"use strict";

const PanelSurfer = {
  _running: false,
  _logEl: null,
  _cmdEl: null,

  init() {
    this._logEl = document.getElementById("surfer-log");
    this._cmdEl = document.getElementById("surfer-cmd-preview");
    document.getElementById("btn-surfer-open").addEventListener("click", () => this._open());
    document.getElementById("btn-surfer-browse").addEventListener("click", () => this._browse());
    document.getElementById("btn-surfer-clear").addEventListener("click", () => this.refresh());
    document.getElementById("surfer-file").addEventListener("input", () => this.refresh());
  },

  refresh() {
    const file = this._file();
    this._cmdEl.textContent = file ? `surfer ${file}` : "surfer <waveform>";
    this._render("ready", file ? "可以打开波形" : "等待选择波形", [
      { state: file ? "success" : "pending", text: file ? `波形文件：${file}` : "请选择 VCD/FST/GHW 波形文件" },
      { state: "pending", text: "启动器输出会保留在技术详情中" },
    ]);
    ToolStepUI.setTechnical("surfer", { meta: "等待打开波形", command: this._cmdEl.textContent, log: this._logEl.textContent });
  },

  async _browse() {
    const result = await window.vflux.openFileDialog({
      title: "选择波形文件",
      filters: [{ name: "Waveform Files", extensions: ["vcd", "fst", "ghw", "lxt", "lxt2"] }, { name: "All Files", extensions: ["*"] }],
    });
    if (result?.filePaths?.[0]) {
      document.getElementById("surfer-file").value = result.filePaths[0];
      this.refresh();
    }
  },

  async _open() {
    const file = this._file();
    if (!file) {
      this._render("failed", "还不能打开波形", [{ state: "failed", text: "请先选择波形文件" }]);
      return;
    }
    this._running = true;
    this._logEl.textContent = "";
    Pipeline.set("surfer", "running");
    App.setStatus("Surfer 启动中...");
    this._render("running", "正在打开波形查看器", [{ state: "running", text: "启动 Surfer 并载入波形文件" }]);
    const command = `surfer ${file}`;
    ToolStepUI.setTechnical("surfer", { meta: "运行中", command, log: "" });
    const result = await App.runTool("surfer", "surfer.exe", [file], Config.getProjectDir(), (text) => this._appendLog(text));
    this._running = false;
    ToolStepUI.setTechnical("surfer", { meta: `退出码：${result.code ?? 0}`, command, log: this._logEl.textContent });
    Pipeline.set("surfer", result.success ? "success" : "failed");
    this._render(result.success ? "success" : "failed", result.success ? "波形查看器已关闭" : "波形查看器启动失败", result.success ? [
      { state: "success", text: "Surfer 已完成本次查看会话" },
    ] : ToolDiagnostics.analyze("surfer", this._logEl.textContent));
    App.setStatus(result.success ? "Surfer 已关闭" : "Surfer 启动失败");
  },

  _file() { return document.getElementById("surfer-file").value.trim(); },
  _appendLog(text) { ToolStepUI.appendHiddenLog(this._logEl, text); },
  _render(kind, summary, items) { ToolStepUI.render("surfer-result", "surfer-summary", "surfer-feedback-list", kind, summary, items); },
};
