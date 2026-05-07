"use strict";

const OptionHelp = {
  data: {
    "synth-opt-abc9": ["ABC9 映射", "CLI: synth_* -abc9", "适用：iCE40 / ECP5", "通常能改善 LUT 映射质量，但不同设计结果可能波动。"],
    "synth-opt-multishare": ["共享优化", "CLI: share -aggressive", "适用：通用综合", "会尝试共享乘法/加法资源，面积可能下降，时序可能变差。"],
    "synth-opt-fsm": ["FSM 提取", "CLI: fsm", "适用：通用综合", "识别状态机并重新编码，适合常规控制逻辑。"],
    "synth-opt-splitnets": ["总线拆分", "CLI: splitnets", "适用：调试/可视化", "便于观察信号，但可能让网表更碎。"],
    "synth-opt-nobram": ["禁用 BRAM", "CLI: -nobram", "适用：iCE40 / ECP5", "强制使用逻辑资源实现存储器，通常只用于调试或资源权衡。"],
    "synth-opt-no-serdes": ["禁用 SERDES", "CLI: -no-serdes", "适用：ECP5", "避免映射高速串并转换资源。"],
    "synth-opt-dont-use-ram": ["避免专用 RAM", "CLI: Gowin RAM 相关开关", "适用：Gowin", "可绕开特定 RAM 映射问题，但会增加逻辑资源占用。"],
    "pnr-opt-ignore-timing": ["忽略时序", "CLI: --ignore-timing / --timing-allow-fail", "适用：按后端支持", "可能生成不可稳定运行的设计，建议只在 bring-up 时临时使用。"],
    "pnr-opt-report": ["JSON 报告", "CLI: --report", "适用：nextpnr", "报告中心会读取它提炼资源、器件和布局布线摘要。"],
    "pnr-opt-svg": ["布局/布线 SVG", "CLI: --placed-svg / --routed-svg", "适用：nextpnr 支持时", "用于报告中心图形预览，生成会稍增加运行时间。"],
    "pnr-opt-no-serdes": ["禁用 SERDES", "CLI: --no-serdes", "适用：ECP5", "避免使用 SERDES 资源，适合没有高速 IO 的学习设计。"],
    "pnr-opt-no-dsp": ["禁用 DSP", "CLI: --no-dsp / dont_use_dsp", "适用：ECP5 / Gowin", "会把乘法等逻辑放到 LUT，面积和时序可能变差。"],
    "prog-opt-skip-detect": ["跳过预检测", "CLI: 直接执行烧录命令", "适用：DFU/重枚举设备", "当设备烧录瞬间断连、预检测误判时可用。"],
    "prog-opt-dfu-alt": ["DFU alt 0", "CLI: dfu-util -a 0", "适用：DFU Bootloader", "多数简单 DFU 目标使用 alt 0；不匹配时可关闭。"],
    "prog-opt-flash": ["写入 Flash", "CLI: openFPGALoader --write-flash", "适用：支持外部 Flash 的板卡", "写入非易失存储，速度较慢但断电保留。"],
    "prog-opt-board": ["Board 覆盖", "CLI: openFPGALoader -b", "适用：openFPGALoader", "当板卡包名称和工具内置 board 名不一致时使用。"],
  },

  init() {
    document.addEventListener("focusin", (event) => this._show(event.target));
    document.addEventListener("click", (event) => this._show(event.target));
  },

  _show(target) {
    const input = target?.closest?.("input, select");
    if (!input || !this.data[input.id]) return;
    const panel = input.closest(".option-workspace")?.querySelector(".option-help-panel");
    if (!panel) return;
    const [title, cli, family, risk] = this.data[input.id];
    panel.innerHTML = `<span>参数说明</span><strong>${ToolStepUI.escape(title)}</strong><p>${ToolStepUI.escape(cli)}</p><p>${ToolStepUI.escape(family)}</p><p>${ToolStepUI.escape(risk)}</p>`;
  },
};
