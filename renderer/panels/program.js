"use strict";

const PanelProgram = {
  _running: false,
  _logEl: null,
  _cmdEl: null,

  init() {
    this._logEl = document.getElementById("prog-log");
    this._cmdEl = document.getElementById("prog-cmd-preview");
    document.getElementById("btn-prog-diagnose").addEventListener("click", () => this.diagnose());
    document.getElementById("btn-prog-detect").addEventListener("click", () => this._detect());
    document.getElementById("btn-prog-run").addEventListener("click", () => this.run());
    document.getElementById("btn-prog-cancel").addEventListener("click", () => this.cancel());
    document.getElementById("btn-prog-clear").addEventListener("click", () => this.refresh());
    document.getElementById("prog-method").addEventListener("change", (event) => {
      Config.setFlowValue("program", "method", event.target.value);
      this.refresh();
    });
    document.getElementById("btn-prog-browse-mass").addEventListener("click", () => this._browseMassStorage());
    this._bindOptions();
  },

  async refresh() {
    this._loadOptions();
    const project = Config.data.project;
    const board = Config.data.board;
    const top = project.top_module || "top";
    document.getElementById("prog-bitstream-label").textContent = this._binPath(top);
    document.getElementById("prog-mass-storage-dir").value = project.program_target_dir || "";
    if (!board.fpga_family) {
      this._render("ready", "等待板卡和比特流", [
        { state: "pending", text: "请先选择目标板卡" },
        { state: "pending", text: "请先生成比特流文件" },
      ]);
      return;
    }

    const command = this._buildProgramCommand(project, board);
    this._cmdEl.textContent = command.tool ? `${command.tool} ${command.args.join(" ")}` : command.label;
    const bitstreamReady = await ToolStepUI.existsInProject(this._binPath(top));
    this._render("ready", "可以检测设备", [
      { state: "success", text: `目标板卡：${board.name || board.fpga_family}` },
      { state: "success", text: `烧录方式：${command.label}` },
      { state: bitstreamReady ? "success" : "failed", text: bitstreamReady ? `比特流已就绪：${this._binPath(top)}` : "还没有找到比特流，请先生成 .bin 文件" },
      { state: "pending", text: command.method === "dfu" ? "DFU 下载后设备短暂消失通常是正常重启" : "确认开发板供电和连接方式正确" },
    ]);
    ToolStepUI.setTechnical("prog", { meta: "等待烧录", command: this._cmdEl.textContent, log: this._logEl.textContent });
  },

  async _detect() {
    this._logEl.textContent = "";
    const board = Config.data.board;
    if (!board.fpga_family) {
      this._render("failed", "还不能检测", [{ state: "failed", text: "请先选择目标板卡" }]);
      return;
    }

    const badge = document.getElementById("prog-device-status");
    badge.textContent = "检测中...";
    badge.className = "status-badge unknown";
    const detect = this._buildDetectCommand(board);
    if (detect.method === "mass-storage") {
      const dir = this._massStorageDir();
      const ok = !!dir && await window.vflux.fileExists(dir);
      badge.textContent = ok ? "已选择盘符" : "未选择盘符";
      badge.className = ok ? "status-badge connected" : "status-badge disconnected";
      this._render(ok ? "success" : "failed", ok ? "拖拽烧录目录可用" : "还没有选择开发板盘符", [
        { state: ok ? "success" : "failed", text: ok ? `将复制到：${dir}` : "请选择开发板暴露出的可移动盘目录" },
        { state: "pending", text: "这种方式适合手动拖拽 .bin 可成功烧录的 iCESugar 工作流" },
      ]);
      ToolStepUI.setTechnical("prog", { meta: "盘符检测", command: detect.label, log: ok ? `目标目录存在：${dir}` : "目标目录未设置或不存在" });
      return;
    }

    this._render("running", "正在检测开发板", [
      { state: "running", text: `使用 ${detect.label} 检测连接` },
      { state: "pending", text: "确认 USB、驱动和供电状态" },
    ]);
    const commandText = `${detect.tool} ${detect.args.join(" ")}`;
    ToolStepUI.setTechnical("prog", { meta: "检测中", command: commandText, log: "" });
    const result = await App.runTool("prog-detect", detect.tool, detect.args, Config.getProjectDir(), (text) => this._appendLog(text));
    ToolStepUI.setTechnical("prog", { meta: `检测退出码：${result.code ?? 0}`, command: commandText, log: this._logEl.textContent });
    const connected = this._isDetectSuccess(result, this._logEl.textContent, detect);
    if (connected) {
      badge.textContent = "已连接";
      badge.className = "status-badge connected";
      this._render("success", "开发板已连接", [
        { state: "success", text: `${board.name || "开发板"} 已被 ${detect.label} 识别` },
        { state: "success", text: "可以开始烧录" },
      ]);
    } else {
      badge.textContent = "未检测到";
      badge.className = "status-badge disconnected";
      this._render("failed", "没有检测到开发板", ToolDiagnostics.analyze(detect.method === "dfu" ? "dfu" : "program", this._logEl.textContent));
    }
  },

  async diagnose() {
    const project = Config.data.project;
    const board = Config.data.board;
    const top = project.top_module || "top";
    const method = this._selectedMethod(board);
    const bitstream = this._binPath(top);
    const items = [];
    const cards = [];

    const add = (key, title, state, detail) => {
      cards.push({ key, title, state, detail });
      items.push({ state: state === "ok" ? "success" : state === "warn" ? "pending" : "failed", text: `${title}：${detail}` });
    };

    add("board", "目标板卡", board.fpga_family ? "ok" : "bad", board.fpga_family ? `${board.name || board.fpga_family} / ${board.fpga_device || "-"}` : "尚未选择板卡");
    add("bitstream", "比特流文件", await ToolStepUI.existsInProject(bitstream) ? "ok" : "bad", await ToolStepUI.existsInProject(bitstream) ? bitstream : `缺少 ${bitstream}`);
    add("method", "烧录方式", "ok", this._programAdvice(method, board));

    if (method === "mass-storage") {
      const dir = this._massStorageDir();
      add("target", "拖拽盘符", dir && await window.vflux.fileExists(dir) ? "ok" : "bad", dir ? `目标目录：${dir}` : "还没有选择开发板盘符目录");
    } else {
      const detect = this._buildDetectCommand(board);
      this._logEl.textContent = "";
      this._render("running", "正在执行烧录诊断", [
        { state: "running", text: `检测 ${detect.label} 连接状态` },
        { state: "pending", text: "诊断结果会保存到 output/reports/program-diagnostic.json" },
      ]);
      const result = await App.runTool("program-diagnose", detect.tool, detect.args, Config.getProjectDir(), (text) => this._appendLog(text));
      const connected = this._isDetectSuccess(result, this._logEl.textContent, detect);
      add("device", "设备连接", connected ? "ok" : "bad", connected ? `${detect.label} 已识别开发板` : this._diagnoseFailureHint(method, this._logEl.textContent));
    }

    const report = {
      schema: 1,
      created_at: new Date().toISOString(),
      board: { name: board.name || "", family: board.fpga_family || "", device: board.fpga_device || "" },
      method,
      bitstream,
      cards,
      log: this._logEl.textContent || "",
    };
    await window.vflux.writeText(ToolStepUI.projectPath("output/reports/program-diagnostic.json"), JSON.stringify(report, null, 2));
    this._renderDiagnosticCards(cards);
    const ok = cards.every((card) => card.state === "ok");
    this._render(ok ? "success" : "failed", ok ? "烧录诊断通过" : "烧录诊断发现问题", items);
    ToolStepUI.setTechnical("prog", { meta: "烧录诊断", command: "program diagnose", log: JSON.stringify(report, null, 2) });
    App.setStatus(ok ? "烧录诊断通过" : "烧录诊断发现问题");
  },

  async run() {
    if (this._running) return;
    const project = Config.data.project;
    const board = Config.data.board;
    const top = project.top_module || "top";
    if (!board.fpga_family) {
      this._render("failed", "还不能烧录", [{ state: "failed", text: "请先选择目标板卡" }]);
      App.setStatus("烧录未开始：未选择板卡");
      return;
    }
    if (!(await ToolStepUI.existsInProject(this._binPath(top)))) {
      this._render("failed", "还不能烧录", [{ state: "failed", text: `找不到 ${this._binPath(top)}，请先生成比特流` }]);
      App.setStatus("烧录未开始：缺少比特流文件");
      return;
    }

    this._running = true;
    this._logEl.textContent = "";
    Pipeline.set("program", "running");
    App.setStatus("烧录中...");
    const command = this._buildProgramCommand(project, board);
    if (command.method === "mass-storage") {
      await this._copyToMassStorage(top);
      return;
    }
    if (!this._checked("prog-opt-skip-detect")) {
      const detect = this._buildDetectCommand(board);
      const detectText = `${detect.tool} ${detect.args.join(" ")}`;
      this._render("running", "正在进行烧录前检测", [
        { state: "running", text: `使用 ${detect.label} 确认开发板连接` },
        { state: "pending", text: "如果你的板卡会在烧录瞬间重枚举，可以勾选跳过预检测" },
      ]);
      ToolStepUI.setTechnical("prog", { meta: "烧录前检测", command: detectText, log: "" });
      const detected = await App.runTool("program-pre-detect", detect.tool, detect.args, Config.getProjectDir(), (text) => this._appendLog(text));
      if (!this._isDetectSuccess(detected, this._logEl.textContent, detect)) {
        this._running = false;
        Pipeline.set("program", "failed");
        ToolStepUI.setTechnical("prog", { meta: `预检测失败，退出码：${detected.code ?? 0}`, command: detectText, log: this._logEl.textContent });
        this._render("failed", "烧录前没有检测到开发板", ToolDiagnostics.analyze(detect.method === "dfu" ? "dfu" : "program", this._logEl.textContent));
        App.setStatus("烧录未开始：预检测未通过");
        return;
      }
      this._logEl.textContent = "";
    }

    this._render("running", "正在烧录开发板", [
      { state: "running", text: "读取比特流文件" },
      { state: "running", text: "写入 FPGA、Flash 或 DFU 目标" },
      { state: "pending", text: "DFU 模式下设备可能会断开并重新枚举" },
    ]);
    const commandText = `${command.tool} ${command.args.join(" ")}`;
    ToolStepUI.setTechnical("prog", { meta: "运行中", command: commandText, log: "" });
    const result = await App.runTool("program", command.tool, command.args, Config.getProjectDir(), (text) => this._appendLog(text));
    this._running = false;
    ToolStepUI.setTechnical("prog", { meta: `退出码：${result.code ?? 0}`, command: commandText, log: this._logEl.textContent });
    const dfuSoftSuccess = command.method === "dfu" && /Download\s+done|File downloaded successfully|state\(.*MANIFEST/i.test(this._logEl.textContent);
    if (result.success || dfuSoftSuccess) {
      Pipeline.set("program", "success");
      this._render("success", dfuSoftSuccess ? "DFU 下载已完成，设备正在重启" : "烧录完成", [
        { state: "success", text: "比特流已发送到开发板" },
        { state: "success", text: command.method === "dfu" ? "DFU 设备消失通常表示已离开下载模式" : "如果板卡已上电，设计应开始运行" },
      ]);
      App.setStatus("烧录完成");
    } else {
      Pipeline.set("program", "failed");
      this._render("failed", "烧录失败", ToolDiagnostics.analyze(command.method === "dfu" ? "dfu" : "program", this._logEl.textContent));
      App.setStatus("烧录失败，请根据提示检查连接和比特流");
    }
  },

  cancel() {
    if (!this._running) return;
    App.cancelTool("program");
    this._running = false;
    Pipeline.set("program", "failed");
    this._render("failed", "烧录已停止", [{ state: "failed", text: "烧录过程中断，建议重新检测设备后再试" }]);
  },

  _selectedMethod(board) {
    const method = document.getElementById("prog-method").value;
    if (method !== "board") return method;
    const tool = (board.program_tool || "").toLowerCase();
    if (tool.includes("icesprog")) return "icesprog";
    if (tool.includes("openfpgaloader")) return "openfpgaloader";
    if (tool.includes("ecpprog")) return "ecpprog";
    if (tool.includes("dfu")) return "dfu";
    return board.fpga_family === "ice40" ? "icesprog" : "openfpgaloader";
  },

  _buildProgramCommand(project, board) {
    const bitstream = this._binPath(project.top_module || "top");
    const method = this._selectedMethod(board);
    if (method === "icesprog") return { tool: "icesprog.exe", args: [bitstream], label: "icesprog", method };
    if (method === "mass-storage") return { tool: "", args: [], label: "复制到开发板盘符", method };
    if (method === "dfu") {
      const args = this._checked("prog-opt-dfu-alt") ? ["-a", "0", "-D", bitstream] : ["-D", bitstream];
      return { tool: "dfu-util.exe", args, label: "DFU", method };
    }
    if (method === "jtag") return { tool: "openFPGALoader.exe", args: this._openFpgaLoaderArgs(board, bitstream, "jtag"), label: "openFPGALoader JTAG", method };
    if (method === "ecpprog") return { tool: "ecpprog.exe", args: [bitstream], label: "ecpprog", method };
    const args = this._openFpgaLoaderArgs(board, bitstream);
    const boardName = this._value("prog-opt-board") || this._openFpgaLoaderBoardName(board);
    return { tool: "openFPGALoader.exe", args, label: boardName ? `openFPGALoader (${boardName})` : "openFPGALoader", method };
  },

  _openFpgaLoaderArgs(board, bitstream, forcedCable = "") {
    const args = [];
    const boardName = this._value("prog-opt-board") || this._openFpgaLoaderBoardName(board);
    const cable = forcedCable || this._value("prog-opt-cable");
    if (boardName) args.push("-b", boardName);
    if (cable) args.push("--cable", cable);
    if (this._checked("prog-opt-flash")) args.push("--write-flash");
    if (this._checked("prog-opt-external-flash")) args.push("--external-flash");
    if (this._checked("prog-opt-verify")) args.push("--verify");
    if (this._checked("prog-opt-reset")) args.push("--reset");
    if (this._value("prog-opt-frequency")) args.push("--freq", this._value("prog-opt-frequency"));
    if (this._value("prog-opt-offset")) args.push("--offset", this._value("prog-opt-offset"));
    args.push(bitstream);
    return args;
  },

  _buildDetectCommand(board) {
    const method = this._selectedMethod(board);
    if (method === "mass-storage") return { tool: "", args: [], label: "开发板盘符", method };
    if (method === "icesprog") return { tool: "lsftdi.exe", args: [], label: "FTDI/lsftdi", method };
    if (method === "ecpprog") return { tool: "ecpprog.exe", args: ["-t"], label: "ecpprog", method };
    if (method === "dfu") return { tool: "dfu-util.exe", args: ["-l"], label: "DFU", method };
    return { tool: "openFPGALoader.exe", args: ["--detect"], label: "openFPGALoader", method };
  },

  _openFpgaLoaderBoardName(board) {
    const name = (board.name || "").toLowerCase();
    if (name.includes("tang nano 9k")) return "tangnano9k";
    if (name.includes("tang nano 20k")) return "tangnano20k";
    if (name.includes("icebreaker")) return "ice40_generic";
    return "";
  },

  _isDetectSuccess(result, log, detect) {
    if (detect.method === "icesprog") return result.success && /ftdi|0403:|6010|6014|channel|description|serial/i.test(log);
    if (detect.method === "dfu") return result.success && /Found DFU|dfu/i.test(log);
    if (detect.method === "ecpprog") return result.success;
    return result.success && /found|jtag|device|cable|idcode/i.test(log);
  },

  _programAdvice(method, board) {
    if (method === "dfu") return "DFU 设备在下载后短暂消失通常是重新枚举，不一定是失败";
    if (method === "mass-storage") return "适合手动拖拽 .bin 可成功的板卡，可绕开命令行烧录器";
    if (method === "icesprog") return "需要 FTDI 驱动可见，适合 iCE40/FTDI 工作流";
    if (method === "openfpgaloader") return `openFPGALoader${board.name ? ` / ${board.name}` : ""}`;
    if (method === "ecpprog") return "适合 ECP5 JTAG/SPI Flash 工作流";
    return method || "板卡默认";
  },

  _diagnoseFailureHint(method, log) {
    if (method === "dfu") return /No DFU capable/i.test(log) ? "没有找到 DFU 设备：请确认板卡进入 DFU/Bootloader 模式" : "DFU 未识别：检查驱动、Boot 键和 USB 数据线";
    if (method === "icesprog") return "FTDI 未识别：如果拖拽烧录可用，可改用“拖拽盘符”方式；否则检查驱动和 USB 接口";
    if (method === "openfpgaloader") return "openFPGALoader 未识别：检查 board/cable 参数、JTAG 线序和驱动";
    return "设备未识别，请检查供电、驱动、线缆和烧录模式";
  },

  _renderDiagnosticCards(cards) {
    const el = document.getElementById("prog-diagnostic-grid");
    if (!el) return;
    el.innerHTML = (cards || []).map((card) => `
      <div class="diagnostic-card ${card.state}">
        <span>${ToolStepUI.escape(card.title)}</span>
        <strong>${ToolStepUI.escape(card.state === "ok" ? "通过" : card.state === "warn" ? "注意" : "处理")}</strong>
        <p>${ToolStepUI.escape(card.detail)}</p>
      </div>
    `).join("");
  },

  _binPath(top) {
    const family = Config.data.board.fpga_family;
    if (family === "ecp5") return `output/bitstream/${top}.bit`;
    if (family === "gowin") return `output/bitstream/${top}.fs`;
    return `output/bitstream/${top}.bin`;
  },
  _massStorageDir() { return document.getElementById("prog-mass-storage-dir").value.trim(); },
  _checked(id) { const el = document.getElementById(id); return !!el && el.checked; },
  _value(id) { return document.getElementById(id)?.value.trim() || ""; },
  _appendLog(text) { ToolStepUI.appendHiddenLog(this._logEl, text); },
  _render(kind, summary, items) { ToolStepUI.render("prog-result", "prog-summary", "prog-feedback-list", kind, summary, items); },

  _bindOptions() {
    const map = { "prog-opt-verify": "verify", "prog-opt-flash": "flash", "prog-opt-external-flash": "external_flash", "prog-opt-reset": "reset", "prog-opt-dfu-alt": "dfu_alt", "prog-opt-skip-detect": "skip_detect" };
    for (const [id, key] of Object.entries(map)) {
      document.getElementById(id)?.addEventListener("change", (event) => {
        Config.setFlowValue("program", key, event.target.checked);
        this.refresh();
      });
    }
    const textInputs = { "prog-opt-cable": "cable", "prog-opt-board": "board_override", "prog-opt-frequency": "frequency", "prog-opt-offset": "offset" };
    for (const [id, key] of Object.entries(textInputs)) {
      document.getElementById(id)?.addEventListener("input", (event) => {
        Config.setFlowValue("program", key, event.target.value);
        this.refresh();
      });
    }
  },

  _loadOptions() {
    const flow = Config.getFlow("program");
    const method = document.getElementById("prog-method");
    if (method) method.value = flow.method || "board";
    const values = {
      "prog-opt-verify": !!flow.verify,
      "prog-opt-flash": !!flow.flash,
      "prog-opt-external-flash": !!flow.external_flash,
      "prog-opt-reset": !!flow.reset,
      "prog-opt-dfu-alt": flow.dfu_alt !== false,
      "prog-opt-skip-detect": !!flow.skip_detect,
    };
    for (const [id, checked] of Object.entries(values)) {
      const el = document.getElementById(id);
      if (el) el.checked = checked;
    }
    const texts = {
      "prog-opt-cable": flow.cable || "",
      "prog-opt-board": flow.board_override || "",
      "prog-opt-frequency": flow.frequency || "",
      "prog-opt-offset": flow.offset || "",
    };
    for (const [id, value] of Object.entries(texts)) {
      const el = document.getElementById(id);
      if (el) el.value = value;
    }
  },

  async _browseMassStorage() {
    const result = await window.vflux.openDirectoryDialog({ title: "选择开发板盘符或拖拽烧录目录" });
    if (result.canceled || !result.filePaths?.[0]) return;
    document.getElementById("prog-mass-storage-dir").value = result.filePaths[0];
    Config.data.project.program_target_dir = result.filePaths[0];
    Config._dirty = true;
    this.refresh();
  },

  async _copyToMassStorage(top) {
    const source = ToolStepUI.projectPath(this._binPath(top));
    const targetDir = this._massStorageDir();
    if (!targetDir) {
      this._running = false;
      Pipeline.set("program", "failed");
      this._render("failed", "还没有选择开发板盘符", [
        { state: "failed", text: "请选择开发板暴露出的可移动盘目录后再复制" },
      ]);
      App.setStatus("烧录未开始：缺少开发板盘符");
      return;
    }
    Config.data.project.program_target_dir = targetDir;
    Config._dirty = true;
    this._render("running", "正在复制比特流", [
      { state: "running", text: `复制 ${this._binPath(top)} 到开发板盘符` },
      { state: "pending", text: "复制完成后开发板可能会自动重启并短暂断开" },
    ]);
    ToolStepUI.setTechnical("prog", { meta: "复制到开发板盘符", command: `copy ${source} -> ${targetDir}`, log: "" });
    const result = await window.vflux.copyFileToDirectory(source, targetDir);
    this._running = false;
    ToolStepUI.setTechnical("prog", { meta: result.success ? "复制完成" : "复制失败", command: `copy ${source} -> ${targetDir}`, log: result.success ? `目标文件：${result.target}` : (result.reason || "") });
    if (result.success) {
      Pipeline.set("program", "success");
      this._render("success", "比特流已复制到开发板", [
        { state: "success", text: `目标文件：${result.target}` },
        { state: "success", text: "如果开发板自动重启或盘符短暂消失，这是正常烧录行为" },
      ]);
      App.setStatus("拖拽盘符烧录完成");
    } else {
      Pipeline.set("program", "failed");
      this._render("failed", "复制烧录失败", [
        { state: "failed", text: result.reason || "无法写入开发板盘符" },
        { state: "pending", text: "请确认开发板处于可拖拽烧录模式，且目标盘符没有被占用" },
      ]);
      App.setStatus("拖拽盘符烧录失败");
    }
  },
};
