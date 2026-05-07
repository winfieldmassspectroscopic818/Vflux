"use strict";

const PanelExamples = {
  _examples: [],
  _targetDir: "",

  init() {
    document.getElementById("btn-example-browse").addEventListener("click", () => this._browseTarget());
    document.getElementById("example-grid").addEventListener("click", (event) => {
      const button = event.target.closest("[data-example-id]");
      if (!button) return;
      this._create(button.dataset.exampleId, button.dataset.exampleAction === "validate");
    });
  },

  async refresh() {
    this._examples = await window.vflux.exampleList();
    this._render();
    this._renderFeedback("ready", "选择例程和目标目录后，可以创建工程，也可以直接运行一键验收。");
  },

  _render() {
    const grid = document.getElementById("example-grid");
    if (!this._examples.length) {
      grid.innerHTML = `<div class="file-empty">没有找到内置例程</div>`;
      return;
    }
    grid.innerHTML = this._examples.map((example) => `
      <div class="example-card">
        <div class="example-card-head">
          <strong>${ToolStepUI.escape(example.title || example.id)}</strong>
          <span>${ToolStepUI.escape(example.family || "-")}</span>
        </div>
        <p>${ToolStepUI.escape(example.description || "")}</p>
        <div class="example-meta">
          <span>板卡：${ToolStepUI.escape(example.board || "-")}</span>
          <span>顶层：${ToolStepUI.escape(example.top_module || "top")}</span>
          ${example.testbench ? `<span>Testbench：${ToolStepUI.escape(example.testbench)}</span>` : ""}
          <span>流程：${ToolStepUI.escape((example.flow || []).join(" → "))}</span>
        </div>
        <div class="example-card-actions">
          <button class="btn-secondary" data-example-id="${ToolStepUI.escape(example.id)}" data-example-action="open">创建并打开</button>
          <button class="btn-primary" data-example-id="${ToolStepUI.escape(example.id)}" data-example-action="validate">创建并验收</button>
        </div>
      </div>
    `).join("");
  },

  async _browseTarget() {
    const result = await window.vflux.openDirectoryDialog({ title: "选择例程工程父目录" });
    if (result?.filePaths?.[0]) {
      this._targetDir = result.filePaths[0];
      document.getElementById("example-target-dir").value = this._targetDir;
      this._renderFeedback("ready", "目标目录已选择，可以创建例程工程。");
    }
  },

  async _create(exampleId, validate = false) {
    if (!this._targetDir) {
      this._renderFeedback("failed", "请先选择例程复制到的父目录。");
      return;
    }
    const example = this._examples.find((item) => item.id === exampleId);
    this._renderFeedback("running", `正在创建例程：${example?.title || exampleId}`);
    const advancedSkeleton = document.getElementById("example-advanced-skeleton")?.checked !== false;
    const result = await window.vflux.createExampleProject(exampleId, this._targetDir, example?.project_name || exampleId, { advancedSkeleton });
    if (!result.success) {
      this._renderFeedback("failed", result.reason || "例程创建失败");
      return;
    }

    await Config.load(result.projectFile);
    document.getElementById("project-name").textContent = Config.data.project.name || "例程工程";
    document.getElementById("board-name").textContent = Config.data.board.name || "未选择板卡";
    Pipeline.init();
    Pipeline.set("examples", "success");
    Pipeline.set("project", "success");
    if (Config.data.board.filename) Pipeline.set("board", "success");
    App.refreshPanels("project", "board", "toolchain", "synthesis", "pnr", "pack", "program", "report");
    App.switchPanel("build-all");
    App.setStatus("例程工程已创建：" + result.projectDir);
    App.globalLog("例程工程已创建：" + result.projectDir);
    if (advancedSkeleton && result.skeletonFiles) App.globalLog("已补齐专业工程骨架: " + result.skeletonFiles.length + " 个文件");

    if (validate) {
      // 验收入口复用一键构建，确保例程流程和正式流程共用同一套执行逻辑。
      const ok = await PanelBuildAll.run({ source: "example", title: example?.title || exampleId });
      await PanelReport.refresh();
      App.switchPanel("report");
      this._renderFeedback(ok ? "success" : "failed", ok ? "例程验收通过，报告中心已生成结论。" : "例程验收未通过，请查看报告中心的失败原因。");
    }
  },

  _renderFeedback(kind, text) {
    ToolStepUI.render("example-result", "example-summary", "example-feedback-list", kind, text, [
      { state: kind === "failed" ? "failed" : kind === "running" ? "running" : "pending", text },
    ]);
  },
};
