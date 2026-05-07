/**
 * Vflux Panel: 工程配置 (增强版)
 * - 新建工程对话框流程
 * - 自动检测工程目录下 HDL 源文件
 * - 自动推断顶层模块
 * - 可视化文件管理器（添加/移除）
 * - 从板卡资源自动生成 PCF 约束
 */
"use strict";

const PanelProject = {
  _detectedModules: [],

  init() {
    document.getElementById("btn-browse-dir").addEventListener("click", () => this._browseDir());
    document.getElementById("btn-add-source").addEventListener("click", () => this._addSource());
    document.getElementById("btn-add-constraint").addEventListener("click", () => this._addConstraint());
    document.getElementById("btn-auto-detect").addEventListener("click", () => this._autoDetect());
    document.getElementById("btn-import-project").addEventListener("click", () => this._importExistingProject());
    document.getElementById("btn-detect-top").addEventListener("click", () => this._detectTop());
    document.getElementById("btn-gen-pcf").addEventListener("click", () => this._genPcf());
    document.getElementById("btn-apply-project").addEventListener("click", () => this._apply());
    document.getElementById("btn-save-project-file").addEventListener("click", () => this._save());

    // 顶部栏的保存按钮
  },

  refresh() {
    const d = Config.data.project;
    document.getElementById("cfg-project-name").value = d.name || "";
    document.getElementById("cfg-project-dir").value = d.directory || "";
    document.getElementById("cfg-top-module").value = d.top_module || "top";
    document.getElementById("cfg-lang").value = d.language || "verilog";
    document.getElementById("cfg-constraints").value = (d.constraints || []).join("\n");
    this._renderSourceList();
  },

  // ==========================================================================
  // 文件列表渲染
  // ==========================================================================
  _renderSourceList() {
    const sources = Config.data.project.sources || [];
    const listEl = document.getElementById("source-file-list");
    const countEl = document.getElementById("source-count");

    if (countEl) countEl.textContent = sources.length + " 个文件";

    if (!listEl) return;

    if (sources.length === 0) {
      listEl.innerHTML = `<li class="file-empty">尚未添加源文件，请点击"自动检测"或手动添加</li>`;
      return;
    }

    listEl.innerHTML = sources
      .map(
        (f, i) => `
      <li class="file-item">
        <span class="file-path" title="${f}">📄 ${f}</span>
        <button class="btn-icon btn-remove-source" data-index="${i}" title="移除">✕</button>
      </li>`
      )
      .join("");

    // 绑定移除按钮
    listEl.querySelectorAll(".btn-remove-source").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index);
        Config.data.project.sources.splice(idx, 1);
        this._renderSourceList();
      });
    });
  },

  // ==========================================================================
  // 浏览目录
  // ==========================================================================
  async _browseDir() {
    const result = await window.vflux.openDirectoryDialog({ title: "选择工程目录" });
    if (result && result.filePaths && result.filePaths.length > 0) {
      const dir = result.filePaths[0];
      document.getElementById("cfg-project-dir").value = dir;
      // 自动从目录名推断工程名
      const dirName = dir.split(/[/\\]/).filter(Boolean).pop();
      const nameInput = document.getElementById("cfg-project-name");
      if (!nameInput.value.trim()) {
        nameInput.value = dirName;
      }
    }
  },

  // ==========================================================================
  // 手动添加源文件
  // ==========================================================================
  async _addSource() {
    const result = await window.vflux.openFileDialog({
      title: "添加源文件",
      filters: [
        { name: "HDL & Constraint Files", extensions: ["v", "sv", "vhd", "vhdl", "vh", "svh"] },
        { name: "All Files", extensions: ["*"] },
      ],
      properties: ["openFile", "multiSelections"],
    });
    if (result && result.filePaths && result.filePaths.length > 0) {
      for (const fp of result.filePaths) {
        if (!Config.data.project.sources.includes(fp)) {
          Config.data.project.sources.push(fp);
        }
      }
      this._renderSourceList();
    }
  },

  // ==========================================================================
  // 自动检测源文件
  // ==========================================================================
  async _autoDetect() {
    const dir = document.getElementById("cfg-project-dir").value.trim();
    if (!dir) {
      App.setStatus("请先选择工程目录");
      App.globalLog("自动检测：请先选择工程目录");
      return;
    }

    App.setStatus("正在扫描工程目录中的 HDL 文件...");
    App.globalLog("自动检测：扫描 " + dir);

    const files = await window.vflux.scanSources(dir);
    if (files.length === 0) {
      App.setStatus("未检测到 HDL 源文件");
      App.globalLog("自动检测：未找到 .v/.sv/.vhd 文件");
      return;
    }

    // 将绝对路径转为相对路径
    const relFiles = files.map((f) => {
      const absDir = dir.replace(/\\/g, "/") + "/";
      const absFile = f.replace(/\\/g, "/");
      return absFile.startsWith(absDir) ? absFile.substring(absDir.length) : f;
    });

    Config.data.project.sources = relFiles;
    this._renderSourceList();

    // 自动推断顶层模块
    const modules = await window.vflux.detectTopModule(files);
    this._detectedModules = modules;
    if (modules.length > 0) {
      document.getElementById("cfg-top-module").value = modules[0].module;
      App.globalLog(`自动检测：找到 ${files.length} 个文件，推断顶层模块: ${modules[0].module}`);
    }

    App.setStatus(`扫描完成：找到 ${files.length} 个 HDL 文件`);
    App.globalLog(`自动检测结果：\n  ${relFiles.join("\n  ")}`);
  },

  async _importExistingProject() {
    const result = await window.vflux.openDirectoryDialog({ title: "选择要导入的 HDL 工程目录" });
    if (!result || result.canceled || !result.filePaths?.[0]) return;
    const dir = result.filePaths[0];
    document.getElementById("cfg-project-dir").value = dir;
    const dirName = dir.split(/[/\\]/).filter(Boolean).pop() || "imported_fpga_project";
    document.getElementById("cfg-project-name").value = document.getElementById("cfg-project-name").value.trim() || dirName;

    App.setStatus("正在导入现有工程...");
    const sources = await window.vflux.scanSources(dir);
    const constraints = await window.vflux.scanConstraints(dir);
    const rel = (filepath) => {
      const root = dir.replace(/\\/g, "/").replace(/\/$/, "") + "/";
      const normalized = filepath.replace(/\\/g, "/");
      return normalized.startsWith(root) ? normalized.slice(root.length) : filepath;
    };

    Config.data.project.sources = sources.map(rel);
    document.getElementById("cfg-constraints").value = constraints.map(rel).join("\n");
    this._renderSourceList();

    const modules = await window.vflux.detectTopModule(sources);
    this._detectedModules = modules;
    if (modules[0]?.module) document.getElementById("cfg-top-module").value = modules[0].module;

    // 导入只修改工程草稿，用户确认后再写入 project.vflux.yaml。
    App.setStatus(`导入完成：${sources.length} 个 HDL 文件，${constraints.length} 个约束文件`);
    App.globalLog(`导入现有工程：${dir}\n  HDL: ${sources.length}\n  Constraints: ${constraints.length}\n  Top: ${modules[0]?.module || "未推断"}`);
  },

  // ==========================================================================
  // 手动触发顶层模块检测
  // ==========================================================================
  async _detectTop() {
    const dir = document.getElementById("cfg-project-dir").value.trim();
    const sources = Config.data.project.sources || [];

    if (sources.length === 0 && !dir) {
      App.setStatus("请先添加源文件或选择工程目录");
      return;
    }

    let files;
    if (sources.length > 0 && dir) {
      files = sources.map((s) => {
        const sep = s.includes("/") ? "/" : "\\";
        return dir + sep + s;
      });
    } else if (dir) {
      files = await window.vflux.scanSources(dir);
    } else {
      files = sources;
    }

    const modules = await window.vflux.detectTopModule(files);
    this._detectedModules = modules;

    if (modules.length === 0) {
      App.setStatus("未检测到任何 module 声明");
      return;
    }

    // 如果有多个候选，显示为下拉选择
    if (modules.length > 1) {
      App.globalLog("检测到多个模块候选：");
      modules.forEach((m, i) => {
        App.globalLog(`  ${i + 1}. ${m.module} (${m.file}, score=${m.score})`);
      });
    }

    document.getElementById("cfg-top-module").value = modules[0].module;
    App.setStatus(`检测到顶层模块: ${modules[0].module}`);
  },

  // ==========================================================================
  // 添加约束文件
  // ==========================================================================
  async _addConstraint() {
    const result = await window.vflux.openFileDialog({
      title: "选择约束文件",
      filters: [
        { name: "Constraint Files", extensions: ["pcf", "cst", "lpf", "sdc"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });
    if (result && result.filePaths && result.filePaths.length > 0) {
      document.getElementById("cfg-constraints").value = result.filePaths[0];
    }
  },

  // ==========================================================================
  // 自动生成 PCF
  // ==========================================================================
  async _genPcf() {
    const boardFilename = Config.data.board.filename;
    if (!boardFilename) {
      App.setStatus("请先在[板卡]页面选择目标板卡");
      App.globalLog("生成 PCF 失败：未选择板卡");
      return;
    }

    const topModule = document.getElementById("cfg-top-module").value.trim() || "top";
    const result = await window.vflux.generatePcf(boardFilename, topModule);

    if (result.success) {
      const dir = Config.data.project.directory || ".";
      const pcfPath = `${dir}/constraints/${topModule}.pcf`;
      document.getElementById("cfg-constraints").value = pcfPath;

      // 自动写入文件
      await window.vflux.writeText(pcfPath, result.content);
      App.setStatus("PCF 约束文件已生成: " + pcfPath);
      App.globalLog("PCF 生成内容:\n" + result.content);
    } else {
      App.setStatus("PCF 生成失败: " + (result.reason || "未知错误"));
    }
  },

  // ==========================================================================
  // 应用配置
  // ==========================================================================
  _apply() {
    const name = document.getElementById("cfg-project-name").value.trim();
    const dir = document.getElementById("cfg-project-dir").value.trim();

    if (!name) {
      App.setStatus("请输入工程名称");
      return;
    }

    Config.data.project.name = name;
    Config.data.project.directory = dir;
    Config.data.project.top_module = document.getElementById("cfg-top-module").value.trim() || "top";
    Config.data.project.language = document.getElementById("cfg-lang").value;
    Config.data.project.constraints = document.getElementById("cfg-constraints").value
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    // 源文件已在 _renderSourceList/移除按钮中实时同步到 Config

    Pipeline.set("project", "success");
    App.setStatus("工程配置已应用");
    App.globalLog("工程配置已应用: " + name + " → " + dir);

    // 更新顶部栏
    document.getElementById("project-name").textContent = name;

    // 刷新后续面板
    App.refreshPanels("check", "synthesis", "pnr", "pack", "program", "simulation");
    Pipeline.resetFrom("check");
  },

  // ==========================================================================
  // 保存工程文件
  // ==========================================================================
  async _save() {
    // 先应用当前配置
    this._apply();

    const filepath = Config.getFilePath();
    if (filepath) {
      await Config.save(filepath);
      App.setStatus("工程已保存: " + filepath);
      App.globalLog("工程已保存: " + filepath);
    } else {
      // 另存为
      const result = await window.vflux.openFileDialog({
        title: "保存 Vflux 工程文件",
        defaultPath: (Config.data.project.name || "project") + ".vflux.yaml",
        filters: [{ name: "Vflux Project", extensions: ["yaml"] }],
        properties: ["saveFile"],
      });
      if (result && !result.canceled && result.filePath) {
        await Config.save(result.filePath);
        App.setStatus("工程已保存: " + result.filePath);
        App.globalLog("工程已保存: " + result.filePath);
      }
    }
  },
};
