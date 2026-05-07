"use strict";

const PanelCheck = {
  _running: false,
  _logEl: null,
  _cmdEl: null,
  _statusEl: null,
  _summaryEl: null,
  _listEl: null,

  init() {
    this._logEl = document.getElementById("check-log");
    this._cmdEl = document.getElementById("check-cmd-preview");
    this._statusEl = document.getElementById("check-result");
    this._summaryEl = document.getElementById("check-summary");
    this._listEl = document.getElementById("check-feedback-list");
    document.getElementById("btn-check-run").addEventListener("click", () => this.run());
    document.getElementById("btn-check-cancel").addEventListener("click", () => this.cancel());
    document.getElementById("btn-check-clear").addEventListener("click", () => this._resetFeedback());
  },

  refresh() {
    const project = Config.data.project;
    if (!project.name) {
      this._cmdEl.textContent = "请先配置工程";
      this._renderFeedback("idle", "等待工程配置", [
        { state: "pending", text: "填写工程名称和工程目录" },
        { state: "pending", text: "添加 HDL 源文件" },
        { state: "pending", text: "确认顶层模块名称" },
      ]);
      return;
    }

    const sourceCount = (project.sources || []).length;
    const top = project.top_module || "top";
    const language = project.language === "sv" ? "SystemVerilog" : project.language === "vhdl" ? "VHDL" : "Verilog";
    this._cmdEl.textContent = this._buildScript(project);
    this._renderFeedback("ready", "可以开始检查", [
      { state: sourceCount > 0 ? "success" : "failed", text: `源文件：${sourceCount} 个` },
      { state: top ? "success" : "failed", text: `顶层模块：${top || "未设置"}` },
      { state: "success", text: `语言标准：${language}` },
    ]);
  },

  async run() {
    if (this._running) return;
    const project = Config.data.project;
    if (!project.sources || project.sources.length === 0) {
      this._renderFeedback("failed", "还不能检查", [
        { state: "failed", text: "请先在工程页添加 HDL 源文件" },
      ]);
      App.setStatus("检查未开始：缺少源文件");
      return;
    }

    this._running = true;
    this._logEl.textContent = "";
    this._renderFeedback("running", "正在检查 HDL 结构", [
      { state: "running", text: "读取源文件" },
      { state: "running", text: "确认顶层模块和层次关系" },
      { state: "pending", text: "生成检查结论" },
    ]);
    Pipeline.set("check", "running");
    App.setStatus("检查中...");

    const result = await App.runTool(
      "check",
      "yosys.exe",
      ["-p", this._buildScript(project)],
      Config.getProjectDir(),
      (text) => {
        // 原始工具输出只保留在隐藏日志中，用于后续诊断，不直接打扰主界面。
        this._logEl.textContent += text;
        this._logEl.scrollTop = this._logEl.scrollHeight;
      }
    );

    this._running = false;
    if (result.success) {
      Pipeline.set("check", "success");
      this._renderFeedback("success", "检查通过", [
        { state: "success", text: "源文件可以被工具链读取" },
        { state: "success", text: `顶层模块 ${project.top_module || "top"} 已确认` },
        { state: "success", text: "未发现阻塞综合的结构问题" },
      ]);
      App.setStatus("检查通过");
    } else {
      const hints = this._extractHints(this._logEl.textContent);
      Pipeline.set("check", "failed", result.code ? `code:${result.code}` : "");
      Pipeline.resetFrom("synthesis");
      this._renderFeedback("failed", "检查未通过", hints);
      App.setStatus("检查未通过，请根据提示修改工程");
    }
  },

  cancel() {
    if (this._running) {
      App.cancelTool("check");
      this._running = false;
      Pipeline.set("check", "failed");
      this._renderFeedback("failed", "检查已取消", [
        { state: "failed", text: "本次检查没有完成，可以修改后重新检查" },
      ]);
    }
  },

  _buildScript(project) {
    const languageFlag = project.language === "sv" ? " -sv" : "";
    const sources = (project.sources || []).join(" ");
    return `read_verilog${languageFlag} ${sources}; hierarchy -check -top ${project.top_module || "top"}`;
  },

  _resetFeedback() {
    this._logEl.textContent = "";
    this.refresh();
  },

  _renderFeedback(kind, summary, items) {
    if (!this._statusEl || !this._summaryEl || !this._listEl) return;
    this._statusEl.className = `result-card ${kind}`;
    this._summaryEl.textContent = summary;
    this._listEl.innerHTML = (items || [])
      .map((item) => `<li class="${item.state || "pending"}"><span></span>${item.text}</li>`)
      .join("");
  },

  _extractHints(rawLog) {
    const log = rawLog || "";
    const hints = [];
    if (/Can't open input file|No such file|cannot open/i.test(log)) {
      hints.push({ state: "failed", text: "有源文件路径无法读取，请检查工程目录和文件列表" });
    }
    if (/Module .* not found|Can't find module|top module/i.test(log)) {
      hints.push({ state: "failed", text: "顶层模块名称可能不匹配，请回到工程页重新检测或手动填写" });
    }
    if (/syntax error|unexpected/i.test(log)) {
      hints.push({ state: "failed", text: "HDL 语法存在问题，请在代码编辑器中定位并修正" });
    }
    if (/SystemVerilog|sv/i.test(log) && Config.data.project.language !== "sv") {
      hints.push({ state: "failed", text: "如果使用 SystemVerilog 语法，请在工程页把语言标准切换为 SystemVerilog" });
    }
    if (hints.length === 0) {
      hints.push({ state: "failed", text: "工具链返回失败，请检查源文件、顶层模块和依赖文件是否完整" });
    }
    return hints;
  },
};
