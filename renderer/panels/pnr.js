"use strict";

const PanelPnr = {
  _running: false,
  _logEl: null,
  _cmdEl: null,

  init() {
    this._logEl = document.getElementById("pnr-log");
    this._cmdEl = document.getElementById("pnr-cmd-preview");
    document.getElementById("btn-pnr-run").addEventListener("click", () => this.run());
    document.getElementById("btn-pnr-cancel").addEventListener("click", () => this.cancel());
    document.getElementById("btn-pnr-clear").addEventListener("click", () => this.refresh());
    this._bindHookBrowsers();
    this._bindOptions();
  },

  async refresh() {
    this._loadOptions();
    if (PanelToolchain?.applyFeatureState) PanelToolchain.applyFeatureState();
    const project = Config.data.project;
    const board = Config.data.board;
    const top = project.top_module || "top";
    const deviceText = board.fpga_device ? `${board.fpga_family}/${board.fpga_device}/${board.fpga_package || "-"}` : "未选择板卡";
    const constraintText = (project.constraints || []).join(", ") || "未设置";
    document.getElementById("pnr-device").value = deviceText;
    document.getElementById("pnr-constraints").value = constraintText;
    document.getElementById("pnr-device-label").textContent = deviceText;
    document.getElementById("pnr-constraints-label").textContent = constraintText;
    document.getElementById("pnr-output-label").textContent = this._ascPath(top);

    if (!project.name || !board.fpga_family) {
      this._render("ready", "等待综合结果", [
        { state: project.name ? "success" : "pending", text: project.name ? "工程已配置" : "请先完成工程配置" },
        { state: board.fpga_family ? "success" : "pending", text: board.fpga_family ? "板卡已选择" : "请先选择目标板卡" },
        { state: "pending", text: "请先完成综合，得到中间网表" },
      ]);
      return;
    }

    const netlistReady = await ToolStepUI.existsInProject(this._jsonPath(top));
    const plan = this._buildCommand(project, board);
    this._cmdEl.textContent = `${plan.tool} ${plan.args.join(" ")}`;
    this._render("ready", netlistReady ? "可以开始布局布线" : "缺少综合网表", [
      { state: netlistReady ? "success" : "failed", text: netlistReady ? `综合网表已就绪：${this._jsonPath(top)}` : `找不到 ${this._jsonPath(top)}，请先完成综合` },
      { state: "success", text: `目标器件：${deviceText}` },
      { state: (project.constraints || []).length ? "success" : "pending", text: (project.constraints || []).length ? "约束文件已设置" : "没有约束文件，可能导致引脚无法正确绑定" },
      { state: "pending", text: `将生成 ${this._ascPath(top)}` },
    ]);
    ToolStepUI.setTechnical("pnr", { meta: "等待运行布局布线", command: this._cmdEl.textContent, log: this._logEl.textContent });
  },

  async run() {
    if (this._running) return;
    const project = Config.data.project;
    const board = Config.data.board;
    const top = project.top_module || "top";
    if (!board.fpga_family) {
      this._render("failed", "还不能布局布线", [{ state: "failed", text: "请先选择目标板卡" }]);
      App.setStatus("布局布线未开始：未选择板卡");
      return;
    }
    if (!(await ToolStepUI.existsInProject(this._jsonPath(top)))) {
      this._render("failed", "还不能布局布线", [{ state: "failed", text: `缺少 ${this._jsonPath(top)}，请先完成综合` }]);
      App.setStatus("布局布线未开始：缺少综合网表");
      return;
    }
    const hookCheck = await this._validateHooks();
    if (!hookCheck.ok) {
      this._render("failed", "专家脚本不可用", hookCheck.items);
      App.setStatus("布局布线未开始：Python hook 文件不存在");
      return;
    }

    this._running = true;
    this._logEl.textContent = "";
    Pipeline.set("pnr", "running");
    App.setStatus("布局布线中...");
    this._render("running", "正在放置和连线", [
      { state: "running", text: "读取综合网表" },
      { state: "running", text: "按高级选项约束布局布线" },
      { state: "pending", text: "生成布局结果" },
    ]);

    const command = this._buildCommand(project, board);
    const commandText = `${command.tool} ${command.args.join(" ")}`;
    ToolStepUI.setTechnical("pnr", { meta: "运行中", command: commandText, log: "" });
    const result = await App.runTool("pnr", command.tool, command.args, Config.getProjectDir(), (text) => this._appendLog(text));
    this._running = false;
    ToolStepUI.setTechnical("pnr", { meta: `退出码：${result.code ?? 0}`, command: commandText, log: this._logEl.textContent });

    if (result.success) {
      Pipeline.set("pnr", "success");
      this._render("success", "布局布线完成", [
        { state: "success", text: "逻辑已经映射到目标 FPGA 资源" },
        { state: "success", text: `已生成 ${this._ascPath(top)}` },
        { state: "success", text: "下一步可以生成比特流" },
      ]);
      App.setStatus("布局布线完成");
    } else {
      Pipeline.set("pnr", "failed", result.code ? `code:${result.code}` : "");
      Pipeline.resetFrom("pack");
      this._render("failed", "布局布线失败", ToolDiagnostics.analyze("pnr", this._logEl.textContent, { top }));
      App.setStatus("布局布线失败，请根据提示调整设计或约束");
    }
  },

  cancel() {
    if (!this._running) return;
    App.cancelTool("pnr");
    this._running = false;
    Pipeline.set("pnr", "failed");
    this._render("failed", "布局布线已停止", [{ state: "failed", text: "本次没有生成可用于比特流打包的布局文件" }]);
  },

  _buildCommand(project, board) {
    const top = project.top_module || "top";
    const json = this._jsonPath(top);
    const asc = this._ascPath(top);
    const tool = board.fpga_family === "gowin" ? "nextpnr-himbaechel.exe" : `nextpnr-${board.fpga_family}.exe`;
    let args = [];
    if (board.fpga_family === "ice40") {
      args = [`--${board.fpga_device}`, "--package", board.fpga_package, "--json", json, "--asc", asc];
      if ((project.constraints || [])[0]) args.push("--pcf", project.constraints[0]);
      if (this._checked("pnr-opt-timing")) args.push("--freq", String(this._number("pnr-frequency", 12)));
      if (this._checked("pnr-opt-ignore-loops")) args.push("--ignore-loops");
      if (!this._checked("pnr-opt-promote-globals")) args.push("--no-promote-globals");
      if (this._checked("pnr-opt-allow-unconstrained")) args.push("--pcf-allow-unconstrained");
      if (this._checked("pnr-opt-timing-allow-fail")) args.push("--timing-allow-fail");
      // 专家选项：用于把 nextpnr 的诊断和时序产物接入 GUI。
      if (this._checked("pnr-opt-werror")) args.push("--Werror");
      if (this._checked("pnr-opt-no-tmdriv")) args.push("--no-tmdriv");
      const stage = this._value("pnr-stage");
      if (stage) args.push(`--${stage}`);
      this._appendHook(args, "pre-pack", "pnr-hook-pre-pack");
      this._appendHook(args, "pre-place", "pnr-hook-pre-place");
      this._appendHook(args, "pre-route", "pnr-hook-pre-route");
      this._appendHook(args, "post-route", "pnr-hook-post-route");
      const placer = this._value("pnr-placer");
      const router = this._value("pnr-router");
      if (placer) args.push("--placer", placer);
      if (router) args.push("--router", router);
      if (this._number("pnr-threads", 1) > 1) args.push("--threads", String(this._number("pnr-threads", 1)));
      if (this._checked("pnr-opt-report")) args.push("--report", `output/reports/${top}.nextpnr.json`);
      if (this._checked("pnr-opt-sdf")) args.push("--sdf", `output/reports/${top}.sdf`);
      if (this._checked("pnr-opt-detailed-timing")) args.push("--detailed-timing-report");
      if (this._checked("pnr-opt-svg")) {
        args.push("--placed-svg", `output/reports/${top}.placed.svg`);
        args.push("--routed-svg", `output/reports/${top}.routed.svg`);
      }
      args.push("--seed", String(this._number("pnr-seed", 1)));
    } else if (board.fpga_family === "ecp5") {
      args = ["--json", json, "--textcfg", asc, "--" + board.fpga_device, "--package", board.fpga_package];
      const lpf = this._value("pnr-lpf-file") || (project.constraints || []).find((file) => /\.lpf$/i.test(file));
      if (lpf) args.push("--lpf", lpf);
      if (this._checked("pnr-opt-timing") && !this._checked("pnr-opt-ignore-timing")) args.push("--freq", String(this._number("pnr-frequency", 12)));
      if (this._checked("pnr-opt-ignore-timing")) args.push("--ignore-loops");
      if (this._checked("pnr-opt-timing-allow-fail")) args.push("--timing-allow-fail");
      if (this._checked("pnr-opt-werror")) args.push("--Werror");
      if (this._checked("pnr-opt-no-serdes")) args.push("--no-serdes");
      if (this._checked("pnr-opt-no-dsp")) args.push("--no-dsp");
      const speed = this._value("pnr-speed-grade") || board.fpga_speed;
      if (speed) args.push("--speed", speed);
      if (this._number("pnr-threads", 1) > 1) args.push("--threads", String(this._number("pnr-threads", 1)));
      if (this._checked("pnr-opt-report")) args.push("--report", `output/reports/${top}.nextpnr.json`);
      if (this._checked("pnr-opt-svg")) args.push("--placed-svg", `output/reports/${top}.placed.svg`, "--routed-svg", `output/reports/${top}.routed.svg`);
      args.push("--seed", String(this._number("pnr-seed", 1)));
    } else if (board.fpga_family === "gowin") {
      args = ["--json", json, "--write", asc, "--device", board.fpga_device, "--vopt", `family=${this._gowinFamily(board.fpga_device)}`];
      if (board.fpga_package) args.push("--package", board.fpga_package);
      const cst = this._value("pnr-cst-file") || (project.constraints || []).find((file) => /\.cst$/i.test(file));
      if (cst) args.push("--vopt", `cst=${cst}`);
      if (this._checked("pnr-opt-ignore-timing")) args.push("--vopt", "ignore_timing=1");
      if (this._checked("pnr-opt-dont-use-ram")) args.push("--vopt", "dont_use_ram=1");
      if (this._checked("pnr-opt-no-dsp")) args.push("--vopt", "dont_use_dsp=1");
      if (this._checked("pnr-opt-report")) args.push("--report", `output/reports/${top}.nextpnr.json`);
      args.push("--seed", String(this._number("pnr-seed", 1)));
    } else {
      args = ["--json", json, "--asc", asc];
    }
    return { tool, args };
  },

  _jsonPath(top) { return `output/synthesis/${top}.json`; },
  _ascPath(top) {
    const family = Config.data.board.fpga_family;
    if (family === "ecp5") return `output/pnr/${top}.config`;
    if (family === "gowin") return `output/pnr/${top}.pnr.json`;
    return `output/pnr/${top}.asc`;
  },
  _gowinFamily(device) {
    if (/GW2AR-18/i.test(device || "")) return "GW2A-18C";
    if (/GW1NSR-4/i.test(device || "")) return "GW1NS-4";
    return "GW1N-9C";
  },
  _checked(id) { const el = document.getElementById(id); return !!el && el.checked; },
  _number(id, fallback) { const n = Number(document.getElementById(id)?.value); return Number.isFinite(n) && n > 0 ? n : fallback; },
  _value(id) { return document.getElementById(id)?.value || ""; },
  _appendHook(args, flag, id) {
    const script = this._value(id).trim();
    if (script) args.push(`--${flag}`, script);
  },
  _resolvePath(path) {
    if (!path) return "";
    if (/^[a-zA-Z]:[\\/]/.test(path) || /^\\\\/.test(path) || path.startsWith("/")) return path;
    return ToolStepUI.projectPath(path);
  },
  async _validateHooks() {
    const hooks = [
      ["pre-pack", "pnr-hook-pre-pack"],
      ["pre-place", "pnr-hook-pre-place"],
      ["pre-route", "pnr-hook-pre-route"],
      ["post-route", "pnr-hook-post-route"],
    ];
    const items = [];
    let ok = true;
    for (const [label, id] of hooks) {
      const value = this._value(id).trim();
      if (!value) continue;
      const exists = await window.vflux.fileExists(this._resolvePath(value));
      items.push({ state: exists ? "success" : "failed", text: exists ? `${label} 脚本已找到：${value}` : `${label} 脚本不存在：${value}` });
      if (!exists) ok = false;
    }
    if (!items.length) items.push({ state: "pending", text: "未配置 Python hook，将执行标准布局布线流程" });
    return { ok, items };
  },
  _bindHookBrowsers() {
    const map = {
      "btn-pnr-hook-pre-pack": "pnr-hook-pre-pack",
      "btn-pnr-hook-pre-place": "pnr-hook-pre-place",
      "btn-pnr-hook-pre-route": "pnr-hook-pre-route",
      "btn-pnr-hook-post-route": "pnr-hook-post-route",
    };
    for (const [buttonId, inputId] of Object.entries(map)) {
      document.getElementById(buttonId)?.addEventListener("click", async () => {
        const result = await window.vflux.openFileDialog({
          title: "选择 nextpnr Python hook",
          filters: [{ name: "Python", extensions: ["py"] }, { name: "All Files", extensions: ["*"] }],
        });
        if (result?.filePaths?.[0]) {
          const input = document.getElementById(inputId);
          input.value = result.filePaths[0];
          input.dispatchEvent(new Event("input"));
        }
      });
    }
  },
  _appendLog(text) { ToolStepUI.appendHiddenLog(this._logEl, text); },
  _render(kind, summary, items) { ToolStepUI.render("pnr-result", "pnr-summary", "pnr-feedback-list", kind, summary, items); },

  _bindOptions() {
    const checkboxes = {
      "pnr-opt-timing": "timing",
      "pnr-opt-ignore-loops": "ignore_loops",
      "pnr-opt-promote-globals": "promote_globals",
      "pnr-opt-allow-unconstrained": "allow_unconstrained",
      "pnr-opt-timing-allow-fail": "timing_allow_fail",
      "pnr-opt-report": "report",
      "pnr-opt-svg": "svg",
      "pnr-opt-sdf": "sdf",
      "pnr-opt-detailed-timing": "detailed_timing",
      "pnr-opt-werror": "werror",
      "pnr-opt-no-tmdriv": "no_tmdriv",
      "pnr-opt-ignore-timing": "ignore_timing",
      "pnr-opt-no-serdes": "no_serdes",
      "pnr-opt-dont-use-ram": "dont_use_ram",
      "pnr-opt-no-dsp": "no_dsp",
    };
    for (const [id, key] of Object.entries(checkboxes)) {
      document.getElementById(id)?.addEventListener("change", (event) => {
        Config.setFlowValue("pnr", key, event.target.checked);
        this.refresh();
      });
    }
    const numbers = { "pnr-seed": "seed", "pnr-frequency": "frequency", "pnr-threads": "threads" };
    for (const [id, key] of Object.entries(numbers)) {
      document.getElementById(id)?.addEventListener("input", (event) => {
        Config.setFlowValue("pnr", key, Number(event.target.value) || 0);
        this.refresh();
      });
    }
    const selects = { "pnr-placer": "placer", "pnr-router": "router", "pnr-stage": "stage" };
    for (const [id, key] of Object.entries(selects)) {
      document.getElementById(id)?.addEventListener("change", (event) => {
        Config.setFlowValue("pnr", key, event.target.value);
        this.refresh();
      });
    }
    const textInputs = { "pnr-hook-pre-pack": "pre_pack", "pnr-hook-pre-place": "pre_place", "pnr-hook-pre-route": "pre_route", "pnr-hook-post-route": "post_route", "pnr-lpf-file": "lpf", "pnr-cst-file": "cst", "pnr-speed-grade": "speed_grade" };
    for (const [id, key] of Object.entries(textInputs)) {
      document.getElementById(id)?.addEventListener("input", (event) => {
        Config.setFlowValue("pnr", key, event.target.value);
        this.refresh();
      });
    }
  },

  _loadOptions() {
    const flow = Config.getFlow("pnr");
    const values = {
      "pnr-opt-timing": !!flow.timing,
      "pnr-opt-ignore-loops": !!flow.ignore_loops,
      "pnr-opt-promote-globals": !!flow.promote_globals,
      "pnr-opt-allow-unconstrained": !!flow.allow_unconstrained,
      "pnr-opt-timing-allow-fail": !!flow.timing_allow_fail,
      "pnr-opt-report": flow.report !== false,
      "pnr-opt-svg": !!flow.svg,
      "pnr-opt-sdf": !!flow.sdf,
      "pnr-opt-detailed-timing": !!flow.detailed_timing,
      "pnr-opt-werror": !!flow.werror,
      "pnr-opt-no-tmdriv": !!flow.no_tmdriv,
      "pnr-opt-ignore-timing": !!flow.ignore_timing,
      "pnr-opt-no-serdes": !!flow.no_serdes,
      "pnr-opt-dont-use-ram": !!flow.dont_use_ram,
      "pnr-opt-no-dsp": !!flow.no_dsp,
    };
    for (const [id, checked] of Object.entries(values)) {
      const el = document.getElementById(id);
      if (el) el.checked = checked;
    }
    const seed = document.getElementById("pnr-seed");
    const freq = document.getElementById("pnr-frequency");
    const threads = document.getElementById("pnr-threads");
    const placer = document.getElementById("pnr-placer");
    const router = document.getElementById("pnr-router");
    const stage = document.getElementById("pnr-stage");
    if (seed) seed.value = flow.seed || 1;
    if (freq) freq.value = flow.frequency || 12;
    if (threads) threads.value = flow.threads || 1;
    if (placer) placer.value = flow.placer || "";
    if (router) router.value = flow.router || "";
    if (stage) stage.value = flow.stage || "";
    const hooks = {
      "pnr-hook-pre-pack": flow.pre_pack || "",
      "pnr-hook-pre-place": flow.pre_place || "",
      "pnr-hook-pre-route": flow.pre_route || "",
      "pnr-hook-post-route": flow.post_route || "",
      "pnr-lpf-file": flow.lpf || "",
      "pnr-cst-file": flow.cst || "",
      "pnr-speed-grade": flow.speed_grade || "",
    };
    for (const [id, value] of Object.entries(hooks)) {
      const el = document.getElementById(id);
      if (el) el.value = value;
    }
  },
};
