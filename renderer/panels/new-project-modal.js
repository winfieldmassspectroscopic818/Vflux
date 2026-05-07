"use strict";
const NewProjectModal = {
  _allBoards: [],
  init() {
    this._modal = document.getElementById("new-project-modal");
    this._nameEl = document.getElementById("modal-project-name");
    this._locEl = document.getElementById("modal-project-location");
    this._pathEl = document.getElementById("modal-full-path");
    this._topEl = document.getElementById("modal-top-module");
    this._langEl = document.getElementById("modal-language");
    this._boardSel = document.getElementById("modal-board-select");
    this._templateChk = document.getElementById("modal-create-template");
    this._pcfChk = document.getElementById("modal-gen-pcf");
    this._advancedChk = document.getElementById("modal-advanced-skeleton");
    this._vscodeChk = document.getElementById("modal-open-vscode");

    document.getElementById("btn-new-project").addEventListener("click", () => this.open());
    document.getElementById("modal-close").addEventListener("click", () => this.close());
    document.getElementById("modal-cancel").addEventListener("click", () => this.close());
    document.getElementById("modal-create").addEventListener("click", () => this.create());
    document.getElementById("modal-browse-location").addEventListener("click", () => this._browseLoc());
    this._nameEl.addEventListener("input", () => this._updatePath());
    this._locEl.addEventListener("input", () => this._updatePath());
  },
  async open() {
    this._allBoards = await window.vflux.boardList();
    this._boardSel.innerHTML = '<option value="">稍后选择</option>' + this._allBoards.map(b => `<option value="${b._filename}">${b.board?.name||b._filename}</option>`).join("");
    this._modal.style.display = "flex";
    this._nameEl.value = "my_fpga_project"; this._locEl.value = "";
    this._topEl.value = "top"; this._langEl.value = "verilog";
    this._templateChk.checked = true; this._pcfChk.checked = true; this._advancedChk.checked = true; this._vscodeChk.checked = true;
    this._updatePath(); this._nameEl.focus();
  },
  close() { this._modal.style.display = "none"; },
  _updatePath() {
    const name = this._nameEl.value.trim() || "my_project", loc = this._locEl.value.trim();
    this._pathEl.textContent = loc ? loc + (loc.includes("\\")?"\\":"/") + name : "(请选择工程位置)";
  },
  async _browseLoc() {
    const r = await window.vflux.openDirectoryDialog({ title: "选择工程父目录" });
    if (r && r.filePaths && r.filePaths.length > 0) { this._locEl.value = r.filePaths[0]; this._updatePath(); }
  },
  async create() {
    const name = this._nameEl.value.trim(), loc = this._locEl.value.trim();
    const topModule = this._topEl.value.trim() || "top", language = this._langEl.value;
    const createTemplate = this._templateChk.checked, genPcf = this._pcfChk.checked, createAdvanced = this._advancedChk.checked, openVs = this._vscodeChk.checked;
    const boardFile = this._boardSel.value;

    if (!name) { App.setStatus("请输入工程名称"); return; }
    if (!loc) { App.setStatus("请选择工程位置"); return; }

    const sep = loc.includes("\\") ? "\\" : "/", projectDir = loc + sep + name;
    App.setStatus("正在创建工程: " + name + " ...");
    App.globalLog("新建工程: " + projectDir);
    await window.vflux.createProjectDir(projectDir);

    if (createTemplate) {
      const r = await window.vflux.generateTemplate(projectDir, topModule, language);
      if (r.success) App.globalLog("已生成顶层模板: " + r.filepath);
      const r2 = await window.vflux.generateTbTemplate(projectDir, topModule, language);
      if (r2.success) App.globalLog("已生成 TB 模板: " + r2.filepath);
    }
    if (createAdvanced) {
      const skeleton = await window.vflux.generateProjectSkeleton(projectDir, topModule, language);
      if (skeleton.success) App.globalLog("已生成专业工程骨架: " + (skeleton.created || []).length + " 个文件");
    }

    Config.create(name, projectDir, topModule, language);
    if (createTemplate) Config.data.project.sources = ["src/" + topModule + (language==="vhdl"?".vhd":language==="sv"?".sv":".v")];

    // 处理板卡选择和 PCF 生成
    if (boardFile) {
      const bd = await window.vflux.boardLoad(boardFile);
      Config.setBoard(bd);
      document.getElementById("board-name").textContent = bd.board?.name || boardFile;
      PanelBoard._selectedFilename = boardFile;
      Pipeline.set("board", "success");

      if (genPcf) {
        const pcfR = await window.vflux.generatePcf(boardFile, topModule);
        if (pcfR.success) {
          const pcfPath = "constraints/" + topModule + ".pcf";
          await window.vflux.writeText(projectDir + sep + pcfPath, pcfR.content);
          Config.data.project.constraints = [pcfPath];
          App.globalLog("已自动生成约束文件: " + pcfPath);
        }
      }
    }

    const yamlPath = projectDir + sep + name + ".vflux.yaml";
    await Config.save(yamlPath);

    Pipeline.init(); Pipeline.set("project", "success");
    if (boardFile) Pipeline.set("board", "success");
    document.getElementById("project-name").textContent = name;
    App.switchPanel("project"); PanelProject.refresh();
    if (boardFile) await PanelBoard.refresh();
    PanelToolchain.refresh();
    App.setStatus("工程已创建: " + projectDir);
    this.close();

    if (openVs) {
      const vsR = await window.vflux.openVscode(projectDir);
      if (!vsR.success) App.globalLog("未能自动打开 VS Code: " + (vsR.reason||""));
    }
    App.globalLog("工程创建完成: " + projectDir);
  },
};
