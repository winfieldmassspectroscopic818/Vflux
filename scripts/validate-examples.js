"use strict";

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const root = path.join(__dirname, "..");
const examplesDir = path.join(root, "examples");
const boardsDir = path.join(root, "boards");
const failures = [];

for (const name of fs.readdirSync(examplesDir)) {
  const dir = path.join(examplesDir, name);
  if (!fs.statSync(dir).isDirectory()) continue;
  const projectPath = path.join(dir, "project.vflux.yaml");
  const metaPath = path.join(dir, "example.yaml");
  if (!fs.existsSync(projectPath)) failures.push(`${name}: 缺少 project.vflux.yaml`);
  if (!fs.existsSync(metaPath)) failures.push(`${name}: 缺少 example.yaml`);
  if (!fs.existsSync(projectPath)) continue;
  const project = yaml.load(fs.readFileSync(projectPath, "utf8"));
  const base = project.project?.directory ? path.resolve(dir) : dir;
  if (project.board?.filename && !fs.existsSync(path.join(boardsDir, project.board.filename))) {
    failures.push(`${name}: 板卡包不存在 ${project.board.filename}`);
  }
  for (const source of project.project?.sources || []) {
    if (!fs.existsSync(path.join(base, source))) failures.push(`${name}: 源文件不存在 ${source}`);
  }
  for (const constraint of project.project?.constraints || []) {
    if (!fs.existsSync(path.join(base, constraint))) failures.push(`${name}: 约束文件不存在 ${constraint}`);
  }
}

if (failures.length) {
  console.error("Vflux 例程验收失败：");
  for (const item of failures) console.error(" - " + item);
  process.exit(1);
}

console.log("Vflux 例程静态验收通过。");
