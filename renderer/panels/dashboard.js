/**
 * Vflux Panel: 仪表板总览 - 首页
 * 动态适应 Pipeline 步骤数
 */
"use strict";

const PanelDashboard = {
  init() {},

  refresh() {
    this._updateCards();
  },

  _updateCards() {
    const cfg = Config.data;

    // 工程卡片
    document.getElementById("dash-project-val").textContent = cfg.project.name || "未命名";

    // 板卡卡片
    document.getElementById("dash-board-val").textContent = cfg.board.name || "未选择";

    // FPGA 卡片
    document.getElementById("dash-fpga-val").textContent = cfg.board.fpga_device
      ? `${cfg.board.fpga_family}/${cfg.board.fpga_device}` : "-";

    // 流程进度卡片 - 排除 dashboard 自身
    const totalSteps = Pipeline.steps.filter(s => s !== "dashboard").length;
    const done = Pipeline.steps.filter(s => s !== "dashboard" && Pipeline.status[s] === "success").length;
    document.getElementById("dash-progress-val").textContent = `${done}/${totalSteps}`;
    document.getElementById("dash-progress-bar").style.width =
      totalSteps > 0 ? Math.round(done / totalSteps * 100) + "%" : "0%";

    // 最近日志
    const globalLog = document.getElementById("global-log");
    if (globalLog) {
      document.getElementById("dash-log-content").textContent =
        globalLog.textContent.split("\n").slice(-8).join("\n");
    }
  },
};
