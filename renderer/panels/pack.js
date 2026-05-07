"use strict";

const PanelPack = {
  _running: false,
  _logEl: null,
  _cmdEl: null,

  init() {
    this._logEl = document.getElementById("pack-log");
    this._cmdEl = document.getElementById("pack-cmd-preview");
    document.getElementById("btn-pack-run").addEventListener("click", () => this.run());
    document.getElementById("btn-pack-cancel").addEventListener("click", () => this.cancel());
    document.getElementById("btn-pack-clear").addEventListener("click", () => this.refresh());
    this._bindOptions();
  },

  async refresh() {
    this._loadOptions();
    if (PanelToolchain?.applyFeatureState) PanelToolchain.applyFeatureState();
    const project = Config.data.project;
    const board = Config.data.board;
    const top = project.top_module || "top";
    document.getElementById("pack-input-label").textContent = this._ascPath(top);
    document.getElementById("pack-bitstream-label").textContent = this._binPath(top);
    document.getElementById("pack-board-label").textContent = board.name || board.fpga_family || "未选择板卡";
    document.getElementById("pack-next-label").textContent = "烧录到开发板";

    if (!board.fpga_family) {
      this._render("ready", "等待板卡和布局结果", [
        { state: "pending", text: "请先选择目标板卡" },
        { state: "pending", text: "请先完成布局布线" },
      ]);
      return;
    }

    const ascReady = await ToolStepUI.existsInProject(this._ascPath(top));
    const command = this._buildCommand(project, board);
    this._cmdEl.textContent = `${command.tool} ${command.args.join(" ")}`;
    this._render("ready", ascReady ? "可以生成比特流" : "缺少布局文件", [
      { state: ascReady ? "success" : "failed", text: ascReady ? `布局文件已就绪：${this._ascPath(top)}` : `找不到 ${this._ascPath(top)}，请先完成布局布线` },
      { state: "success", text: `目标板卡：${board.name || board.fpga_family}` },
      { state: "pending", text: `生成后得到 ${this._binPath(top)}` },
    ]);
    ToolStepUI.setTechnical("pack", { meta: "等待生成比特流", command: this._cmdEl.textContent, log: this._logEl.textContent });
  },

  async run() {
    if (this._running) return;
    const project = Config.data.project;
    const board = Config.data.board;
    const top = project.top_module || "top";
    if (!board.fpga_family) {
      this._render("failed", "还不能生成比特流", [{ state: "failed", text: "请先选择目标板卡" }]);
      App.setStatus("比特流未生成：未选择板卡");
      return;
    }
    if (!(await ToolStepUI.existsInProject(this._ascPath(top)))) {
      this._render("failed", "还不能生成比特流", [{ state: "failed", text: `缺少 ${this._ascPath(top)}，请先完成布局布线` }]);
      App.setStatus("比特流未生成：缺少布局文件");
      return;
    }

    this._running = true;
    this._logEl.textContent = "";
    Pipeline.set("pack", "running");
    App.setStatus("生成比特流中...");
    this._render("running", "正在生成比特流", [
      { state: "running", text: "读取布局布线结果" },
      { state: "running", text: "按高级选项打包 bitstream" },
      { state: "pending", text: "写出最终产物" },
    ]);

    const command = this._buildCommand(project, board);
    const commandText = `${command.tool} ${command.args.join(" ")}`;
    ToolStepUI.setTechnical("pack", { meta: "运行中", command: commandText, log: "" });
    const result = await App.runTool("pack", command.tool, command.args, Config.getProjectDir(), (text) => this._appendLog(text));
    this._running = false;
    ToolStepUI.setTechnical("pack", { meta: `退出码：${result.code ?? 0}`, command: commandText, log: this._logEl.textContent });

    if (result.success) {
      if (this._checked("pack-opt-metadata")) await this._writeMetadata(project, board);
      if (this._checked("pack-opt-verify-unpack") && board.fpga_family === "ice40") await this._verifyUnpack(top);
      if (this._checked("pack-opt-vlog") && board.fpga_family === "ice40") await this._writeReverseVlog(top);
      if (this._checked("pack-opt-html") && board.fpga_family === "ice40") await this._writeFloorplanHtml(top);
      if (this._checked("pack-opt-open-folder")) await window.vflux.shellOpenDir(ToolStepUI.projectPath("output/bitstream"));
      Pipeline.set("pack", "success");
      this._render("success", "比特流已生成", [
        { state: "success", text: `最终产物：${this._binPath(top)}` },
        { state: "success", text: "可以进入烧录页下载到开发板" },
        { state: "success", text: "也可以先查看报告和时序分析" },
      ]);
      App.setStatus("比特流生成完成");
    } else {
      Pipeline.set("pack", "failed", result.code ? `code:${result.code}` : "");
      Pipeline.resetFrom("timing");
      this._render("failed", "比特流生成失败", ToolDiagnostics.analyze("pack", this._logEl.textContent, { top }));
      App.setStatus("比特流生成失败，请根据提示检查上一步结果");
    }
  },

  cancel() {
    if (!this._running) return;
    App.cancelTool("pack");
    this._running = false;
    Pipeline.set("pack", "failed");
    this._render("failed", "比特流生成已停止", [{ state: "failed", text: "本次没有生成可烧录文件" }]);
  },

  _buildCommand(project, board) {
    const top = project.top_module || "top";
    const input = this._ascPath(top);
    const bitstream = this._binPath(top);
    if (board.fpga_family === "ice40") return { tool: "icepack.exe", args: [input, bitstream] };
    if (board.fpga_family === "ecp5") {
      const args = [input, bitstream];
      if (this._checked("pack-opt-compress")) args.unshift("--compress");
      if (this._checked("pack-opt-crc")) args.unshift("--crc");
      if (this._checked("pack-opt-flash")) args.unshift("--flash");
      if (this._checked("pack-opt-background")) args.unshift("--background");
      if (this._checked("pack-opt-svf")) args.unshift("--svf", `output/bitstream/${top}.svf`);
      if (this._value("pack-opt-freq")) args.unshift("--freq", this._value("pack-opt-freq"));
      if (this._value("pack-opt-idcode")) args.unshift("--idcode", this._value("pack-opt-idcode"));
      if (this._checked("pack-opt-encrypt") && this._value("pack-opt-key")) args.unshift("--key", this._value("pack-opt-key"));
      return { tool: "ecppack.exe", args };
    }
    const args = ["-d", board.fpga_device, "-o", bitstream, input];
    if (this._checked("pack-opt-compress")) args.unshift("--compress");
    if (this._checked("pack-opt-crc")) args.unshift("--crc");
    if (this._checked("pack-opt-encrypt") && this._value("pack-opt-key")) args.unshift("--key", this._value("pack-opt-key"));
    return { tool: "gowin_pack.exe", args };
  },

  async _writeMetadata(project, board) {
    const top = project.top_module || "top";
    const content = JSON.stringify({ project: project.name, top, board: board.name, generated_at: new Date().toISOString() }, null, 2);
    await window.vflux.writeText(ToolStepUI.projectPath(`output/bitstream/${top}.metadata.json`), content);
  },

  async _verifyUnpack(top) {
    await App.runTool("pack-unpack", "iceunpack.exe", [this._binPath(top), `output/bitstream/${top}.unpacked.asc`], Config.getProjectDir(), (text) => this._appendLog(text));
  },

  async _writeReverseVlog(top) {
    const before = this._logEl.textContent.length;
    const target = `output/reports/${top}.icebox.v`;
    await App.runTool("pack-vlog", "icebox_vlog.exe", [this._ascPath(top)], Config.getProjectDir(), (text) => this._appendLog(text));
    const generated = this._logEl.textContent.slice(before);
    if (generated.trim()) await window.vflux.writeText(ToolStepUI.projectPath(target), generated);
  },

  async _writeFloorplanHtml(top) {
    const before = this._logEl.textContent.length;
    const target = `output/reports/${top}.floorplan.html`;
    await App.runTool("pack-html", "icebox_html.exe", [this._ascPath(top)], Config.getProjectDir(), (text) => this._appendLog(text));
    const generated = this._logEl.textContent.slice(before);
    if (generated.trim()) await window.vflux.writeText(ToolStepUI.projectPath(target), generated);
  },

  _ascPath(top) { return `output/pnr/${top}.asc`; },
  _binPath(top) {
    const family = Config.data.board.fpga_family;
    if (family === "ecp5") return `output/bitstream/${top}.bit`;
    if (family === "gowin") return `output/bitstream/${top}.fs`;
    return `output/bitstream/${top}.bin`;
  },
  _checked(id) { const el = document.getElementById(id); return !!el && el.checked; },
  _value(id) { return document.getElementById(id)?.value.trim() || ""; },
  _appendLog(text) { ToolStepUI.appendHiddenLog(this._logEl, text); },
  _render(kind, summary, items) { ToolStepUI.render("pack-result", "pack-summary", "pack-feedback-list", kind, summary, items); },

  _bindOptions() {
    const map = { "pack-opt-compress": "compress", "pack-opt-crc": "crc", "pack-opt-verify-crc": "verify_crc", "pack-opt-encrypt": "encrypt", "pack-opt-svf": "svf", "pack-opt-flash": "flash", "pack-opt-background": "background", "pack-opt-verify-unpack": "verify_unpack", "pack-opt-metadata": "metadata", "pack-opt-open-folder": "open_folder", "pack-opt-vlog": "vlog", "pack-opt-html": "html" };
    for (const [id, key] of Object.entries(map)) {
      document.getElementById(id)?.addEventListener("change", (event) => {
        Config.setFlowValue("pack", key, event.target.checked);
        this.refresh();
      });
    }
    const textInputs = { "pack-opt-freq": "freq", "pack-opt-idcode": "idcode", "pack-opt-key": "key" };
    for (const [id, key] of Object.entries(textInputs)) {
      document.getElementById(id)?.addEventListener("input", (event) => {
        Config.setFlowValue("pack", key, event.target.value);
        this.refresh();
      });
    }
  },

  _loadOptions() {
    const flow = Config.getFlow("pack");
    const values = {
      "pack-opt-compress": !!flow.compress,
      "pack-opt-crc": !!flow.crc,
      "pack-opt-verify-crc": !!flow.verify_crc,
      "pack-opt-encrypt": !!flow.encrypt,
      "pack-opt-svf": !!flow.svf,
      "pack-opt-flash": !!flow.flash,
      "pack-opt-background": !!flow.background,
      "pack-opt-verify-unpack": !!flow.verify_unpack,
      "pack-opt-metadata": !!flow.metadata,
      "pack-opt-open-folder": !!flow.open_folder,
      "pack-opt-vlog": !!flow.vlog,
      "pack-opt-html": !!flow.html,
    };
    for (const [id, checked] of Object.entries(values)) {
      const el = document.getElementById(id);
      if (el) el.checked = checked;
    }
    const texts = { "pack-opt-freq": flow.freq || "", "pack-opt-idcode": flow.idcode || "", "pack-opt-key": flow.key || "" };
    for (const [id, value] of Object.entries(texts)) {
      const el = document.getElementById(id);
      if (el) el.value = value;
    }
  },
};
