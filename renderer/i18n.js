"use strict";

const I18n = {
  lang: "zh-CN",
  _textOriginals: new WeakMap(),
  _attrOriginals: new WeakMap(),
  dict: {
    "工程": "Project",
    "新建工程": "New Project",
    "打开工程": "Open Project",
    "保存工程": "Save Project",
    "打开工程目录": "Open Project Folder",
    "工程管理页": "Project Page",
    "视图": "View",
    "浅色主题": "Light Theme",
    "深色主题": "Dark Theme",
    "紧凑模式": "Compact Mode",
    "底部日志": "Bottom Log",
    "报告中心": "Report Center",
    "工作台": "Workbench",
    "一键构建": "Build All",
    "生成比特流": "Bitstream",
    "烧录": "Program",
    "验证与调试": "Verify & Debug",
    "未打开工程": "No Project",
    "未选择板卡": "No Board",
    "Vflux 工作流": "Vflux Flow",
    "总览": "Overview",
    "准备": "Prepare",
    "例程": "Examples",
    "板卡": "Boards",
    "工具链": "Toolchain",
    "构建": "Build",
    "检查": "Check",
    "综合": "Synthesis",
    "布局布线": "Place & Route",
    "分析": "Analysis",
    "时序分析": "Timing",
    "资源统计": "Resources",
    "报告": "Report",
    "仿真": "Simulation",
    "形式验证": "Formal",
    "波形查看": "Waveform",
    "突变覆盖": "Mutation Coverage",
    "工程总览": "Project Overview",
    "工程配置": "Project Settings",
    "工程名称": "Project Name",
    "顶层模块": "Top Module",
    "工程目录": "Project Directory",
    "浏览...": "Browse...",
    "语言标准": "Language",
    "自动检测源文件": "Auto Detect Sources",
    "导入现有工程": "Import Existing Project",
    "源文件": "Source Files",
    "添加文件": "Add File",
    "约束文件 (PCF)": "Constraint File (PCF)",
    "自动生成": "Generate",
    "应用配置": "Apply",
    "保存工程文件": "Save Project File",
    "例程工作台": "Examples",
    "例程状态": "Example Status",
    "等待选择例程": "Waiting for Example",
    "快速验收": "Quick Acceptance",
    "选择一个内置例程，一键复制成工程": "Choose a built-in example and copy it into a project",
    "选择目录": "Choose Folder",
    "选择板卡": "Select Board",
    "板卡向导": "Board Guide",
    "先选芯片族，再选开发板": "Select FPGA family first, then board",
    "全部板卡": "All Boards",
    "厂商": "Vendor",
    "FPGA 系列": "FPGA Family",
    "FPGA 型号": "FPGA Device",
    "封装": "Package",
    "时钟": "Clock",
    "按键": "Buttons",
    "说明": "Description",
    "导出板卡包草稿": "Export Board Draft",
    "图形化创建自定义板卡包": "Create Custom Board Package",
    "板卡名称": "Board Name",
    "芯片族": "FPGA Family",
    "器件": "Device",
    "时钟名": "Clock Name",
    "时钟引脚": "Clock Pin",
    "时钟频率": "Clock Frequency",
    "LED 资源": "LED Resources",
    "按键资源": "Button Resources",
    "烧录工具": "Programmer",
    "保存并选择自定义板卡": "Save and Select Custom Board",
    "工具链配置": "Toolchain",
    "环境验收": "Environment Check",
    "等待运行环境验收": "Waiting for Environment Check",
    "OSS CAD Suite 路径": "OSS CAD Suite Path",
    "运行环境验收": "Run Environment Check",
    "尚未检测": "Not Checked",
    "代码检查": "Code Check",
    "检查状态": "Check Status",
    "可以开始检查": "Ready to Check",
    "开始检查": "Start Check",
    "停止": "Stop",
    "重置反馈": "Reset Feedback",
    "综合工作台": "Synthesis",
    "综合状态": "Synthesis Status",
    "等待综合": "Waiting for Synthesis",
    "目标架构": "Target Architecture",
    "输出网表": "Output Netlist",
    "综合高级选项": "Advanced Synthesis Options",
    "优化流程": "Optimization Flow",
    "逻辑压缩与时序": "Logic Compression & Timing",
    "器件资源映射": "Device Resource Mapping",
    "开始综合": "Start Synthesis",
    "布局布线工作台": "Place & Route",
    "布局布线状态": "P&R Status",
    "等待布局布线": "Waiting for P&R",
    "目标器件": "Target Device",
    "布局结果": "P&R Output",
    "布局布线高级选项": "Advanced P&R Options",
    "时序与约束": "Timing & Constraints",
    "产物与报告": "Artifacts & Reports",
    "专家参数": "Expert Options",
    "开始布局布线": "Start P&R",
    "比特流工作台": "Bitstream",
    "比特流状态": "Bitstream Status",
    "等待生成比特流": "Waiting for Bitstream",
    "比特流高级选项": "Advanced Bitstream Options",
    "开始生成比特流": "Generate Bitstream",
    "烧录工作台": "Programming",
    "烧录状态": "Program Status",
    "等待连接开发板": "Waiting for Board",
    "烧录方式": "Programming Method",
    "设备状态": "Device Status",
    "比特流文件": "Bitstream File",
    "烧录高级选项": "Advanced Programming Options",
    "烧录诊断向导": "Programming Diagnostics",
    "检测设备": "Detect Device",
    "开始烧录": "Start Programming",
    "仿真工作台": "Simulation",
    "仿真状态": "Simulation Status",
    "等待运行仿真": "Waiting for Simulation",
    "仿真引擎": "Simulation Engine",
    "仿真高级选项": "Advanced Simulation Options",
    "运行仿真": "Run Simulation",
    "打开波形": "Open Waveform",
    "形式验证工作台": "Formal Verification",
    "验证状态": "Verification Status",
    "等待运行验证": "Waiting for Verification",
    "运行验证": "Run Verification",
    "波形状态": "Waveform Status",
    "等待选择波形": "Waiting for Waveform",
    "波形文件": "Waveform File",
    "打开 Surfer": "Open Surfer",
    "报告中心": "Report Center",
    "构建报告": "Build Report",
    "等待刷新报告": "Waiting for Report Refresh",
    "验收结论": "Acceptance",
    "资源与器件": "Resources & Device",
    "时序与产物": "Timing & Artifacts",
    "引脚与约束": "Pins & Constraints",
    "构建产物": "Build Artifacts",
    "图形预览": "Visual Preview",
    "构建时间线": "Build Timeline",
    "刷新报告": "Refresh Report",
    "导出 HTML 报告": "Export HTML Report",
    "构建状态": "Build Status",
    "等待一键构建": "Waiting for Build",
    "全局日志": "Global Log",
    "就绪": "Ready",
    "等待开始": "Waiting",
    "新建 FPGA 工程": "New FPGA Project",
    "工程位置": "Project Location",
    "完整路径：": "Full Path:",
    "目标板卡": "Target Board",
    "稍后选择": "Select Later",
    "自动生成顶层模板文件": "Generate top template",
    "根据板卡自动生成约束文件": "Generate constraints from board",
    "创建后自动用 VS Code 打开": "Open with VS Code after creation",
    "取消": "Cancel",
    "创建工程": "Create Project",
    "选择工程目录...": "Select project directory...",
    "搜索板卡、厂商、FPGA 型号...": "Search board, vendor, FPGA device...",
    "选择例程复制到的父目录...": "Choose parent folder for example copy...",
    "选择源文件": "Choose source files",
    "开发板盘符目录，例如 E:\\": "Board drive folder, for example E:\\",
  },

  init() {
    this.lang = localStorage.getItem("vflux.language") || "";
    this._bindButtons();
    if (!this.lang) this._showLanguageModal();
    else this.apply();
  },

  setLanguage(lang) {
    this.lang = lang === "en" ? "en" : "zh-CN";
    localStorage.setItem("vflux.language", this.lang);
    document.documentElement.lang = this.lang;
    this.apply();
    this._updateMenuLabel();
  },

  apply(root = document) {
    if (!this.lang) return;
    document.documentElement.lang = this.lang;
    this._translateTextNodes(root);
    this._translateAttributes(root);
    this._updateMenuLabel();
  },

  _bindButtons() {
    document.getElementById("btn-toggle-language")?.addEventListener("click", () => {
      this.setLanguage(this.lang === "en" ? "zh-CN" : "en");
    });
    document.getElementById("btn-lang-zh")?.addEventListener("click", () => this._choose("zh-CN"));
    document.getElementById("btn-lang-en")?.addEventListener("click", () => this._choose("en"));
  },

  _choose(lang) {
    this.setLanguage(lang);
    const modal = document.getElementById("language-modal");
    if (modal) modal.style.display = "none";
  },

  _showLanguageModal() {
    const modal = document.getElementById("language-modal");
    if (modal) modal.style.display = "flex";
  },

  _updateMenuLabel() {
    const button = document.getElementById("btn-toggle-language");
    if (button) button.textContent = this.lang === "en" ? "中文界面" : "English UI";
  },

  _translateTextNodes(root) {
    const walker = document.createTreeWalker(root.body || root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (!this._textOriginals.has(node)) this._textOriginals.set(node, node.nodeValue);
      const original = this._textOriginals.get(node);
      node.nodeValue = this._translatePreserveWhitespace(original);
    }
  },

  _translateAttributes(root) {
    const elements = (root.body || root).querySelectorAll?.("[placeholder], [title]") || [];
    for (const el of elements) {
      for (const attr of ["placeholder", "title"]) {
        if (!el.hasAttribute(attr)) continue;
        const key = `${attr}`;
        let store = this._attrOriginals.get(el);
        if (!store) {
          store = {};
          this._attrOriginals.set(el, store);
        }
        if (!store[key]) store[key] = el.getAttribute(attr);
        el.setAttribute(attr, this._translate(store[key]));
      }
    }
  },

  _translatePreserveWhitespace(value) {
    const leading = value.match(/^\s*/)?.[0] || "";
    const trailing = value.match(/\s*$/)?.[0] || "";
    return leading + this._translate(value.trim()) + trailing;
  },

  _translate(value) {
    if (this.lang !== "en") return value;
    return this.dict[value] || value;
  },
};

window.I18n = I18n;
