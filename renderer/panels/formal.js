"use strict";

const PanelFormal = {
  _running: false,
  _logEl: null,
  _cmdEl: null,

  init() {
    this._logEl = document.getElementById("formal-log");
    this._cmdEl = document.getElementById("formal-cmd-preview");
    document.getElementById("btn-formal-run").addEventListener("click", () => this.run());
    document.getElementById("btn-formal-cancel").addEventListener("click", () => this.cancel());
    document.getElementById("btn-formal-clear").addEventListener("click", () => this.refresh());
    document.getElementById("btn-add-sby").addEventListener("click", () => this._addSby());
    document.getElementById("btn-gen-sby").addEventListener("click", () => this._genSby());
    ["formal-mode", "formal-depth", "formal-engine", "formal-opt-trace"].forEach((id) => {
      document.getElementById(id)?.addEventListener("change", () => this._saveOptions());
      document.getElementById(id)?.addEventListener("input", () => this._saveOptions());
    });
  },

  refresh() {
    this._loadOptions();
    const sbyFile = this._sbyFile();
    const mode = document.getElementById("formal-mode").value;
    const command = `sby -f ${sbyFile || "formal/proof.sby"} task=${mode}`;
    this._cmdEl.textContent = command;
    this._render("ready", "可以运行形式验证", [
      { state: sbyFile ? "success" : "pending", text: sbyFile ? `配置文件：${sbyFile}` : "请选择或生成 .sby 配置文件" },
      { state: "pending", text: "失败时会提炼断言、反例或求解器相关提示" },
    ]);
    ToolStepUI.setTechnical("formal", { meta: "等待运行形式验证", command, log: this._logEl.textContent });
  },

  async _addSby() {
    const result = await window.vflux.openFileDialog({ title: "选择 .sby 文件", filters: [{ name: "SBY Files", extensions: ["sby"] }, { name: "All Files", extensions: ["*"] }] });
    if (result?.filePaths?.[0]) {
      document.getElementById("formal-sby-file").value = result.filePaths[0];
      this.refresh();
    }
  },

  async _genSby() {
    const proj = Config.data.project;
    const top = proj.top_module || "top";
    const mode = document.getElementById("formal-mode").value;
    const depth = document.getElementById("formal-depth").value || "20";
    const engine = document.getElementById("formal-engine").value || "smtbmc";
    const sources = proj.sources || [];
    const content = `# Auto-generated .sby by Vflux\n# Top module: ${top}\n\n[options]\nmode ${mode}\ndepth ${depth}\n\n[engines]\n${engine}\n\n[script]\nread_verilog ${sources.join(" ")}\nprep -top ${top}\n\n[files]\n${sources.join("\n")}\n`;
    const path = `${Config.getProjectDir()}/formal/${top}.sby`;
    await window.vflux.writeText(path, content);
    document.getElementById("formal-sby-file").value = path;
    this.refresh();
    App.setStatus("已生成形式验证模板");
  },

  async run() {
    if (this._running) return;
    const sbyFile = this._sbyFile();
    if (!sbyFile) {
      this._render("failed", "还不能验证", [{ state: "failed", text: "请先选择或生成 .sby 配置文件" }]);
      return;
    }
    this._running = true;
    this._logEl.textContent = "";
    Pipeline.set("formal", "running");
    App.setStatus("形式验证运行中...");
    this._render("running", "正在运行形式验证", [
      { state: "running", text: "读取 .sby 配置" },
      { state: "running", text: "调用求解器检查属性" },
    ]);
    const mode = document.getElementById("formal-mode").value;
    const args = ["-f", sbyFile, `task=${mode}`];
    const command = `sby ${args.join(" ")}`;
    ToolStepUI.setTechnical("formal", { meta: "运行中", command, log: "" });
    const result = await App.runTool("formal", "sby.exe", args, Config.getProjectDir(), (text) => this._appendLog(text));
    this._running = false;
    ToolStepUI.setTechnical("formal", { meta: `退出码：${result.code ?? 0}`, command, log: this._logEl.textContent });
    Pipeline.set("formal", result.success ? "success" : "failed", result.success ? "" : `code:${result.code}`);
    this._render(result.success ? "success" : "failed", result.success ? "形式验证通过" : "形式验证失败", result.success ? [
      { state: "success", text: "指定属性在当前深度/模式下通过验证" },
    ] : ToolDiagnostics.analyze("formal", this._logEl.textContent));
    App.setStatus(result.success ? "形式验证通过" : "形式验证失败");
    if (PanelDashboard) PanelDashboard.refresh();
  },

  cancel() {
    if (!this._running) return;
    App.cancelTool("formal");
    this._running = false;
    Pipeline.set("formal", "failed", "已取消");
    this._render("failed", "形式验证已取消", [{ state: "failed", text: "验证任务被中断" }]);
  },

  _sbyFile() { return document.getElementById("formal-sby-file").value.trim(); },
  _appendLog(text) { ToolStepUI.appendHiddenLog(this._logEl, text); },
  _render(kind, summary, items) { ToolStepUI.render("formal-result", "formal-summary", "formal-feedback-list", kind, summary, items); },
  _saveOptions() {
    Config.setFlowValue("formal", "depth", Number(document.getElementById("formal-depth").value) || 20);
    Config.setFlowValue("formal", "engine", document.getElementById("formal-engine").value);
    Config.setFlowValue("formal", "trace", !!document.getElementById("formal-opt-trace").checked);
    this.refresh();
  },
  _loadOptions() {
    const flow = Config.getFlow("formal");
    document.getElementById("formal-depth").value = flow.depth || 20;
    document.getElementById("formal-engine").value = flow.engine || "smtbmc";
    document.getElementById("formal-opt-trace").checked = flow.trace !== false;
  },
};
