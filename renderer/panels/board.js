/**
 * Vflux Panel: 板卡选择
 */
"use strict";

const PanelBoard = {
  _allBoards: [],
  _selectedFilename: "",
  _familyFilter: "all",
  _searchText: "",

  init() {
    document.getElementById("board-grid").addEventListener("click", (event) => {
      const card = event.target.closest(".board-card");
      if (card) this._select(card.dataset.filename);
    });
    document.getElementById("board-family-tabs").addEventListener("click", (event) => {
      const tab = event.target.closest("[data-family]");
      if (!tab) return;
      this._familyFilter = tab.dataset.family;
      this._renderFilters();
      this._renderGrid();
    });
    document.getElementById("board-search").addEventListener("input", (event) => {
      this._searchText = event.target.value.trim().toLowerCase();
      this._renderGrid();
    });
    document.getElementById("btn-export-board-draft").addEventListener("click", () => this._exportBoardDraft());
    document.getElementById("btn-save-custom-board").addEventListener("click", () => this._saveCustomBoard());
    this._ensureCustomValidationPanel();
    document.querySelectorAll(".custom-board-editor input, .custom-board-editor select").forEach((el) => {
      el.addEventListener("input", () => this._renderCustomValidation());
      el.addEventListener("change", () => this._renderCustomValidation());
    });
  },

  async refresh() {
    const projectDir = Config.getProjectDir();
    this._allBoards = await window.vflux.boardList(projectDir && projectDir !== "." ? projectDir : "");
    this._renderFilters();
    this._renderGrid();
    if (Config.data.board.filename) {
      this._selectedFilename = Config.data.board.filename;
      this._showDetail(Config.data.board.filename);
    }
  },

  _renderFilters() {
    const families = ["all", ...new Set(this._allBoards.map((board) => board.fpga?.family).filter(Boolean))];
    document.getElementById("board-family-tabs").innerHTML = families.map((family) => {
      const count = family === "all" ? this._allBoards.length : this._allBoards.filter((board) => board.fpga?.family === family).length;
      const active = family === this._familyFilter ? " active" : "";
      return `<button class="board-family-tab${active}" data-family="${ToolStepUI.escape(family)}">${ToolStepUI.escape(this._familyLabel(family))} <span>${count}</span></button>`;
    }).join("");
  },

  _renderGrid() {
    const grid = document.getElementById("board-grid");
    const boards = this._filteredBoards();
    document.getElementById("board-section-title").textContent = this._sectionTitle(boards.length);
    if (!boards.length) {
      grid.innerHTML = `<div class="file-empty">没有匹配的板卡，请调整芯片族或搜索关键词</div>`;
      return;
    }
    grid.innerHTML = boards.map((board) => {
      const filename = board._filename || "";
      const selected = filename === this._selectedFilename ? " selected" : "";
      return `<div class="board-card${selected}" data-filename="${ToolStepUI.escape(filename)}">
        <div class="board-card-name">${ToolStepUI.escape(board.board?.name || filename)}</div>
        <div class="board-card-vendor">${ToolStepUI.escape(board.board?.vendor || "-")} · ${ToolStepUI.escape(this._familyLabel(board.fpga?.family))}</div>
        <div class="board-card-fpga">${ToolStepUI.escape(board.fpga?.family || "-")} / ${ToolStepUI.escape(board.fpga?.device || "-")} / ${ToolStepUI.escape(board.fpga?.package || "-")}</div>
        <div class="board-card-desc">${ToolStepUI.escape(board.board?.description || "")}</div>
      </div>`;
    }).join("");
  },

  _filteredBoards() {
    return this._allBoards.filter((board) => {
      const familyOk = this._familyFilter === "all" || board.fpga?.family === this._familyFilter;
      const haystack = [
        board.board?.name,
        board.board?.vendor,
        board.board?.description,
        board.fpga?.family,
        board.fpga?.device,
        board.fpga?.package,
      ].join(" ").toLowerCase();
      return familyOk && (!this._searchText || haystack.includes(this._searchText));
    });
  },

  async _select(filename) {
    if (!filename) return;
    this._selectedFilename = filename;
    this._renderGrid();
    this._showDetail(filename);

    const boardData = await window.vflux.boardLoad(filename, Config.getProjectDir());
    Config.setBoard(boardData);
    Pipeline.set("board", "success");
    App.setStatus("已选择板卡: " + (boardData.board?.name || filename));
    App.globalLog("板卡已选择: " + (boardData.board?.name || filename));

    App.refreshPanels("toolchain", "synthesis", "pnr", "pack", "program");
    Pipeline.resetFrom("toolchain");

    document.getElementById("board-name").textContent = boardData.board?.name || filename;
  },

  _showDetail(filename) {
    const board = this._allBoards.find((item) => item._filename === filename);
    if (!board) return;

    const detail = document.getElementById("board-detail");
    detail.style.display = "block";
    document.getElementById("detail-board-name").textContent = board.board?.name || "";
    document.getElementById("detail-vendor").textContent = board.board?.vendor || "-";
    document.getElementById("detail-family").textContent = board.fpga?.family || "-";
    document.getElementById("detail-device").textContent = board.fpga?.device || "-";
    document.getElementById("detail-package").textContent = board.fpga?.package || "-";

    const pinText = (pin) => pin ? `P${pin}` : "按约束文件";
    const clocks = (board.resources?.clock || []).map((clock) => `${clock.name}(${pinText(clock.pin)},${clock.frequency})`).join(", ");
    document.getElementById("detail-clocks").textContent = clocks || "-";

    const leds = (board.resources?.leds || []).map((led) => `${led.name}(${pinText(led.pin)})`).join(", ");
    document.getElementById("detail-leds").textContent = leds || "-";

    const buttons = (board.resources?.buttons || []).map((button) => `${button.name}(${pinText(button.pin)})`).join(", ");
    document.getElementById("detail-btns").textContent = buttons || "-";

    const uart = board.resources?.uart;
    document.getElementById("detail-uart").textContent = uart ? `TX:P${uart.tx} RX:P${uart.rx}` : "-";
    document.getElementById("detail-description").textContent = board.board?.description || "-";
  },

  _sectionTitle(count) {
    const family = this._familyFilter === "all" ? "全部芯片族" : this._familyLabel(this._familyFilter);
    return `${family} · ${count} 块板卡`;
  },

  _familyLabel(family) {
    const labels = { all: "全部", ice40: "Lattice iCE40", ecp5: "Lattice ECP5", gowin: "Gowin" };
    return labels[family] || family || "-";
  },

  async _exportBoardDraft() {
    const board = this._allBoards.find((item) => item._filename === this._selectedFilename);
    const dir = Config.getProjectDir();
    if (!board || !dir || dir === ".") {
      App.setStatus("请先选择板卡并打开工程，再导出板卡包草稿");
      return;
    }
    const slug = (board.board?.name || "custom-board").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const target = ToolStepUI.projectPath(`boards/${slug || "custom-board"}.yaml`);
    const yaml = [
      "# Vflux board package draft",
      "# 可以在这里补充 LED、按键、时钟和烧录参数，然后提交到 boards 目录。",
      "board:",
      `  name: "${board.board?.name || "Custom Board"}"`,
      `  vendor: "${board.board?.vendor || "Custom"}"`,
      `  description: "${board.board?.description || "User board package draft"}"`,
      "fpga:",
      `  family: "${board.fpga?.family || ""}"`,
      `  device: "${board.fpga?.device || ""}"`,
      `  package: "${board.fpga?.package || ""}"`,
      `  speed: "${board.fpga?.speed || ""}"`,
      "toolchain:",
      `  pnr: "${board.toolchain?.pnr || ""}"`,
      `  pack: "${board.toolchain?.pack || ""}"`,
      `  program: "${board.toolchain?.program || ""}"`,
      "resources:",
      "  clock: []",
      "  leds: []",
      "  buttons: []",
      "programming:",
      `  method: "${board.programming?.method || ""}"`,
      "",
    ].join("\n");
    // 先导出到工程目录，避免直接修改软件内置 boards 包。
    await window.vflux.writeText(target, yaml);
    App.setStatus("板卡包草稿已导出：" + target);
    App.globalLog("板卡包草稿已导出：" + target);
  },

  async _saveCustomBoard() {
    const dir = Config.getProjectDir();
    if (!dir || dir === ".") {
      App.setStatus("请先打开或创建工程，再保存自定义板卡包");
      return;
    }
    const name = this._value("custom-board-name");
    const family = this._value("custom-board-family") || "ice40";
    const device = this._value("custom-board-device");
    const pkg = this._value("custom-board-package");
    const program = this._value("custom-board-program") || "openFPGALoader";
    const validation = this._validateCustomBoard({ name, family, device, pkg, program });
    this._renderCustomValidation(validation);
    if (validation.errors.length) {
      App.setStatus("自定义板卡包还有必填或格式问题，请先修正红色提示");
      return;
    }
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "custom-board";
    const relative = `boards/${slug}.yaml`;
    const target = ToolStepUI.projectPath(relative);
    const boardData = {
      _filename: `project:${relative}`,
      board: {
        name,
        vendor: this._value("custom-board-vendor") || "Custom",
        description: "User-defined board package created in Vflux",
        url: "",
      },
      fpga: {
        family,
        device,
        package: pkg,
        speed: this._value("custom-board-speed"),
      },
      resources: {
        clock: this._clockList(),
        leds: this._pinList("custom-board-leds"),
        buttons: this._pinList("custom-board-buttons"),
      },
      constraints: { [family === "ecp5" ? "lpf_file" : family === "gowin" ? "cst_file" : "pcf_file"]: "" },
      toolchain: {
        synth: { tool: "yosys", arch: family, synth_options: ["-top", "${top_module}"], extra_options: [] },
        place_and_route: { tool: family === "gowin" ? "nextpnr-himbaechel" : `nextpnr-${family}`, arch_options: [], extra_options: [] },
        pack: { tool: family === "ecp5" ? "ecppack" : family === "gowin" ? "gowin_pack" : "icepack" },
        program: { tool: program, interface: program === "icesprog" || program === "ecpprog" ? "ftdi" : "usb", extra_options: [] },
      },
    };
    const yaml = this._boardYaml(boardData);
    await window.vflux.writeText(target, yaml);
    Config.setBoard(boardData);
    Pipeline.set("board", "success");
    document.getElementById("board-name").textContent = name;
    App.setStatus("自定义板卡包已保存并选择：" + target);
    App.globalLog("自定义板卡包已保存：" + target);
    await this.refresh();
    this._selectedFilename = boardData._filename;
    this._showDetail(boardData._filename);
    App.refreshPanels("toolchain", "synthesis", "pnr", "pack", "program");
  },

  _value(id) {
    return document.getElementById(id)?.value.trim() || "";
  },

  _clockList() {
    const name = this._value("custom-board-clock-name");
    const pin = this._value("custom-board-clock-pin");
    const frequency = this._value("custom-board-clock-freq");
    return name || pin || frequency ? [{ name: name || "clk", pin, frequency }] : [];
  },

  _pinList(id) {
    return this._value(id).split(",").map((entry) => entry.trim()).filter(Boolean).map((entry, index) => {
      const [name, pin] = entry.split(":").map((part) => part.trim());
      return { name: name || `io${index}`, pin: pin || "" };
    });
  },

  _ensureCustomValidationPanel() {
    const editor = document.querySelector(".custom-board-editor");
    if (!editor || document.getElementById("custom-board-validation-list")) return;
    const panel = document.createElement("div");
    panel.className = "custom-board-validation";
    panel.innerHTML = [
      '<div class="result-card ready compact-card" id="custom-board-validation-card">',
      '<div><span class="result-kicker">板卡包体检</span><h3 id="custom-board-validation-summary">填写后自动检查</h3></div><span class="result-dot"></span>',
      "</div>",
      '<ul class="feedback-list" id="custom-board-validation-list"></ul>',
    ].join("");
    editor.appendChild(panel);
  },

  _renderCustomValidation(precomputed = null) {
    this._ensureCustomValidationPanel();
    const validation = precomputed || this._validateCustomBoard();
    const kind = validation.errors.length ? "failed" : validation.warnings.length ? "ready" : "success";
    const summary = validation.errors.length
      ? `${validation.errors.length} 项需要修正`
      : validation.warnings.length
        ? `${validation.warnings.length} 项建议补充`
        : "板卡包可以保存";
    const card = document.getElementById("custom-board-validation-card");
    const title = document.getElementById("custom-board-validation-summary");
    const list = document.getElementById("custom-board-validation-list");
    if (card) card.className = `result-card ${kind} compact-card`;
    if (title) title.textContent = summary;
    if (list) {
      const items = [
        ...validation.errors.map((text) => ({ state: "failed", text })),
        ...validation.warnings.map((text) => ({ state: "pending", text })),
        ...validation.ok.map((text) => ({ state: "success", text })),
      ];
      list.innerHTML = items.map((item) => `<li class="${item.state}"><span></span>${ToolStepUI.escape(item.text)}</li>`).join("");
    }
  },

  _validateCustomBoard(seed = {}) {
    const name = seed.name ?? this._value("custom-board-name");
    const family = seed.family ?? (this._value("custom-board-family") || "ice40");
    const device = seed.device ?? this._value("custom-board-device");
    const pkg = seed.pkg ?? this._value("custom-board-package");
    const program = seed.program ?? this._value("custom-board-program");
    const clock = this._clockList();
    const leds = this._pinList("custom-board-leds");
    const buttons = this._pinList("custom-board-buttons");
    const resources = [...clock, ...leds, ...buttons];
    const errors = [];
    const warnings = [];
    const ok = [];

    // 保存前先做板卡包体检，避免用户到综合或烧录阶段才发现基础字段填错。
    if (!name.trim()) errors.push("板卡名称不能为空，用于工程配置和板卡包文件名。");
    if (!["ice40", "ecp5", "gowin"].includes(family)) errors.push("芯片族必须是 ice40、ecp5 或 gowin。");
    if (!device.trim()) errors.push("器件型号不能为空，例如 up5k、hx8k、25k、45k、GW1NR-9。");
    if (!pkg.trim()) errors.push("封装不能为空，例如 sg48、ct256、CABGA381、QFN88。");

    const familyRules = {
      ice40: {
        device: /^(up5k|hx[148]k|lp[138]k)$/i,
        package: /^(sg48|cm81|cm121|cb132|vq100|tq144|ct256)$/i,
        programs: ["openFPGALoader", "icesprog", "dfu-util"],
      },
      ecp5: {
        device: /^(12k|25k|45k|85k|um-25k|um5g-25k|um5g-45k|um5g-85k)$/i,
        package: /^(CABGA256|CABGA381|CABGA554|CSFBGA285|BG256|BG381)$/i,
        programs: ["openFPGALoader", "ecpprog"],
      },
      gowin: {
        device: /^GW[0-9A-Z-]+$/i,
        package: /^(QFN|QN|LQFP|BGA|PBGA|CABGA|UBGA|CS|MG)[A-Z0-9-]*$/i,
        programs: ["openFPGALoader", "dfu-util"],
      },
    };
    const rule = familyRules[family];
    if (rule) {
      if (device && !rule.device.test(device)) warnings.push(`${family} 器件型号看起来不常见，请确认 nextpnr 是否支持：${device}`);
      if (pkg && !rule.package.test(pkg)) warnings.push(`${family} 封装看起来不常见，请确认板卡资料和 nextpnr 参数：${pkg}`);
      if (program && !rule.programs.includes(program)) warnings.push(`${program} 不是 ${family} 常见烧录工具，后续可能需要手动覆盖烧录参数。`);
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const builtinConflict = this._allBoards.some((board) => board._source === "builtin" && board._filename === `${slug}.yaml`);
    if (builtinConflict) warnings.push("该名称会生成与内置板卡同名的文件，建议换一个更具体的名称。");

    const badPins = resources.filter((item) => item.pin && !this._looksLikePin(item.pin));
    if (badPins.length) warnings.push(`有 ${badPins.length} 个引脚格式不常见，请确认是否和约束文件格式一致。`);
    const pinMap = new Map();
    for (const item of resources) {
      if (!item.pin) continue;
      const key = String(item.pin).toUpperCase();
      pinMap.set(key, [...(pinMap.get(key) || []), item.name]);
    }
    const duplicates = [...pinMap.entries()].filter(([, names]) => names.length > 1);
    if (duplicates.length) errors.push(`发现重复引脚：${duplicates.map(([pin, names]) => `${pin}(${names.join("/")})`).join(", ")}`);

    if (!clock.length) warnings.push("建议至少填写一个时钟资源，便于新工程自动生成约束和 SDC 草稿。");
    else {
      const invalidFreq = clock.filter((item) => item.frequency && !/^\d+(\.\d+)?\s*(hz|khz|mhz|ghz)$/i.test(item.frequency));
      if (invalidFreq.length) warnings.push("时钟频率建议写成 12MHz、25 MHz、100MHz 这类形式。");
    }
    if (!leds.length && !buttons.length) warnings.push("建议至少填写 LED 或按键资源，方便例程和约束生成。");

    if (!errors.length) ok.push("必填字段完整，板卡包可写入当前工程的 boards 目录。");
    if (clock.length) ok.push(`已识别 ${clock.length} 个时钟资源。`);
    if (leds.length || buttons.length) ok.push(`已识别 ${leds.length} 个 LED、${buttons.length} 个按键资源。`);
    return { errors, warnings, ok };
  },

  _looksLikePin(pin) {
    const text = String(pin || "").trim();
    return /^[A-Za-z]?[0-9]+$/.test(text) || /^[A-Z]{1,3}[0-9]{1,3}$/i.test(text) || /^[A-Z][0-9]+_[A-Z0-9]+$/i.test(text);
  },

  _boardYaml(data) {
    const quote = (value) => `"${String(value || "").replace(/"/g, '\\"')}"`;
    const pinSection = (key, items) => items.length ? `  ${key}:\n${items.map((item) => `    - name: ${quote(item.name)}\n      pin: ${quote(item.pin)}${item.frequency ? `\n      frequency: ${quote(item.frequency)}` : ""}`).join("\n")}` : `  ${key}: []`;
    const constraintKey = data.fpga.family === "ecp5" ? "lpf_file" : data.fpga.family === "gowin" ? "cst_file" : "pcf_file";
    return [
      "# Vflux user-defined board package",
      "board:",
      `  name: ${quote(data.board.name)}`,
      `  vendor: ${quote(data.board.vendor)}`,
      `  description: ${quote(data.board.description)}`,
      `  url: ${quote(data.board.url)}`,
      "fpga:",
      `  family: ${quote(data.fpga.family)}`,
      `  device: ${quote(data.fpga.device)}`,
      `  package: ${quote(data.fpga.package)}`,
      `  speed: ${quote(data.fpga.speed)}`,
      "resources:",
      pinSection("clock", data.resources.clock),
      pinSection("leds", data.resources.leds),
      pinSection("buttons", data.resources.buttons),
      "constraints:",
      `  ${constraintKey}: ""`,
      "toolchain:",
      "  synth:",
      "    tool: \"yosys\"",
      `    arch: ${quote(data.fpga.family)}`,
      "    synth_options: [\"-top\", \"${top_module}\"]",
      "    extra_options: []",
      "  place_and_route:",
      `    tool: ${quote(data.toolchain.place_and_route.tool)}`,
      "    arch_options: []",
      "    extra_options: []",
      "  pack:",
      `    tool: ${quote(data.toolchain.pack.tool)}`,
      "  program:",
      `    tool: ${quote(data.toolchain.program.tool)}`,
      `    interface: ${quote(data.toolchain.program.interface)}`,
      "    extra_options: []",
      "",
    ].join("\n");
  },
};
