"use strict";

const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");

// ============================================================================
// OSS CAD Suite 环境变量配置
// ============================================================================
function findOssCadSuite() {
  const candidates = [
    process.env.YOSYSHQ_ROOT,
    process.env.OSS_CAD_SUITE,
    path.join(__dirname, "..", "..", "oss-cad-suite"),
    path.join(process.resourcesPath || "", "oss-cad-suite"),
    path.join(__dirname, "..", "oss-cad-suite"),
    process.platform === "win32" ? "C:\\oss-cad-suite" : "",
    process.platform !== "win32" ? path.join(process.env.HOME || "", "oss-cad-suite") : "",
    process.platform !== "win32" ? "/opt/oss-cad-suite" : "",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (isOssCadSuiteDir(candidate)) return candidate;
  }
  console.warn("[Vflux] 未找到 OSS CAD Suite，工具链功能可能不可用");
  return null;
}

let OSS_CAD_SUITE_DIR = findOssCadSuite();
let OSS_CAD_BIN_DIR = OSS_CAD_SUITE_DIR ? path.join(OSS_CAD_SUITE_DIR, "bin") : "";

const TOOL_ALIASES = {
  "verilator.exe": ["verilator_bin.exe", "verilator"],
  verilator: ["verilator_bin", "verilator"],
};

function isOssCadSuiteDir(dirpath) {
  if (!dirpath) return false;
  const binDir = path.join(dirpath, "bin");
  const markers = ["environment.bat", "environment", "environment.sh"];
  return fs.existsSync(binDir) && markers.some((name) => fs.existsSync(path.join(dirpath, name)));
}

function platformCommandName(command) {
  if (process.platform !== "win32" && /\.exe$/i.test(command)) return command.replace(/\.exe$/i, "");
  return command;
}

function commandCandidates(command, aliases = []) {
  const raw = [command, ...(TOOL_ALIASES[command] || []), ...aliases].filter(Boolean);
  const expanded = [];
  for (const item of raw) {
    expanded.push(item);
    if (/\.exe$/i.test(item)) expanded.push(item.replace(/\.exe$/i, ""));
    else expanded.push(`${item}.exe`);
  }
  const preferred = process.platform === "win32"
    ? expanded
    : expanded.sort((a, b) => Number(/\.exe$/i.test(a)) - Number(/\.exe$/i.test(b)));
  return [...new Set(preferred)];
}

function setOssCadSuiteDir(dirpath) {
  if (!dirpath) {
    OSS_CAD_SUITE_DIR = findOssCadSuite();
    OSS_CAD_BIN_DIR = OSS_CAD_SUITE_DIR ? path.join(OSS_CAD_SUITE_DIR, "bin") : "";
    return { success: true, path: OSS_CAD_SUITE_DIR || "" };
  }

  if (!isOssCadSuiteDir(dirpath)) {
    return { success: false, reason: "请选择有效的 OSS CAD Suite 根目录（需要包含 environment/environment.bat 和 bin 目录）" };
  }

  // 工具链路径来自 GUI 配置，后续所有命令都会使用这个目录。
  OSS_CAD_SUITE_DIR = dirpath;
  OSS_CAD_BIN_DIR = path.join(dirpath, "bin");
  return { success: true, path: OSS_CAD_SUITE_DIR };
}

function buildToolEnv() {
  const env = { ...process.env };
  if (!OSS_CAD_SUITE_DIR) return env;
  const pythonName = process.platform === "win32" ? "python3.exe" : "python3";
  env.YOSYSHQ_ROOT = OSS_CAD_SUITE_DIR;
  env.PATH = [OSS_CAD_BIN_DIR, path.join(OSS_CAD_SUITE_DIR, "lib"), env.PATH || ""].filter(Boolean).join(path.delimiter);
  env.PYTHON_EXECUTABLE = path.join(OSS_CAD_SUITE_DIR, "lib", pythonName);
  env.QT_PLUGIN_PATH = path.join(OSS_CAD_SUITE_DIR, "lib", "qt5", "plugins");
  env.QT_LOGGING_RULES = "*=false";
  env.OPENFPGALOADER_SOJ_DIR = path.join(OSS_CAD_SUITE_DIR, "share", "openFPGALoader");
  env.GTK_EXE_PREFIX = OSS_CAD_SUITE_DIR;
  env.GTK_DATA_PREFIX = OSS_CAD_SUITE_DIR;
  env.SSL_CERT_FILE = path.join(OSS_CAD_SUITE_DIR, "etc", "cacert.pem");
  return env;
}

// ============================================================================
// 主窗口
// ============================================================================
let mainWindow = null;

function getAppIconPath() {
  const iconName = process.platform === "win32" ? "icon.ico" : "icon.png";
  const candidates = [
    path.join(__dirname, "..", "assets", iconName),
    path.join(process.resourcesPath || "", "assets", iconName),
    path.join(process.resourcesPath || "", iconName),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || undefined;
}

function createWindow() {
  const iconPath = getAppIconPath();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 680,
    title: "Vflux - FPGA Development Studio",
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  mainWindow.setMenuBarVisibility(false);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.setName("Vflux");
if (process.platform === "win32") app.setAppUserModelId("com.vflux.app");

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ============================================================================
// IPC 处理：运行工具链命令
// ============================================================================
function runToolCommand(command, args, cwd, callback) {
  const env = buildToolEnv();
  const fullPath = resolveToolPath(command);
  if (cwd && fs.existsSync(cwd)) {
    // Vflux 将产物按阶段分目录保存，便于定位和版本管理。
    ["output", "output/synthesis", "output/pnr", "output/bitstream", "output/reports", "output/simulation"].forEach((dir) => {
      const outputDir = path.join(cwd, dir);
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    });
  }
  // 直接执行工具可避免把工程文件名拼进 shell 命令，减少路径空格和注入风险。
  const proc = spawn(fullPath, args, { cwd, env, shell: false, windowsHide: true });

  proc.stdout.on("data", (data) => {
    callback({ type: "stdout", text: data.toString() });
  });
  proc.stderr.on("data", (data) => {
    callback({ type: "stderr", text: data.toString() });
  });
  proc.on("close", (code) => {
    callback({ type: "exit", code });
  });
  proc.on("error", (err) => {
    callback({ type: "error", text: err.message });
  });

  return proc;
}

const runningProcesses = {};

ipcMain.handle("tool:run", (event, { id, command, args, cwd }) => {
  return new Promise((resolve) => {
    const proc = runToolCommand(command, args, cwd, (data) => {
      if (data.type === "exit") {
        delete runningProcesses[id];
        resolve({ type: "exit", code: data.code });
      } else {
        mainWindow.webContents.send("tool:output", { id, ...data });
      }
    });
    runningProcesses[id] = proc;
  });
});

ipcMain.handle("tool:cancel", (event, { id }) => {
  if (runningProcesses[id]) {
    runningProcesses[id].kill();
    delete runningProcesses[id];
    return { success: true };
  }
  return { success: false, reason: "no such process" };
});

ipcMain.handle("toolchain:setPath", (event, dirpath) => {
  return setOssCadSuiteDir(dirpath);
});

function probeTool(tool) {
  return new Promise((resolve) => {
    if (!OSS_CAD_BIN_DIR) {
      resolve({ command: tool.command, ok: false, reason: "未找到 OSS CAD Suite" });
      return;
    }

    const candidates = commandCandidates(tool.command, tool.aliases || []);
    const actualCommand = candidates.find((command) => fs.existsSync(path.join(OSS_CAD_BIN_DIR, command)));
    const fullPath = actualCommand ? path.join(OSS_CAD_BIN_DIR, actualCommand) : path.join(OSS_CAD_BIN_DIR, tool.command);
    if (!fs.existsSync(fullPath)) {
      resolve({ command: tool.command, ok: false, reason: "工具不存在" });
      return;
    }

    const env = buildToolEnv();
    const args = tool.versionArgs || ["--version"];
    const proc = spawn(fullPath, args, { env, shell: false, windowsHide: true });
    let output = "";
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve({ command: tool.command, actualCommand, ...result });
    };
    const timer = setTimeout(() => {
      proc.kill();
      finish({ ok: true, version: "已找到，版本检测超时", path: fullPath });
    }, 3000);

    proc.stdout.on("data", (data) => { output += data.toString(); });
    proc.stderr.on("data", (data) => { output += data.toString(); });
    proc.on("error", (err) => {
      clearTimeout(timer);
      finish({ ok: false, reason: err.message, path: fullPath });
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      const firstLine = output.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
      if (code !== 0 && !firstLine) {
        finish({ ok: false, reason: `工具启动失败或异常退出，退出码 ${code}`, path: fullPath });
        return;
      }
      const base = { ok: true, version: firstLine || "已找到", path: fullPath };
      if (!tool.features || !tool.featureArgs) {
        finish(base);
        return;
      }
      const help = spawn(fullPath, tool.featureArgs, { env, shell: false, windowsHide: true });
      let helpOutput = "";
      const helpTimer = setTimeout(() => help.kill(), 3000);
      help.stdout.on("data", (data) => { helpOutput += data.toString(); });
      help.stderr.on("data", (data) => { helpOutput += data.toString(); });
      help.on("error", () => {
        clearTimeout(helpTimer);
        finish({ ...base, features: {} });
      });
      help.on("close", () => {
        clearTimeout(helpTimer);
        const lower = helpOutput.toLowerCase();
        const features = {};
        for (const [name, token] of Object.entries(tool.features || {})) {
          features[name] = lower.includes(String(token).toLowerCase());
        }
        finish({ ...base, features });
      });
    });
  });
}

function resolveToolPath(command) {
  if (!OSS_CAD_BIN_DIR) return platformCommandName(command);
  const candidates = commandCandidates(command);
  const found = candidates.find((candidate) => fs.existsSync(path.join(OSS_CAD_BIN_DIR, candidate)));
  return found ? path.join(OSS_CAD_BIN_DIR, found) : platformCommandName(command);
}

ipcMain.handle("toolchain:probe", async (event, tools) => {
  const list = Array.isArray(tools) ? tools : [];
  const results = [];
  for (const tool of list) {
    results.push(await probeTool(tool));
  }
  return { ossPath: OSS_CAD_SUITE_DIR || "", results };
});

// ============================================================================
// IPC 处理：文件对话 / YAML 读写
// ============================================================================
const yaml = require("js-yaml");

ipcMain.handle("dialog:openFile", async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

ipcMain.handle("dialog:openDirectory", async (event, options) => {
  return await dialog.showOpenDialog(mainWindow, {
    ...options,
    properties: ["openDirectory"],
  });
});

ipcMain.handle("file:readYaml", (event, filepath) => {
  const content = fs.readFileSync(filepath, "utf-8");
  return yaml.load(content);
});

ipcMain.handle("file:writeYaml", (event, { filepath, data }) => {
  const content = yaml.dump(data, { lineWidth: -1, noRefs: true });
  fs.writeFileSync(filepath, content, "utf-8");
  return { success: true };
});

ipcMain.handle("file:readText", (event, filepath) => {
  return fs.readFileSync(filepath, "utf-8");
});

ipcMain.handle("file:writeText", (event, { filepath, content }) => {
  const parent = path.dirname(filepath);
  if (parent && !fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
  fs.writeFileSync(filepath, content, "utf-8");
  return { success: true };
});

ipcMain.handle("file:exists", (event, filepath) => {
  return fs.existsSync(filepath);
});

ipcMain.handle("file:copyToDirectory", (event, { source, targetDir }) => {
  if (!source || !fs.existsSync(source)) {
    return { success: false, reason: "源文件不存在" };
  }
  if (!targetDir || !fs.existsSync(targetDir)) {
    return { success: false, reason: "目标目录不存在" };
  }
  const stat = fs.statSync(targetDir);
  if (!stat.isDirectory()) {
    return { success: false, reason: "目标路径不是目录" };
  }

  // 拖拽烧录类板卡会把开发板暴露成盘符，GUI 直接复制 bin 到该目录。
  const target = path.join(targetDir, path.basename(source));
  fs.copyFileSync(source, target);
  return { success: true, target };
});

ipcMain.handle("file:listDir", (event, dirpath) => {
  if (!fs.existsSync(dirpath)) return [];
  return fs.readdirSync(dirpath);
});

// ============================================================================
// IPC 处理：加载板卡
// ============================================================================
function readBoardFile(filepath, filename, source) {
  const content = fs.readFileSync(filepath, "utf-8");
  const data = yaml.load(content);
  data._filename = filename;
  data._source = source;
  return data;
}

ipcMain.handle("board:list", (event, projectDir) => {
  const boardsDir = path.join(__dirname, "..", "boards");
  const files = fs.readdirSync(boardsDir);
  const boards = [];
  for (const file of files) {
    if (file.endsWith(".yaml") || file.endsWith(".yml")) {
      boards.push(readBoardFile(path.join(boardsDir, file), file, "builtin"));
    }
  }
  const projectBoardsDir = projectDir ? path.join(projectDir, "boards") : "";
  if (projectBoardsDir && fs.existsSync(projectBoardsDir)) {
    for (const file of fs.readdirSync(projectBoardsDir)) {
      if (file.endsWith(".yaml") || file.endsWith(".yml")) {
        boards.push(readBoardFile(path.join(projectBoardsDir, file), `project:boards/${file}`, "project"));
      }
    }
  }
  return boards;
});

ipcMain.handle("board:load", (event, { filename, projectDir }) => {
  const filepath = String(filename || "").startsWith("project:")
    ? path.join(projectDir || "", String(filename).replace(/^project:/, ""))
    : path.join(__dirname, "..", "boards", filename);
  const content = fs.readFileSync(filepath, "utf-8");
  const data = yaml.load(content);
  data._filename = filename;
  return data;
});

// ============================================================================
// IPC 处理：内置例程
// ============================================================================
function copyDirectoryRecursive(source, target) {
  if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const src = path.join(source, entry.name);
    const dst = path.join(target, entry.name);
    if (entry.isDirectory()) copyDirectoryRecursive(src, dst);
    else if (entry.isFile()) fs.copyFileSync(src, dst);
  }
}

ipcMain.handle("example:list", () => {
  const examplesDir = path.join(__dirname, "..", "examples");
  if (!fs.existsSync(examplesDir)) return [];
  return fs.readdirSync(examplesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const metaPath = path.join(examplesDir, entry.name, "example.yaml");
      if (!fs.existsSync(metaPath)) return null;
      const meta = yaml.load(fs.readFileSync(metaPath, "utf-8")) || {};
      return { id: entry.name, ...meta };
    })
    .filter(Boolean);
});

ipcMain.handle("example:createProject", (event, { exampleId, targetParent, projectName, options }) => {
  const examplesDir = path.join(__dirname, "..", "examples");
  const source = path.join(examplesDir, exampleId || "");
  if (!exampleId || !fs.existsSync(source)) return { success: false, reason: "例程不存在" };
  if (!targetParent || !fs.existsSync(targetParent)) return { success: false, reason: "请选择有效的目标目录" };

  const metaPath = path.join(source, "example.yaml");
  const meta = fs.existsSync(metaPath) ? yaml.load(fs.readFileSync(metaPath, "utf-8")) || {} : {};
  const name = (projectName || meta.project_name || exampleId).replace(/[<>:"/\\|?*]/g, "_");
  const target = path.join(targetParent, name);
  if (fs.existsSync(target)) return { success: false, reason: "目标工程目录已存在" };

  copyDirectoryRecursive(source, target);
  fs.rmSync(path.join(target, "example.yaml"), { force: true });

  const projectFile = path.join(target, "project.vflux.yaml");
  if (fs.existsSync(projectFile)) {
    const data = yaml.load(fs.readFileSync(projectFile, "utf-8")) || {};
    data.schema_version = data.schema_version || 1;
    data.app_version = data.app_version || "1.0.0-preview";
    data.project = data.project || {};
    data.project.name = name;
    data.project.directory = target;
    fs.writeFileSync(projectFile, yaml.dump(data, { lineWidth: -1, noRefs: true }), "utf-8");
  }

  const skeleton = options?.advancedSkeleton
    ? generateProjectSkeletonFiles(target, meta.top_module || "top", meta.language || "verilog")
    : { created: [] };

  return { success: true, projectDir: target, projectFile, skeletonFiles: skeleton.created || [] };
});

// ============================================================================
// IPC 处理：工程辅助功能
// ============================================================================
ipcMain.handle("project:scanSources", (event, dirpath) => {
  const extensions = [".v", ".sv", ".vh", ".svh", ".vhd", ".vhdl"];
  const results = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const bn = entry.name.toLowerCase();
        if (entry.name.startsWith(".") || bn === "output" || bn === "build" || bn === "node_modules") continue;
        walk(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (extensions.includes(ext)) {
          results.push(full);
        }
      }
    }
  }
  walk(dirpath);
  return results;
});

ipcMain.handle("project:scanConstraints", (event, dirpath) => {
  const extensions = [".pcf", ".lpf", ".cst", ".sdc", ".xdc"];
  const results = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const bn = entry.name.toLowerCase();
        if (entry.name.startsWith(".") || bn === "output" || bn === "build" || bn === "node_modules") continue;
        walk(full);
      } else if (entry.isFile() && extensions.includes(path.extname(entry.name).toLowerCase())) {
        results.push(full);
      }
    }
  }
  walk(dirpath);
  return results;
});

ipcMain.handle("project:detectTopModule", (event, filepaths) => {
  const candidates = [];
  for (const fp of (filepaths || [])) {
    if (!fs.existsSync(fp)) continue;
    const content = fs.readFileSync(fp, "utf-8");
    const re = /^\s*module\s+(\w+)\s*[#(]/gm;
    let m;
    while ((m = re.exec(content)) !== null) {
      candidates.push({ module: m[1], file: fp });
    }
  }
  const scored = candidates.map((c) => {
    const base = path.basename(c.file, path.extname(c.file));
    let score = 0;
    if (c.module === base) score = 2;
    if (c.module.toLowerCase().includes("top")) score += 3;
    if (c.module === "top") score += 5;
    return { ...c, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 10);
});

function resolveProjectPath(projectDir, filepath) {
  if (!filepath) return "";
  if (path.isAbsolute(filepath)) return filepath;
  return path.join(projectDir || ".", filepath);
}

function resolveBoardPackagePath(projectDir, filename) {
  if (!filename) return "";
  return String(filename).startsWith("project:")
    ? path.join(projectDir || "", String(filename).replace(/^project:/, ""))
    : path.join(__dirname, "..", "boards", filename);
}

function loadBoardPackageForHealth(projectDir, filename) {
  const filepath = resolveBoardPackagePath(projectDir, filename);
  if (!filepath || !fs.existsSync(filepath)) return { filepath, exists: false, data: null };
  try {
    return { filepath, exists: true, data: yaml.load(fs.readFileSync(filepath, "utf-8")) || {}, error: "" };
  } catch (error) {
    return { filepath, exists: true, data: null, error: error.message };
  }
}

function validateBoardPackageForHealth(boardData) {
  const errors = [];
  const warnings = [];
  const family = boardData?.fpga?.family || "";
  const device = boardData?.fpga?.device || "";
  const pkg = boardData?.fpga?.package || "";
  const resources = boardData?.resources || {};
  const toolchain = boardData?.toolchain || {};
  const program = toolchain?.program || {};

  // 工程体检要检查板卡包本身，而不是只检查当前工程里缓存的板卡摘要。
  if (!boardData?.board?.name) warnings.push("缺少 board.name，界面显示会退化为文件名");
  if (!["ice40", "ecp5", "gowin"].includes(family)) errors.push("fpga.family 必须是 ice40、ecp5 或 gowin");
  if (!device) errors.push("缺少 fpga.device");
  if (!pkg) errors.push("缺少 fpga.package");
  if (!toolchain?.synth?.tool) warnings.push("缺少 toolchain.synth.tool，综合页将使用默认 Yosys");
  if (!toolchain?.place_and_route?.tool) warnings.push("缺少 toolchain.place_and_route.tool，布局布线页将使用芯片族默认工具");
  if (!toolchain?.pack?.tool) warnings.push("缺少 toolchain.pack.tool，打包页将使用芯片族默认工具");
  if (!program?.tool) warnings.push("缺少 toolchain.program.tool，烧录页将使用板卡族默认值");

  const allPins = [];
  const pushPins = (kind, list) => {
    for (const item of Array.isArray(list) ? list : []) {
      if (!item?.name) warnings.push(`${kind} 资源缺少 name`);
      if (!item?.pin) warnings.push(`${kind} 资源 ${item?.name || "-"} 缺少 pin`);
      if (item?.pin) allPins.push({ kind, name: item.name || "-", pin: String(item.pin).toUpperCase() });
    }
  };
  pushPins("clock", resources.clock);
  pushPins("leds", resources.leds);
  pushPins("buttons", resources.buttons);
  if (!Array.isArray(resources.clock) || !resources.clock.length) warnings.push("建议至少声明一个 resources.clock");

  const seen = new Map();
  for (const item of allPins) {
    seen.set(item.pin, [...(seen.get(item.pin) || []), `${item.kind}.${item.name}`]);
  }
  const duplicates = [...seen.entries()].filter(([, names]) => names.length > 1);
  if (duplicates.length) {
    errors.push(`板卡包存在重复引脚：${duplicates.map(([pin, names]) => `${pin}(${names.join("/")})`).join(", ")}`);
  }

  const constraintKeys = family === "ecp5" ? ["lpf_file"] : family === "gowin" ? ["cst_file"] : ["pcf_file"];
  if (family && !constraintKeys.some((key) => key in (boardData.constraints || {}))) {
    warnings.push(`constraints 建议包含 ${constraintKeys.join(" 或 ")}`);
  }
  return { errors, warnings };
}

ipcMain.handle("project:healthCheck", (event, data) => {
  const project = data.project || {};
  const board = data.board || {};
  const toolchain = data.toolchain || {};
  const dir = project.directory || "";
  const top = project.top_module || "top";
  const items = [];
  const add = (key, title, state, detail) => items.push({ key, title, state, detail });

  add("schema", "工程格式", data.schema_version ? "ok" : "warn", data.schema_version ? `schema ${data.schema_version}` : "旧工程文件，保存后会自动补 schema_version");
  add("project-name", "工程名称", project.name ? "ok" : "bad", project.name || "尚未填写工程名称");
  add("project-dir", "工程目录", dir && fs.existsSync(dir) ? "ok" : "bad", dir || "尚未选择工程目录");

  const sources = Array.isArray(project.sources) ? project.sources : [];
  const missingSources = sources.filter((file) => !fs.existsSync(resolveProjectPath(dir, file)));
  add("sources", "源文件", sources.length && !missingSources.length ? "ok" : "bad", sources.length ? (missingSources.length ? `缺失：${missingSources.join(", ")}` : `${sources.length} 个源文件可读取`) : "尚未添加 HDL 源文件");

  const constraints = Array.isArray(project.constraints) ? project.constraints : [];
  const missingConstraints = constraints.filter((file) => !fs.existsSync(resolveProjectPath(dir, file)));
  add("constraints", "约束文件", constraints.length && !missingConstraints.length ? "ok" : "warn", constraints.length ? (missingConstraints.length ? `缺失：${missingConstraints.join(", ")}` : `${constraints.length} 个约束文件可读取`) : "尚未设置约束文件，部分流程可能无法布局布线");

  let topFound = false;
  for (const file of sources) {
    const full = resolveProjectPath(dir, file);
    if (!fs.existsSync(full) || !/\.(v|sv|vh|svh)$/i.test(full)) continue;
    const content = fs.readFileSync(full, "utf-8");
    if (new RegExp(`\\bmodule\\s+${top}\\b`).test(content)) {
      topFound = true;
      break;
    }
  }
  add("top-module", "顶层模块", topFound ? "ok" : "warn", topFound ? `已找到 module ${top}` : `未在 Verilog/SystemVerilog 源文件中确认 ${top}`);

  let boardFileOk = !!board.fpga_family;
  let boardPackageResult = null;
  if (board.filename) {
    boardPackageResult = loadBoardPackageForHealth(dir, board.filename);
    boardFileOk = boardFileOk && boardPackageResult.exists && !boardPackageResult.error;
  }
  add("board", "目标板卡", boardFileOk ? "ok" : "bad", board.fpga_family ? `${board.name || board.fpga_family} / ${board.fpga_device || "-"}${board.filename && !boardFileOk ? "，板卡包文件缺失" : ""}` : "尚未选择板卡");
  if (board.filename) {
    if (!boardPackageResult?.exists) {
      add("board-package", "板卡包结构", "bad", `找不到板卡包文件：${board.filename}`);
    } else if (boardPackageResult.error) {
      add("board-package", "板卡包结构", "bad", `YAML 解析失败：${boardPackageResult.error}`);
    } else {
      const check = validateBoardPackageForHealth(boardPackageResult.data);
      const state = check.errors.length ? "bad" : check.warnings.length ? "warn" : "ok";
      const detail = check.errors.length
        ? check.errors.join("；")
        : check.warnings.length
          ? check.warnings.join("；")
          : "板卡包必填字段、工具链字段和基础资源检查通过";
      add("board-package", "板卡包结构", state, detail);
    }
  }
  add("toolchain", "OSS CAD Suite", toolchain.oss_cad_path && isOssCadSuiteDir(toolchain.oss_cad_path) ? "ok" : "warn", toolchain.oss_cad_path ? "路径需要重新检测或无效" : "尚未配置 OSS CAD Suite 路径");

  const outputDir = dir ? path.join(dir, "output") : "";
  try {
    if (outputDir) fs.mkdirSync(outputDir, { recursive: true });
    if (outputDir) fs.accessSync(outputDir, fs.constants.W_OK);
    add("output", "输出目录", "ok", "output 目录可写");
  } catch (error) {
    add("output", "输出目录", "bad", error.message);
  }

  const bad = items.filter((item) => item.state === "bad").length;
  const warn = items.filter((item) => item.state === "warn").length;
  return { schema: 1, ok: bad === 0, bad, warn, created_at: new Date().toISOString(), items };
});

ipcMain.handle("project:exportDiagnosticPackage", (event, payload) => {
  const project = payload.project || {};
  const dir = project.directory || "";
  if (!dir || !fs.existsSync(dir)) return { success: false, reason: "工程目录不存在" };
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = path.join(dir, "output", "reports", `vflux-diagnostic-${stamp}`);
  fs.mkdirSync(target, { recursive: true });

  const manifest = {
    schema: 1,
    created_at: new Date().toISOString(),
    project: payload.project || {},
    board: payload.board || {},
    toolchain: { oss_cad_path: payload.toolchain?.oss_cad_path ? "[configured]" : "" },
    pipeline: payload.pipeline || {},
    copied: [],
    missing: [],
  };
  const copyIfExists = (relative) => {
    const source = path.join(dir, relative);
    if (!fs.existsSync(source)) {
      manifest.missing.push(relative);
      return;
    }
    const dest = path.join(target, relative);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(source, dest);
    manifest.copied.push(relative);
  };

  for (const name of fs.readdirSync(dir)) {
    if (/\.vflux\.ya?ml$/i.test(name)) copyIfExists(name);
  }
  for (const rel of [
    "output/reports/vflux-acceptance.json",
    "output/reports/toolchain-acceptance.json",
    "output/reports/project-health.json",
    "output/reports/program-diagnostic.json",
    "output/reports/vflux-report.html",
  ]) copyIfExists(rel);

  const reportsDir = path.join(dir, "output", "reports");
  if (fs.existsSync(reportsDir)) {
    for (const file of fs.readdirSync(reportsDir)) {
      const full = path.join(reportsDir, file);
      if (fs.statSync(full).isFile() && /\.(log|json|html|sdf|svg|v)$/i.test(file)) copyIfExists(path.join("output", "reports", file));
    }
  }

  fs.writeFileSync(path.join(target, "manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");
  return { success: true, dir: target, manifest };
});

ipcMain.handle("project:createDir", (event, dirpath) => {
  if (!fs.existsSync(dirpath)) {
    fs.mkdirSync(dirpath, { recursive: true });
  }
  const subdirs = [
    "src",
    "tb",
    "constraints",
    "scripts",
    "formal",
    "mcy",
    "docs",
    "output",
    "output/synthesis",
    "output/pnr",
    "output/bitstream",
    "output/reports",
    "output/simulation",
  ];
  for (const sub of subdirs) {
    const p = path.join(dirpath, sub);
    if (!fs.existsSync(p)) fs.mkdirSync(p);
  }
  return { success: true };
});

function writeTemplateIfMissing(filepath, content) {
  if (fs.existsSync(filepath)) return false;
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, content, "utf-8");
  return true;
}

function generateProjectSkeletonFiles(dirpath, topModule, language) {
  const top = topModule || "top";
  const ext = language === "sv" ? "sv" : "v";
  const files = [
    {
      path: path.join(dirpath, "src", "vflux_defs.vh"),
      content: `// vflux_defs.vh - Project-wide macro definitions.\n// Add shared \`define values here and include this file from RTL when needed.\n\n\`ifndef VFLUX_DEFS_VH\n\`define VFLUX_DEFS_VH\n\n// \`define SIM 1\n\n\`endif\n`,
    },
    {
      path: path.join(dirpath, "constraints", `${top}.sdc`),
      content: `# ${top}.sdc - Optional timing constraints.\n# Example:\n# create_clock -name clk -period 83.333 [get_ports clk]\n\n`,
    },
    {
      path: path.join(dirpath, "constraints", "README.md"),
      content: `# Constraints\n\nPlace board and timing constraints here.\n\n- iCE40: usually \`${top}.pcf\`\n- ECP5: usually \`${top}.lpf\`\n- Gowin: usually \`${top}.cst\`\n- Optional timing: \`${top}.sdc\`\n`,
    },
    {
      path: path.join(dirpath, "scripts", "yosys_extra.ys"),
      content: `# Optional Yosys script fragment.\n# Vflux can expose most common switches in GUI; keep project-specific experiments here.\n\n# read_verilog src/${top}.${ext}\n# hierarchy -top ${top}\n`,
    },
    {
      path: path.join(dirpath, "scripts", "nextpnr_pre_pack.py"),
      content: `# Optional nextpnr hook: run before pack.\n# Fill this file only when a target flow needs custom nextpnr scripting.\n\n`,
    },
    {
      path: path.join(dirpath, "scripts", "nextpnr_pre_place.py"),
      content: `# Optional nextpnr hook: run before place.\n\n`,
    },
    {
      path: path.join(dirpath, "scripts", "nextpnr_pre_route.py"),
      content: `# Optional nextpnr hook: run before route.\n\n`,
    },
    {
      path: path.join(dirpath, "scripts", "nextpnr_post_route.py"),
      content: `# Optional nextpnr hook: run after route.\n\n`,
    },
    {
      path: path.join(dirpath, "formal", `${top}.sby`),
      content: `[options]\nmode bmc\ndepth 20\n\n[engines]\nsmtbmc\n\n[script]\nread -formal src/${top}.${ext}\nprep -top ${top}\n\n[files]\nsrc/${top}.${ext}\n`,
    },
    {
      path: path.join(dirpath, "mcy", `${top}.cfg`),
      content: `[script]\nread_verilog src/${top}.${ext}\nprep -top ${top}\n\n[files]\nsrc/${top}.${ext}\n`,
    },
    {
      path: path.join(dirpath, "docs", "design-notes.md"),
      content: `# Design Notes\n\nRecord clocking, reset strategy, board resources, timing assumptions, and debug notes here.\n`,
    },
  ];

  const created = files.filter((item) => writeTemplateIfMissing(item.path, item.content)).map((item) => item.path);
  return { success: true, created };
}

ipcMain.handle("project:generateSkeleton", (event, { dirpath, topModule, language }) => {
  if (!dirpath || !fs.existsSync(dirpath)) return { success: false, reason: "project directory does not exist" };
  return generateProjectSkeletonFiles(dirpath, topModule, language);
});

ipcMain.handle("project:generatePcf", (event, { boardYaml, topModule, sources }) => {
  let boardData = boardYaml;
  if (typeof boardYaml === "string") {
    const filepath = path.join(__dirname, "..", "boards", boardYaml);
    if (fs.existsSync(filepath)) {
      boardData = yaml.load(fs.readFileSync(filepath, "utf-8"));
    }
  }
  if (!boardData || !boardData.resources) return { success: false, reason: "no resources in board yaml" };

  const lines = ["# Auto-generated PCF by Vflux", `# Top module: ${topModule || "top"}`, ""];
  const r = boardData.resources;

  if (r.clock) for (const clk of r.clock) lines.push(`set_io ${clk.name} ${clk.pin}`);
  if (r.leds) for (const led of r.leds) lines.push(`set_io ${led.name} ${led.pin}`);
  if (r.buttons) for (const btn of r.buttons) lines.push(`set_io ${btn.name} ${btn.pin}`);
  if (r.uart) {
    if (r.uart.tx) lines.push(`set_io uart_tx ${r.uart.tx}`);
    if (r.uart.rx) lines.push(`set_io uart_rx ${r.uart.rx}`);
  }
  if (r.spi) {
    if (r.spi.flash_cs) lines.push(`set_io flash_cs ${r.spi.flash_cs}`);
    if (r.spi.flash_sck) lines.push(`set_io flash_sck ${r.spi.flash_sck}`);
    if (r.spi.flash_mosi) lines.push(`set_io flash_mosi ${r.spi.flash_mosi}`);
    if (r.spi.flash_miso) lines.push(`set_io flash_miso ${r.spi.flash_miso}`);
  }

  return { success: true, content: lines.join("\n") };
});

ipcMain.handle("shell:openDir", (event, dirpath) => {
  require("electron").shell.openPath(dirpath);
  return { success: true };
});

ipcMain.handle("shell:openPath", (event, filepath) => {
  require("electron").shell.openPath(filepath);
  return { success: true };
});

ipcMain.handle("shell:openVscode", (event, dirpath) => {
  return new Promise((resolve) => {
    const proc = spawn("code", [dirpath || "."], { shell: true });
    proc.on("error", () => {
      const alt = spawn("code.cmd", [dirpath || "."], { shell: true });
      alt.on("error", () => resolve({ success: false, reason: "VS Code not found" }));
      alt.on("close", (code) => resolve({ success: code === 0 }));
    });
    proc.on("close", (code) => resolve({ success: code === 0 }));
  });
});

ipcMain.handle("project:generateTemplate", (event, { dirpath, topModule, language }) => {
  const ext = language === "vhdl" ? ".vhd" : language === "sv" ? ".sv" : ".v";
  const filepath = path.join(dirpath || ".", "src", `${topModule}${ext}`);
  if (!fs.existsSync(path.dirname(filepath))) {
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
  }
  let content = "";
  if (language === "verilog" || language === "sv") {
    content = `// ${topModule}.v - Auto-generated by Vflux\n\nmodule ${topModule}(\n  input  wire clk,\n  input  wire rst_n,\n  output wire led\n);\n\n  assign led = clk;\n\nendmodule\n`;
  } else {
    content = `-- ${topModule}.vhd - Auto-generated by Vflux\n\nlibrary IEEE;\nuse IEEE.STD_LOGIC_1164.ALL;\n\nentity ${topModule} is\n  port (\n    clk   : in  std_logic;\n    rst_n : in  std_logic;\n    led   : out std_logic\n  );\nend ${topModule};\n\narchitecture Behavioral of ${topModule} is\nbegin\n  led <= clk;\nend Behavioral;\n`;
  }
  fs.writeFileSync(filepath, content, "utf-8");
  return { success: true, filepath };
});

ipcMain.handle("project:generateTbTemplate", (event, { dirpath, topModule, language }) => {
  const ext = language === "vhdl" ? ".vhd" : ".v";
  const filepath = path.join(dirpath || ".", "tb", `tb_${topModule}.${ext}`);
  if (!fs.existsSync(path.dirname(filepath))) {
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
  }
  let content = "";
  if (language !== "vhdl") {
    content = "// tb_" + topModule + ".v - Auto-generated by Vflux\n\n`timescale 1ns / 1ps\n\nmodule tb_" + topModule + ";\n  reg clk;\n  reg rst_n;\n  wire led;\n\n  " + topModule + " uut (\n    .clk(clk),\n    .rst_n(rst_n),\n    .led(led)\n  );\n\n  always #5 clk = ~clk;\n\n  initial begin\n    clk = 0;\n    rst_n = 0;\n    #20 rst_n = 1;\n    #100;\n    $finish;\n  end\n\n  initial begin\n    $dumpfile(\"output/simulation/dump.vcd\");\n    $dumpvars(0, tb_" + topModule + ");\n  end\nendmodule\n";
  }
  fs.writeFileSync(filepath, content, "utf-8");
  return { success: true, filepath };
});
