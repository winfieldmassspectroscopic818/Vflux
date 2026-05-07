"use strict";

const PanelSynthesis = {
  _running: false,
  _logEl: null,
  _cmdEl: null,

  init() {
    this._logEl = document.getElementById("synth-log");
    this._cmdEl = document.getElementById("synth-cmd-preview");
    document.getElementById("btn-synth-run").addEventListener("click", () => this.run());
    document.getElementById("btn-synth-cancel").addEventListener("click", () => this.cancel());
    document.getElementById("btn-synth-clear").addEventListener("click", () => this.refresh());
    this._bindOptions();
  },

  refresh() {
    this._loadOptions();
    const project = Config.data.project;
    const board = Config.data.board;
    const top = project.top_module || "top";
    document.getElementById("synth-top-module").value = top;
    document.getElementById("synth-top-label").textContent = top;
    document.getElementById("synth-family-label").textContent = board.fpga_family || "未选择板卡";
    document.getElementById("synth-output-label").textContent = this._jsonPath(top);

    if (!project.name || !board.fpga_family) {
      this._cmdEl.textContent = "请先配置工程并选择板卡";
      this._render("ready", "等待工程和板卡", [
        { state: project.name ? "success" : "pending", text: project.name ? "工程已配置" : "请先完成工程配置" },
        { state: board.fpga_family ? "success" : "pending", text: board.fpga_family ? "板卡已选择" : "请先选择目标板卡" },
      ]);
      ToolStepUI.setTechnical("synth", { meta: "尚未满足综合条件", command: this._cmdEl.textContent, log: this._logEl.textContent });
      return;
    }

    this._cmdEl.textContent = this._buildScript(project, board);
    this._render("ready", "可以开始综合", [
      { state: (project.sources || []).length ? "success" : "failed", text: `源文件：${(project.sources || []).length} 个` },
      { state: "success", text: `目标架构：${board.fpga_family}` },
      { state: "pending", text: `将生成 ${this._jsonPath(top)}` },
    ]);
    ToolStepUI.setTechnical("synth", { meta: "等待运行综合", command: `yosys.exe -p "${this._cmdEl.textContent}"`, log: this._logEl.textContent });
  },

  async run() {
    if (this._running) return;
    const project = Config.data.project;
    const board = Config.data.board;
    const top = project.top_module || "top";
    if (!project.sources || !project.sources.length) {
      this._render("failed", "还不能综合", [{ state: "failed", text: "请先在工程页添加 HDL 源文件" }]);
      App.setStatus("综合未开始：缺少源文件");
      return;
    }
    if (!board.fpga_family) {
      this._render("failed", "还不能综合", [{ state: "failed", text: "请先选择目标板卡" }]);
      App.setStatus("综合未开始：未选择板卡");
      return;
    }

    this._running = true;
    this._logEl.textContent = "";
    Pipeline.set("synthesis", "running");
    App.setStatus("综合中...");
    this._render("running", "正在综合设计", [
      { state: "running", text: "读取 HDL 源文件" },
      { state: "running", text: "按高级选项执行优化与映射" },
      { state: "pending", text: "写出综合结果" },
    ]);

    const script = this._buildScript(project, board);
    const commandText = `yosys.exe -p "${script}"`;
    ToolStepUI.setTechnical("synth", { meta: "运行中", command: commandText, log: "" });
    const result = await App.runTool("synthesis", "yosys.exe", ["-p", script], Config.getProjectDir(), (text) => this._appendLog(text));
    this._running = false;
    ToolStepUI.setTechnical("synth", { meta: `退出码：${result.code ?? 0}`, command: commandText, log: this._logEl.textContent });

    if (result.success) {
      await this._saveReports(top);
      Pipeline.set("synthesis", "success");
      this._render("success", "综合完成", [
        { state: "success", text: "HDL 已转换为逻辑网表" },
        { state: "success", text: `已生成 ${this._jsonPath(top)}` },
        { state: "success", text: "下一步可以进入布局布线" },
      ]);
      App.setStatus("综合完成");
    } else {
      Pipeline.set("synthesis", "failed", result.code ? `code:${result.code}` : "");
      Pipeline.resetFrom("pnr");
      this._render("failed", "综合失败", ToolDiagnostics.analyze("synthesis", this._logEl.textContent, { top }));
      App.setStatus("综合失败，请根据提示修改设计");
    }
  },

  cancel() {
    if (!this._running) return;
    App.cancelTool("synthesis");
    this._running = false;
    Pipeline.set("synthesis", "failed");
    this._render("failed", "综合已停止", [{ state: "failed", text: "本次综合没有生成可用于布局布线的网表" }]);
  },

  _buildScript(project, board) {
    const top = project.top_module || "top";
    const family = board.fpga_family;
    const synth = family === "gowin" ? "synth_gowin" : `synth_${family}`;
    const languageFlag = project.language === "sv" ? " -sv" : "";
    const passes = [`read_verilog${languageFlag} ${(project.sources || []).join(" ")}`];
    if (this._checked("synth-opt-proc")) passes.push("proc");
    if (this._checked("synth-opt-flatten")) passes.push("flatten");
    if (this._checked("synth-opt-fsm")) passes.push("fsm");
    if (this._checked("synth-opt-memory")) passes.push("memory");
    if (this._checked("synth-opt-opt")) passes.push("opt");
    if (this._checked("synth-opt-multishare")) passes.push("share -aggressive; opt");
    if (this._checked("synth-opt-splitnets")) passes.push("splitnets -ports");
    const flags = [`-top ${top}`];
    if (!this._checked("synth-opt-abc")) flags.push("-noabc");
    if (this._checked("synth-opt-dff")) flags.push("-dff");
    if (this._checked("synth-opt-retime")) flags.push("-retime");
    if (this._checked("synth-opt-nobram")) flags.push("-nobram");
    if (this._checked("synth-opt-spram")) flags.push("-spram");
    if (this._checked("synth-opt-dsp")) flags.push("-dsp");
    if (this._checked("synth-opt-abc2")) flags.push("-abc2");
    if (this._checked("synth-opt-abc9") && (family === "ice40" || family === "ecp5")) flags.push("-abc9");
    // 专业映射开关：保留 CLI 能力，但默认仍走稳妥流程。
    if (this._checked("synth-opt-noabc9")) flags.push("-noabc9");
    if (this._checked("synth-opt-nocarry")) flags.push("-nocarry");
    if (this._checked("synth-opt-nodffe")) flags.push("-nodffe");
    if (this._checked("synth-opt-no-rw-check")) flags.push("-no-rw-check");
    if (this._checked("synth-opt-no-serdes") && family === "ecp5") flags.push("-no-serdes");
    if (this._checked("synth-opt-dont-use-ram") && family === "gowin") flags.push("-nobram");
    passes.push(`${synth} ${flags.join(" ")} -json ${this._jsonPath(top)}`);
    return passes.join("; ");
  },

  _jsonPath(top) { return `output/synthesis/${top}.json`; },
  _checked(id) { const el = document.getElementById(id); return !!el && el.checked; },
  _appendLog(text) { ToolStepUI.appendHiddenLog(this._logEl, text); },
  _render(kind, summary, items) { ToolStepUI.render("synth-result", "synth-summary", "synth-feedback-list", kind, summary, items); },

  async _saveReports(top) {
    // 保存综合日志，报告中心会从中提炼资源摘要。
    await window.vflux.writeText(ToolStepUI.projectPath(`output/reports/${top}.yosys.log`), this._logEl.textContent || "");
  },

  _bindOptions() {
    const map = this._optionMap();
    for (const [id, key] of Object.entries(map)) {
      document.getElementById(id)?.addEventListener("change", (event) => {
        Config.setFlowValue("synthesis", key, event.target.checked);
        this.refresh();
      });
    }
  },

  _loadOptions() {
    const flow = Config.getFlow("synthesis");
    for (const [id, key] of Object.entries(this._optionMap())) {
      const el = document.getElementById(id);
      if (el) el.checked = !!flow[key];
    }
  },

  _optionMap() {
    return {
      "synth-opt-proc": "proc",
      "synth-opt-opt": "opt",
      "synth-opt-fsm": "fsm",
      "synth-opt-memory": "memory",
      "synth-opt-splitnets": "splitnets",
      "synth-opt-abc": "abc",
      "synth-opt-flatten": "flatten",
      "synth-opt-dff": "dff",
      "synth-opt-retime": "retime",
      "synth-opt-nobram": "nobram",
      "synth-opt-spram": "spram",
      "synth-opt-dsp": "dsp",
      "synth-opt-abc2": "abc2",
      "synth-opt-abc9": "abc9",
      "synth-opt-multishare": "multishare",
      "synth-opt-noabc9": "noabc9",
      "synth-opt-nocarry": "nocarry",
      "synth-opt-nodffe": "nodffe",
      "synth-opt-no-rw-check": "no_rw_check",
      "synth-opt-no-serdes": "no_serdes",
      "synth-opt-dont-use-ram": "dont_use_ram",
    };
  },
};
