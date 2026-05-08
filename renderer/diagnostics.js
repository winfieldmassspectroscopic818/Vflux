"use strict";

const ToolDiagnostics = {
  analyze(stage, rawLog, context = {}) {
    const log = rawLog || "";
    const rules = [
      {
        test: /syntax error|unexpected token|parse error/i,
        item: { state: "failed", text: "HDL 语法存在问题，请回到代码编辑器检查报错附近的模块声明、分号、括号和 always/assign 写法。" },
      },
      {
        test: /re-definition|already defined|duplicate declaration|conflicting drivers|multiple drivers/i,
        item: { state: "failed", text: "存在重复定义或多重驱动，请检查模块名、信号名、include 文件和同一信号是否被多个 always/assign 同时驱动。" },
      },
      {
        test: /Latch inferred|inferred latch|unintended latch/i,
        item: { state: "pending", text: "工具推断出了锁存器。如果不是有意设计，请检查组合逻辑 always 块是否为所有分支都赋值。" },
      },
      {
        test: /Module .* not found|Can't find module|top module|Cannot find module/i,
        item: { state: "failed", text: `找不到顶层模块或依赖模块，请确认顶层模块 ${context.top || "top"} 已填写正确，并且相关源文件已经加入工程。` },
      },
      {
        test: /include file.*not found|cannot find include|No include path/i,
        item: { state: "failed", text: "头文件或 include 路径缺失，请确认 `.vh/.svh` 文件已加入工程，或在仿真/综合选项里补充 include 目录。" },
      },
      {
        test: /Can't open input file|No such file|cannot open|failed to open/i,
        item: { state: "failed", text: "工具无法读取输入文件，请检查工程目录、源文件、约束文件和上一阶段产物是否存在。" },
      },
      {
        test: /SystemVerilog|sv mode|Unsupported language/i,
        item: { state: "failed", text: "代码可能使用了 SystemVerilog 特性，请在工程页确认语言模式或后续启用 SystemVerilog 读取选项。" },
      },
      {
        test: /constraint|PCF|pin|package|unconstrained/i,
        item: { state: "failed", text: "约束或封装信息可能不匹配，请检查板卡型号、PCF 引脚和未约束 IO。" },
      },
      {
        test: /IO.*already constrained|duplicate.*pin|pin.*already used|multiple.*constraint/i,
        item: { state: "failed", text: "约束文件里可能有重复引脚或同一端口重复约束，请检查 PCF/LPF/CST 中的端口名和物理引脚。" },
      },
      {
        test: /Unknown package|unsupported device|Unknown device|does not exist in database/i,
        item: { state: "failed", text: "目标器件、封装或芯片族不被当前 nextpnr 支持，请检查板卡包里的 device/package/speed 字段和工具链版本。" },
      },
      {
        test: /failed to place|unable to place|no BEL|No available|resource/i,
        item: { state: "failed", text: "布局失败，当前器件资源可能不足，或某些逻辑无法映射到目标 FPGA 资源。" },
      },
      {
        test: /failed to route|routing failed|unrouted/i,
        item: { state: "failed", text: "布线失败，建议降低资源占用、调整约束、改变 seed，或放宽目标频率后重试。" },
      },
      {
        test: /timing fail|timing.*not met|failed timing|negative slack|slack.*-/i,
        item: { state: "failed", text: "时序没有收敛，请降低目标频率、检查关键路径，或启用更偏时序优化的综合/布局策略。" },
      },
      {
        test: /No DFU capable USB device|Cannot open DFU device/i,
        item: { state: "failed", text: "没有找到 DFU 设备。若下载刚开始或刚结束，设备短暂消失可能是重枚举；否则请重新进入 DFU 模式。" },
      },
      {
        test: /LIBUSB_ERROR_ACCESS|Access is denied|Permission denied|insufficient permissions/i,
        item: { state: "failed", text: "USB/JTAG 访问权限不足。Windows 请检查驱动，Linux 需要检查 udev 规则、用户组权限或以合适权限重新插拔设备。" },
      },
      {
        test: /No such file or directory.*(icepack|ecppack|yosys|nextpnr|openFPGALoader)|spawn .* ENOENT/i,
        item: { state: "failed", text: "工具链命令没有找到，请回到工具链页面重新选择 OSS CAD Suite 根目录并运行环境验收。" },
      },
      {
        test: /No cable|not found|unable to open|USB|JTAG|libusb|ftdi/i,
        item: { state: "failed", text: "没有找到烧录器或开发板，请检查 USB 连接、驱动、供电、线缆和烧录方式。" },
      },
      {
        test: /permission|access denied|Operation not permitted/i,
        item: { state: "failed", text: "当前系统权限不足或目标文件被占用，请检查目录权限、驱动权限，或重新插拔设备。" },
      },
      {
        test: /verify|mismatch|CRC/i,
        item: { state: "failed", text: "写入校验不一致，建议重新生成比特流后再次烧录，并确认目标存储类型选择正确。" },
      },
      {
        test: /VCD|dumpfile|Unable to open.*vcd|waveform/i,
        item: { state: "pending", text: "仿真波形没有正确生成或打开，请确认 testbench 中写出了 `$dumpfile` 和 `$dumpvars`，并检查 output/simulation 目录。" },
      },
    ];

    const items = [];
    for (const rule of rules) {
      if (rule.test.test(log)) items.push(rule.item);
    }
    if (stage === "dfu") {
      items.push({ state: "pending", text: "DFU 下载完成后设备短暂消失通常是正常重启，不一定代表烧录失败。" });
    }
    if (items.length) return items;
    return [this._fallback(stage)];
  },

  _fallback(stage) {
    const map = {
      synthesis: "综合没有完成，请检查源文件、顶层模块、语言模式和综合高级选项。",
      pnr: "布局布线没有完成，请检查综合网表、目标器件、约束文件和布局布线高级选项。",
      pack: "比特流没有生成，请检查布局文件、目标板卡、输出目录和打包选项。",
      program: "烧录没有完成，请检查比特流、连接方式、驱动和开发板状态。",
      simulation: "仿真没有完成，请检查 testbench、源文件列表、仿真引擎和波形设置。",
      formal: "形式验证没有完成，请检查 .sby 配置、验证模式、深度和求解器设置。",
      verilator: "Verilator 没有完成，请检查语言特性、include 路径、宏定义和 C++ testbench。",
      mcy: "突变覆盖没有完成，请检查 MCY 配置文件和测试/验证任务设置。",
      surfer: "波形查看器没有完成，请检查波形文件路径和工具链环境。",
    };
    return { state: "failed", text: map[stage] || "工具没有完成，请展开技术详情查看原始日志。" };
  },
};
