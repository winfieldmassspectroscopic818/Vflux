"use strict";

const PanelReport = {
  init() {
    document.getElementById("btn-report-refresh").addEventListener("click", () => this.refresh());
    document.getElementById("btn-report-preflight")?.addEventListener("click", () => this.runReleasePreflight());
    document.getElementById("btn-report-export-html").addEventListener("click", () => this.exportHtml());
    document.getElementById("btn-report-export-diagnostic")?.addEventListener("click", () => this.exportDiagnosticPackage());
    document.getElementById("btn-report-open-dir").addEventListener("click", () => this._openDir());
    document.getElementById("report-artifacts").addEventListener("click", (event) => this._openArtifact(event));
    document.getElementById("report-visual-preview").addEventListener("click", (event) => this._openArtifact(event));
  },

  async refresh() {
    const proj = Config.data.project;
    const board = Config.data.board;
    const status = Pipeline.status;
    const top = proj.top_module || "top";
    const artifacts = await this._collectArtifacts(top);

    this._renderStatusSummary(status);
    this._renderReleaseReadiness(artifacts, status);
    this._renderAcceptance(artifacts.acceptance, artifacts.toolchainAcceptance);
    this._renderResource(proj, board, artifacts);
    this._renderTimingAndProducts(proj, board, artifacts);
    this._renderPins(proj, board);
    this._renderArtifacts(artifacts);
    this._renderVisualPreview(artifacts);
    this._renderTimeline(status, artifacts.acceptance);

    const criticalSteps = ["check", "synthesis", "pnr", "pack"];
    const allCriticalOk = criticalSteps.every((s) => status[s] === "success");
    const anyCriticalFailed = criticalSteps.some((s) => status[s] === "failed");
    const items = [];
    if (artifacts.acceptance) {
      items.push({ state: artifacts.acceptance.success ? "success" : "failed", text: artifacts.acceptance.success ? "最近一次验收通过。" : `最近一次验收未通过：${artifacts.acceptance.stopped_at || "核心步骤失败"}` });
    }
    if (allCriticalOk) items.push({ state: "success", text: "检查、综合、布局布线和比特流生成均已完成。" });
    else items.push({ state: anyCriticalFailed ? "failed" : "pending", text: anyCriticalFailed ? "存在失败的关键构建步骤，请回到对应工作台查看诊断。" : "关键构建步骤尚未全部完成。" });
    if (artifacts.nextpnrReport) items.push({ state: "success", text: "已找到 nextpnr JSON 报告。" });
    if (artifacts.bitstream) items.push({ state: "success", text: "已找到目标芯片对应的比特流文件。" });

    const kind = allCriticalOk ? "success" : anyCriticalFailed ? "failed" : "ready";
    ToolStepUI.render("report-result", "report-summary", "report-feedback-list", kind, allCriticalOk ? "报告已就绪" : anyCriticalFailed ? "报告显示存在失败步骤" : "报告等待更多构建数据", items);
    ToolStepUI.setTechnical("report", {
      meta: "报告数据来源",
      command: "读取 output/reports、output/bitstream 与当前流水线状态",
      log: JSON.stringify({ status, artifacts }, null, 2),
    });

    if (allCriticalOk) Pipeline.set("report", "success");
    else if (anyCriticalFailed) Pipeline.set("report", "failed", "上游步骤失败");
    else Pipeline.set("report", "pending");
  },

  async runReleasePreflight() {
    const button = document.getElementById("btn-report-preflight");
    if (button) button.disabled = true;
    const started = new Date().toISOString();
    ToolStepUI.render("report-result", "report-summary", "report-feedback-list", "running", "正在执行 1.0 发布前自动验收", [
      { state: "running", text: "将依次运行工程体检、工具链验收、一键构建、HTML 报告导出和发布前检查刷新。" },
      { state: "pending", text: "如果核心构建失败，会保留失败步骤并停止后续核心流程。" },
    ]);
    ToolStepUI.setTechnical("report", { meta: "1.0 release preflight", command: "health-check -> toolchain-probe -> build-all -> export-html -> refresh-report", log: "" });

    const log = [];
    const step = async (label, fn) => {
      log.push(`Start: ${label}`);
      ToolStepUI.setTechnical("report", { meta: `运行中：${label}`, command: "release preflight", log: log.join("\n") });
      const result = await fn();
      log.push(`Done: ${label}`);
      ToolStepUI.setTechnical("report", { meta: `完成：${label}`, command: "release preflight", log: log.join("\n") });
      return result;
    };

    try {
      // Keep this orchestration small: each panel owns its own detailed behavior.
      await step("工程体检", () => PanelProject.runHealthCheck());
      await step("工具链验收", () => PanelToolchain.probe());
      const buildOk = await step("一键构建与验收", () => PanelBuildAll.run({ source: "release-preflight", title: Config.data.project.name || "Vflux Project" }));
      if (buildOk) await step("导出 HTML 报告", () => this.exportHtml({ open: false, silent: true }));
      await step("刷新发布前检查", () => this.refresh());

      const artifacts = await this._collectArtifacts(Config.data.project.top_module || "top");
      const ready = this._releaseReadinessSummary(artifacts, Pipeline.status);
      const ok = buildOk && ready.bad === 0;
      ToolStepUI.render("report-result", "report-summary", "report-feedback-list", ok ? "success" : "failed", ok ? "发布前自动验收完成" : "发布前自动验收发现问题", [
        { state: ok ? "success" : "failed", text: ok ? "核心流程通过，发布前检查无阻塞项。" : `仍有 ${ready.bad} 个阻塞项、${ready.warn} 个注意项。` },
        { state: buildOk ? "success" : "failed", text: buildOk ? "一键构建通过。" : "一键构建未通过，请查看对应工作台诊断。" },
        { state: "success", text: `开始时间：${new Date(started).toLocaleString("zh-CN")}` },
      ]);
      ToolStepUI.setTechnical("report", { meta: ok ? "preflight passed" : "preflight issues found", command: "release preflight", log: log.join("\n") });
    } catch (error) {
      log.push(`Failed: ${error.message}`);
      ToolStepUI.render("report-result", "report-summary", "report-feedback-list", "failed", "发布前自动验收失败", [
        { state: "failed", text: error.message },
        { state: "pending", text: "可展开技术细节查看自动验收停在哪一步。" },
      ]);
      ToolStepUI.setTechnical("report", { meta: "preflight failed", command: "release preflight", log: log.join("\n") });
    } finally {
      if (button) button.disabled = false;
    }
  },

  _renderAcceptance(acceptance, toolchainAcceptance) {
    const el = document.getElementById("report-acceptance");
    if (!el) return;
    if (!acceptance) {
      el.innerHTML = [
        this._row("最近验收", "尚未运行"),
        this._row("工具链环境", toolchainAcceptance ? `${toolchainAcceptance.passed}/${toolchainAcceptance.total} 项通过` : "尚未验收"),
        this._row("建议", "从例程工作台或一键构建启动"),
      ].join("");
      return;
    }
    el.innerHTML = [
      `<div class="${acceptance.success ? "rp-status-ok" : "rp-status-err"}">${acceptance.success ? "验收通过" : "验收未通过"}</div>`,
      this._row("类型", acceptance.type === "example-acceptance" ? "例程验收" : "工程验收"),
      this._row("目标", acceptance.title || "-"),
      this._row("完成时间", acceptance.finished_at ? new Date(acceptance.finished_at).toLocaleString("zh-CN") : "-"),
      this._row("停止位置", acceptance.stopped_at || "无"),
      this._row("工具链环境", toolchainAcceptance ? `${toolchainAcceptance.passed}/${toolchainAcceptance.total} 项通过` : "尚未验收"),
    ].join("");
  },

  _renderReleaseReadiness(artifacts, status) {
    const el = document.getElementById("report-release-readiness");
    if (!el) return;
    const health = artifacts.projectHealth;
    const toolchain = artifacts.toolchainAcceptance;
    const acceptance = artifacts.acceptance;
    const criticalSteps = ["check", "synthesis", "pnr", "pack"];
    const criticalOk = criticalSteps.every((step) => status[step] === "success");
    const programReady = status.program === "success" || Config.data.flow?.program?.method === "mass-storage";
    const rows = [
      this._readinessItem("工程配置", health ? (health.ok ? "ok" : "bad") : "warn", health ? (health.ok ? "工程体检通过" : `${health.bad || 0} 个阻塞问题，${health.warn || 0} 个注意项`) : "尚未运行工程体检"),
      this._readinessItem("工具链环境", toolchain ? (toolchain.failed ? "bad" : "ok") : "warn", toolchain ? `${toolchain.passed}/${toolchain.total} 项通过` : "尚未验收 OSS CAD Suite"),
      this._readinessItem("核心构建", criticalOk && artifacts.bitstream ? "ok" : "warn", criticalOk && artifacts.bitstream ? "检查、综合、布局布线、比特流均已完成" : "建议运行一键构建或例程验收"),
      this._readinessItem("报告材料", artifacts.htmlReport && artifacts.acceptance ? "ok" : "warn", artifacts.htmlReport ? "HTML 报告已生成" : "建议导出 HTML 报告"),
      this._readinessItem("图形产物", artifacts.placedSvg || artifacts.routedSvg || artifacts.floorplanHtml ? "ok" : "warn", artifacts.placedSvg || artifacts.routedSvg || artifacts.floorplanHtml ? "已有可视化产物" : "如需展示布线/资源图，请在对应工作台启用输出"),
      this._readinessItem("烧录准备", artifacts.bitstream && programReady ? "ok" : artifacts.bitstream ? "warn" : "bad", artifacts.bitstream ? (programReady ? "比特流和烧录方式已就绪" : "比特流存在，烧录方式建议再检查") : "尚未生成比特流"),
      this._readinessItem("最近验收", acceptance ? (acceptance.success ? "ok" : "bad") : "warn", acceptance ? (acceptance.success ? "最近一次验收通过" : `验收停在 ${acceptance.stopped_at || "未知步骤"}`) : "尚未运行一键验收"),
    ];
    const { bad, warn } = this._releaseReadinessSummary(artifacts, status, rows);
    const headline = bad ? `暂不建议发布：${bad} 个阻塞项` : warn ? `接近可发布：${warn} 个注意项` : "可以作为试用版发布";
    el.innerHTML = `<div class="release-readiness-head ${bad ? "bad" : warn ? "warn" : "ok"}">${ToolStepUI.escape(headline)}</div><div class="release-readiness-list">${rows.map((item) => `
      <div class="release-readiness-item ${item.state}">
        <span></span>
        <div><strong>${ToolStepUI.escape(item.title)}</strong><p>${ToolStepUI.escape(item.detail)}</p></div>
      </div>`).join("")}</div>`;
  },

  _readinessItem(title, state, detail) {
    return { title, state, detail };
  },

  _releaseReadinessSummary(artifacts, status, existingRows = null) {
    // Shared summary for both the visible readiness card and the automated preflight result.
    const rows = existingRows || [
      this._readinessItem("工程配置", artifacts.projectHealth ? (artifacts.projectHealth.ok ? "ok" : "bad") : "warn", ""),
      this._readinessItem("工具链环境", artifacts.toolchainAcceptance ? (artifacts.toolchainAcceptance.failed ? "bad" : "ok") : "warn", ""),
      this._readinessItem("核心构建", ["check", "synthesis", "pnr", "pack"].every((step) => status[step] === "success") && artifacts.bitstream ? "ok" : "warn", ""),
      this._readinessItem("报告材料", artifacts.htmlReport && artifacts.acceptance ? "ok" : "warn", ""),
      this._readinessItem("图形产物", artifacts.placedSvg || artifacts.routedSvg || artifacts.floorplanHtml ? "ok" : "warn", ""),
      this._readinessItem("烧录准备", artifacts.bitstream ? "warn" : "bad", ""),
      this._readinessItem("最近验收", artifacts.acceptance ? (artifacts.acceptance.success ? "ok" : "bad") : "warn", ""),
    ];
    return {
      bad: rows.filter((item) => item.state === "bad").length,
      warn: rows.filter((item) => item.state === "warn").length,
      ok: rows.filter((item) => item.state === "ok").length,
    };
  },

  _renderResource(proj, board, artifacts) {
    const el = document.getElementById("report-resource");
    el.innerHTML = [
      this._row("FPGA 系列", board.fpga_family || "-"),
      this._row("FPGA 型号", board.fpga_device || "-"),
      this._row("封装", board.fpga_package || "-"),
      this._row("顶层模块", proj.top_module || "-"),
      this._row("HDL 语言", proj.language || "verilog"),
      this._row("源文件数", (proj.sources || []).length),
      artifacts.yosysSummary ? this._row("综合摘要", artifacts.yosysSummary) : "",
    ].join("");
  },

  _renderTimingAndProducts(proj, board, artifacts) {
    const top = proj.top_module || "top";
    const family = board.fpga_family || "ice40";
    const rows = [
      this._row("目标器件", board.fpga_device || "-"),
      this._row("布局结果", this._pnrPath(top, family)),
      this._row("比特流", this._bitstreamPath(top, family)),
      this._row("nextpnr 报告", artifacts.nextpnrReport ? "已生成" : "未生成"),
      this._row("比特流元数据", artifacts.metadata ? "已生成" : "未生成"),
    ];
    if (artifacts.icetimeSummary) rows.push(this._row("icetime 时序", artifacts.icetimeSummary));
    if (artifacts.nextpnrSummary) rows.push(this._row("P&R 摘要", artifacts.nextpnrSummary));
    document.getElementById("report-timing").innerHTML = rows.join("");
  },

  _renderPins(proj, board) {
    const rows = [this._row("约束文件", (proj.constraints || []).join(", ") || "无")];
    if (board.name) rows.push(this._row("板卡", board.name));
    if (board.fpga_package) rows.push(this._row("封装", board.fpga_package));
    document.getElementById("report-pins").innerHTML = rows.join("");
  },

  _renderArtifacts(artifacts) {
    const top = Config.data.project.top_module || "top";
    const rows = [
      this._row("综合网表", artifacts.synthesis ? "存在" : "缺失"),
      this._row("布局文件", artifacts.pnr ? "存在" : "缺失"),
      this._row("比特流", artifacts.bitstream ? "存在" : "缺失"),
      this._row("SDF 时序", artifacts.sdf ? "已生成" : "未生成"),
      this._row("门级 Verilog", artifacts.gateVlog ? "已生成" : "未生成"),
      this._row("内部布线 HTML", artifacts.floorplanHtml ? "已生成" : "未生成"),
      this._row("HTML 总报告", artifacts.htmlReport ? "已生成" : "未生成"),
      this._row("报告文件", artifacts.reportFiles.length ? artifacts.reportFiles.join(", ") : "无"),
    ];
    const actionDefs = [
      ["打开报告目录", "output/reports"],
      ["打开比特流目录", "output/bitstream"],
      artifacts.placedSvg ? ["查看布局 SVG", `output/reports/${top}.placed.svg`] : null,
      artifacts.routedSvg ? ["查看布线 SVG", `output/reports/${top}.routed.svg`] : null,
      artifacts.sdf ? ["查看 SDF 时序", `output/reports/${top}.sdf`] : null,
      artifacts.yosysLog ? ["查看 Yosys 日志", `output/reports/${top}.yosys.log`] : null,
      artifacts.icetimeLog ? ["查看 icetime 日志", `output/reports/${top}.icetime.log`] : null,
      artifacts.floorplanHtml ? ["查看内部布线 HTML", `output/reports/${top}.floorplan.html`] : null,
      artifacts.gateVlog ? ["查看门级 Verilog", `output/reports/${top}.icebox.v`] : null,
      artifacts.acceptance ? ["查看验收 JSON", "output/reports/vflux-acceptance.json"] : null,
      artifacts.toolchainAcceptance ? ["查看工具链验收 JSON", "output/reports/toolchain-acceptance.json"] : null,
      artifacts.htmlReport ? ["查看 HTML 报告", "output/reports/vflux-report.html"] : null,
    ].filter(Boolean);
    const actions = actionDefs.map(([label, path]) => `<button data-open-path="${ToolStepUI.escape(path)}">${ToolStepUI.escape(label)}</button>`).join("");
    document.getElementById("report-artifacts").innerHTML = rows.join("") + `<div class="artifact-actions">${actions}</div>`;
  },

  _renderVisualPreview(artifacts) {
    const el = document.getElementById("report-visual-preview");
    if (!el) return;
    const top = Config.data.project.top_module || "top";
    const items = [
      artifacts.placedSvg ? ["布局 SVG", `output/reports/${top}.placed.svg`] : null,
      artifacts.routedSvg ? ["布线 SVG", `output/reports/${top}.routed.svg`] : null,
      artifacts.floorplanHtml ? ["Floorplan HTML", `output/reports/${top}.floorplan.html`] : null,
      artifacts.gateVlog ? ["门级 Verilog", `output/reports/${top}.icebox.v`] : null,
      artifacts.htmlReport ? ["HTML 报告", "output/reports/vflux-report.html"] : null,
    ].filter(Boolean);
    const body = items.length
      ? `<div class="artifact-actions visual-actions">${items.map(([label, path]) => `<button data-open-path="${ToolStepUI.escape(path)}">${ToolStepUI.escape(label)}</button>`).join("")}</div>`
      : `<div class="rp-hint">当前工程还没有可视化产物。需要 SVG、SDF、门级网表或内部布线图时，请在布局布线、生成比特流或资源图工作台启用对应输出后重新构建。</div>`;
    el.innerHTML = `${body}<div class="rp-hint">这里只显示已经真实存在的产物，技术日志仍可在“查看技术细节”中展开。</div>`;
  },

  async exportHtml(options = {}) {
    const { open = true, silent = false } = options;
    const top = Config.data.project.top_module || "top";
    const artifacts = await this._collectArtifacts(top);
    const html = this._buildHtmlReport(artifacts);
    const target = ToolStepUI.projectPath("output/reports/vflux-report.html");
    // HTML 报告自包含，方便直接分享给其他人查看工程状态。
    await window.vflux.writeText(target, html);
    await this.refresh();
    if (!silent) {
      ToolStepUI.render("report-result", "report-summary", "report-feedback-list", "success", "HTML 报告已导出", [
        { state: "success", text: "已生成 output/reports/vflux-report.html。" },
        { state: "pending", text: "报告包含工程验收、工具链验收、产物摘要和流水线状态。" },
      ]);
    }
    if (open) await window.vflux.shellOpenPath(target);
  },

  async exportDiagnosticPackage() {
    const result = await window.vflux.exportDiagnosticPackage({
      schema_version: Config.data.schema_version || 1,
      project: Config.data.project,
      board: Config.data.board,
      toolchain: Config.data.toolchain,
      pipeline: { status: Pipeline.status, results: Pipeline.results, timestamps: Pipeline.timestamps },
    });
    if (!result.success) {
      ToolStepUI.render("report-result", "report-summary", "report-feedback-list", "failed", "诊断包导出失败", [
        { state: "failed", text: result.reason || "无法创建诊断包目录" },
      ]);
      return;
    }
    ToolStepUI.render("report-result", "report-summary", "report-feedback-list", "success", "诊断包已导出", [
      { state: "success", text: `已生成：${result.dir}` },
      { state: "pending", text: "诊断包包含工程配置、报告 JSON、日志、HTML 报告和产物摘要，不会主动复制完整 RTL 源码。" },
    ]);
    await window.vflux.shellOpenDir(result.dir);
  },

  _renderTimeline(status, acceptance) {
    const el = document.getElementById("report-timeline");
    if (!el) return;
    const labels = { check: "检查", synthesis: "综合", pnr: "布局布线", pack: "比特流", timing: "时序", floorplan: "资源图", program: "烧录", simulation: "仿真", formal: "形式验证", mcy: "突变覆盖", verilator: "Verilator" };
    const rows = Object.keys(labels).map((step) => {
      const state = status[step] || "pending";
      const at = Pipeline.timestamps?.[step] ? new Date(Pipeline.timestamps[step]).toLocaleTimeString("zh-CN") : "-";
      const detail = Pipeline.results?.[step] ? ` / ${Pipeline.results[step]}` : "";
      return this._row(labels[step], `${this._stateText(state)} / ${at}${detail}`);
    });
    if (acceptance) rows.unshift(this._row("最近验收", acceptance.success ? "通过" : "未通过"));
    el.innerHTML = rows.join("");
  },

  async _collectArtifacts(top) {
    const family = Config.data.board.fpga_family || "ice40";
    const artifacts = {
      synthesis: await ToolStepUI.existsInProject(`output/synthesis/${top}.json`),
      pnr: await ToolStepUI.existsInProject(this._pnrPath(top, family)),
      bitstream: await ToolStepUI.existsInProject(this._bitstreamPath(top, family)),
      nextpnrReport: false,
      metadata: false,
      placedSvg: false,
      routedSvg: false,
      sdf: false,
      floorplanHtml: false,
      gateVlog: false,
      htmlReport: false,
      yosysLog: false,
      icetimeLog: false,
      nextpnrSummary: "",
      yosysSummary: "",
      icetimeSummary: "",
      reportFiles: [],
      acceptance: null,
      toolchainAcceptance: null,
      projectHealth: null,
    };
    try {
      artifacts.reportFiles = await window.vflux.listDir(ToolStepUI.projectPath("output/reports"));
      artifacts.nextpnrReport = artifacts.reportFiles.includes(`${top}.nextpnr.json`);
      artifacts.placedSvg = artifacts.reportFiles.includes(`${top}.placed.svg`);
      artifacts.routedSvg = artifacts.reportFiles.includes(`${top}.routed.svg`);
      artifacts.sdf = artifacts.reportFiles.includes(`${top}.sdf`);
      artifacts.floorplanHtml = artifacts.reportFiles.includes(`${top}.floorplan.html`);
      artifacts.gateVlog = artifacts.reportFiles.includes(`${top}.icebox.v`);
      artifacts.htmlReport = artifacts.reportFiles.includes("vflux-report.html");
      artifacts.yosysLog = artifacts.reportFiles.includes(`${top}.yosys.log`);
      artifacts.icetimeLog = artifacts.reportFiles.includes(`${top}.icetime.log`);
      if (artifacts.nextpnrReport) {
        const raw = await window.vflux.readText(ToolStepUI.projectPath(`output/reports/${top}.nextpnr.json`));
        artifacts.nextpnrSummary = this._summarizeNextpnr(JSON.parse(raw));
      }
    } catch (_) {}
    try {
      const raw = await window.vflux.readText(ToolStepUI.projectPath("output/reports/vflux-acceptance.json"));
      artifacts.acceptance = JSON.parse(raw);
    } catch (_) {}
    try {
      const raw = await window.vflux.readText(ToolStepUI.projectPath("output/reports/toolchain-acceptance.json"));
      artifacts.toolchainAcceptance = JSON.parse(raw);
    } catch (_) {}
    try {
      const raw = await window.vflux.readText(ToolStepUI.projectPath("output/reports/project-health.json"));
      artifacts.projectHealth = JSON.parse(raw);
    } catch (_) {}
    try {
      artifacts.metadata = !!(await window.vflux.readText(ToolStepUI.projectPath(`output/bitstream/${top}.metadata.json`)));
    } catch (_) {}
    try {
      artifacts.yosysSummary = this._summarizeYosys(await window.vflux.readText(ToolStepUI.projectPath(`output/reports/${top}.yosys.log`)));
    } catch (_) {}
    try {
      artifacts.icetimeSummary = this._summarizeIcetime(await window.vflux.readText(ToolStepUI.projectPath(`output/reports/${top}.icetime.log`)));
    } catch (_) {}
    return artifacts;
  },

  _summarizeNextpnr(json) {
    if (!json || typeof json !== "object") return "已读取";
    const keys = ["device", "family", "package", "checksum"].filter((key) => json[key]);
    return keys.length ? keys.map((key) => `${key}: ${json[key]}`).join(" / ") : "已读取 JSON 报告";
  },

  _summarizeYosys(log) {
    const cells = [...(log || "").matchAll(/Number of cells:\s+([0-9]+)/gi)].pop();
    const wires = [...(log || "").matchAll(/Number of wires:\s+([0-9]+)/gi)].pop();
    const bits = [...(log || "").matchAll(/Number of wire bits:\s+([0-9]+)/gi)].pop();
    return [
      cells ? `cells ${cells[1]}` : "",
      wires ? `wires ${wires[1]}` : "",
      bits ? `bits ${bits[1]}` : "",
    ].filter(Boolean).join(" / ");
  },

  _summarizeIcetime(log) {
    const max = (log || "").match(/Max frequency.*?([0-9.]+)\s*MHz/i);
    const delay = (log || "").match(/Total path delay:\s*([0-9.]+)\s*ns/i);
    return [
      max ? `Fmax ${max[1]} MHz` : "",
      delay ? `路径延迟 ${delay[1]} ns` : "",
    ].filter(Boolean).join(" / ");
  },

  _renderStatusSummary(status) {
    const summaryEl = document.getElementById("report-status-summary");
    if (!summaryEl) return;
    const steps = ["check", "synthesis", "pnr", "pack", "timing", "floorplan", "program", "simulation", "formal", "mcy", "verilator"];
    const labels = { check: "检查", synthesis: "综合", pnr: "P&R", pack: "比特流", timing: "时序", floorplan: "资源图", program: "烧录", simulation: "仿真", formal: "验证", mcy: "覆盖", verilator: "Verilator" };
    summaryEl.innerHTML = steps.map((s) => {
      const st = status[s] || "pending";
      const cls = st === "success" ? "st-ok" : st === "failed" ? "st-err" : st === "running" ? "st-run" : "st-pend";
      const icon = st === "success" ? "✓" : st === "failed" ? "!" : st === "running" ? "…" : "•";
      return `<span class="rs-chip ${cls}" title="${labels[s]}: ${st}">${icon} ${labels[s]}</span>`;
    }).join("");
  },

  _buildHtmlReport(artifacts) {
    const project = Config.data.project;
    const board = Config.data.board;
    const top = project.top_module || "top";
    const family = board.fpga_family || "ice40";
    const rows = {
      "工程名称": project.name || "-",
      "工程目录": Config.getProjectDir() || "-",
      "顶层模块": top,
      "板卡": board.name || "-",
      "FPGA 系列": family,
      "FPGA 型号": board.fpga_device || "-",
      "封装": board.fpga_package || "-",
      "源文件数": (project.sources || []).length,
      "约束文件": (project.constraints || []).join(", ") || "无",
      "综合网表": artifacts.synthesis ? `output/synthesis/${top}.json` : "缺失",
      "布局文件": artifacts.pnr ? this._pnrPath(top, family) : "缺失",
      "比特流": artifacts.bitstream ? this._bitstreamPath(top, family) : "缺失",
    };
    const acceptance = artifacts.acceptance;
    const toolchain = artifacts.toolchainAcceptance;
    const statusRows = Object.entries(Pipeline.status || {}).map(([key, value]) => ({
      step: key,
      status: this._stateText(value),
      time: Pipeline.timestamps?.[key] ? new Date(Pipeline.timestamps[key]).toLocaleString("zh-CN") : "-",
      detail: Pipeline.results?.[key] || "",
    }));
    const toolGroups = (toolchain?.groups || []).map((group) => ({
      name: group.title,
      result: group.pending ? "检测中" : group.ok ? "通过" : group.required ? "需要处理" : "可选缺失",
      tools: (group.toolNames || []).join(" / ") || "-",
      missing: (group.missing || []).join("；"),
    }));
    const artifactList = (artifacts.reportFiles || []).map((file) => `<li>${this._html(file)}</li>`).join("") || "<li>无</li>";
    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Vflux 工程报告 - ${this._html(project.name || top)}</title>
  <style>
    :root { color-scheme: light; --fg:#17202a; --muted:#667085; --line:#d8dee9; --ok:#1a7f37; --bad:#cf222e; --warn:#9a6700; --bg:#f6f8fb; --card:#fff; --accent:#0969da; }
    body { margin:0; font:14px/1.55 "Segoe UI", "Microsoft YaHei", Arial, sans-serif; color:var(--fg); background:var(--bg); }
    header { padding:32px 40px 22px; background:#0f172a; color:#fff; }
    header h1 { margin:0 0 8px; font-size:28px; letter-spacing:0; }
    header p { margin:0; color:#cbd5e1; }
    main { max-width:1180px; margin:0 auto; padding:24px; display:grid; gap:18px; }
    section { background:var(--card); border:1px solid var(--line); border-radius:8px; padding:18px; }
    h2 { margin:0 0 12px; font-size:17px; }
    .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:12px; }
    .kv { display:flex; justify-content:space-between; gap:14px; border-bottom:1px solid #edf0f5; padding:7px 0; }
    .kv span:first-child { color:var(--muted); }
    .kv span:last-child { font-family:Consolas, "Cascadia Mono", monospace; text-align:right; overflow-wrap:anywhere; }
    .badge { display:inline-block; padding:4px 10px; border-radius:999px; border:1px solid var(--line); font-size:12px; }
    .ok { color:var(--ok); border-color:#8cdaa2; background:#eefbf1; }
    .bad { color:var(--bad); border-color:#ffb3ba; background:#fff1f2; }
    .warn { color:var(--warn); border-color:#f0c36a; background:#fff8dc; }
    table { width:100%; border-collapse:collapse; }
    th, td { text-align:left; border-bottom:1px solid #edf0f5; padding:8px; vertical-align:top; }
    th { color:var(--muted); font-weight:600; }
    code { font-family:Consolas, "Cascadia Mono", monospace; }
    ul { margin:8px 0 0 18px; padding:0; }
    footer { color:var(--muted); padding:6px 40px 30px; text-align:center; }
  </style>
</head>
<body>
  <header>
    <h1>${this._html(project.name || "Vflux 工程报告")}</h1>
    <p>生成时间：${this._html(new Date().toLocaleString("zh-CN"))} / 顶层模块：${this._html(top)}</p>
  </header>
  <main>
    <section>
      <h2>验收结论</h2>
      <p>${this._acceptanceBadge(acceptance)} ${toolchain ? this._toolchainBadge(toolchain) : '<span class="badge warn">工具链未验收</span>'}</p>
      ${acceptance ? this._kvTable({
        "验收类型": acceptance.type === "example-acceptance" ? "例程验收" : "工程验收",
        "目标": acceptance.title || "-",
        "开始时间": acceptance.started_at ? new Date(acceptance.started_at).toLocaleString("zh-CN") : "-",
        "完成时间": acceptance.finished_at ? new Date(acceptance.finished_at).toLocaleString("zh-CN") : "-",
        "停止位置": acceptance.stopped_at || "无",
      }) : "<p>尚未运行工程验收。</p>"}
    </section>
    <section>
      <h2>工程与器件</h2>
      ${this._kvTable(rows)}
    </section>
    <section>
      <h2>资源与时序摘要</h2>
      ${this._kvTable({
        "Yosys 综合摘要": artifacts.yosysSummary || "暂无",
        "nextpnr 摘要": artifacts.nextpnrSummary || "暂无",
        "icetime 摘要": artifacts.icetimeSummary || "暂无",
        "nextpnr JSON": artifacts.nextpnrReport ? "已生成" : "未生成",
        "比特流元数据": artifacts.metadata ? "已生成" : "未生成",
      })}
    </section>
    <section>
      <h2>工具链环境</h2>
      ${toolGroups.length ? this._table(["能力", "结论", "工具", "问题"], toolGroups.map((g) => [g.name, g.result, g.tools, g.missing || "-"])) : "<p>尚未运行工具链环境验收。</p>"}
    </section>
    <section>
      <h2>流水线状态</h2>
      ${this._table(["步骤", "状态", "时间", "说明"], statusRows.map((r) => [r.step, r.status, r.time, r.detail || "-"]))}
    </section>
    <section>
      <h2>报告产物</h2>
      <ul>${artifactList}</ul>
    </section>
  </main>
  <footer>Vflux report generated from local project data.</footer>
</body>
</html>`;
  },

  _kvTable(data) {
    return `<div class="grid">${Object.entries(data).map(([key, value]) => `<div class="kv"><span>${this._html(key)}</span><span>${this._html(value)}</span></div>`).join("")}</div>`;
  },

  _table(headers, rows) {
    return `<table><thead><tr>${headers.map((h) => `<th>${this._html(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${this._html(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  },

  _acceptanceBadge(acceptance) {
    if (!acceptance) return '<span class="badge warn">工程未验收</span>';
    return acceptance.success ? '<span class="badge ok">工程验收通过</span>' : '<span class="badge bad">工程验收未通过</span>';
  },

  _toolchainBadge(toolchain) {
    const failed = Number(toolchain.failed || 0);
    return failed ? `<span class="badge bad">工具链 ${this._html(toolchain.passed)}/${this._html(toolchain.total)} 通过</span>` : `<span class="badge ok">工具链 ${this._html(toolchain.passed)}/${this._html(toolchain.total)} 通过</span>`;
  },

  _html(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  },

  _row(label, value) {
    return `<div class="rp-row"><span class="rp-label">${ToolStepUI.escape(label)}</span><span class="rp-val">${ToolStepUI.escape(value)}</span></div>`;
  },

  _bitstreamPath(top, family) {
    if (family === "ecp5") return `output/bitstream/${top}.bit`;
    if (family === "gowin") return `output/bitstream/${top}.fs`;
    return `output/bitstream/${top}.bin`;
  },

  _pnrPath(top, family) {
    if (family === "ecp5") return `output/pnr/${top}.config`;
    if (family === "gowin") return `output/pnr/${top}.pnr.json`;
    return `output/pnr/${top}.asc`;
  },

  _stateText(state) {
    return { success: "完成", failed: "失败", running: "进行中", pending: "等待" }[state] || state;
  },

  async _openDir() {
    const dir = Config.getProjectDir();
    if (dir) await window.vflux.shellOpenDir(dir);
  },

  async _openArtifact(event) {
    const button = event.target.closest("[data-open-path]");
    if (!button) return;
    const relative = button.getAttribute("data-open-path");
    const full = ToolStepUI.projectPath(relative);
    if (!(await window.vflux.fileExists(full))) {
      ToolStepUI.render("report-result", "report-summary", "report-feedback-list", "failed", "产物不存在", [
        { state: "failed", text: `没有找到 ${relative}` },
        { state: "pending", text: "请先在对应工作台启用相关产物选项并重新生成。" },
      ]);
      return;
    }
    await window.vflux.shellOpenPath(full);
  },
};
