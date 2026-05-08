# Vflux 中文指南

[English README](README.md)

Vflux 是一个面向 FPGA 学习与开发的小型图形化工具，配合 [OSS CAD Suite](https://github.com/YosysHQ/oss-cad-suite-build) 使用。它不会重新实现 Yosys、nextpnr、icepack、ecppack、openFPGALoader 等底层工具，而是把原本分散在命令行里的 FPGA 开发流程整理成连续、清晰、可视化的工作台。

当前版本定位为 **Vflux 1.0.0-rc.1**。Windows portable 是当前主要验证目标，Linux AppImage 已预留打包脚本，但仍需要独立机器做实机验收。

English README: [README.en.md](README.en.md)

## 使用前准备

Vflux **不内置 OSS CAD Suite**。使用前请先安装 OSS CAD Suite，并在 Vflux 的“工具链”页面选择安装目录，或让 Vflux 自动搜索。

推荐步骤：

1. 下载 OSS CAD Suite：<https://github.com/YosysHQ/oss-cad-suite-build/releases>
2. 解压到固定目录，例如：

   ```text
   D:\oss-cad-suite
   ```

3. 打开 Vflux。
4. 进入“工具链”页面。
5. 如果自动检测失败，点击“浏览...”选择 OSS CAD Suite 根目录，也就是包含 `environment.bat` 和 `bin` 的目录。
6. 运行环境验收，确认 Yosys、nextpnr、打包工具、烧录工具和仿真工具可用。

## 第一次使用流程

建议第一次使用时按这个顺序：

1. 安装并解压 OSS CAD Suite。
2. 打开 Vflux，完成语言和主题选择。
3. 在“工具链”页面完成 OSS CAD Suite 环境验收。
4. 在“例程”页面创建 `iCESugar LED Blinky` 或 `iCESugar Multi-file Counter`。
5. 运行“一键构建”或在“报告中心”点击“1.0 发布前自动验收”。
6. 在“报告中心”查看发布前检查、产物、时序、资源和 HTML 报告。
7. 对 iCESugar，优先在“烧录”页面选择“拖拽盘符”方式，把生成的 `.bin` 复制到开发板盘符。

## 主要功能

- 创建、打开和保存 Vflux FPGA 工程。
- 选择内置板卡包，或通过 GUI 创建基础自定义板卡包。
- 扫描已有 Verilog/SystemVerilog 工程，导入源文件和约束文件。
- 运行检查、综合、布局布线、生成比特流、时序分析、资源统计和烧录。
- 分阶段保存输出目录：
  - `output/synthesis`
  - `output/pnr`
  - `output/bitstream`
  - `output/reports`
  - `output/simulation`
- 提供综合、布局布线、比特流、烧录等高级参数配置。
- 默认显示图形化反馈，同时保留命令行技术细节。
- 支持仿真、波形查看、形式验证、Verilator、MCY 等扩展工作台。
- 提供工程体检、工具链验收、一键验收、发布前检查和 HTML 报告导出。
- 支持中文/英文界面切换。
- 支持浅色/深色主题切换。

## 内置例程

| 例程 | 目标 | 用途 |
| --- | --- | --- |
| `iCESugar LED Blinky` | iCE40 / iCESugar | 最小点灯工程，用于快速跑通检查、综合、布局布线和比特流生成 |
| `iCESugar Multi-file Counter` | iCE40 / iCESugar | 多文件 Verilog 工程，包含宏定义头文件和多个模块 |
| `iCESugar PWM Breathing LED` | iCE40 / iCESugar | PWM 呼吸灯，占空比渐变和寄存器计数示例 |
| `iCESugar Button Debounce` | iCE40 / iCESugar | 按键同步、消抖和边沿检测示例 |
| `iCESugar UART Echo` | iCE40 / iCESugar | UART RX/TX echo 多模块工程模板 |
| `iCESugar-pro Blinky` | ECP5 / iCESugar-pro | ECP5 点灯流程示例 |
| `Tang Nano 9K Blinky` | Gowin / Tang Nano 9K | Gowin 流程示例 |
| `Verilog Counter Sim` | 纯仿真 | 用于验证 Icarus Verilog、VVP 和波形查看 |
| `Verilog FSM Simulation` | 纯仿真 | FSM testbench 和 VCD 波形示例 |

推荐第一轮先运行：

1. `iCESugar LED Blinky`
2. `iCESugar Multi-file Counter`
3. `Verilog Counter Sim`

如果这几个例程能顺利验收，说明基础构建、报告和仿真路径已经基本可用。

## 板卡配置

Vflux 的板卡信息保存在 `boards/*.yaml` 中。板卡包通常包含：

- 板卡名称
- FPGA family/device/package/speed
- 时钟、LED、按键、UART 等资源
- 约束文件类型
- 综合、布局布线、打包和烧录工具

当前支持四种板卡配置方式：

1. **选择内置板卡包**：适合 iCESugar、iCEBreaker、iCESugar-pro、Tang Nano、ULX3S 等已收录板卡。
2. **选择 Custom 模板**：适合暂未收录的板卡，用户需要自己维护 PCF/LPF/CST 约束文件。
3. **导出板卡包草稿**：从已有板卡导出 YAML 草稿到当前工程目录。
4. **图形化创建自定义板卡包**：在板卡页面填写板卡名称、厂商、芯片族、器件、封装、时钟、LED、按键和烧录工具，保存后写入当前工程的 `boards/*.yaml`。

自定义板卡保存前会运行基础体检，检查必填字段、常见器件/封装格式、重复引脚、时钟资源和烧录工具匹配度。复杂资源仍可继续手动编辑 YAML。

## 报告中心

报告中心会汇总：

- 工程验收结论
- 工具链环境验收结论
- 发布前检查
- FPGA 器件信息
- 综合网表状态
- 布局布线产物
- 比特流产物
- Yosys / nextpnr / icetime 摘要
- 图形预览入口
- HTML 报告导出
- 诊断包导出

导出的 HTML 报告位于：

```text
output/reports/vflux-report.html
```

如果准备打包或发布试用版，建议在报告中心点击：

```text
1.0 发布前自动验收
```

它会依次运行工程体检、工具链验收、一键构建、HTML 报告导出，并刷新发布前检查。

## 烧录方式

Vflux 支持多种烧录入口：

- `icesprog`
- `openFPGALoader`
- `ecpprog`
- DFU
- JTAG
- 拖拽盘符烧录

对于 iCESugar，如果手动拖拽 `.bin` 文件可以成功烧录，建议在 Vflux 的烧录页面选择 **拖拽盘符**。这是当前 Windows 试用版最稳定的 iCESugar 路径。

## 常见问题

### Vflux 找不到 OSS CAD Suite

确认你选择的是 OSS CAD Suite 根目录，而不是 `bin` 目录。正确目录里应该能看到 `environment.bat` 和 `bin`。

### 工具链页面一直红色

先确认 OSS CAD Suite 是否能在命令行单独运行。然后回到 Vflux 的工具链页面重新选择路径并运行环境验收。

### iCESugar DFU 或 FTDI 检测不到

如果拖拽盘符烧录可用，优先选择“拖拽盘符”。DFU/FTDI 路径可能受驱动、权限和板卡启动模式影响。

### 仿真完成但打不开波形

检查 testbench 是否包含 `$dumpfile` 和 `$dumpvars`。Vflux 只会在 `output/simulation` 中找到真实 `.vcd` 或 `.fst` 文件后才提示可以打开波形。

### 报告中心显示某些产物不存在

报告中心只显示真实存在的产物。SDF、门级 Verilog、SVG 或 Floorplan HTML 需要在对应工作台启用输出并重新构建。

### Windows 提示未知发布者

当前 portable 构建默认未进行代码签名，Windows 可能提示未知发布者。确认来源可信后再运行。

## 开发运行

安装依赖：

```powershell
npm install
```

启动开发版：

```powershell
npm start
```

检查内置例程：

```powershell
npm run validate:examples
```

## Windows RC 打包

Vflux 不会把 OSS CAD Suite 打进安装包。用户需要自行安装 OSS CAD Suite，并在首次启动后到工具链页面选择路径。

打包 Windows portable 版本：

```powershell
npm run pack:win
```

如果只想输出 ZIP：

```powershell
npm run pack:win:zip
```

输出目录：

```text
dist/
```

打包前建议先执行：

```powershell
npm run release:check
```

## Linux 计划

当前已预留 Linux AppImage 打包脚本：

```bash
npm run pack:linux
```

但 Linux 版本仍需要在真实 Linux 机器上验证 OSS CAD Suite 路径、USB/JTAG 权限、udev 规则和 AppImage 行为。

## 1.0.0-rc.1 边界

- Windows portable 是当前主要目标。
- Linux AppImage 已预留，但未完成实机验收。
- iCESugar 拖拽盘符烧录路径已经优先支持。
- ECP5/Gowin 工作流和高级参数已提供入口，但仍需要更多真实板卡测试。
- 自定义板卡包支持 GUI 创建基础包，复杂板卡仍建议手动编辑 YAML。
- OSS CAD Suite 不内置，需要用户自行安装。
