/**
 * Vflux 主应用逻辑：负责面板切换、工具执行桥接和全局状态展示。
 */
"use strict";

const App = {
  panels: {
    dashboard: PanelDashboard,
    project: PanelProject,
    examples: PanelExamples,
    board: PanelBoard,
    toolchain: PanelToolchain,
    check: PanelCheck,
    synthesis: PanelSynthesis,
    pnr: PanelPnr,
    pack: PanelPack,
    timing: PanelTiming,
    floorplan: PanelFloorplan,
    program: PanelProgram,
    simulation: PanelSimulation,
    formal: PanelFormal,
    surfer: PanelSurfer,
    mcy: PanelMcy,
    verilator: PanelVerilator,
    report: PanelReport,
    "build-all": PanelBuildAll,
  },

  _activePanel: "project",
  _toolOutputCleanup: null,
  _runningToolId: null,
  _runningToolCallback: null,

  async init() {
    Pipeline.init();
    NewProjectModal.init();
    I18n.init();
    OptionHelp.init();
    Object.values(this.panels).forEach((panel) => {
      if (panel.init) panel.init();
    });

    document.querySelectorAll(".pipeline-step").forEach((item) => {
      item.addEventListener("click", () => this.switchPanel(item.dataset.panel));
    });
    this._bindPipelineGroups();
    document.getElementById("btn-open-project").addEventListener("click", () => this.openProject());
    document.getElementById("btn-save-project").addEventListener("click", () => this.saveProject());
    document.getElementById("btn-open-project-dir").addEventListener("click", () => this.openProjectDir());
    document.getElementById("btn-menu-project-page").addEventListener("click", () => this.switchPanel("project"));
    document.getElementById("btn-open-report-page").addEventListener("click", () => this.switchPanel("report"));
    document.getElementById("btn-menu-build").addEventListener("click", () => this.switchPanel("build-all"));
    document.getElementById("btn-menu-bitstream").addEventListener("click", () => this.switchPanel("pack"));
    document.getElementById("btn-menu-program").addEventListener("click", () => this.switchPanel("program"));
    document.getElementById("btn-menu-debug").addEventListener("click", () => this.switchPanel("simulation"));
    this._restoreTheme();
    document.getElementById("btn-toggle-theme").addEventListener("click", () => this._toggleTheme());
    document.getElementById("btn-toggle-compact").addEventListener("click", () => {
      document.body.classList.toggle("compact");
      this.setStatus(document.body.classList.contains("compact") ? "已启用紧凑模式" : "已关闭紧凑模式");
    });
    document.getElementById("btn-toggle-bottom-log").addEventListener("click", () => {
      document.getElementById("bottom-log").classList.toggle("collapsed");
    });
    document.getElementById("bottom-log-toggle").addEventListener("click", () => {
      document.getElementById("bottom-log").classList.toggle("collapsed");
    });

    this._toolOutputCleanup = window.vflux.onToolOutput((data) => {
      if (data.type === "stdout") {
        this.globalLog(data.text, false);
        if (this._runningToolCallback) this._runningToolCallback(data.text, "stdout");
      } else if (data.type === "stderr") {
        this.globalLog("[stderr] " + data.text, false);
        if (this._runningToolCallback) this._runningToolCallback(data.text, "stderr");
      }
    });

    this._bindToolchainApply();
    this.switchPanel("dashboard");
    this.setStatus("就绪");
  },

  _bindToolchainApply() {
    const panel = document.getElementById("panel-toolchain");
    if (!panel) return;
    const body = panel.querySelector(".panel-body");
    if (!body || body.querySelector("#btn-apply-toolchain")) return;
    const btn = document.createElement("button");
    btn.id = "btn-apply-toolchain";
    btn.className = "btn-primary";
    btn.textContent = "应用工具链配置";
    btn.style.marginTop = "8px";
    btn.addEventListener("click", async () => {
      await PanelToolchain.apply();
    });
    body.appendChild(btn);
  },

  _bindPipelineGroups() {
    const saved = this._loadCollapsedGroups();
    document.querySelectorAll(".pipeline-group[data-group]").forEach((group) => {
      const key = group.dataset.group;
      group.addEventListener("click", () => this._togglePipelineGroup(key));
      this._setPipelineGroupCollapsed(key, !!saved[key], false);
    });
  },

  _togglePipelineGroup(key) {
    const group = document.querySelector(`.pipeline-group[data-group="${key}"]`);
    if (!group) return;
    const collapsed = !group.classList.contains("collapsed");
    this._setPipelineGroupCollapsed(key, collapsed, true);
  },

  _setPipelineGroupCollapsed(key, collapsed, persist) {
    const group = document.querySelector(`.pipeline-group[data-group="${key}"]`);
    if (!group) return;
    group.classList.toggle("collapsed", collapsed);
    let item = group.nextElementSibling;
    while (item && !item.classList.contains("pipeline-group")) {
      if (item.classList.contains("pipeline-step")) item.classList.toggle("group-hidden", collapsed);
      item = item.nextElementSibling;
    }
    if (persist) {
      const saved = this._loadCollapsedGroups();
      saved[key] = collapsed;
      localStorage.setItem("vflux.pipeline.collapsedGroups", JSON.stringify(saved));
    }
  },

  _loadCollapsedGroups() {
    try {
      return JSON.parse(localStorage.getItem("vflux.pipeline.collapsedGroups") || "{}");
    } catch (_) {
      return {};
    }
  },

  _restoreTheme() {
    const theme = localStorage.getItem("vflux.theme") || "dark";
    document.body.classList.toggle("theme-light", theme === "light");
    this._updateThemeButton();
  },

  _toggleTheme() {
    const light = !document.body.classList.contains("theme-light");
    document.body.classList.toggle("theme-light", light);
    localStorage.setItem("vflux.theme", light ? "light" : "dark");
    this._updateThemeButton();
    this.setStatus(light ? "已启用浅色主题" : "已启用深色主题");
  },

  _updateThemeButton() {
    const button = document.getElementById("btn-toggle-theme");
    if (button) button.textContent = document.body.classList.contains("theme-light") ? "深色主题" : "浅色主题";
  },

  switchPanel(panelName) {
    if (!this.panels[panelName]) return;
    const navItem = document.querySelector(`.pipeline-step[data-panel="${panelName}"]`);
    if (navItem?.classList.contains("group-hidden")) {
      const group = this._findOwningPipelineGroup(navItem);
      if (group?.dataset.group) this._setPipelineGroupCollapsed(group.dataset.group, false, true);
    }
    document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("visible"));
    const el = document.getElementById("panel-" + panelName);
    if (el) el.classList.add("visible");
    document.querySelectorAll(".pipeline-step").forEach((item) => {
      item.classList.toggle("active", item.dataset.panel === panelName);
    });
    this._activePanel = panelName;
    if (this.panels[panelName].refresh) this.panels[panelName].refresh();
    if (this.panels[panelName].onShow) this.panels[panelName].onShow();
    I18n.apply();
  },

  _findOwningPipelineGroup(item) {
    let cursor = item?.previousElementSibling;
    while (cursor) {
      if (cursor.classList.contains("pipeline-group")) return cursor;
      cursor = cursor.previousElementSibling;
    }
    return null;
  },

  refreshPanels(...names) {
    names.forEach((name) => {
      if (this.panels[name] && this.panels[name].refresh) this.panels[name].refresh();
    });
    I18n.apply();
  },

  async openProject() {
    const result = await window.vflux.openFileDialog({
      title: "打开 Vflux 工程文件",
      filters: [
        { name: "Vflux Project", extensions: ["yaml", "yml"] },
        { name: "All", extensions: ["*"] },
      ],
      properties: ["openFile"],
    });
    if (!result || result.canceled || !result.filePaths || result.filePaths.length === 0) return;

    const filepath = result.filePaths[0];
    await Config.load(filepath);
    document.getElementById("project-name").textContent = Config.data.project.name || "未命名工程";
    document.getElementById("board-name").textContent = Config.data.board.name || "未选择板卡";
    PanelProject.refresh();
    this.switchPanel("project");
    if (Config.data.board.filename) {
      PanelBoard._selectedFilename = Config.data.board.filename;
      await PanelBoard.refresh();
    }
    PanelToolchain.refresh();
    Pipeline.init();
    Pipeline.set("project", "success");
    if (Config.data.board.filename) Pipeline.set("board", "success");
    this.setStatus("已打开工程: " + filepath);
    this.globalLog("已加载 " + filepath);
  },

  async saveProject() {
    const filepath = Config.getFilePath();
    if (filepath) {
      await Config.save(filepath);
      this.setStatus("已保存 " + filepath);
      this.globalLog("已保存 " + filepath);
      return;
    }

    const result = await window.vflux.openFileDialog({
      title: "保存 Vflux 工程",
      defaultPath: (Config.data.project.name || "project") + ".vflux.yaml",
      filters: [{ name: "Vflux Project", extensions: ["yaml"] }],
      properties: ["saveFile"],
    });
    if (result && !result.canceled && result.filePath) {
      await Config.save(result.filePath);
      this.setStatus("已保存 " + result.filePath);
      this.globalLog("已保存 " + result.filePath);
    }
  },

  async openProjectDir() {
    const dir = Config.getProjectDir();
    if (!dir || dir === ".") {
      this.setStatus("还没有可打开的工程目录");
      return;
    }
    await window.vflux.shellOpenDir(dir);
  },

  async runTool(id, command, args, cwd, onOutput) {
    this._runningToolId = id;
    this._runningToolCallback = onOutput || null;
    const result = await window.vflux.toolRun(id, command, args, cwd);
    this._runningToolId = null;
    this._runningToolCallback = null;
    const success = result.type === "exit" && result.code === 0;
    if (!success) {
      this.globalLog(`工具 ${command} 退出码: ${result.code}（失败）`);
    }
    return { success, code: result.code || -1 };
  },

  async cancelTool(id) {
    if (this._runningToolId === id) {
      await window.vflux.toolCancel(id);
      this._runningToolId = null;
      this._runningToolCallback = null;
    }
  },

  globalLog(message, appendNewline = true) {
    const el = document.getElementById("global-log");
    if (!el) return;
    const ts = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    if (appendNewline) el.textContent += "[" + ts + "] " + message + "\n";
    else el.textContent += message;
    el.scrollTop = el.scrollHeight;
  },

  setStatus(text) {
    const el = document.getElementById("status-text");
    if (el) el.textContent = text;
  },
};

document.addEventListener("DOMContentLoaded", () => {
  App.init();
});
