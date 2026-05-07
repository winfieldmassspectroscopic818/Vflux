/**
 * Vflux Pipeline 状态管理 - 严格状态跟踪
 * 只有工具退出码为 0 才标记 success
 */
"use strict";

const Pipeline = {
  steps: [
    "project",
    "examples",
    "board",
    "toolchain",
    "check",
    "synthesis",
    "pnr",
    "pack",
    "timing",
    "floorplan",
    "program",
    "simulation",
    "formal",
    "surfer",
    "mcy",
    "verilator",
    "report",
    "build-all",
  ],

  status: {},

  /** 每个步骤的运行结果信息 */
  results: {},
  timestamps: {},

  init() {
    this.steps.forEach((step) => {
      this.status[step] = "pending";
      this.results[step] = null;
      this.timestamps[step] = null;
    });
    this._updateNavUI();
  },

  /** 设置步骤状态并记录结果 */
  set(step, status, detail) {
    if (!this.steps.includes(step)) return;
    this.status[step] = status;
    this.results[step] = detail || null;
    this.timestamps[step] = new Date().toISOString();
    this._updateNavUI();
    this._updateStatusbar();
  },

  /** 标记从某步开始及之后全部为 pending */
  resetFrom(step) {
    const idx = this.steps.indexOf(step);
    if (idx === -1) return;
    for (let i = idx; i < this.steps.length; i++) {
      this.status[this.steps[i]] = "pending";
      this.results[this.steps[i]] = null;
      this.timestamps[this.steps[i]] = null;
    }
    this._updateNavUI();
    this._updateStatusbar();
  },

  /** 获取当前激活步骤名（第一个非 success 且必须前面都是 success） */
  getActiveStep() {
    for (let i = 0; i < this.steps.length; i++) {
      if (this.status[this.steps[i]] !== "success") return this.steps[i];
    }
    return this.steps[this.steps.length - 1];
  },

  _updateNavUI() {
    const items = document.querySelectorAll(".pipeline-step");
    items.forEach((item) => {
      const panel = item.dataset.panel;
      item.classList.remove("status-pending", "status-running", "status-success", "status-failed");
      const s = this.status[panel] || "pending";
      item.classList.add("status-" + s);
    });
  },

  _updateStatusbar() {
    const statusEl = document.getElementById("status-pipeline");
    if (!statusEl) return;

    const completed = this.steps.filter((s) => this.status[s] === "success").length;
    const total = this.steps.length;
    const running = this.steps.find((s) => this.status[s] === "running");
    const failed = this.steps.find((s) => this.status[s] === "failed");

    if (failed) {
      const detail = this.results[failed] || "";
      statusEl.textContent = `\u2716 ${failed} 失败${detail ? " (" + detail + ")" : ""} (${completed}/${total})`;
      statusEl.style.color = "var(--red)";
    } else if (running) {
      statusEl.textContent = `\u25B6 ${running} 进行中 (${completed}/${total})`;
      statusEl.style.color = "var(--yellow)";
    } else if (completed === total) {
      statusEl.textContent = `\u2714 全部完成 (${completed}/${total})`;
      statusEl.style.color = "var(--green)";
    } else {
      statusEl.textContent = `等待开始 (${completed}/${total})`;
      statusEl.style.color = "var(--text-muted)";
    }
  },
};
