"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("vflux", {
  platform: process.platform,
  // -- 工具链 --
  toolRun: (id, command, args, cwd) =>
    ipcRenderer.invoke("tool:run", { id, command, args, cwd }),
  toolCancel: (id) => ipcRenderer.invoke("tool:cancel", { id }),
  setToolchainPath: (dirpath) => ipcRenderer.invoke("toolchain:setPath", dirpath || ""),
  probeToolchain: (tools) => ipcRenderer.invoke("toolchain:probe", tools || []),
  onToolOutput: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on("tool:output", handler);
    return () => ipcRenderer.removeListener("tool:output", handler);
  },

  // -- 文件对话框 --
  openFileDialog: (options) => ipcRenderer.invoke("dialog:openFile", options || {}),
  openDirectoryDialog: (options) =>
    ipcRenderer.invoke("dialog:openDirectory", options || {}),

  // -- YAML --
  readYaml: (filepath) => ipcRenderer.invoke("file:readYaml", filepath),
  writeYaml: (filepath, data) =>
    ipcRenderer.invoke("file:writeYaml", { filepath, data }),

  // -- 文本 --
  readText: (filepath) => ipcRenderer.invoke("file:readText", filepath),
  writeText: (filepath, content) =>
    ipcRenderer.invoke("file:writeText", { filepath, content }),

  // -- 文件检查 --
  fileExists: (filepath) => ipcRenderer.invoke("file:exists", filepath),
  copyFileToDirectory: (source, targetDir) =>
    ipcRenderer.invoke("file:copyToDirectory", { source, targetDir }),
  listDir: (dirpath) => ipcRenderer.invoke("file:listDir", dirpath),

  // -- 板卡 --
  boardList: (projectDir) => ipcRenderer.invoke("board:list", projectDir || ""),
  boardLoad: (filename, projectDir) => ipcRenderer.invoke("board:load", { filename, projectDir: projectDir || "" }),

  // -- 例程 --
  exampleList: () => ipcRenderer.invoke("example:list"),
  createExampleProject: (exampleId, targetParent, projectName, options) =>
    ipcRenderer.invoke("example:createProject", { exampleId, targetParent, projectName, options: options || {} }),

  // -- 工程辅助 --
  scanSources: (dirpath) => ipcRenderer.invoke("project:scanSources", dirpath),
  scanConstraints: (dirpath) => ipcRenderer.invoke("project:scanConstraints", dirpath),
  detectTopModule: (filepaths) => ipcRenderer.invoke("project:detectTopModule", filepaths),
  healthCheckProject: (project) => ipcRenderer.invoke("project:healthCheck", project || {}),
  exportDiagnosticPackage: (payload) => ipcRenderer.invoke("project:exportDiagnosticPackage", payload || {}),
  createProjectDir: (dirpath) => ipcRenderer.invoke("project:createDir", dirpath),
  generatePcf: (boardYaml, topModule) =>
    ipcRenderer.invoke("project:generatePcf", { boardYaml, topModule }),
  generateTemplate: (dirpath, topModule, language) =>
    ipcRenderer.invoke("project:generateTemplate", { dirpath, topModule, language }),
  generateTbTemplate: (dirpath, topModule, language) =>
    ipcRenderer.invoke("project:generateTbTemplate", { dirpath, topModule, language }),
  generateProjectSkeleton: (dirpath, topModule, language) =>
    ipcRenderer.invoke("project:generateSkeleton", { dirpath, topModule, language }),

  // -- 系统 --
  shellOpenDir: (dirpath) => ipcRenderer.invoke("shell:openDir", dirpath),
  shellOpenPath: (filepath) => ipcRenderer.invoke("shell:openPath", filepath),
  openVscode: (dirpath) => ipcRenderer.invoke("shell:openVscode", dirpath),
});
