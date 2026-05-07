"use strict";

const PanelBuildAll = {
  _running: false,
  _cancel: false,
  _logEl: null,
  _startedAt: null,

  init() {
    this._logEl = document.getElementById("build-all-log");
    document.getElementById("btn-build-all-run").addEventListener("click", () => this.run());
    document.getElementById("btn-build-all-cancel").addEventListener("click", () => this.cancel());
    document.getElementById("btn-build-all-clear").addEventListener("click", () => this.refresh());
    this.refresh();
  },

  _steps() {
    const board = Config.data.board || {};
    const steps = [
      { name: "检查", pipelineStep: "check", run: () => PanelCheck.run(), critical: true },
      { name: "综合", pipelineStep: "synthesis", run: () => PanelSynthesis.run(), critical: true },
      { name: "布局布线", pipelineStep: "pnr", run: () => PanelPnr.run(), critical: true },
      { name: "生成比特流", pipelineStep: "pack", run: () => PanelPack.run(), critical: true },
    ];
    if (board.fpga_family === "ice40") {
      steps.push({ name: "时序分析", pipelineStep: "timing", run: () => PanelTiming.run(), critical: false });
      steps.push({ name: "资源图与统计", pipelineStep: "floorplan", run: () => PanelFloorplan.runStat(), critical: false });
    }
    steps.push({ name: "报告汇总", pipelineStep: "report", run: () => PanelReport.refresh(), critical: false });
    return steps;
  },

  refresh() {
    const list = document.getElementById("build-step-list");
    if (!list) return;
    const steps = this._steps();
    list.innerHTML = steps.map((step, index) => `
      <div class="build-step status-${Pipeline.status[step.pipelineStep] || "pending"}" data-index="${index}">
        <span class="step-icon">${index + 1}</span>
        <span class="step-name">${step.name}${step.critical ? "" : "（附加）"}</span>
        <span class="step-status">${this._label(Pipeline.status[step.pipelineStep])}</span>
      </div>`).join("");
    this._updateProgress(steps);
    if (!this._running) {
      this._render("ready", "等待一键构建", [
        { state: "pending", text: "将按检查、综合、布局布线、生成比特流顺序执行核心构建。" },
        { state: "pending", text: "iCE40 工程会附加时序分析和资源图生成，最后写入验收报告。" },
      ]);
      ToolStepUI.setTechnical("build", { meta: "等待一键构建", command: steps.map((s) => s.name).join(" -> "), log: this._logEl.textContent });
    }
  },

  async run(options = {}) {
    if (this._running) return false;
    this._running = true;
    this._cancel = false;
    this._startedAt = new Date().toISOString();
    this._logEl.textContent = "";

    const steps = this._steps();
    Pipeline.set("build-all", "running");
    App.setStatus(options.source === "example" ? "例程验收中..." : "一键构建中...");
    this._render("running", options.source === "example" ? "正在运行例程验收" : "正在执行一键构建", [
      { state: "running", text: "按流水线顺序运行构建步骤。" },
      { state: "running", text: "失败时会停止后续核心步骤，并在报告中心形成结论。" },
    ]);
    ToolStepUI.setTechnical("build", { meta: "运行中", command: steps.map((s) => s.name).join(" -> "), log: "" });

    let stoppedAt = "";
    for (let i = 0; i < steps.length; i++) {
      if (this._cancel) {
        stoppedAt = "用户取消";
        break;
      }
      const step = steps[i];
      this._log(`开始：${step.name}`);
      await step.run();
      this.refresh();
      const state = Pipeline.status[step.pipelineStep];
      if (state !== "success") {
        const optional = !step.critical;
        this._log(`${optional ? "附加步骤未完成" : "停止"}：${step.name}`);
        if (!optional) {
          stoppedAt = step.name;
          break;
        }
      } else {
        this._log(`完成：${step.name}`);
      }
    }

    this._running = false;
    const ok = this._coreSteps().every((s) => Pipeline.status[s.pipelineStep] === "success") && !this._cancel;
    Pipeline.set("build-all", ok ? "success" : "failed", stoppedAt || null);
    await this._writeAcceptanceReport(ok, options, stoppedAt);
    if (ok && PanelReport?.exportHtml) {
      // 一键验收成功后同步生成 HTML 总报告，报告工作台不再出现“应有但不存在”的入口。
      await PanelReport.exportHtml({ open: false, silent: true });
    }
    this._render(ok ? "success" : "failed", ok ? "构建验收完成" : "构建验收未通过", ok ? [
      { state: "success", text: "核心流程已完成，比特流已生成。" },
      { state: "success", text: "验收结果已写入 output/reports/vflux-acceptance.json。" },
    ] : [
      { state: "failed", text: stoppedAt ? `构建停在：${stoppedAt}` : "构建任务被取消或核心步骤失败。" },
      { state: "pending", text: "请在对应工作台查看图形化诊断，技术详情保留原始日志。" },
    ]);
    ToolStepUI.setTechnical("build", { meta: ok ? "验收完成" : "验收未通过", command: steps.map((s) => s.name).join(" -> "), log: this._logEl.textContent });
    App.setStatus(ok ? "一键构建完成，比特流已生成" : "一键构建未通过，请查看失败步骤提示");
    if (PanelDashboard) PanelDashboard.refresh();
    return ok;
  },

  cancel() {
    this._cancel = true;
    this._running = false;
    App.cancelTool("check");
    App.cancelTool("synthesis");
    App.cancelTool("pnr");
    App.cancelTool("pack");
    App.cancelTool("timing");
    App.cancelTool("floorplan-stat");
    Pipeline.set("build-all", "failed", "用户取消");
    this._render("failed", "一键构建已取消", [{ state: "failed", text: "构建任务已中断。" }]);
    App.setStatus("一键构建已取消");
  },

  _coreSteps() {
    return this._steps().filter((step) => step.critical);
  },

  _label(status) {
    return { success: "完成", running: "进行中", failed: "失败", pending: "等待" }[status || "pending"];
  },

  _updateProgress(steps = this._steps()) {
    const done = steps.filter((s) => Pipeline.status[s.pipelineStep] === "success").length;
    const fill = document.getElementById("build-progress");
    if (fill) fill.style.width = `${Math.round((done / steps.length) * 100)}%`;
  },

  _log(text) {
    ToolStepUI.appendHiddenLog(this._logEl, text + "\n");
  },

  async _writeAcceptanceReport(ok, options, stoppedAt) {
    const top = Config.data.project.top_module || "top";
    const family = Config.data.board.fpga_family || "ice40";
    const bitstream = family === "ecp5" ? `output/bitstream/${top}.bit` : family === "gowin" ? `output/bitstream/${top}.fs` : `output/bitstream/${top}.bin`;
    const report = {
      schema: 1,
      type: options.source === "example" ? "example-acceptance" : "build-acceptance",
      title: options.title || Config.data.project.name || "Vflux 工程",
      success: ok,
      started_at: this._startedAt,
      finished_at: new Date().toISOString(),
      stopped_at: stoppedAt || "",
      project: {
        name: Config.data.project.name || "",
        top_module: top,
        directory: Config.getProjectDir(),
      },
      board: {
        name: Config.data.board.name || "",
        family,
        device: Config.data.board.fpga_device || "",
        package: Config.data.board.fpga_package || "",
      },
      outputs: {
        synthesis: `output/synthesis/${top}.json`,
        pnr: this._pnrPath(top, family),
        bitstream,
        reports: "output/reports",
      },
      pipeline: { ...Pipeline.status },
      details: this._logEl.textContent || "",
    };
    // 报告中心读取这个小 JSON，给用户一个不依赖命令行日志的验收结论。
    await window.vflux.writeText(ToolStepUI.projectPath("output/reports/vflux-acceptance.json"), JSON.stringify(report, null, 2));
  },

  _pnrPath(top, family) {
    if (family === "ecp5") return `output/pnr/${top}.config`;
    if (family === "gowin") return `output/pnr/${top}.pnr.json`;
    return `output/pnr/${top}.asc`;
  },

  _render(kind, summary, items) {
    ToolStepUI.render("build-result", "build-summary", "build-feedback-list", kind, summary, items);
  },
};
