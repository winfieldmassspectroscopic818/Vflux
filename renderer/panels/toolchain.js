"use strict";

const PanelToolchain = {
  _lastProbe: [],
  _featureState: {},
  _lastAutoProbeKey: "",
  _autoProbeRunning: false,

  init() {
    document.getElementById("btn-browse-oss").addEventListener("click", () => this._browseOss());
    document.getElementById("btn-probe-toolchain").addEventListener("click", () => this.probe());
  },

  refresh() {
    const savedPath = Config.getGlobalOssCadPath?.() || "";
    if (!Config.data.toolchain.oss_cad_path && savedPath) {
      // 工具链路径优先作为全局偏好复用，避免新工程反复变红。
      Config.data.toolchain.oss_cad_path = savedPath;
    }
    const board = Config.data.board;
    const family = board.fpga_family || "ice40";
    document.getElementById("tl-synth").textContent = "Yosys";
    document.getElementById("tl-pnr").textContent = "nextpnr-" + family;
    document.getElementById("tl-pack").textContent = this._pack(family);
    document.getElementById("tl-prog").textContent = this._prog(family);
    document.getElementById("cfg-oss-path").value = Config.data.toolchain.oss_cad_path || "(自动搜索 OSS CAD Suite，或手动选择安装目录)";
    this._renderAcceptance(this._lastProbe);
    this._renderMatrix(this._lastProbe);
  },

  async onShow() {
    const projectKey = Config.getProjectDir?.() || ".";
    const key = `${projectKey}|${Config.data.toolchain.oss_cad_path || "auto"}|${Config.data.board.fpga_family || "ice40"}|${Config.data.board.program_tool || ""}`;
    if (this._autoProbeRunning) return;
    if (this._lastAutoProbeKey === key && Pipeline.status.toolchain === "success") return;
    this._autoProbeRunning = true;
    this._lastAutoProbeKey = key;
    try {
      await this.probe();
    } finally {
      this._autoProbeRunning = false;
    }
  },

  _pack(family) {
    const tools = { ice40: "icepack", ecp5: "ecppack", gowin: "gowin_pack" };
    return tools[family] || "自动选择";
  },

  _prog(family) {
    if (Config.data.board.program_tool) return Config.data.board.program_tool;
    const tools = { ice40: "icesprog", ecp5: "ecpprog", gowin: "openFPGALoader" };
    return tools[family] || "openFPGALoader";
  },

  _cmd(name) {
    if (window.vflux?.platform !== "win32" && /\.exe$/i.test(name)) return name.replace(/\.exe$/i, "");
    return name;
  },

  async _browseOss() {
    const result = await window.vflux.openDirectoryDialog({ title: "选择 OSS CAD Suite 目录" });
    if (result?.filePaths?.[0]) {
      document.getElementById("cfg-oss-path").value = result.filePaths[0];
      Config.setOssCadPath(result.filePaths[0]);
      await this.apply();
    }
  },

  async apply() {
    const result = await window.vflux.setToolchainPath(Config.data.toolchain.oss_cad_path || "");
    if (!result.success) {
      Pipeline.set("toolchain", "failed", result.reason || "路径无效");
      App.setStatus(result.reason || "工具链路径无效");
      return;
    }
    Pipeline.set("toolchain", "success");
    App.setStatus("工具链配置已更新");
    await this.probe();
  },

  async probe() {
    const button = document.getElementById("btn-probe-toolchain");
    const summary = document.getElementById("toolchain-probe-summary");
    if (button) button.disabled = true;
    if (summary) summary.textContent = "环境验收中...";
    ToolStepUI.render("toolchain-result", "toolchain-summary", "toolchain-feedback-list", "running", "正在验收工具链环境", [
      { state: "running", text: "检测综合、布局布线、比特流、烧录、仿真和可视化工具。" },
    ]);
    ToolStepUI.setTechnical("toolchain", { meta: "环境验收中", command: "probe OSS CAD Suite tools", log: "" });
    this._renderMatrix(this._toolSpecs().map((tool) => ({ ...tool, pending: true })));
    this._renderAcceptance(this._toolSpecs().map((tool) => ({ ...tool, pending: true })));

    // 先把“检测中”状态交给浏览器绘制，避免 IPC 返回前界面停在旧状态。
    await new Promise((resolve) => requestAnimationFrame(resolve));

    try {
      const pathResult = await window.vflux.setToolchainPath(Config.data.toolchain.oss_cad_path || "");
      if (!pathResult.success) throw new Error(pathResult.reason || "OSS CAD Suite 路径无效");
      if (pathResult.path && !Config.data.toolchain.oss_cad_path) {
        // 自动搜索成功时也记录下来，下次打开工程即可直接使用。
        Config.data.toolchain.oss_cad_path = pathResult.path;
        Config.setGlobalOssCadPath(pathResult.path);
        const pathInput = document.getElementById("cfg-oss-path");
        if (pathInput) pathInput.value = pathResult.path;
      }
      const response = await window.vflux.probeToolchain(this._toolSpecs());
      const resultMap = new Map((response.results || []).map((result) => [result.command, result]));
      this._lastProbe = this._toolSpecs().map((tool) => ({ ...tool, ...(resultMap.get(tool.command) || {}) }));
      this._featureState = this._collectFeatures(this._lastProbe);
      this._renderMatrix(this._lastProbe);
      const acceptance = this._buildAcceptance(this._lastProbe);
      this._renderAcceptance(this._lastProbe, acceptance);
      this.applyFeatureState();
      await this._writeAcceptance(acceptance);

      const okCount = this._lastProbe.filter((tool) => tool.ok).length;
      const total = this._lastProbe.length;
      const requiredOk = this._lastProbe.filter((tool) => tool.required).every((tool) => tool.ok);
      if (summary) summary.textContent = `${acceptance.passed}/${acceptance.total} 项通过，${acceptance.failed} 项失败，${acceptance.optionalMissing} 项可选缺失`;
      Pipeline.set("toolchain", requiredOk ? "success" : "failed", `${okCount}/${total}`);
      App.setStatus(okCount === total ? "工具链能力检测通过" : "工具链检测完成，部分能力不可用");
      ToolStepUI.render("toolchain-result", "toolchain-summary", "toolchain-feedback-list", requiredOk ? "success" : "failed", requiredOk ? "环境验收通过" : "环境验收发现问题", acceptance.feedback);
      ToolStepUI.setTechnical("toolchain", { meta: "环境验收结果", command: "probe OSS CAD Suite tools", log: JSON.stringify(acceptance, null, 2) });
    } catch (error) {
      if (summary) summary.textContent = "检测失败";
      Pipeline.set("toolchain", "failed", "probe failed");
      App.setStatus("工具链检测失败：" + error.message);
      ToolStepUI.render("toolchain-result", "toolchain-summary", "toolchain-feedback-list", "failed", "环境验收失败", [
        { state: "failed", text: error.message },
      ]);
    } finally {
      if (button) button.disabled = false;
    }
  },

  _toolSpecs() {
    const board = Config.data.board;
    const family = board.fpga_family || "ice40";
    const cmd = (name) => this._cmd(name);
    const specs = [
      { command: cmd("yosys.exe"), role: "综合", required: true, versionArgs: ["--version"] },
      { command: cmd(`nextpnr-${family}.exe`), aliases: family === "gowin" ? [cmd("nextpnr-himbaechel.exe")] : [], role: "布局布线", required: true, versionArgs: ["--version"], featureArgs: ["--help"], features: this._nextpnrFeatures(family) },
      { command: cmd(`${this._pack(family)}.exe`), role: "生成比特流", required: true, versionArgs: ["--version"], featureArgs: ["--help"], features: this._packFeatures(family) },
      { command: cmd(`${this._prog(family)}.exe`), role: "烧录", required: true, versionArgs: ["--version"] },
      { command: cmd("lsftdi.exe"), role: "FTDI 检测", required: family === "ice40", versionArgs: ["--help"] },
      { command: cmd("openFPGALoader.exe"), role: "通用烧录/检测", required: family !== "ice40", versionArgs: ["--version"] },
      { command: cmd("iverilog.exe"), role: "仿真编译", required: false, versionArgs: ["-V"] },
      { command: cmd("vvp.exe"), role: "仿真运行", required: false, versionArgs: ["-V"] },
      { command: cmd("gtkwave.exe"), role: "GTKWave 波形", required: false, versionArgs: ["--version"] },
      { command: cmd("surfer.exe"), role: "Surfer 波形", required: false, versionArgs: ["--version"] },
      { command: cmd("sby.exe"), role: "形式验证", required: false, versionArgs: ["--version"] },
      { command: cmd("verilator.exe"), aliases: [cmd("verilator_bin.exe"), "verilator"], role: "高级仿真/Lint", required: false, versionArgs: ["--version"] },
      { command: cmd("mcy.exe"), role: "突变覆盖", required: false, versionArgs: ["--version"] },
      { command: cmd("icebox_html.exe"), role: "内部布线 HTML", required: false, versionArgs: ["-h"] },
      { command: cmd("icebox_vlog.exe"), role: "反解门级网表", required: false, versionArgs: ["-h"] },
    ];
    return specs.filter((tool, index, array) => array.findIndex((t) => t.command === tool.command) === index);
  },

  _nextpnrFeatures(family) {
    if (family === "ecp5") return {
      pnr_speed: "--speed",
      pnr_lpf: "--lpf",
      pnr_no_serdes: "--no-serdes",
      pnr_no_dsp: "--no-dsp",
      pnr_report: "--report",
      pnr_svg: "--placed-svg",
    };
    if (family === "gowin") return {
      pnr_cst: "cst",
      pnr_ignore_timing: "ignore_timing",
      pnr_dont_use_ram: "dont_use_ram",
      pnr_no_dsp: "dont_use_dsp",
      pnr_report: "--report",
    };
    return {
      pnr_sdf: "--sdf",
      pnr_detailed_timing: "--detailed-timing-report",
      pnr_no_tmdriv: "--no-tmdriv",
      pnr_report: "--report",
      pnr_svg: "--placed-svg",
    };
  },

  _packFeatures(family) {
    if (family === "ecp5") return {
      pack_compress: "--compress",
      pack_crc: "--crc",
      pack_svf: "--svf",
      pack_flash: "--flash",
      pack_background: "--background",
      pack_freq: "--freq",
      pack_idcode: "--idcode",
      pack_key: "--key",
    };
    if (family === "gowin") return {
      pack_compress: "compress",
      pack_crc: "crc",
      pack_key: "key",
    };
    return { pack_reverse: "icepack" };
  },

  _collectFeatures(tools) {
    const state = {};
    for (const tool of tools || []) {
      for (const [name, ok] of Object.entries(tool.features || {})) state[name] = !!ok;
    }
    return state;
  },

  applyFeatureState() {
    const map = {
      "pnr-opt-sdf": "pnr_sdf",
      "pnr-opt-detailed-timing": "pnr_detailed_timing",
      "pnr-opt-no-tmdriv": "pnr_no_tmdriv",
      "pnr-opt-no-serdes": "pnr_no_serdes",
      "pnr-opt-no-dsp": "pnr_no_dsp",
      "pnr-lpf-file": "pnr_lpf",
      "pnr-cst-file": "pnr_cst",
      "pnr-speed-grade": "pnr_speed",
      "pack-opt-compress": "pack_compress",
      "pack-opt-crc": "pack_crc",
      "pack-opt-svf": "pack_svf",
      "pack-opt-flash": "pack_flash",
      "pack-opt-background": "pack_background",
      "pack-opt-freq": "pack_freq",
      "pack-opt-idcode": "pack_idcode",
      "pack-opt-key": "pack_key",
    };
    for (const [id, feature] of Object.entries(map)) {
      const input = document.getElementById(id);
      if (!input) continue;
      const known = Object.prototype.hasOwnProperty.call(this._featureState, feature);
      const supported = !known || this._featureState[feature];
      input.disabled = !supported;
      const label = input.closest("label");
      if (label) label.classList.toggle("unsupported", !supported);
    }
  },

  _renderMatrix(tools) {
    const matrix = document.getElementById("toolchain-matrix");
    if (!matrix) return;
    const list = tools?.length ? tools : this._toolSpecs();
    matrix.innerHTML = list.map((tool) => {
      const state = tool.pending ? "pending" : tool.ok ? "ok" : "missing";
      const status = tool.pending ? "检测中" : tool.ok ? "可用" : "不可用";
      const commandLabel = tool.actualCommand && tool.actualCommand !== tool.command ? `${tool.command} (${tool.actualCommand})` : tool.command;
      const detail = tool.pending ? "等待工具响应" : tool.ok ? (tool.version || "已找到") : (tool.reason || "尚未检测");
      const featureText = tool.features ? this._featureSummary(tool.features) : "";
      return `
        <div class="tool-card ${state}">
          <div class="tool-card-head">
            <strong>${ToolStepUI.escape(tool.role)}</strong>
            <span>${status}</span>
          </div>
          <code>${ToolStepUI.escape(commandLabel)}</code>
          <p>${ToolStepUI.escape(detail)}</p>
          ${featureText ? `<em>${ToolStepUI.escape(featureText)}</em>` : ""}
          ${tool.required ? "<em>构建必需</em>" : "<em>可选能力</em>"}
        </div>`;
    }).join("");
  },

  _buildAcceptance(tools) {
    const family = Config.data.board.fpga_family || "ice40";
    const byCommand = new Map((tools || []).map((tool) => [tool.command, tool]));
    const find = (...commands) => commands.map((cmd) => byCommand.get(cmd)).find(Boolean);
    const cmd = (name) => this._cmd(name);
    const groups = [
      { key: "synthesis", title: "综合", required: true, tools: [find(cmd("yosys.exe"))] },
      { key: "pnr", title: "布局布线", required: true, tools: [find(cmd(`nextpnr-${family}.exe`))] },
      { key: "pack", title: "比特流生成", required: true, tools: [find(cmd(`${this._pack(family)}.exe`))] },
      { key: "program", title: "烧录/下载", required: true, tools: [find(cmd(`${this._prog(family)}.exe`)), find(cmd("openFPGALoader.exe")), find(cmd("lsftdi.exe"))].filter(Boolean) },
      { key: "simulation", title: "仿真", required: false, tools: [find(cmd("iverilog.exe")), find(cmd("vvp.exe"))] },
      { key: "wave", title: "波形查看", required: false, tools: [find(cmd("surfer.exe")), find(cmd("gtkwave.exe"))] },
      { key: "debug", title: "验证与调试", required: false, tools: [find(cmd("sby.exe")), find(cmd("verilator.exe")), find(cmd("mcy.exe"))] },
      { key: "visual", title: "图形化产物", required: false, tools: [find(cmd("icebox_html.exe")), find(cmd("icebox_vlog.exe"))] },
    ];
    const results = groups.map((group) => {
      const present = group.tools.filter(Boolean);
      const okTools = present.filter((tool) => tool.ok);
      const requiredOk = group.required ? present.length > 0 && present.every((tool) => tool.ok || !tool.required) : okTools.length > 0;
      const ok = group.required ? requiredOk : okTools.length > 0;
      const pending = present.some((tool) => tool.pending);
      const missing = present.filter((tool) => !tool.ok && !tool.pending);
      return {
        ...group,
        ok,
        pending,
        toolNames: present.map((tool) => tool.actualCommand || tool.command),
        missing: missing.map((tool) => `${tool.role}: ${tool.reason || "不可用"}`),
      };
    });
    const failedRequired = results.filter((group) => group.required && !group.ok && !group.pending);
    const optionalMissing = results.filter((group) => !group.required && !group.ok && !group.pending).length;
    const feedback = [];
    if (!failedRequired.length) feedback.push({ state: "success", text: "核心构建工具可用：综合、布局布线、比特流生成具备运行条件。" });
    for (const group of failedRequired) feedback.push({ state: "failed", text: `${group.title}不可用：${group.missing.join("；") || "缺少必要工具"}` });
    if (family === "ice40" && !find(cmd("lsftdi.exe"))?.ok) feedback.push({ state: "pending", text: "iCE40/FTDI 检测工具不可用时，烧录连接诊断会受限。" });
    if (!results.find((g) => g.key === "wave")?.ok) feedback.push({ state: "pending", text: "未找到可用波形查看器，仿真仍可运行，但无法直接打开波形。" });
    if (optionalMissing) feedback.push({ state: "pending", text: `${optionalMissing} 个可选能力暂不可用，不影响核心构建。` });
    return {
      schema: 1,
      family,
      created_at: new Date().toISOString(),
      total: results.length,
      passed: results.filter((group) => group.ok).length,
      failed: failedRequired.length,
      optionalMissing,
      groups: results.map(({ tools: _tools, ...rest }) => rest),
      tools: tools || [],
      feedback,
    };
  },

  _renderAcceptance(tools, acceptance = null) {
    const grid = document.getElementById("toolchain-acceptance-grid");
    if (!grid) return;
    const data = acceptance || this._buildAcceptance(tools || []);
    grid.innerHTML = data.groups.map((group) => {
      const state = group.pending ? "pending" : group.ok ? "ok" : group.required ? "missing" : "optional";
      const title = group.pending ? "检测中" : group.ok ? "通过" : group.required ? "需要处理" : "可选缺失";
      const detail = group.toolNames.length ? group.toolNames.join(" / ") : "尚未检测";
      return `
        <div class="tool-accept-card ${state}">
          <div><strong>${ToolStepUI.escape(group.title)}</strong><span>${ToolStepUI.escape(title)}</span></div>
          <p>${ToolStepUI.escape(detail)}</p>
        </div>`;
    }).join("");
  },

  async _writeAcceptance(acceptance) {
    const dir = Config.getProjectDir();
    if (!dir || dir === ".") return;
    // 工具链验收写入工程报告目录，方便用户反馈环境问题时一并提供。
    await window.vflux.writeText(ToolStepUI.projectPath("output/reports/toolchain-acceptance.json"), JSON.stringify(acceptance, null, 2));
  },

  _featureSummary(features) {
    const entries = Object.entries(features || {});
    if (!entries.length) return "";
    const supported = entries.filter(([, ok]) => ok).length;
    return `参数能力 ${supported}/${entries.length}`;
  },
};
