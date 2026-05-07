"use strict";

const PanelFloorplan = {
  _logEl: null,

  init() {
    this._logEl = document.getElementById("floorplan-log");
    document.getElementById("btn-floorplan-stat").addEventListener("click", () => this.runStat());
    document.getElementById("btn-floorplan-html").addEventListener("click", () => this.runHtml());
    document.getElementById("btn-floorplan-clear").addEventListener("click", () => this.refresh());
    document.getElementById("floorplan-opt-html").addEventListener("change", () => this._saveOptions());
    document.getElementById("floorplan-opt-save").addEventListener("change", () => this._saveOptions());
  },

  refresh() {
    this._loadOptions();
    const board = Config.data.board;
    this._render("ready", board.fpga_family === "ice40" ? "可以统计资源" : "当前仅支持 iCE40 资源统计", [
      { state: board.fpga_family === "ice40" ? "success" : "failed", text: board.fpga_family === "ice40" ? "icebox 工具支持当前目标" : "请选择 iCE40 板卡" },
      { state: "pending", text: "统计摘要会图形化显示，原始输出在技术详情" },
    ]);
    ToolStepUI.setTechnical("floorplan", { meta: "等待资源统计", command: this._command("icebox_stat.exe"), log: this._logEl.textContent });
  },

  async runStat() {
    const board = Config.data.board;
    if (board.fpga_family !== "ice40") {
      this._render("failed", "还不能统计资源", [{ state: "failed", text: "资源统计当前仅支持 iCE40 流程" }]);
      return;
    }
    this._logEl.textContent = "";
    Pipeline.set("floorplan", "running");
    App.setStatus("资源统计中...");
    this._render("running", "正在统计资源", [
      { state: "running", text: "读取布局布线结果" },
      { state: "running", text: "统计芯片资源占用" },
    ]);
    const args = [this._ascPath()];
    const command = `icebox_stat.exe ${args.join(" ")}`;
    ToolStepUI.setTechnical("floorplan", { meta: "运行中", command, log: "" });
    const result = await App.runTool("floorplan-stat", "icebox_stat.exe", args, Config.getProjectDir(), (tx) => this._appendLog(tx));
    if (this._checked("floorplan-opt-html")) await this.runHtml(false);
    ToolStepUI.setTechnical("floorplan", { meta: `退出码：${result.code ?? 0}`, command, log: this._logEl.textContent });
    Pipeline.set("floorplan", result.success ? "success" : "failed");
    this._render(result.success ? "success" : "failed", result.success ? "资源统计完成" : "资源统计失败", result.success ? this._summarize() : ToolDiagnostics.analyze("pnr", this._logEl.textContent));
    App.setStatus(result.success ? "统计完成" : "统计失败");
  },

  async runHtml(updateUi = true) {
    const board = Config.data.board;
    if (board.fpga_family !== "ice40") return;
    const before = this._logEl.textContent.length;
    if (updateUi) {
      this._logEl.textContent = "";
      this._render("running", "正在生成 Floorplan HTML", [{ state: "running", text: "调用 icebox_html 生成可视化文件" }]);
    }
    const args = [this._ascPath()];
    await App.runTool("floorplan-html", "icebox_html.exe", args, Config.getProjectDir(), (tx) => this._appendLog(tx));
    const top = Config.data.project.top_module || "top";
    const generated = this._logEl.textContent.slice(before);
    if (generated.trim()) await window.vflux.writeText(ToolStepUI.projectPath(`output/reports/${top}.floorplan.html`), generated);
    if (updateUi) this._render("success", "Floorplan HTML 已生成", [{ state: "success", text: `可在报告中心打开 output/reports/${top}.floorplan.html` }]);
  },

  _ascPath() { return `output/pnr/${Config.data.project.top_module || "top"}.asc`; },
  _command(tool) { return `${tool} ${this._ascPath()}`; },
  _checked(id) { return !!document.getElementById(id)?.checked; },
  _appendLog(text) { ToolStepUI.appendHiddenLog(this._logEl, text); },
  _render(kind, summary, items) { ToolStepUI.render("floorplan-result", "floorplan-summary", "floorplan-feedback-list", kind, summary, items); },
  _summarize() {
    const log = this._logEl.textContent || "";
    const lines = log.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(-6);
    return [{ state: "success", text: lines.length ? `统计摘要：${lines.join(" / ")}` : "icebox_stat 已完成资源统计" }];
  },
  _saveOptions() {
    Config.setFlowValue("floorplan", "html", this._checked("floorplan-opt-html"));
    Config.setFlowValue("floorplan", "save", this._checked("floorplan-opt-save"));
    this.refresh();
  },
  _loadOptions() {
    const flow = Config.getFlow("floorplan");
    document.getElementById("floorplan-opt-html").checked = !!flow.html;
    document.getElementById("floorplan-opt-save").checked = flow.save !== false;
  },
};
