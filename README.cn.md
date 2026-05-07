# Vflux
English README: [README.md](README.md)

Vflux 是一个面向 FPGA 学习与开发的小型图形化工具，配合 [OSS CAD Suite](https://github.com/YosysHQ/oss-cad-suite-build) 使用。它不会重新实现 Yosys、nextpnr、icepack、ecppack、openFPGALoader 等底层工具，而是把原本分散在命令行里的 FPGA 开发流程整理成连续、清晰、可视化的工作台。

当前版本定位为 **0.9 Windows 试用版**：重点覆盖 iCE40/iCESugar 学习流程，并提供 ECP5、Gowin 的工程配置和工具链入口。



## 使用前准备

Vflux **不会内置 OSS CAD Suite**。使用前请先安装 OSS CAD Suite，并在 Vflux 的“工具链”页面选择安装目录或让 Vflux 自动搜索。

推荐步骤：

1. 下载 OSS CAD Suite：
   <https://github.com/YosysHQ/oss-cad-suite-build/releases>
2. 解压到一个固定目录，例如：

   ```text
   D:\oss-cad-suite
   ```

3. 打开 Vflux。
4. 进入“工具链”页面。
5. 如果自动检测失败，点击“浏览...”选择 OSS CAD Suite 根目录，也就是包含 `environment.bat` 和 `bin` 的目录。
6. 点击或等待“运行环境验收”，确认 Yosys、nextpnr、打包工具、烧录工具和仿真工具可用。

## 主要功能

- 创建、打开和保存 Vflux FPGA 工程。
- 选择内置板卡包，或使用 Custom 模板配置自己的板卡。
- 扫描已有 Verilog/SystemVerilog 工程，自动导入源文件和约束文件。
- 运行代码检查、综合、布局布线、生成比特流。
- 支持按阶段拆分输出目录：
  - `output/synthesis`
  - `output/pnr`
  - `output/bitstream`
  - `output/reports`
  - `output/simulation`
- 提供综合、布局布线、比特流、烧录等高级参数配置。
- 在 GUI 中显示结构化反馈，并保留命令行技术详情。
- 支持仿真、波形查看、形式验证、Verilator、MCY 等扩展工作台。
- 提供工具链环境验收、例程一键验收、HTML 工程报告导出。
- 支持中文/英文界面切换。
- 支持浅色/深色主题切换。

## 基本工作流

1. 打开 Vflux。
2. 在“工具链”页面运行环境验收，确认 OSS CAD Suite 可用。打开该页面时 Vflux 会自动开始检测。
3. 新建工程、打开工程，或从“例程”页面创建内置例程。
4. 在“板卡”页面选择目标开发板。
5. 在 VS Code 或其他编辑器中编写 Verilog/SystemVerilog。
6. 回到 Vflux，按顺序运行：
   - 检查
   - 综合
   - 布局布线
   - 生成比特流
7. 在“报告中心”查看资源、时序、产物和验收结论。
8. 在“烧录”页面选择合适的烧录方式并下载到开发板。

## 内置例程

Vflux 内置了几个可快速验证环境的例程：

| 例程 | 目标 | 用途 |
| --- | --- | --- |
| `iCESugar LED Blinky` | iCE40 / iCESugar | 最小点灯工程，用于快速跑通检查、综合、布局布线和比特流生成 |
| `iCESugar Multi-file Counter` | iCE40 / iCESugar | 多文件工程，包含宏定义头文件和多个 Verilog 模块 |
| `iCESugar-pro Blinky` | ECP5 / iCESugar-pro | ECP5 点灯流程示例 |
| `Tang Nano 9K Blinky` | Gowin / Tang Nano 9K | Gowin 流程示例 |
| `Verilog Counter Sim` | 纯仿真 | 用于验证 Icarus Verilog、VVP 和波形查看 |

推荐第一次使用时先运行：

1. `iCESugar LED Blinky`
2. `iCESugar Multi-file Counter`

如果这两个例程能完成构建并生成比特流，说明 iCE40 基础流程已经基本可用。

## 烧录方式

Vflux 支持多种烧录入口：

- `icesprog`
- `openFPGALoader`
- `ecpprog`
- `DFU`
- `JTAG`
- 拖拽盘符烧录

对于 iCESugar，如果手动拖拽 `.bin` 文件可以成功烧录，建议在 Vflux 的烧录页面选择 **拖拽盘符**。这种方式对 0.9 试用版最稳定，也适合教学和快速验证。

烧录页面提供“烧录诊断向导”，可检查：

- 是否已选择板卡
- 是否已生成比特流
- 当前烧录方式是否匹配
- DFU/FTDI/openFPGALoader/拖拽盘符是否可用

## 板卡配置

Vflux 的板卡信息保存在 `boards/*.yaml` 中。板卡包通常包含：

- 板卡名称
- FPGA family/device/package/speed
- 时钟、LED、按键、UART 等资源
- 约束文件类型
- 综合、布局布线、打包和烧录工具

当前已经支持四种板卡配置方式：

1. **选择内置板卡包**
   - 适合 iCESugar、iCEBreaker、iCESugar-pro、Tang Nano、ULX3S 等已收录板卡。

2. **选择 Custom 模板**
   - 适合暂未收录的板卡。
   - 例如：
     - `Custom iCE40 UP5K`
     - `Custom iCE40 HX8K`
     - `Custom ECP5`
     - `Custom Gowin`
   - 用户需要自己维护 PCF/LPF/CST 约束文件。

3. **导出板卡包草稿**
   - 在“板卡”页面选择板卡后，可以导出一个 YAML 草稿到当前工程目录。
   - 之后可以手动补充时钟、LED、按键、烧录参数等信息。

4. **图形化创建自定义板卡包**
   - 在“板卡”页面展开“图形化创建自定义板卡包”。
   - 可以填写板卡名称、厂商、芯片族、器件、封装、时钟、LED、按键和烧录工具。
   - 保存后会写入当前工程目录的 `boards/*.yaml`，并立即作为当前板卡使用。

需要说明：当前版本已经可以通过 GUI 创建基础自定义板卡包，也可以手动编辑 YAML 继续补充复杂资源。1.0 前还需要继续完善字段校验、约束模板生成和更多外设资源编辑。

## 工程文件

Vflux 工程配置保存在：

```text
project.vflux.yaml
```

它记录：

- 工程名称
- 工程目录
- 顶层模块
- 源文件
- 约束文件
- 目标板卡
- 工具链路径
- 各阶段高级选项

这个文件可以加入版本管理，便于复现工程配置。

## 报告中心

报告中心会汇总：

- 工程验收结论
- 工具链环境验收结论
- FPGA 器件信息
- 综合网表状态
- 布局布线产物
- 比特流产物
- Yosys / nextpnr / icetime 摘要
- 图形预览入口
- HTML 报告导出

导出的 HTML 报告位于：

```text
output/reports/vflux-report.html
```

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

## Windows 试用版打包

Vflux 0.9 打包时不包含 OSS CAD Suite。用户需要自己安装 OSS CAD Suite，并在第一次启动后到工具链页面选择路径。

打包 Windows portable 版本：

```powershell
npm run pack:win
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

当前已经预留 Linux AppImage 打包脚本：

```bash
npm run pack:linux
```

但 0.9 阶段优先验证 Windows portable。Linux 版本建议在 1.0 前单独做工具链路径、权限、USB/JTAG 访问和 AppImage 打包验证。

## 0.9 已知边界

- Windows portable 是当前主要目标。
- Linux AppImage 需要后续独立验收。
- Gowin/ECP5 的部分高级参数还需要更多真实板卡测试。
- 板卡包可以通过 YAML 配置，但完整 GUI 编辑器尚未完成。
- 报告中心可以打开 SVG/HTML 产物，后续可继续做内嵌预览。

## 版本目标

### 0.9

- 能创建和打开工程。
- 能运行内置例程。
- 能完成 iCESugar 拖拽盘符烧录闭环。
- 能导出 HTML 报告。
- 能打包 Windows portable 试用版。

### 1.0

- Windows + Linux 双平台落地。
- 更完整的板卡包编辑器。
- 更完整的报告预览和图形化分析。
- 更多真实板卡端到端例程。
- 更完善的烧录诊断和工具链环境检测。
