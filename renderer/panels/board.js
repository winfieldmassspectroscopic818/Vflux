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
    const name = this._value("custom-board-name") || "Custom FPGA Board";
    const family = this._value("custom-board-family") || "ice40";
    const device = this._value("custom-board-device") || (family === "ecp5" ? "25k" : family === "gowin" ? "GW1NR-9" : "up5k");
    const pkg = this._value("custom-board-package") || (family === "ecp5" ? "CABGA381" : family === "gowin" ? "QFN88" : "sg48");
    const program = this._value("custom-board-program") || "openFPGALoader";
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
