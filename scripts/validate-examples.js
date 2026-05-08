"use strict";

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const root = path.join(__dirname, "..");
const examplesDir = path.join(root, "examples");
const boardsDir = path.join(root, "boards");
const failures = [];
const warnings = [];

function readYaml(file) {
  return yaml.load(fs.readFileSync(file, "utf8")) || {};
}

function exists(base, relative) {
  return fs.existsSync(path.join(base, relative || ""));
}

function readText(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function flattenFiles(dir, predicate) {
  const out = [];
  function walk(current) {
    if (!fs.existsSync(current)) return;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (!predicate || predicate(full)) out.push(full);
    }
  }
  walk(dir);
  return out;
}

for (const name of fs.readdirSync(examplesDir)) {
  const dir = path.join(examplesDir, name);
  if (!fs.statSync(dir).isDirectory()) continue;

  const projectPath = path.join(dir, "project.vflux.yaml");
  const metaPath = path.join(dir, "example.yaml");
  const readmePath = path.join(dir, "README.md");

  if (!fs.existsSync(projectPath)) failures.push(`${name}: 缺少 project.vflux.yaml`);
  if (!fs.existsSync(metaPath)) failures.push(`${name}: 缺少 example.yaml`);
  if (!fs.existsSync(readmePath)) warnings.push(`${name}: 建议补充 README.md`);
  if (!fs.existsSync(projectPath)) continue;

  const project = readYaml(projectPath);
  const meta = fs.existsSync(metaPath) ? readYaml(metaPath) : {};
  const base = project.project?.directory ? path.resolve(dir) : dir;

  if (!project.schema_version) failures.push(`${name}: project.vflux.yaml 缺少 schema_version`);
  if (!project.app_version) warnings.push(`${name}: project.vflux.yaml 建议写入 app_version`);
  if (!project.project?.name) failures.push(`${name}: 缺少 project.name`);
  if (!project.project?.top_module) failures.push(`${name}: 缺少 project.top_module`);

  if (project.board?.filename && !fs.existsSync(path.join(boardsDir, project.board.filename))) {
    failures.push(`${name}: 板卡包不存在 ${project.board.filename}`);
  }

  const sources = project.project?.sources || [];
  for (const source of sources) {
    if (!exists(base, source)) failures.push(`${name}: 源文件不存在 ${source}`);
  }
  for (const constraint of project.project?.constraints || []) {
    if (!exists(base, constraint)) failures.push(`${name}: 约束文件不存在 ${constraint}`);
  }

  if (!sources.length) warnings.push(`${name}: 没有列出 project.sources`);
  const sourceText = sources.map((source) => readText(path.join(base, source))).join("\n");
  const top = project.project?.top_module;
  if (top && sources.length && !new RegExp(`\\bmodule\\s+${top}\\b`).test(sourceText)) {
    failures.push(`${name}: 顶层模块 ${top} 未在源文件中找到`);
  }

  // 例程验收提前检查 include，避免用户一键复制后才在综合阶段遇到缺文件。
  const includes = [...sourceText.matchAll(/`include\s+"([^"]+)"/g)].map((match) => match[1]);
  for (const inc of includes) {
    const found = sources.some((source) => exists(path.dirname(path.join(base, source)), inc))
      || exists(base, inc)
      || exists(path.join(base, "src"), inc);
    if (!found) failures.push(`${name}: include 文件不存在 ${inc}`);
  }

  if (meta.testbench && !exists(base, meta.testbench)) failures.push(`${name}: testbench 不存在 ${meta.testbench}`);
  if ((meta.family || project.board?.fpga_family) === "simulation" && !meta.testbench) {
    warnings.push(`${name}: 仿真例程建议在 example.yaml 写入 testbench`);
  }

  const hdlFiles = flattenFiles(dir, (file) => /\.(v|sv|vh|svh)$/i.test(file));
  if (!fs.existsSync(path.join(dir, "src")) && hdlFiles.length) {
    warnings.push(`${name}: 建议使用 src/ 组织 HDL 文件`);
  }
}

if (failures.length) {
  console.error("Vflux 例程静态验收失败：");
  for (const item of failures) console.error(" - " + item);
  if (warnings.length) {
    console.warn("提示：");
    for (const item of warnings) console.warn(" - " + item);
  }
  process.exit(1);
}

console.log("Vflux 例程静态验收通过。");
if (warnings.length) {
  console.log("提示：");
  for (const item of warnings) console.log(" - " + item);
}
