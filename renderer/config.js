/**
 * Vflux 工程配置读写模块
 * 负责 project.vflux.yaml 的加载、保存与状态管理
 */
"use strict";

const Config = {
  SCHEMA_VERSION: 1,

  /** 当前工程配置数据 */
  data: {
    schema_version: 1,
    app_version: "1.0.0-preview",
    project: {
      name: "",
      directory: "",
      top_module: "top",
      language: "verilog",
      sources: [],
      constraints: [],
      program_target_dir: "",
    },
    board: {
      filename: "",
      name: "",
      fpga_family: "",
      fpga_device: "",
      fpga_package: "",
      fpga_speed: "",
      program_tool: "",
      program_interface: "",
    },
    toolchain: {
      oss_cad_path: "",
      extra_args: "",
    },
    flow: {
      synthesis: {
        proc: true,
        opt: true,
        fsm: true,
        memory: true,
        splitnets: false,
        abc: true,
        flatten: false,
        dff: false,
        retime: false,
        nobram: false,
        spram: false,
        dsp: false,
        abc2: false,
        abc9: false,
        multishare: false,
        noabc9: false,
        nocarry: false,
        nodffe: false,
        no_rw_check: false,
        no_serdes: false,
        dont_use_ram: false,
      },
      pnr: {
        timing: true,
        ignore_loops: false,
        promote_globals: true,
        allow_unconstrained: false,
        timing_allow_fail: false,
        report: true,
        svg: false,
        sdf: false,
        detailed_timing: false,
        werror: false,
        no_tmdriv: false,
        ignore_timing: false,
        no_serdes: false,
        dont_use_ram: false,
        no_dsp: false,
        lpf: "",
        cst: "",
        speed_grade: "",
        stage: "",
        pre_pack: "",
        pre_place: "",
        pre_route: "",
        post_route: "",
        placer: "",
        router: "",
        threads: 1,
        seed: 1,
        frequency: 12,
      },
      pack: {
        compress: false,
        crc: false,
        verify_crc: false,
        encrypt: false,
        svf: false,
        flash: false,
        background: false,
        freq: "",
        idcode: "",
        key: "",
        verify_unpack: false,
        metadata: true,
        open_folder: false,
        vlog: false,
        html: false,
      },
      program: {
        verify: false,
        flash: false,
        external_flash: false,
        reset: false,
        cable: "",
        board_override: "",
        frequency: "",
        offset: "",
        dfu_alt: true,
        skip_detect: false,
        method: "board",
      },
      simulation: { wave: true, warnings: true, output: "output/simulation/sim.vvp", testbench: "", includes: "", defines: "", timescale: "", trace_fst: false, cflags: "", ldflags: "" },
      formal: { depth: 20, engine: "smtbmc", trace: true },
      mcy: { size: 10, keep: true },
      verilator: { wall: true, trace: false, coverage: false, use_sim_config: true },
      timing: { max: true, report: true, target: 12 },
      floorplan: { html: false, save: true },
    },
  },

  /** 工程文件路径 */
  _filepath: "",

  /** 是否有未保存的修改 */
  _dirty: false,

  /** 创建新工程 */
  create(name, directory, topModule, language) {
    this.data.schema_version = this.SCHEMA_VERSION;
    this.data.app_version = "1.0.0-preview";
    this.data.project.name = name;
    this.data.project.directory = directory;
    this.data.project.top_module = topModule || "top";
    this.data.project.language = language || "verilog";
    this.data.project.sources = [];
    this.data.project.constraints = [];
    this.data.project.program_target_dir = "";
    this.data.board = { filename: "", name: "", fpga_family: "", fpga_device: "", fpga_package: "", fpga_speed: "", program_tool: "", program_interface: "" };
    // OSS CAD Suite 是机器级配置，新工程默认沿用上一次有效路径。
    this.data.toolchain.oss_cad_path = this.getGlobalOssCadPath();
    this.data.flow = this._defaultFlow();
    this._filepath = "";
    this._dirty = true;
  },

  /** 从 YAML 加载工程配置 */
  async load(filepath) {
    const raw = await window.vflux.readYaml(filepath);
    const savedOssPath = this.getGlobalOssCadPath();
    this.data.schema_version = raw.schema_version || this.SCHEMA_VERSION;
    this.data.app_version = raw.app_version || "1.0.0-preview";
    this.data.project = {
      name: raw.project?.name || "",
      directory: raw.project?.directory || "",
      top_module: raw.project?.top_module || "top",
      language: raw.project?.language || "verilog",
      sources: raw.project?.sources || [],
      constraints: raw.project?.constraints || [],
      program_target_dir: raw.project?.program_target_dir || "",
    };
    this.data.board = {
      filename: raw.board?.filename || "",
      name: raw.board?.name || "",
      fpga_family: raw.board?.fpga_family || "",
      fpga_device: raw.board?.fpga_device || "",
      fpga_package: raw.board?.fpga_package || "",
      fpga_speed: raw.board?.fpga_speed || "",
      program_tool: raw.board?.program_tool || "",
      program_interface: raw.board?.program_interface || "",
    };
    this.data.toolchain = {
      oss_cad_path: raw.toolchain?.oss_cad_path || savedOssPath || "",
      extra_args: raw.toolchain?.extra_args || "",
    };
    if (this.data.toolchain.oss_cad_path) this.setGlobalOssCadPath(this.data.toolchain.oss_cad_path);
    this.data.flow = this._mergeFlow(raw.flow || {});
    this._filepath = filepath;
    this._dirty = false;
  },

  /** 保存工程配置到 YAML */
  async save(filepath) {
    const target = filepath || this._filepath;
    if (!target) throw new Error("no filepath specified");
    // 1.0 起工程文件带 schema，后续字段迁移可以有稳定入口。
    this.data.schema_version = this.SCHEMA_VERSION;
    this.data.app_version = "1.0.0-preview";
    await window.vflux.writeYaml(target, this.data);
    this._filepath = target;
    this._dirty = false;
  },

  /** 设置板卡信息 */
  setBoard(boardData) {
    this.data.board = {
      filename: boardData._filename || "",
      name: boardData.board?.name || "",
      fpga_family: boardData.fpga?.family || "",
      fpga_device: boardData.fpga?.device || "",
      fpga_package: boardData.fpga?.package || "",
      fpga_speed: boardData.fpga?.speed || "",
      program_tool: boardData.toolchain?.program?.tool || "",
      program_interface: boardData.toolchain?.program?.interface || "",
    };
    this._dirty = true;
  },

  /** 设置工具链路径 */
  setOssCadPath(p) {
    this.data.toolchain.oss_cad_path = p;
    this.setGlobalOssCadPath(p);
    this._dirty = true;
  },

  getGlobalOssCadPath() {
    try {
      return localStorage.getItem("vflux.ossCadPath") || "";
    } catch (_) {
      return "";
    }
  },

  setGlobalOssCadPath(p) {
    try {
      if (p) localStorage.setItem("vflux.ossCadPath", p);
      else localStorage.removeItem("vflux.ossCadPath");
    } catch (_) {}
  },

  /** 添加源文件 */
  addSource(file) {
    if (!this.data.project.sources.includes(file)) {
      this.data.project.sources.push(file);
      this._dirty = true;
    }
  },

  /** 移除源文件 */
  removeSource(file) {
    const idx = this.data.project.sources.indexOf(file);
    if (idx !== -1) {
      this.data.project.sources.splice(idx, 1);
      this._dirty = true;
    }
  },

  /** 获取工程目录 */
  getProjectDir() {
    return this.data.project.directory || ".";
  },

  /** 获取顶层模块名 */
  getTopModule() {
    return this.data.project.top_module || "top";
  },

  /** 是否为脏状态 */
  isDirty() {
    return this._dirty;
  },

  /** 获取工程文件路径 */
  getFilePath() {
    return this._filepath;
  },

  /** 是否有打开的工程 */
  hasProject() {
    return !!this._filepath || !!this.data.project.name;
  },

  _defaultFlow() {
    return {
      synthesis: { proc: true, opt: true, fsm: true, memory: true, splitnets: false, abc: true, flatten: false, dff: false, retime: false, nobram: false, spram: false, dsp: false, abc2: false, abc9: false, multishare: false, noabc9: false, nocarry: false, nodffe: false, no_rw_check: false, no_serdes: false, dont_use_ram: false },
      pnr: { timing: true, ignore_loops: false, promote_globals: true, allow_unconstrained: false, timing_allow_fail: false, report: true, svg: false, sdf: false, detailed_timing: false, werror: false, no_tmdriv: false, ignore_timing: false, no_serdes: false, dont_use_ram: false, no_dsp: false, lpf: "", cst: "", speed_grade: "", stage: "", pre_pack: "", pre_place: "", pre_route: "", post_route: "", placer: "", router: "", threads: 1, seed: 1, frequency: 12 },
      pack: { compress: false, crc: false, verify_crc: false, encrypt: false, svf: false, flash: false, background: false, freq: "", idcode: "", key: "", verify_unpack: false, metadata: true, open_folder: false, vlog: false, html: false },
      program: { verify: false, flash: false, external_flash: false, reset: false, cable: "", board_override: "", frequency: "", offset: "", dfu_alt: true, skip_detect: false, method: "board" },
      simulation: { wave: true, warnings: true, output: "output/simulation/sim.vvp", testbench: "", includes: "", defines: "", timescale: "", trace_fst: false, cflags: "", ldflags: "" },
      formal: { depth: 20, engine: "smtbmc", trace: true },
      mcy: { size: 10, keep: true },
      verilator: { wall: true, trace: false, coverage: false, use_sim_config: true },
      timing: { max: true, report: true, target: 12 },
      floorplan: { html: false, save: true },
    };
  },

  _mergeFlow(flow) {
    const defaults = this._defaultFlow();
    return {
      synthesis: { ...defaults.synthesis, ...(flow.synthesis || {}) },
      pnr: { ...defaults.pnr, ...(flow.pnr || {}) },
      pack: { ...defaults.pack, ...(flow.pack || {}) },
      program: { ...defaults.program, ...(flow.program || {}) },
      simulation: { ...defaults.simulation, ...(flow.simulation || {}) },
      formal: { ...defaults.formal, ...(flow.formal || {}) },
      mcy: { ...defaults.mcy, ...(flow.mcy || {}) },
      verilator: { ...defaults.verilator, ...(flow.verilator || {}) },
      timing: { ...defaults.timing, ...(flow.timing || {}) },
      floorplan: { ...defaults.floorplan, ...(flow.floorplan || {}) },
    };
  },

  getFlow(stage) {
    if (!this.data.flow) this.data.flow = this._defaultFlow();
    if (!this.data.flow[stage]) this.data.flow[stage] = this._defaultFlow()[stage] || {};
    return this.data.flow[stage];
  },

  setFlowValue(stage, key, value) {
    const flow = this.getFlow(stage);
    flow[key] = value;
    this._dirty = true;
  },
};
