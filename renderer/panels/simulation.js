"use strict";

const PanelSimulation = {
  _running: false,
  _logEl: null,
  _cmdEl: null,

  init() {
    this._logEl = document.getElementById("sim-log");
    this._cmdEl = document.getElementById("sim-cmd-preview");
    document.getElementById("sim-engine").addEventListener("change", () => this.refresh());
    document.getElementById("sim-tb-file").addEventListener("input", (event) => {
      Config.setFlowValue("simulation", "testbench", event.target.value);
      this.refresh();
    });
    document.getElementById("btn-add-tb").addEventListener("click", () => this._browseTb());
    document.getElementById("btn-sim-run").addEventListener("click", () => this.run());
    document.getElementById("btn-sim-wave").addEventListener("click", () => this._openWave());
    document.getElementById("btn-sim-cancel").addEventListener("click", () => this.cancel());
    document.getElementById("btn-sim-clear").addEventListener("click", () => this.refresh());
    this._bindOptions();
  },

  refresh() {
    this._loadOptions();
    const command = this._buildCommand();
    this._cmdEl.textContent = command.text;
    const sources = Config.data.project.sources || [];
    this._render("ready", "可以运行仿真", [
      { state: sources.length ? "success" : "failed", text: `源文件：${sources.length} 个` },
      { state: document.getElementById("sim-tb-file").value.trim() ? "success" : "pending", text: "Testbench 可选，复杂仿真建议指定" },
      { state: "pending", text: "失败时可展开技术详情查看仿真器原始输出" },
    ]);
    ToolStepUI.setTechnical("sim", { meta: "等待运行仿真", command: command.text, log: this._logEl.textContent });
  },

  async _browseTb() {
    const result = await window.vflux.openFileDialog({
      title: "选择 Testbench 文件",
      filters: [{ name: "HDL Files", extensions: ["v", "sv", "vhd", "vhdl"] }, { name: "All Files", extensions: ["*"] }],
    });
    if (result?.filePaths?.[0]) {
      document.getElementById("sim-tb-file").value = result.filePaths[0];
      Config.setFlowValue("simulation", "testbench", result.filePaths[0]);
      this.refresh();
    }
  },

  async run() {
    if (this._running) return;
    const sources = Config.data.project.sources || [];
    if (!sources.length) {
      this._render("failed", "还不能仿真", [{ state: "failed", text: "请先在工程页添加 HDL 源文件" }]);
      App.setStatus("仿真未开始：缺少源文件");
      return;
    }

    this._running = true;
    this._logEl.textContent = "";
    Pipeline.set("simulation", "running");
    App.setStatus("仿真中...");
    this._render("running", "正在运行仿真", [
      { state: "running", text: "编译仿真输入" },
      { state: "pending", text: "运行 testbench 并生成反馈" },
    ]);

    const engine = document.getElementById("sim-engine").value;
    const command = this._buildCommand();
    ToolStepUI.setTechnical("sim", { meta: "运行中", command: command.text, log: "" });
    let ok = false;
    if (engine === "iverilog") {
      const compile = await App.runTool("sim-compile", "iverilog.exe", command.args, Config.getProjectDir(), (t) => this._appendLog(t));
      if (compile.success) {
        const run = await App.runTool("sim-run", "vvp.exe", [this._outputFile()], Config.getProjectDir(), (t) => this._appendLog(t));
        ok = run.success;
      }
    } else if (engine === "verilator") {
      const run = await App.runTool("sim-verilator", "verilator.exe", command.args, Config.getProjectDir(), (t) => this._appendLog(t));
      ok = run.success;
    } else {
      ok = await this._openWave();
    }

    this._running = false;
    const waveFile = ok ? await this._findWaveFile() : "";
    ToolStepUI.setTechnical("sim", { meta: ok ? "仿真完成" : "仿真失败", command: command.text, log: this._logEl.textContent });
    Pipeline.set("simulation", ok ? "success" : "failed");
    this._render(ok ? "success" : "failed", ok ? "仿真完成" : "仿真失败", ok ? [
      { state: "success", text: "仿真工具已完成运行" },
      { state: waveFile ? "success" : "pending", text: waveFile ? `可打开波形：${waveFile}` : (this._checked("sim-opt-wave") ? "仿真完成，但没有发现 VCD/FST 波形产物；请确认 Testbench 写出了 $dumpfile/$dumpvars。" : "当前未要求生成波形") },
    ] : ToolDiagnostics.analyze("simulation", this._logEl.textContent));
    App.setStatus(ok ? "仿真完成" : "仿真失败，请检查 Testbench 和源文件");
    if (PanelDashboard) PanelDashboard.refresh();
  },

  async _openWave() {
    const wave = await this._findWaveFile();
    if (!wave) {
      this._render("failed", "还没有可打开的波形", [
        { state: "failed", text: "没有找到 output/simulation 下的 VCD 或 FST 波形文件" },
        { state: "pending", text: "请先运行仿真，并确认 Testbench 中写出了 VCD 波形" },
      ]);
      return false;
    }
    const full = ToolStepUI.projectPath(wave);
    if (!(await window.vflux.fileExists(full))) {
      this._render("failed", "还没有可打开的波形", [
        { state: "failed", text: `没有找到 ${wave}` },
        { state: "pending", text: "请先运行仿真，并确认 Testbench 中写出了 VCD 波形" },
      ]);
      return false;
    }

    // Windows 上 GTKWave 偶尔会 assertion failed，优先使用 OSS CAD Suite 自带 Surfer。
    let result = await App.runTool("sim-wave-surfer", "surfer.exe", [wave], Config.getProjectDir(), (t) => this._appendLog(t));
    if (result.success) return true;

    result = await App.runTool("sim-wave-gtkwave", "gtkwave.exe", [wave], Config.getProjectDir(), (t) => this._appendLog(t));
    if (!result.success) {
      this._render("failed", "波形查看器启动失败", [
        { state: "failed", text: "Surfer 和 GTKWave 都没有成功打开波形" },
        { state: "pending", text: `可以切到波形查看工作台，手动选择 ${wave}` },
      ]);
    }
    return result.success;
  },

  async _findWaveFile() {
    const dir = ToolStepUI.projectPath("output/simulation");
    try {
      const files = await window.vflux.listDir(dir);
      const preferred = ["dump.vcd", "wave.vcd", "sim.vcd", "dump.fst", "wave.fst", "sim.fst"];
      const foundPreferred = preferred.find((name) => files.includes(name));
      if (foundPreferred) return `output/simulation/${foundPreferred}`;
      const found = files.find((name) => /\.(vcd|fst)$/i.test(name));
      return found ? `output/simulation/${found}` : "";
    } catch (_) {
      return "";
    }
  },

  cancel() {
    if (!this._running) return;
    App.cancelTool("sim-compile");
    App.cancelTool("sim-run");
    App.cancelTool("sim-verilator");
    this._running = false;
    Pipeline.set("simulation", "failed", "已取消");
    this._render("failed", "仿真已取消", [{ state: "failed", text: "本次仿真已中断" }]);
    App.setStatus("仿真已取消");
  },

  _buildCommand() {
    const sources = Config.data.project.sources || [];
    const tb = document.getElementById("sim-tb-file").value.trim();
    const engine = document.getElementById("sim-engine").value;
    const includeArgs = this._splitList("sim-include-dirs").map((dir) => `-I${dir}`);
    const defineArgs = this._splitList("sim-defines").map((item) => `-D${item}`);
    const timescale = document.getElementById("sim-timescale")?.value.trim();
    if (engine === "iverilog") {
      const args = ["-o", this._outputFile(), ...includeArgs, ...defineArgs];
      // Icarus 没有统一的命令行 timescale 覆盖，保留配置用于报告和 Verilator。
      if (this._checked("sim-opt-warnings")) args.push("-Wall");
      args.push(...sources);
      if (tb) args.push(tb);
      return { text: `iverilog ${args.join(" ")}`, args };
    }
    if (engine === "verilator") {
      const cppTb = tb && /\.(cc|cpp|cxx)$/i.test(tb);
      const args = cppTb ? ["--cc", "--exe", "--build", ...includeArgs, ...defineArgs] : ["--lint-only", ...includeArgs, ...defineArgs];
      if (this._checked("sim-opt-warnings")) args.push("-Wall");
      if (this._checked("sim-opt-wave")) args.push(this._checked("sim-opt-trace-fst") ? "--trace-fst" : "--trace");
      if (timescale) args.push("--timescale", timescale);
      const cflags = document.getElementById("sim-cflags")?.value.trim();
      const ldflags = document.getElementById("sim-ldflags")?.value.trim();
      if (cppTb && cflags) args.push("-CFLAGS", cflags);
      if (cppTb && ldflags) args.push("-LDFLAGS", ldflags);
      args.push(...sources);
      if (cppTb) args.push(tb);
      return { text: `verilator ${args.join(" ")}`, args };
    }
    return { text: "surfer output/simulation/dump.vcd", args: ["output/simulation/dump.vcd"] };
  },

  _outputFile() { return document.getElementById("sim-output-file").value.trim() || "output/simulation/sim.vvp"; },
  _checked(id) { return !!document.getElementById(id)?.checked; },
  _splitList(id) {
    const value = document.getElementById(id)?.value || "";
    return value.split(/[;,]/).map((item) => item.trim()).filter(Boolean);
  },
  _appendLog(text) { ToolStepUI.appendHiddenLog(this._logEl, text); },
  _render(kind, summary, items) { ToolStepUI.render("sim-result", "sim-summary", "sim-feedback-list", kind, summary, items); },

  _bindOptions() {
    const map = { "sim-opt-wave": "wave", "sim-opt-warnings": "warnings", "sim-opt-trace-fst": "trace_fst" };
    for (const [id, key] of Object.entries(map)) {
      document.getElementById(id)?.addEventListener("change", (event) => {
        Config.setFlowValue("simulation", key, event.target.checked);
        this.refresh();
      });
    }
    document.getElementById("sim-output-file")?.addEventListener("input", (event) => {
      Config.setFlowValue("simulation", "output", event.target.value);
      this.refresh();
    });
    const textInputs = { "sim-include-dirs": "includes", "sim-defines": "defines", "sim-timescale": "timescale", "sim-cflags": "cflags", "sim-ldflags": "ldflags" };
    for (const [id, key] of Object.entries(textInputs)) {
      document.getElementById(id)?.addEventListener("input", (event) => {
        Config.setFlowValue("simulation", key, event.target.value);
        this.refresh();
      });
    }
  },

  _loadOptions() {
    const flow = Config.getFlow("simulation");
    const wave = document.getElementById("sim-opt-wave");
    const warnings = document.getElementById("sim-opt-warnings");
    const traceFst = document.getElementById("sim-opt-trace-fst");
    const output = document.getElementById("sim-output-file");
    const tb = document.getElementById("sim-tb-file");
    if (wave) wave.checked = flow.wave !== false;
    if (warnings) warnings.checked = flow.warnings !== false;
    if (traceFst) traceFst.checked = !!flow.trace_fst;
    if (output) output.value = flow.output || "output/simulation/sim.vvp";
    if (tb) tb.value = flow.testbench || "";
    const texts = {
      "sim-include-dirs": flow.includes || "",
      "sim-defines": flow.defines || "",
      "sim-timescale": flow.timescale || "",
      "sim-cflags": flow.cflags || "",
      "sim-ldflags": flow.ldflags || "",
    };
    for (const [id, value] of Object.entries(texts)) {
      const el = document.getElementById(id);
      if (el) el.value = value;
    }
  },
};
