"use strict";

const PanelTiming = {
  _running: false,
  _logEl: null,
  _cmdEl: null,

  init() {
    this._logEl = document.getElementById("timing-log");
    this._cmdEl = document.getElementById("timing-cmd-preview");
    document.getElementById("btn-timing-run").addEventListener("click", () => this.run());
    document.getElementById("btn-timing-cancel").addEventListener("click", () => this.cancel());
    document.getElementById("btn-timing-clear").addEventListener("click", () => this.refresh());
    ["timing-opt-max", "timing-opt-report", "timing-target"].forEach((id) => {
      document.getElementById(id)?.addEventListener("change", () => this._saveOptions());
      document.getElementById(id)?.addEventListener("input", () => this._saveOptions());
    });
  },

  refresh() {
    this._loadOptions();
    const board = Config.data.board;
    const command = this._buildCommand();
    this._cmdEl.textContent = command.text;
    this._render("ready", board.fpga_family === "ice40" ? "可以运行时序分析" : "当前仅支持 iCE40 时序分析", [
      { state: board.fpga_family === "ice40" ? "success" : "failed", text: board.fpga_family === "ice40" ? "icetime 支持当前目标" : "请选择 iCE40 板卡" },
      { state: "pending", text: "结果会提炼为时序摘要，原始输出放在技术详情" },
    ]);
    ToolStepUI.setTechnical("timing", { meta: "等待时序分析", command: command.text, log: this._logEl.textContent });
  },

  async run() {
    if (this._running) return;
    const board = Config.data.board;
    if (board.fpga_family !== "ice40") {
      this._render("failed", "还不能运行时序分析", [{ state: "failed", text: "icetime 当前仅支持 iCE40 流程" }]);
      return;
    }
    this._running = true;
    this._logEl.textContent = "";
    Pipeline.set("timing", "running");
    App.setStatus("时序分析中...");
    this._render("running", "正在分析时序", [
      { state: "running", text: "读取布局布线结果" },
      { state: "running", text: "计算路径延迟和频率信息" },
    ]);
    const command = this._buildCommand();
    ToolStepUI.setTechnical("timing", { meta: "运行中", command: command.text, log: "" });
    const result = await App.runTool("timing", "icetime.exe", command.args, Config.getProjectDir(), (tx) => this._appendLog(tx));
    this._running = false;
    if (result.success && this._checked("timing-opt-report")) {
      // 保存 icetime 原始摘要，报告中心负责提炼为可读指标。
      await window.vflux.writeText(ToolStepUI.projectPath(`output/reports/${Config.data.project.top_module || "top"}.icetime.log`), this._logEl.textContent || "");
    }
    ToolStepUI.setTechnical("timing", { meta: `退出码：${result.code ?? 0}`, command: command.text, log: this._logEl.textContent });
    Pipeline.set("timing", result.success ? "success" : "failed");
    this._render(result.success ? "success" : "failed", result.success ? "时序分析完成" : "时序分析失败", result.success ? this._summarizeTiming() : ToolDiagnostics.analyze("pnr", this._logEl.textContent));
    App.setStatus(result.success ? "时序完成" : "时序失败");
  },

  cancel() {
    if (!this._running) return;
    App.cancelTool("timing");
    this._running = false;
    Pipeline.set("timing", "failed");
    this._render("failed", "时序分析已取消", [{ state: "failed", text: "任务被中断" }]);
  },

  _buildCommand() {
    const board = Config.data.board;
    const top = Config.data.project.top_module || "top";
    const args = ["-d", board.fpga_device || "up5k"];
    args.push(this._checked("timing-opt-max") ? "-mit" : "-t");
    args.push(`output/pnr/${top}.asc`);
    return { args, text: `icetime ${args.join(" ")}` };
  },

  _summarizeTiming() {
    const log = this._logEl.textContent || "";
    const max = log.match(/Max frequency.*?([0-9.]+)\s*MHz/i);
    const items = [{ state: "success", text: "icetime 已完成路径分析" }];
    if (max) items.push({ state: "success", text: `估算最高频率：${max[1]} MHz` });
    return items;
  },

  _checked(id) { return !!document.getElementById(id)?.checked; },
  _appendLog(text) { ToolStepUI.appendHiddenLog(this._logEl, text); },
  _render(kind, summary, items) { ToolStepUI.render("timing-result", "timing-summary", "timing-feedback-list", kind, summary, items); },
  _saveOptions() {
    Config.setFlowValue("timing", "max", this._checked("timing-opt-max"));
    Config.setFlowValue("timing", "report", this._checked("timing-opt-report"));
    Config.setFlowValue("timing", "target", Number(document.getElementById("timing-target").value) || 12);
    this.refresh();
  },
  _loadOptions() {
    const flow = Config.getFlow("timing");
    document.getElementById("timing-opt-max").checked = flow.max !== false;
    document.getElementById("timing-opt-report").checked = flow.report !== false;
    document.getElementById("timing-target").value = flow.target || 12;
  },
};
