# Vflux 审计与修改记录

记录日期：2026-05-05

## 已发现并修复的问题

1. 检查页过度暴露命令行细节
   - 问题：检查页面直接显示 Yosys 命令预览和原始日志，用户需要阅读命令行输出才能知道结果。
   - 修改：将检查页改为图形化反馈结构：状态卡、检查项列表、开始/停止/重置按钮。
   - 理由：Vflux 的定位是把 OSS CAD Suite 的流程图形化，默认界面应优先显示“能不能继续做下一步”，而不是要求初学者理解命令输出。

2. 命令预览默认展示过多
   - 问题：多个流程页默认展示 `*-cmd-preview`，界面更像命令生成器。
   - 修改：通过样式隐藏命令预览区域，保留 DOM 节点供现有 JS 逻辑继续写入，避免大范围重构带来风险。
   - 理由：先用低风险方式把 UI 默认体验改成图形化，同时保留以后增加“高级模式/技术详情”的可能。

3. 检查失败反馈不可读
   - 问题：失败时只显示工具输出或退出码。
   - 修改：检查页会根据 Yosys 输出提炼常见原因，例如源文件找不到、顶层模块不匹配、语法问题、SystemVerilog 模式未开启。
   - 理由：用户需要的是下一步修什么，而不是先读完整日志。

4. 工具链路径配置没有真正生效
   - 问题：工具链页面允许选择 OSS CAD Suite 路径，但主进程执行命令时仍使用启动时自动发现的路径。
   - 修改：新增 `toolchain:setPath` IPC，工具链页点击“应用工具链配置”后会把路径同步到主进程，并验证 `environment.bat` 和 `bin` 是否存在。
   - 理由：界面配置必须影响实际执行，否则会造成“我明明选了路径但还是失败”的隐性问题。

5. 命令执行使用 shell
   - 问题：工具执行使用 `shell: true`，工程文件名和参数可能被 shell 解释，遇到空格、特殊字符或恶意路径会更脆弱。
   - 修改：改为直接 spawn 工具程序，并启用 `windowsHide`。
   - 理由：FPGA 工程路径常包含空格，直接执行更稳定，也减少命令注入风险。

6. 顶部保存按钮被重复绑定
   - 问题：主应用和工程面板都给顶部保存按钮绑定了保存逻辑，可能造成重复保存或重复弹窗。
   - 修改：移除了工程面板中重复的顶部保存监听，只保留主应用统一处理。
   - 理由：顶栏属于全局应用层，保存入口应集中管理。

7. 视觉风格偏单一
   - 问题：原主题主要由深蓝/蓝色渐变构成，层级感有限。
   - 修改：调整为更中性的深色工作台风格，引入青绿色主色和暖色辅助反馈，面板间距、卡片阴影和检查页反馈结构更现代。
   - 理由：FPGA 工具应是安静、清晰、适合反复使用的生产力界面，而不是命令行窗口的包装。

## 当前仍建议继续处理

1. 增加“高级详情”开关
   - 默认隐藏命令和原始日志，但应提供高级模式，让有经验的用户展开查看实际命令、完整 stdout/stderr 和复制命令。

2. 建立统一的流程结果组件
   - 检查页已经改为图形化反馈，综合、布局布线、打包、烧录、仿真也应逐步使用同一套状态卡和摘要组件。

3. 完善工具链能力探测
   - 工具链页可以检测 `yosys`、`nextpnr-*`、`icepack/ecppack/gowin_pack`、`openFPGALoader` 是否可执行，并给出版本号。

4. 工程配置 schema
   - 为 `project.vflux.yaml` 增加版本号和 schema 校验，避免旧工程或手动编辑导致 GUI 状态异常。

5. 板卡硬件包校验
   - 对 boards/*.yaml 增加必填字段校验，例如板卡名、family、device、package、program tool、约束类型。

6. 引入测试
   - 当前项目缺少自动化测试。建议先加轻量的 Node 单元测试，覆盖路径解析、顶层模块检测、PCF 生成、工具链路径验证。

7. 日志分层
   - 建议把日志分为“用户摘要”“诊断详情”“原始工具输出”三层，GUI 默认显示摘要，报告页可引用诊断详情。

## 第二轮升级记录

1. 明确“生成比特流”工作台
   - 问题：原来导航中叫“打包”，用户不容易把它和最终 `.bin` 比特流产物对应起来。
   - 修改：导航、工具链卡片、一键构建描述和面板标题都改为“生成比特流”；面板中新增“最终产物”区域，直接显示 `output/bitstream/<top>.bin`。
   - 理由：FPGA 初学者更关心“我有没有得到可以烧录的文件”，而不是底层 pack 工具叫什么。

2. 综合页去命令行化
   - 问题：综合页原来主要显示 Yosys 命令和日志。
   - 修改：改为“综合工作台”，显示顶层模块、目标架构、输出网表和可读反馈；失败时提炼语法错误、模块找不到、文件路径错误、目标架构不支持等提示。
   - 理由：综合失败通常需要用户回到代码或工程配置修改，界面应直接指向可修改的位置。

3. 布局布线页去命令行化
   - 问题：布局布线页原来展示 nextpnr 命令和原始日志。
   - 修改：改为“布局布线工作台”，显示目标器件、约束文件、布局输出；失败时提炼约束问题、资源不足、布线失败、输入文件缺失等原因。
   - 理由：nextpnr 日志信息量大，默认界面需要先告诉用户“是约束问题、资源问题还是上一步产物缺失”。

4. 比特流生成页强化
   - 问题：最终 `.bin` 产物不够突出。
   - 修改：新增最终产物高亮区、输入布局文件、目标板卡、下一步提示；失败时提炼布局文件缺失、板卡/系列不支持、输出目录权限问题。
   - 理由：这是从“编译过程”转向“可烧录产物”的关键节点，需要比其他中间步骤更醒目。

5. 烧录页去命令行化
   - 问题：烧录页原来依赖检测/烧录日志判断设备状态。
   - 修改：改为“烧录工作台”，保留烧录方式选择，显示设备状态、比特流文件和可读反馈；检测失败和烧录失败会提示连接、驱动、权限、比特流文件缺失等常见原因。
   - 理由：烧录问题通常来自硬件连接和驱动，用户不应被迫阅读 openFPGALoader 或 icesprog 原文。

6. 自动准备输出目录
   - 问题：打开旧工程时如果没有 `output` 目录，综合/布局/打包可能因为输出路径不存在而失败。
   - 修改：主进程在运行工具前确保工程目录下存在 `output`。
   - 理由：这是 GUI 应该兜底处理的工程卫生问题，不应让用户手动建目录。

7. 修复隐藏的运行期引用问题
   - 问题：部分 JS 引用了 HTML 中不存在的元素，例如板卡详情的 UART 字段、形式验证命令预览字段，以及若干面板刷新总览时使用了错误的 dashboard ID。
   - 修改：补齐缺失 DOM，统一改为 `panel-dashboard`，并重写了仿真、一键构建、MCY、Verilator 的基础实现，避免乱码字符串导致语法错误。
   - 理由：即使这些页面不是本轮重点，也不能让用户切换页面时遇到空引用或脚本中断。

## 下一次升级建议

1. 建立统一的“工具步骤基类”
   - 现在检查、综合、布局布线、比特流、烧录已经有相似的状态卡和反馈逻辑。下一步建议抽出通用渲染、日志提炼、运行状态管理，减少重复代码。

2. 增加高级详情抽屉
   - 默认继续隐藏命令和原始日志，但在每个工作台右上角提供“技术详情”，展开后显示实际命令、完整日志、退出码和复制按钮。

3. 增加产物存在性检查
   - 每个步骤运行前检查上一阶段产物是否存在，例如布局布线前检查 `.json`，比特流前检查 `.asc`，烧录前检查 `.bin`，并在界面中直接标红缺失项。

4. 优化一键构建
   - 一键构建目前仍偏日志化。建议改成大号流水线进度视图，每一步只显示“运行中/完成/失败原因/下一步”，日志放到高级详情。

5. 工具链版本和板卡适配检查
   - 在工具链页检测 `yosys`、`nextpnr`、打包工具、烧录工具版本；在板卡页提示当前板卡使用的 family 是否和可用工具匹配。

## 第三轮升级记录

1. 左侧工作流分组
   - 问题：左侧流程把构建、分析、验证、调试全部平铺，信息密度高但章法不足。
   - 修改：将导航整理为“准备 / 构建 / 分析 / 验证与调试”四组，并把“一键构建”放到构建组前部。
   - 理由：FPGA 开发流程本身有阶段性，分组后用户更容易理解自己处在工程准备、生成产物还是后续验证阶段。

2. 抽出工具步骤 UI 辅助模块
   - 问题：检查、综合、布局布线、比特流、烧录页面都有类似的状态卡和反馈列表渲染逻辑。
   - 修改：新增 `renderer/tool-step-ui.js`，统一处理结果卡渲染、工程内产物路径、产物存在性检查和隐藏日志追加。
   - 理由：后续继续扩展命令行工具时，可以复用同一套 GUI 反馈模式，减少重复代码。

3. 增加阶段产物检查
   - 问题：用户可能跳过上一步，导致布局布线找不到 `.json`、比特流生成找不到 `.asc`、烧录找不到 `.bin`。
   - 修改：布局布线前检查 `output/synthesis/<top>.json`，比特流前检查 `output/pnr/<top>.asc`，烧录前检查 `output/bitstream/<top>.bin`，缺失时直接给出明确提示。
   - 理由：这比让底层工具报 “No such file” 更符合图形化工作台的职责。

4. iCESugar 烧录检测修复
   - 问题：烧录页原来固定使用 `openFPGALoader --detect` 检测设备，但 iCESugar 板卡包声明的烧录工具是 `icesprog`，这会造成“检测不到设备”，即使实际 bitstream 和开发板都正常。
   - 修改：工程配置现在会保存板卡包中的 `program.tool` 和 `program.interface`；烧录页的“板卡默认”会根据板卡包选择工具。iCESugar 默认走 `icesprog`，检测阶段使用 `lsftdi` 查 FTDI 设备，烧录阶段使用 `icesprog output/bitstream/<top>.bin`。
   - 理由：检测和烧录必须使用同一类硬件通道，否则 GUI 会误判连接状态。

5. 烧录方式专业化
   - 问题：原来的烧录方式只有 FTDI/DFU/JTAG，和板卡硬件包里的具体工具没有直接对应。
   - 修改：烧录方式改为“板卡默认 / iCESugar icesprog / openFPGALoader / DFU / JTAG”，默认优先尊重板卡包。
   - 理由：Vflux 的目标是覆盖命令行工具，但 GUI 层应按板卡抽象工具，而不是让用户先知道每个命令怎么选。

## 下一次升级建议

1. 工具链能力矩阵
   - 在工具链页做一个矩阵：Yosys、nextpnr、icepack、icesprog、openFPGALoader、iverilog、gtkwave、sby、verilator、mcy 是否可用，并显示版本或检测方式。

2. 板卡硬件包 schema 校验
   - 对 `boards/*.yaml` 做字段校验，尤其是 `toolchain.program.tool/interface`，避免烧录策略缺失或写错。

3. 高级详情抽屉
   - 每个工作台增加“技术详情”，展开显示真实命令、完整日志、退出码和复制按钮。默认仍保持去命令行化。

4. iCESugar 多烧录路径
   - 如果你的 iCESugar 常用拖拽烧录，后续可以增加“打开比特流目录”和“复制到可移动盘”的 GUI 路径；这需要先识别 iCESugar 暴露的盘符或让用户指定一次。

## 第四轮升级记录

1. 工具链能力矩阵
   - 问题：工具链页此前只展示“综合/P&R/打包/烧录”四张静态卡，无法提前判断某个命令行工具是否存在。
   - 修改：新增工具链能力矩阵，覆盖 `yosys`、`nextpnr-*`、`icepack/ecppack/gowin_pack`、`icesprog/ecpprog/openFPGALoader`、`lsftdi`、`iverilog`、`vvp`、`gtkwave`、`sby`、`verilator`、`mcy`。
   - 理由：专业化工作台应该在运行前知道工具链是否完整，而不是等到综合、仿真或烧录失败后才发现缺工具。

2. 主进程工具探测 IPC
   - 问题：前端无法可靠判断 OSS CAD Suite 内部工具是否存在，也不应该自己拼接工具路径。
   - 修改：新增 `toolchain:probe` IPC，由主进程按当前 OSS CAD Suite 路径检查工具文件，并尝试运行版本命令；前端通过 `probeToolchain` 获取结果。
   - 理由：工具路径、环境变量和 Windows 执行细节都属于主进程职责。

3. 工具链页状态联动
   - 问题：工具链路径应用成功不代表工具都可用。
   - 修改：应用工具链配置后自动触发能力检测；矩阵显示“构建必需/可选能力”，并根据必需工具检测情况更新流水线状态。
   - 理由：用户应该能区分“构建无法进行”和“某些高级功能不可用”。

4. 本地工具覆盖检查
   - 当前本机 OSS CAD Suite 中已确认存在：`yosys.exe`、`nextpnr-ice40.exe`、`icepack.exe`、`icesprog.exe`、`lsftdi.exe`、`openFPGALoader.exe`、`iverilog.exe`、`vvp.exe`、`gtkwave.exe`、`sby.exe`、`mcy.exe`。
   - 当前未找到：`verilator.exe`，但存在 `verilator` 和 `verilator_bin.exe`。

5. 工具别名探测
   - 问题：部分 OSS CAD Suite 工具在 Windows 包里不一定带 `.exe` 文件名，例如 Verilator 可能叫 `verilator` 或 `verilator_bin.exe`。
   - 修改：工具探测支持 `aliases`，矩阵会显示主命令以及实际命中的替代命令。
   - 理由：能力矩阵应该判断“能力是否可用”，而不是被单一文件名误导。

## 下一次升级建议

1. 高级详情抽屉
   - 工具矩阵已经能发现问题，下一步应在每个工作台加“技术详情”，显示真实命令、完整日志、退出码和复制按钮。

2. 可移动盘拖拽烧录路径
   - 针对 iCESugar 的拖拽烧录体验，增加“打开比特流目录”和“复制到开发板盘符”的入口。

## 第五轮升级记录

1. 分阶段产物目录
   - 问题：所有构建产物混在 `output` 根目录下，随着报告、仿真、波形和多轮构建增加，会显得不专业也不易排查。
   - 修改：综合输出改为 `output/synthesis/<top>.json`，布局布线输出改为 `output/pnr/<top>.asc`，比特流输出改为 `output/bitstream/<top>.bin`，仿真输出使用 `output/simulation`，报告预留 `output/reports`。
   - 理由：按阶段保存产物更接近专业 FPGA 工程习惯，也方便后续做报告索引、缓存复用和清理策略。

2. 综合高级选项
   - 问题：综合页原来只有固定流程，无法表达 Yosys 中常见的优化/映射步骤。
   - 修改：新增时序逻辑化简、常量与无用逻辑优化、FSM 提取与优化、存储器映射、总线拆分、ABC 逻辑压缩、flatten 等开关，并根据勾选生成 Yosys 脚本。
   - 理由：GUI 不应该只是一键封装命令，而应该让用户理解并控制综合流程中的关键专业阶段。

3. 布局布线与比特流高级选项
   - 问题：nextpnr 和打包阶段缺少频率、seed、全局网络提升、环路处理、压缩、反解校验等控制项。
   - 修改：布局布线页新增时序约束、忽略组合环、全局网络提升、seed、目标频率选项；比特流页新增压缩、反解校验和元数据记录选项。
   - 理由：这些选项会直接影响收敛、可重复性和产物可诊断性，是从学习工具走向专业工作台的必要入口。

4. DFU 烧录误判修复
   - 问题：DFU 下载开始或结束后设备会短暂消失/重枚举，GUI 容易把这个正常现象误判为“检测不到设备”。
   - 修改：DFU 默认使用 `-a 0 -D output/bitstream/<top>.bin`，并在日志出现下载完成或 MANIFEST 状态时按软成功处理；界面提示 DFU 设备下载后消失通常是正常重启。
   - 理由：烧录页要解释硬件状态变化，而不是把底层 USB 枚举变化直接暴露为失败。

5. 拖拽盘符烧录
   - 问题：用户已经验证手动拖拽 `.bin` 到开发板盘符可以成功，但 GUI 中没有这条稳定路径。
   - 修改：烧录方式新增“拖拽盘符”，可选择开发板暴露出的可移动盘目录，Vflux 会把 `output/bitstream/<top>.bin` 复制过去并给出图形化反馈。
   - 理由：真实可用的板卡工作流应该被纳入 GUI，尤其适合 iCESugar 这类可通过拖拽完成烧录的场景。

6. Verilator Lint 可用性修复
   - 问题：本机 OSS CAD Suite 中没有 `verilator.exe`，但存在 `verilator` 和 `verilator_bin.exe`，导致 lint 被错误显示为不可用或运行失败。
   - 修改：主进程执行工具时支持命令别名解析，`verilator.exe` 会自动解析到可用的 `verilator` 或 `verilator_bin.exe`。
   - 理由：GUI 应判断能力是否存在，而不是死守单一 Windows 文件名。

## 下一次升级建议

1. 技术详情抽屉
   - 在综合、布局布线、比特流、烧录、仿真、Lint 页统一加入“技术详情”，默认收起，展开后显示真实命令、完整日志、退出码、耗时和复制按钮。

2. 专业配置持久化
   - 将综合、布局布线、打包、烧录的高级选项写入 `project.vflux.yaml`，让工程配置可以复现，而不是只停留在本次 GUI 状态。

3. 报告索引与产物清理
   - 为 `output/reports` 增加统一索引页，展示综合资源、时序结果、bitstream 信息和最近一次失败原因；同时提供“清理本阶段产物”和“清理全部构建产物”。

4. iCESugar 自动盘符识别
   - 进一步识别可移动盘卷标或 VID/PID，把“拖拽盘符”从手动选择升级为自动发现，并保留手动选择作为兜底。

## 待办路线图：专业化与去命令化

### 1. 命令行能力补齐清单

| 阶段 | 已有 GUI 能力 | 待补齐的命令行能力 | 建议界面形态 |
| --- | --- | --- | --- |
| Yosys 源文件读取 | 源文件列表、顶层模块 | SystemVerilog 模式、include 目录、宏定义 `-D`、库文件、黑盒文件、按文件语言区分 | “源文件高级设置”：include 路径表、宏定义表、库文件列表 |
| Yosys 综合 | `proc`、`opt`、`fsm`、`memory`、`splitnets`、`abc`、`flatten` | `synth_ice40` 的 `-device`、`-dff`、`-retime`、`-nocarry`、`-nodffe`、`-dffe_min_ce_use`、`-nobram`、`-spram`、`-dsp`、`-abc2`、`-noabc9`、`-flowmap`、`-no-rw-check`，以及 `blif/edif/json/rtlil` 等输出格式 | “综合策略”：面积优先、时序优先、资源映射、实验特性、输出格式 |
| Yosys 分析 | 基础检查和综合反馈 | `stat`、`check`、`hierarchy -check`、`show`、`write_verilog`、`write_rtlil`、`write_smt2`、自定义 pass 顺序 | “分析报告”：资源统计、层级检查、中间网表导出 |
| nextpnr 布局布线 | device/package/pcf/json/asc、freq、seed、ignore-loops、global promotion | `--placer`、`--router`、`--randomize-seed`、`--threads`、`--Werror`、`--timing-allow-fail`、`--no-tmdriv`、`--sdf`、`--report`、`--detailed-timing-report`、`--placed-svg`、`--routed-svg`、`--pack-only/no-place/no-route/no-pack`、`--pre-pack/pre-place/pre-route/post-route` Python hooks、`--pcf-allow-unconstrained` | “布局布线高级”：算法、线程、时序、报告、SVG 可视化、阶段钩子 |
| 约束管理 | 选择 PCF、自动生成基础 PCF | 未约束 IO 允许、约束完整性检查、时钟约束、板卡资源冲突检查、按接口生成约束片段 | “约束工作台”：引脚表、冲突提示、未约束 IO 清单 |
| 比特流生成 | asc -> bin、元数据、反解检查 | `iceunpack` 差异比对、`icemulti` 多镜像、`icebram` BRAM 内容替换、不同架构的 pack 工具选项 | “比特流产物”：bin、反解 asc、metadata、多启动镜像 |
| 时序分析 | 基础 icetime 入口 | 指定器件/package、频率扫描、关键路径、最高频率估算、报告保存 | “时序报告”：WNS/TNS、关键路径表、频率上限 |
| 烧录 | icesprog、openFPGALoader、DFU、JTAG、拖拽盘符 | 指定 board/cable/device、FTDI serial/channel、reset、volatile/flash 目标、file type、bitbang pins、stdin/network bitstream | “烧录高级”：线缆、目标存储、复位、设备选择、文件类型 |
| 仿真 | Icarus/Verilator 基础入口 | include、宏定义、timescale、VCD/FST、Verilator `--lint-only`、`--trace`、`--coverage`、C++ testbench、编译参数 | “仿真配置”：引擎、波形、覆盖率、编译参数 |
| 形式验证 | SBY 基础入口 | mode、engine、depth、prove/cover/bmc、多 task、SMT solver 选择、counterexample 波形 | “形式验证工作台”：任务矩阵、失败轨迹、波形入口 |
| 报告 | 基础汇总 | 聚合 Yosys stat、nextpnr report JSON、icetime、烧录记录、构建耗时、产物 hash | “构建报告中心”：一次构建一份报告包 |

目标：Vflux 应尽量覆盖 OSS CAD Suite 的常用命令行能力；只有 Python hook、自定义 Yosys pass 脚本、特殊烧录器参数等难以稳定图形化的内容，才放到“高级命令片段”里让用户手写。

### 2. 日志工作台去命令化方案

1. 默认层：图形化摘要
   - 每个工作台默认显示“当前状态、失败阶段、下一步建议、相关文件/产物”。
   - 不默认显示命令、stdout/stderr、退出码。

2. 诊断层：专业原因分析
   - 保留原始日志，但先通过规则解析器转换成结构化诊断。
   - 诊断字段建议包括：严重程度、工具阶段、原因分类、可能原因、建议动作、相关文件、是否可重试。
   - 典型分类：源文件缺失、顶层模块不存在、语法错误、SystemVerilog 模式未启用、约束缺失、IO 未约束、资源不足、布局失败、布线失败、时序失败、bitstream 输入缺失、DFU 设备重枚举、权限/驱动问题。

3. 技术层：高级详情抽屉
   - 每个工作台右上角提供“技术详情”。
   - 展开后显示真实命令、完整日志、退出码、耗时、环境摘要和复制按钮。
   - 这样既保留专业透明度，也不让初学者一进入页面就被英文日志淹没。

4. 失败反馈示例
   - 摘要：综合失败。
   - 原因：找不到顶层模块 `top`。
   - 可能原因：`project.vflux.yaml` 中顶层模块填写错误；源文件没有加入工程；模块名与文件名不一致。
   - 建议：回到工程页点击“自动检测顶层模块”；确认 `src/*.v` 已加入源文件列表；检查模块声明。
   - 技术详情：保留 Yosys 原始输出和退出码。

### 3. 下一步执行优先级

1. 技术详情抽屉
   - 先做统一组件，接入综合、布局布线、比特流、烧录、仿真、Verilator Lint。
   - 默认收起，确保界面继续保持去命令行化。

2. 专业配置持久化
   - 把综合、布局布线、打包、烧录、仿真高级选项写入 `project.vflux.yaml`。
   - 工程重新打开后应恢复所有勾选项和参数。

3. 统一诊断系统
   - 新增公共诊断模块，把工具日志转换为中文结构化提示。
   - 各工作台只负责展示诊断结果，不再各自解析日志。

4. 扩充 Yosys 与 nextpnr 选项
   - 优先补齐 `synth_ice40` 资源映射、时序优化、实验特性。
   - 其次补齐 nextpnr 的 placer/router/report/SDF/SVG/Python hook。

5. 报告中心升级
   - 将 `output/reports` 做成真正的构建报告入口。
   - 汇总资源、时序、关键路径、产物 hash、构建耗时、烧录记录和最近一次失败原因。

6. iCESugar 自动盘符识别
   - 从手动选择“拖拽盘符”升级为自动识别可移动盘卷标或 VID/PID。
   - 保留手动选择作为兜底，避免不同批次板卡行为差异导致误判。

## 第六轮升级记录

1. 技术详情抽屉
   - 问题：前几轮为了去命令化隐藏了命令和原始日志，但高级用户仍然需要在必要时看到真实命令、退出码和完整输出。
   - 修改：新增通用技术详情抽屉，综合、布局布线、比特流、烧录等工作台会默认显示图形化反馈，展开“技术详情”后查看实际命令、原始日志和退出码。
   - 理由：Vflux 的界面默认应面向流程理解，但不能牺牲专业透明度；技术详情抽屉能同时照顾初学者和高级用户。

2. 统一诊断系统
   - 问题：各工作台原本分别解析日志，提示风格不一致，后续扩展会导致重复代码。
   - 修改：新增 `renderer/diagnostics.js`，集中识别语法错误、顶层模块缺失、文件缺失、SystemVerilog 模式、约束/PCF、资源不足、布局失败、布线失败、时序失败、DFU、USB/JTAG/FTDI、权限、校验不一致等常见问题。
   - 理由：失败反馈应该输出“原因分类 + 可能原因 + 下一步动作”，而不是把英文日志直接扔给用户。

3. 高级配置持久化
   - 问题：综合、布局布线、打包、烧录页的高级选项之前只存在于本次界面状态，工程重新打开后无法复现。
   - 修改：在 `project.vflux.yaml` 中新增 `flow` 配置结构，保存 synthesis、pnr、pack、program 的高级选项；工程加载时自动合并默认值，避免旧工程缺字段出错。
   - 理由：专业 FPGA 工程必须可保存、可迁移、可复现；GUI 选项本质上也是工程配置的一部分。

4. Yosys 综合选项扩充
   - 问题：综合页只有基础 pass 开关，距离替代命令行仍不够。
   - 修改：在已有 `proc/opt/fsm/memory/splitnets/abc/flatten` 基础上，新增 `-dff`、`-retime`、`-nobram`、`-spram`、`-dsp`、`-abc2` 等专业选项。
   - 理由：这些选项会影响触发器处理、时序重定时、BRAM/SPRAM/DSP 资源映射和 ABC 流程，是综合策略专业化的核心入口。

5. nextpnr 布局布线选项扩充
   - 问题：布局布线页原来只有频率、seed 和少数布线控制项。
   - 修改：新增允许未约束 IO、允许时序未收敛产物、输出 JSON 报告、输出 placed/routed SVG、布局算法、布线算法、线程数等选项，并将报告产物写入 `output/reports`。
   - 理由：布局布线的专业调试通常需要算法切换、报告文件、可视化产物和可重复 seed，这些不应只能通过命令行完成。

6. 烧录预检测与跳过预检测
   - 问题：“跳过预检测直接烧录”之前只是界面选项，没有实际影响流程。
   - 修改：烧录前默认先进行设备预检测；如果用户勾选跳过预检测，则直接进入烧录。对 DFU 这类会重枚举的设备，界面会提示可按需跳过预检测。
   - 理由：预检测能帮助大多数用户避免误操作；跳过预检测则给特殊板卡和特殊烧录模式保留专业兜底。

## 下一次升级建议

1. 报告中心落地
   - 读取 `output/reports/*.json`、SVG、metadata、时序结果，做成构建报告中心，而不是只列静态摘要。

2. 继续补齐命令行能力
   - Yosys 继续补 `-nocarry`、`-nodffe`、`-dffe_min_ce_use`、`-noabc9`、`-flowmap`、`-no-rw-check`、输出格式选择。
   - nextpnr 继续补 SDF、detailed timing report、阶段 hook、pack/place/route 分阶段运行。

3. 诊断规则数据化
   - 将 `diagnostics.js` 中的规则拆成可维护的数据表，并按工具阶段输出更细的原因代码，方便后续报告中心引用。

4. GUI 配置分组优化
   - 高级选项数量增加后，应把综合/布局布线设置拆成“基础、资源映射、时序、报告、实验特性”分组，避免工作台变成复选框墙。

## 第七轮升级记录

1. 顶部菜单栏
   - 问题：新建、打开、保存一直固定显示在右上角，随着功能增加会让顶部区域越来越像按钮堆。
   - 修改：将顶部改为“工程 / 视图 / 工作台”菜单。工程菜单包含新建、打开、保存、打开工程目录、工程管理页；视图菜单包含紧凑模式、底部日志、报告中心；工作台菜单包含一键构建、生成比特流、烧录、验证与调试。
   - 理由：Vflux 正在从单流程工具变成完整 IDE 辅助软件，顶部应承载全局入口和个性化选项，而不是只放几个工程按钮。

2. 报告中心去日志化
   - 问题：报告页之前偏静态汇总，不能真正读取 `output/reports`、bitstream metadata 和流水线状态，也缺少结构化失败反馈。
   - 修改：报告页改成报告中心工作台，显示构建状态卡、流程芯片、资源与器件、时序与产物、引脚与约束、构建产物；读取 `output/reports/<top>.nextpnr.json` 和 `output/bitstream/<top>.metadata.json`，技术详情中保留数据来源和原始 JSON 摘要。
   - 理由：报告中心应该把构建产物转化为可读结论，而不是要求用户翻目录和日志。

3. 调试/验证页面去日志化
   - 问题：仿真、形式验证、MCY、Verilator、Surfer、时序分析、资源统计仍然以命令预览和日志框为主。
   - 修改：这些页面统一改为工作台结构：状态卡、关键信息、反馈列表、操作按钮、技术详情抽屉。默认界面显示可读反馈，原始命令和日志放入技术详情。
   - 理由：调试功能同样应服务于“下一步该怎么修”，而不是把英文输出原样交给用户。

4. 剩余功能高级配置
   - 问题：高级配置主要集中在综合、布局布线、比特流和烧录，验证/调试类页面缺少专业选项入口。
   - 修改：新增仿真高级选项（波形、警告诊断、输出文件）、形式验证高级选项（深度、求解器、反例波形）、MCY 高级选项（突变规模、保留工作目录）、Verilator 高级选项（`-Wall`、`--trace`、`--coverage`）、时序分析高级选项（最大频率估算、报告保存、目标频率）、资源统计高级选项（同时生成 HTML、保存摘要）。
   - 理由：Vflux 的目标是尽量替代命令行，所以每个工作台都需要逐步暴露常用专业配置，而不是只有“一键运行”。

5. 一键构建去日志化
   - 问题：一键构建页仍然有构建日志框，和其他工作台的图形化反馈不一致。
   - 修改：一键构建页新增状态卡和反馈列表，构建日志隐藏到技术详情；主界面只显示进度、步骤状态和失败后的定位提示。
   - 理由：用户在一键构建时最关心哪一步失败和下一步去哪修，详细日志应该作为诊断材料保留而不是默认展示。

6. 工程配置继续持久化
   - 问题：新增调试/验证高级选项如果不保存，会再次变成临时 UI 状态。
   - 修改：`flow` 配置继续扩展到 simulation、formal、mcy、verilator、timing、floorplan。
   - 理由：验证与调试配置也属于工程复现的一部分，应和综合、布局布线配置一样进入 `project.vflux.yaml`。

## 下一次升级建议

1. 高级选项分组与折叠
   - 当前高级配置数量已经明显增加，下一步应把综合、布局布线、仿真、验证选项按“基础 / 时序 / 资源 / 报告 / 实验特性”折叠分组。

2. 报告中心读取更多产物
   - 继续解析 Yosys `stat`、icetime 文本、icebox_stat 输出、Verilator lint 摘要和 MCY 结果，并在报告中心给出统一摘要。

3. 工程管理页升级
   - 工程管理页应增加最近工程、工程文件位置、产物目录、清理产物、导出工程包、打开 VS Code 等入口。

4. 个性化设置持久化
   - 顶部菜单已有紧凑模式入口，后续应把主题、紧凑模式、是否默认展开技术详情等偏好保存到本地用户配置。

## 第八轮升级记录

1. Verilator 可用性修复
   - 问题：OSS CAD Suite Windows 包中存在 `verilator_bin.exe` 和 `verilator`，但无扩展名的 `verilator` 不一定能被 Windows `spawn` 稳定执行，导致高级仿真/Lint 显示或运行不可用。
   - 修改：主进程和工具链检测都将 `verilator_bin.exe` 放在别名优先级第一位，再回退到 `verilator`。
   - 理由：GUI 判断的是“Verilator 能力是否可用”，应优先选择 Windows 可直接执行的 `.exe` 文件。

2. 工具链检测刷新修复
   - 问题：工具链页面点击检测后，界面容易停留在“检测中”，切换页面回来才显示绿色可用。
   - 修改：检测开始后先渲染 pending 矩阵并等待一帧 `requestAnimationFrame`，再发起主进程 IPC；检测过程中禁用按钮，完成或失败后恢复。
   - 理由：长 IPC 前需要把 UI 更新交给浏览器绘制，否则用户会误以为检测卡死。

3. OSS CAD Suite 渲染产物查看
   - 问题：用户希望查看内部布线图、门级结构、OSS CAD Suite 生成的各类图形化产物。
   - 修改：报告中心新增产物打开入口：报告目录、比特流目录、nextpnr placed SVG、nextpnr routed SVG、icebox 内部布线 HTML、icebox 反解门级 Verilog。
   - 理由：Vflux 应把工具链产物组织成可浏览的工作台，而不是让用户手动翻 `output` 目录。

4. 生成比特流高级配置扩展
   - 问题：生成比特流阶段之前只有压缩、反解检查、元数据，专业性不足。
   - 修改：比特流阶段高级选项分为“产物”和“反解与可视化”；新增生成后打开产物目录、生成门级 Verilog、生成内部布线 HTML。
   - 理由：比特流阶段不仅是生成 `.bin`，也是连接后续报告、可视化、反解检查和调试的重要节点。

5. 高级选项界面整理
   - 问题：随着 CLI 选项增加，单层复选框会变成难以扫描的选项墙。
   - 修改：新增可折叠的高级选项分组样式，先在比特流阶段落地，后续综合、布局布线、仿真、验证页面继续迁移。
   - 理由：专业化不是把所有命令行参数平铺出来，而是按任务意图组织。

## CLI 覆盖差距清单

| 工作台 | 当前覆盖 | 仍待覆盖的 CLI 能力 | 建议优先级 |
| --- | --- | --- | --- |
| 检查 | Yosys 基础读取/层级检查 | include 路径、宏定义、库文件、黑盒、按文件语言选择、仅 lint 不综合、警告等级 | 高 |
| 综合 | 常见 pass、资源映射、ABC/retime/BRAM/SPRAM/DSP | `-nocarry`、`-nodffe`、`-dffe_min_ce_use`、`-noabc9`、`-flowmap`、`-no-rw-check`、输出 BLIF/EDIF/RTLIL、Yosys 自定义脚本片段、`show`/`write_*` 可视化 | 高 |
| 布局布线 | device/package/pcf/freq/seed/report/SVG/placer/router/thread | SDF、detailed timing report、阶段运行 `--pack-only/--no-place/--no-route`、Python hooks、Werror、更多架构 nextpnr 选项 | 高 |
| 生成比特流 | icepack/ecppack/gowin_pack 基础、metadata、反解、内部 HTML、门级 Verilog | ECP5 ecppack 详细选项、Gowin pack 详细选项、多镜像 `icemulti`、BRAM 替换 `icebram`、产物 hash/签名、输出格式切换 | 高 |
| 烧录 | icesprog/openFPGALoader/DFU/JTAG/拖拽盘符 | openFPGALoader cable/device/serial/flash/volatile/reset/file-type/bitbang、FTDI channel、烧录后复位策略 | 高 |
| 时序 | icetime 基础最大频率/报告 | 频率扫描、关键路径结构化解析、SDF 关联、目标频率对比、失败路径高亮 | 中 |
| 资源统计/图形 | icebox_stat、icebox_html、nextpnr SVG | Yosys `show` 门级图、netlistsvg、icebox_maps、图形产物索引和缩略图 | 中 |
| 仿真 | Icarus/Verilator/GTKWave 基础 | include、宏定义、timescale、VCD/FST 选择、运行参数、仿真时长、Verilator build/run 完整流程 | 高 |
| 形式验证 | SBY mode/depth/engine 基础 | 多 task、solver 选择、expect、cover trace、反例波形自动打开、SMT2 导出 | 中 |
| MCY | 配置文件/突变规模 | 完整 MCY 配置项、任务矩阵、覆盖结果解析、失败突变定位 | 中 |
| 报告中心 | nextpnr JSON、metadata、SVG/HTML/Verilog 打开 | Yosys stat、icetime 解析、icebox_stat 解析、Verilator/MCY/SBY 结果归档、构建时间线 | 高 |

## 第九轮升级记录

1. 高级仿真与工具链检测
   - 修改：本机 OSS CAD Suite 同时存在 `verilator` 与 `verilator_bin.exe`，Vflux 现在优先探测 `verilator_bin.exe`，再回退到 `verilator`，用于减少 Windows 环境下 Verilator 被误判不可用的问题。
   - 修改：工具链检测页在点击检测后会立即刷新为“检测中”矩阵，并在检测完成后主动重绘结果，不再依赖切换页面触发刷新。
   - 理由：工具链检测是后续专业工作台的入口，状态必须即时可信。

2. 图形产物查看
   - 修改：报告中心新增打开入口：布局 SVG、布线 SVG、SDF 时序文件、icebox 内部布线 HTML、icebox 反解门级 Verilog。
   - 修改：资源统计工作台生成 `icebox_html` 时会把 HTML 写入 `output/reports/<top>.floorplan.html`，比特流工作台也可以在生成后同时反解 Verilog 与 HTML。
   - 理由：用户需要从 GUI 直接查看 OSS CAD Suite 产生的结构图、布线图和门级视图，而不是去输出目录里猜文件。

3. 综合工作台高级选项补充
   - 新增：`-noabc9`、`-nocarry`、`-nodffe`、`-no-rw-check`。
   - 现状：综合页已经覆盖基础 pass 开关、ABC、flatten、DFF、retime、BRAM/SPRAM/DSP、ABC2，以及上述补充选项。
   - 理由：这些选项会显著影响 iCE40 资源映射与时序结果，属于从“固定一键流程”走向“专业综合策略”的关键开关。

4. 布局布线工作台高级选项补充
   - 新增：`--Werror`、`--no-tmdriv`、`--sdf`、`--detailed-timing-report`。
   - 现状：布局布线页已经覆盖 device/package/pcf/json/asc、目标频率、seed、placer/router、threads、report、SVG、时序失败容忍、未约束 IO、组合环、全局网络提升，以及上述补充选项。
   - 理由：这些选项让用户可以把警告升级为构建失败、输出更完整的时序数据，并调试三态驱动等较专业的问题。

5. 输出目录约定
   - 继续使用分阶段目录：`output/synthesis`、`output/pnr`、`output/bitstream`、`output/simulation`、`output/reports`。
   - 新增产物优先归档到 `output/reports`，例如 SVG、HTML、SDF、门级 Verilog。
   - 理由：报告与可视化产物集中管理，阶段中间文件仍保留在对应阶段目录，便于版本管理与问题定位。

## 仍待继续补齐的 CLI 覆盖

| 工作台 | 下一批建议补齐 | 说明 |
| --- | --- | --- |
| 综合 | `synth_ice40 -device`、`-dffe_min_ce_use`、多输出格式 `blif/edif/rtlil`、Yosys `stat`、`show`/Graphviz、外部脚本片段 | 当前已经覆盖常用策略开关，下一步应补“输出格式”和“图形网表”。 |
| 布局布线 | `--pre-pack`、`--pre-place`、`--pre-route`、`--post-route` Python hook，`--pack-only/no-place/no-route/no-pack` 分阶段运行 | 这些选项适合放入“专家模式”，需要明确提示会改变流程完整性。 |
| 比特流 | 不同架构的 packer 差异化选项、bitstream 校验摘要、bin/hash/manifest 归档 | 当前 iCE40 反解与可视化已补，后续要面向 ECP5/Gowin 做分支。 |
| 仿真/调试 | Icarus include/define/timescale，Verilator CFLAGS/LDFLAGS、线程、trace-fst，GTKWave/Surfer 会话文件 | 高级仿真要从“能运行”升级到“可配置仿真工程”。 |
| 报告 | Yosys stat 解析、nextpnr 详细时序提炼、SDF/资源统计汇总、构建时间线 | 目标是报告页能直接回答“失败在哪里、资源多少、时序差多少”。 |

## 第十轮升级记录

1. 仿真工作台专业化
   - 修改：仿真高级配置拆分为“输入与波形”“编译参数”“Verilator 专家参数”。
   - 新增：Include 目录、宏定义、Timescale、Verilator FST 波形、CFLAGS、LDFLAGS。
   - 修改：Icarus Verilog 会接收 `-I`、`-D`、`-Wall` 等配置；Verilator 在提供 C++ testbench 时切换到 `--cc --exe --build`，否则仍作为 lint/静态检查运行。
   - 理由：仿真不能只是一键跑固定命令，至少要能覆盖常见工程的 include、define、波形和 C++ testbench 配置。

2. nextpnr 专家模式
   - 新增：分阶段运行模式：完整布局布线、仅 Pack、跳过 Place、跳过 Route、跳过 Pack。
   - 新增：`pre-pack`、`pre-place`、`pre-route`、`post-route` Python hook 输入。
   - 理由：这些是 nextpnr CLI 的高级调试能力，适合放在折叠的专家兼容区，默认不干扰初学者流程。

3. 报告中心继续去日志化
   - 修改：综合成功后保存 `output/reports/<top>.yosys.log`。
   - 修改：icetime 成功后保存 `output/reports/<top>.icetime.log`。
   - 修改：报告中心会从 Yosys 日志中提炼 cells/wires/bits，从 icetime 日志中提炼 Fmax 和路径延迟。
   - 修改：报告中心新增打开 Yosys 日志、icetime 日志入口；摘要默认图形化展示，原始文本作为技术细节备用。
   - 理由：专业用户需要原始日志，但默认界面应该先回答“资源用了多少、时序大概如何”。

4. 后续建议
   - 把 Verilator 工作台和仿真工作台进一步合并配置来源，避免两个页面分别维护相似参数。
   - 为 nextpnr hook 增加文件浏览按钮和存在性校验。
   - 为报告中心增加构建时间线、资源趋势、失败原因分类。
   - 补齐 Yosys `show` 或 netlistsvg 图形网表入口，形成“RTL/门级/布局/布线”连续可视化链路。

## 第十一轮升级记录

1. nextpnr hook 可用性完善
   - 修改：`pre-pack`、`pre-place`、`pre-route`、`post-route` 增加文件浏览按钮。
   - 修改：运行布局布线前会检查已填写的 hook 文件是否存在，缺失时直接在 GUI 中给出结构化提示，不再等 nextpnr 报英文错误。
   - 理由：专家功能虽然高级，但也要尽量避免“路径输错才看日志”的命令行体验。

2. Verilator 与仿真配置复用
   - 修改：Verilator 工作台会复用仿真页的 include、define、timescale、CFLAGS、LDFLAGS 和 FST trace 配置。
   - 修改：当选择非 lint 模式且提供 C++ testbench 时，Verilator 使用 `--cc --exe --build`，否则保持轻量的 `--cc` 或 `--lint-only`。
   - 理由：仿真页和 Verilator 页本质上共享同一套工程编译环境，分散维护会让参数不一致。

3. 报告中心时间线
   - 修改：Pipeline 记录每个阶段最后一次状态更新时间。
   - 修改：报告中心新增“构建时间线”，显示检查、综合、布局布线、比特流、时序、资源、烧录、仿真、验证等阶段的状态、时间和失败详情。
   - 理由：用户需要快速知道“哪一步刚跑过、哪一步失败、失败详情是什么”，而不是翻各个工作台。

4. 网表图入口评估
   - 检查：当前本机 OSS CAD Suite `bin` 中未发现 `netlistsvg` 或 Graphviz `dot`。
   - 结论：暂不添加依赖缺失的假入口；后续可做两种方案：一是提示用户安装 Graphviz/netlistsvg，二是内置一个基于 Yosys JSON 的简化网表浏览器。

## 第十二轮升级记录：高级 CLI 参数覆盖

本轮只做高级参数覆盖，不改其它工作流体验。

1. 综合工作台
   - 新增 `-abc9`、`share -aggressive`、ECP5 `-no-serdes`、Gowin RAM 避让映射入口。
   - 已有并继续保留：`-noabc`、`-abc2`、`-noabc9`、`-nocarry`、`-nodffe`、`-no-rw-check`、`-nobram`、`-spram`、`-dsp`、`-dff`、`-retime`、`flatten`、`splitnets`、`fsm`、`memory`、`proc`、`opt`。
   - 代码按 family 判断部分参数，只在 iCE40/ECP5/Gowin 相关工具中加入对应参数。

2. 布局布线工作台
   - iCE40：继续使用 `nextpnr-ice40`，覆盖 device/package/pcf/json/asc/freq/seed/report/svg/sdf/detailed timing/Werror/no-tmdriv/阶段运行/hook。
   - ECP5：切换为 `nextpnr-ecp5` 参数形态，输出 `output/pnr/<top>.config`，使用 `--textcfg`、`--lpf`、`--speed`、`--freq`、`--seed`、`--report`、SVG 等参数。
   - Gowin：切换为 `nextpnr-himbaechel` 参数形态，输出 `output/pnr/<top>.pnr.json`，使用 `--device`、`--package`、`--write`、`--vopt cst=...`、`ignore_timing`、`dont_use_ram`、`dont_use_dsp` 等参数入口。
   - 新增 GUI 参数：ignore timing、no-serdes、dont-use-ram、no-dsp、LPF、CST、速度等级。

3. 比特流工作台
   - iCE40：继续使用 `icepack`，保留反解、门级 Verilog、HTML 可视化入口。
   - ECP5：使用 `ecppack`，新增 `--compress`、`--crc`、`--svf`、`--flash`、`--background`、`--freq`、`--idcode`、`--key` 等入口，输出扩展名改为 `.bit`。
   - Gowin：使用 `gowin_pack`，新增 compress、CRC、key 等入口，输出扩展名改为 `.fs`。
   - 报告中心和烧录阶段同步识别 iCE40 `.bin`、ECP5 `.bit`、Gowin `.fs`。

4. 烧录工作台
   - 新增 openFPGALoader 参数入口：写 Flash、外部 Flash、下载后 reset、cable、board override、JTAG 频率、Flash offset。
   - 新增 `ecpprog` 烧录方式与基础检测入口，ECP5 板卡默认工具可以更准确地落到 `ecpprog`。
   - 仍保留：icesprog、DFU、JTAG、拖拽盘符、跳过预检测、verify。

5. 仍需注意
   - OSS CAD Suite 版本间参数支持可能有差异，后续应在工具链检测页增加“参数能力探测”，按实际 `--help` 或试运行结果灰显不支持的开关。
   - ECP5/Gowin 的高级参数比 iCE40 更依赖具体器件和工具版本，建议下一轮做“按 family 动态显示/禁用参数”，避免用户在不适用架构下误勾。

## 第十三轮升级记录：参数能力探测与宽屏工作台

1. 参数能力探测
   - 修改：主进程工具链探测支持 `featureArgs` 与 `features`，在版本检测后继续读取工具帮助输出，并按 token 判断参数是否存在。
   - 修改：工具链页为 `nextpnr-*`、`ecppack/gowin_pack/icepack` 增加参数能力探测，工具卡显示“参数能力 x/y”。
   - 修改：P&R 和比特流工作台会根据最近一次能力探测结果灰显未确认支持的高级选项，例如 SDF、detailed timing、no-serdes、SVF、Flash、background、freq、idcode、key 等。
   - 理由：OSS CAD Suite 不同版本的命令行参数可能有差异，GUI 不能假设每个开关一定可用。

2. 宽屏工作台布局
   - 修改：移除 `.panel-body` 的 `max-width: 880px` 限制，工作台内容现在会使用右侧可用宽度。
   - 修改：主工作区左右 padding 改为响应式 `clamp`，工具链卡片、工作台信息卡、报告卡、高级选项网格的最小列宽重新规划。
   - 修改：高级选项灰显时追加“当前工具未确认支持”的小提示。
   - 理由：左侧菜单保留，但右侧工作区不应该在全屏时仍是一条窄列，尤其高级参数页面需要更大的横向信息密度。

3. 后续建议
   - 参数能力探测目前基于帮助文本 token，下一步可以增加“按 family 的参数分组显示/隐藏”，让不属于当前芯片族的选项直接折叠或隐藏。
   - 对一些帮助文本输出不完整的工具，可以增加轻量 dry-run 能力测试，避免误灰显。

## 第十四轮升级记录：板卡选择向导与板卡包扩充

1. 板卡选择界面
   - 修改：板卡页改为“先选芯片族，再选具体板卡”的向导式布局。
   - 新增：芯片族筛选标签，当前覆盖全部、Lattice iCE40、Lattice ECP5、Gowin。
   - 新增：板卡搜索框，可以按板卡名、厂商、描述、FPGA family/device/package 搜索。
   - 修改：右侧详情面板改为 sticky 详情卡，显示厂商、芯片族、器件、封装、时钟、LED、按键、UART 和说明。
   - 理由：板卡数量增加后，单纯平铺会变乱；按芯片族进入更符合 FPGA 工具链选择逻辑。

2. 新增板卡包
   - `upduino-v3.yaml`：UPduino v3，iCE40UP5K/SG48。
   - `ulx3s-85f.yaml`：ULX3S 85F，ECP5 85K/CABGA381。
   - `tang-nano-4k.yaml`：Tang Nano 4K，Gowin GW1NSR-4C/QFN48。
   - `custom-ice40-up5k.yaml`：通用 iCE40 UP5K 模板。
   - `custom-ecp5.yaml`：通用 ECP5 模板。
   - `custom-gowin.yaml`：通用 Gowin 模板。

3. 数据保守策略
   - 对新增真实板卡，只写入高置信的器件、封装、工具链和烧录方式。
   - 不确定的 LED、按键、UART 引脚不硬填，避免 Vflux 自动生成错误约束；用户应以官方原理图或示例工程维护 PCF/LPF/CST。
   - Custom 模板用于暂未收录板卡先进入正确 family 流程，再由用户补约束。

## 第十五轮升级记录：例程工作台与快速验收工程

1. 例程工作台
   - 新增左侧“例程”工作台。
   - 用户选择目标父目录后，可以把内置例程复制成普通 Vflux 工程，并自动打开该工程。
   - 创建成功后自动进入“一键构建”页面，方便立即跑检查、综合、布局布线和比特流生成。

2. 内置例程
   - `icesugar-blinky`：iCESugar/iCE40UP5K 点灯例程，包含 `src/top.v`、`constraints/top.pcf`、`project.vflux.yaml`，用于端到端构建验收。
   - `verilog-counter-sim`：纯 Verilog 计数器仿真例程，包含 testbench 和 VCD 输出配置，用于快速测试 Icarus/VVP/波形流程。

3. 工程与打包
   - `package.json` 已把 `examples/**/*` 加入打包文件列表，预览版 exe 会包含内置例程。
   - 主进程新增 `example:list` 和 `example:createProject` IPC，创建例程时会复制目录、删除 `example.yaml` 元数据，并把工程配置中的 `project.directory` 改成目标目录。
   - 仿真配置新增 `testbench` 字段，仿真例程可以自动带入 TB 路径。

4. 后续建议
   - 给每个芯片族补一个真实可构建例程：ECP5/ULX3S 或 iCESugar-pro、Gowin/Tang Nano。
   - 例程卡片后续可以显示“需要硬件/仅仿真/可烧录”等标签，并在缺工具链时提示先去工具链页检测。

## 第十六轮升级记录：三芯片族例程与波形打开修复

1. 例程覆盖
   - 新增 `icesugar-pro-blinky`：ECP5/iCESugar-pro 点灯例程，包含 Verilog、LPF、工程配置，输出目标为 `.bit`。
   - 新增 `tang-nano-9k-blinky`：Gowin/Tang Nano 9K 点灯例程，包含 Verilog、CST、工程配置，输出目标为 `.fs`。
   - 现在例程工作台覆盖 iCE40、ECP5、Gowin 和纯仿真四类快速测试入口。

2. 波形打开修复
   - 问题：计数器仿真例程生成 VCD 后，点击“打开波形”时 GTKWave 在部分 Windows 环境会 assertion failed。
   - 修改：仿真工作台打开波形前先确认 `output/simulation/dump.vcd` 存在。
   - 修改：优先使用 Surfer 打开 VCD，失败后再尝试 GTKWave；两者都失败时给出结构化中文反馈，并建议切到波形查看工作台手动选择文件。
   - 理由：Surfer 是 OSS CAD Suite 中更现代的波形查看器，作为默认打开路径更稳妥。

3. Gowin P&R 补充
   - 修改：Gowin/Himbaechel P&R 命令增加 family 推断，通过 `--vopt family=...` 传入 GW1N/GW2A 族信息。
   - 理由：Gowin 器件型号和 family 信息都影响 himbaechel 后端选择。

## 第十七轮升级记录：例程一键验收与报告中心雏形

1. 例程工作台
   - 修改：例程卡片拆成两个动作：“创建并打开”和“创建并验收”。
   - 新增：“创建并验收”会复制例程、打开工程、进入一键构建，并自动跑核心流程。
   - 理由：用户第一次使用 Vflux 时，需要一个可重复的一键验收入口，而不是只创建工程后再手动找构建按钮。

2. 一键构建验收
   - 修改：一键构建现在会按当前芯片族动态组织步骤。
   - 核心步骤：检查、综合、布局布线、生成比特流。
   - iCE40 附加步骤：时序分析、资源图与统计。
   - 新增：构建结束后写入 `output/reports/vflux-acceptance.json`，记录工程、板卡、输出文件、流水线状态、开始/结束时间和停止位置。
   - 理由：验收报告是后续自动测试、打包前自检和用户问题复现的基础数据。

3. 报告中心
   - 新增：“验收结论”报告卡片，读取 `vflux-acceptance.json` 并显示最近一次验收是否通过。
   - 修复：报告中心根据芯片族识别 P&R 产物扩展名：iCE40 `.asc`、ECP5 `.config`、Gowin `.pnr.json`。
   - 新增：构建产物中可直接打开验收 JSON。
   - 理由：报告中心不应只是日志入口，而要成为用户判断工程状态的专业摘要面板。

4. 文本修复
   - 修复：`examples.js`、`build-all.js`、`report.js` 中若干中文提示乱码。
   - 理由：这些提示直接面向用户，乱码会破坏“去命令化”和专业感。

5. 下一步建议
   - 在工具链页面增加“环境验收”按钮：检测 Yosys、nextpnr、pack、program、仿真器、波形工具和常见 DLL/PATH 问题。
   - 给报告中心增加 HTML 导出，把当前 JSON 验收结论、资源、时序、产物链接整理成可分享报告。
   - 对例程验收增加“仅软件流程/需要硬件烧录”的分级，避免没有板卡时误把烧录失败当成构建失败。

## 第十八轮升级记录：工具链环境验收

1. 工具链页面
   - 修改：“检测工具链能力”升级为“运行环境验收”。
   - 新增：环境验收结果卡片，按综合、布局布线、比特流生成、烧录/下载、仿真、波形查看、验证与调试、图形化产物分组展示。
   - 新增：每组显示“通过 / 需要处理 / 可选缺失 / 检测中”，避免用户只看到一堆 exe 名称。
   - 理由：Vflux 的目标是替代散乱命令行体验，工具链页也应按 FPGA 开发流程表达可用性。

2. 验收报告
   - 新增：工具链验收结果会写入 `output/reports/toolchain-acceptance.json`。
   - 报告内容包含芯片族、分组结论、每个工具的实际命令、版本/失败原因、可选能力缺失情况。
   - 理由：用户反馈环境问题时，可以直接提供 JSON，后续也能用于打包前自检。

3. 报告中心联动
   - 修改：报告中心“验收结论”卡片现在会显示工具链环境通过数量。
   - 新增：构建产物区域可打开 `toolchain-acceptance.json`。
   - 理由：工程验收和环境验收应该互相可追溯，避免构建失败时分不清是工程问题还是环境问题。

4. 主进程 probe 修复
   - 修改：工具进程异常退出且没有任何版本输出时，不再误判为可用。
   - 理由：缺 DLL、路径污染、运行库问题常表现为工具能启动但立刻失败，必须在环境验收里暴露出来。

5. 下一步建议
   - 增加“导出 HTML 报告”，把工程验收、工具链验收、资源、时序和产物链接汇总成一个可分享页面。
   - 增加烧录专用诊断向导，区分 DFU、FTDI、openFPGALoader、拖拽盘符和驱动问题。
   - 对高级选项增加“解释侧栏”，显示选项作用、对应 CLI 参数、适用芯片族和风险提示。

## 第十九轮升级记录：HTML 工程报告导出

1. 报告中心
   - 新增：“导出 HTML 报告”按钮。
   - 新增：构建产物区域增加“查看 HTML 报告”入口。
   - 导出路径：`output/reports/vflux-report.html`。
   - 理由：JSON 适合机器读取，但用户更需要一个可以直接打开、截图、分享的工程报告页面。

2. HTML 报告内容
   - 包含：工程名称、工程目录、顶层模块、板卡、FPGA family/device/package、源文件数、约束文件。
   - 包含：工程验收结论、工具链验收结论、开始/完成时间、停止位置。
   - 包含：综合网表、布局文件、比特流、Yosys 摘要、nextpnr 摘要、icetime 摘要。
   - 包含：工具链分组能力表和流水线状态表。
   - 包含：报告目录下已生成的产物列表。

3. 实现策略
   - HTML 报告使用自包含样式，不依赖外部 CSS 或 JS，双击文件即可查看。
   - 文本统一 HTML 转义，避免工程路径、文件名或工具输出破坏报告结构。
   - 生成后自动刷新报告中心并打开 HTML 文件。

4. 下一步建议
   - 增加烧录专用诊断向导，尤其针对 iCESugar 的 DFU/拖拽烧录/FTDI/openFPGALoader 分支。
   - 给高级选项做解释侧栏，显示“作用、CLI 参数、适用芯片族、风险提示、默认建议”。
   - 给报告中心增加可视化预览区，直接嵌入布局 SVG、布线 SVG 和 Floorplan HTML。

## 第二十轮升级记录：专业化功能补齐与界面沉稳化

1. 烧录诊断向导
   - 新增：烧录工作台增加“烧录诊断向导”按钮。
   - 新增：诊断会检查目标板卡、比特流文件、烧录方式、设备连接或拖拽盘符。
   - 新增：诊断结果以卡片显示，并写入 `output/reports/program-diagnostic.json`。
   - 新增：针对 DFU、FTDI/icesprog、openFPGALoader 给出不同失败建议。
   - 理由：iCESugar 等板卡经常出现“DFU 能看到、下载瞬间消失、命令行误判失败”的情况，需要把设备重枚举和真实失败区分开。

2. 高级选项解释侧栏
   - 新增：综合、布局布线、烧录工作台增加参数解释侧栏。
   - 点击/聚焦高级选项时，会显示作用、对应 CLI 参数、适用芯片族和风险提示。
   - 当前覆盖重点参数：ABC9、multishare、FSM、splitnets、BRAM/SERDES/RAM 避免、ignore timing、SVG/report、no DSP、DFU alt、skip detect、Flash、Board 覆盖等。
   - 理由：专业化不是堆开关，用户需要知道每个开关为什么存在、什么时候该用。

3. 报告中心图形预览入口
   - 新增：“图形预览”卡片，集中打开 placed SVG、routed SVG、Floorplan HTML、门级 Verilog 和 HTML 报告。
   - 理由：把图形化产物入口集中到报告中心，减少用户去 output 目录找文件。

4. 项目导入向导
   - 新增：工程页增加“导入现有工程”按钮。
   - 新增：主进程提供约束文件扫描能力，覆盖 `.pcf`、`.lpf`、`.cst`、`.sdc`、`.xdc`。
   - 导入时会扫描 HDL 源文件、约束文件，并自动推断顶层模块。
   - 理由：打开 TinyRISC-V 这类已有工程时，应尽量减少手动添加文件和猜顶层模块的工作。

5. 板卡包草稿导出
   - 新增：板卡详情中增加“导出板卡包草稿”按钮。
   - 草稿会写入当前工程的 `boards/<board>.yaml`，避免直接修改软件内置 boards 目录。
   - 理由：这是板卡包编辑器的第一步，先让用户可以从已有板卡复制结构并补资源。

6. 开发者验收脚本
   - 新增：`scripts/validate-examples.js`。
   - 新增：`npm run validate:examples`，静态检查所有内置例程是否包含元数据、工程文件、源文件和约束文件。
   - 理由：打包前至少保证内置例程不会因为路径或文件缺失而无法创建。

7. GUI 风格调整
   - 调整：整体色彩从偏亮青绿色改为更低饱和、沉稳的深色工作台风格。
   - 调整：顶部栏、按钮、卡片、背景和引导区降低装饰感，强调工程工具的专业感。
   - 新增：诊断卡片、选项解释侧栏、工具提示区域样式。

8. 后续建议
   - 板卡包编辑器下一步应支持完整表单编辑和校验，而不仅是导出草稿。
   - 高级选项解释应继续扩充到仿真、形式验证、MCY、Verilator。
   - 报告中心后续可以把 SVG/HTML 直接嵌入预览，而不是只打开外部文件。

## 第二十一轮升级记录：左侧工作流分组折叠

1. 左侧菜单
   - 新增：准备、构建、分析、验证与调试四个大类现在可以点击折叠/展开。
   - 新增：折叠状态保存到 `localStorage`，下次打开 Vflux 会恢复用户的侧栏习惯。
   - 新增：如果通过顶部菜单或程序逻辑切换到某个被折叠分组内的页面，Vflux 会自动展开对应分组。
   - 理由：当前工作台数量已经接近第一版试用版规模，侧栏必须支持按阶段收纳，否则信息密度会显得乱。

2. 试用版状态
   - iCESugar 已确认可通过拖拽盘符完成烧录，说明 iCE40 点灯例程具备实际硬件闭环。
   - 左侧折叠完成后，第一版试用版还应重点做一次打包前验收：例程静态检查、工具链环境验收、iCESugar 点灯构建、拖拽烧录路径确认。

## 第二十二轮升级记录：0.9 Windows 试用版准备

1. 多文件例程
   - 新增 `icesugar-multifile-counter` 例程。
   - 覆盖：多个 Verilog 文件、`include` 宏定义头文件、子模块层次、iCESugar 约束、拖拽盘符烧录配置。
   - 关键文件：`src/vflux_defs.vh`、`src/prescaler.v`、`src/led_chaser.v`、`src/top.v`。
   - 理由：第一版试用版不能只验证单文件点灯，还要验证更接近真实工程的多文件组织方式。

2. 板卡包扩充
   - 新增 `colorlight-i5-25f.yaml`：ECP5 25K 常见模板。
   - 新增 `tinyfpga-bx.yaml`：iCE40LP8K 模板。
   - 新增 `ulx3s-45f.yaml`：ECP5 45K 模板。
   - 新增 `custom-ice40-hx8k.yaml`、`custom-ecp5-45f.yaml`、`custom-gowin-gw2a-18.yaml`。
   - 策略：对引脚资源不高置信的板卡不硬填 LED/按键/时钟，避免自动生成错误约束。

3. 打包准备
   - `package.json` 版本号提升到 `0.9.0`。
   - 新增脚本：
     - `npm run release:check`
     - `npm run pack:win`
     - `npm run pack:linux`
   - Windows 目标为 portable；Linux 预留 AppImage。
   - 移除缺失的 `assets/icon.ico` 引用，避免 Windows 打包阶段因为图标文件不存在而失败。

4. 0.9 清单
   - 新增 `docs/release-0.9-windows-checklist.md`。
   - 记录打包前检查、GUI 验收步骤、Windows portable 打包命令、0.9 已知边界和 1.0 建议。

5. 验收脚本增强
   - `validate-examples.js` 增加板卡包存在性检查。
   - 理由：例程如果引用了不存在的 board yaml，创建工程时会表现为 GUI 问题，打包前应提前发现。

## 第二十三轮升级记录：图标接入与浅色主题

1. 图标资源
   - 用户提供的 `tabler_letter-v (1).png` 已整理为 `assets/icon.png`。
   - 新增 `assets/icon.ico`，用于 Windows portable exe 图标。
   - GUI 顶部 logo 改为显示 `assets/icon.png`。
   - `index.html` 增加 favicon 引用。

2. 打包配置
   - `package.json` 的打包文件列表加入 `assets/**/*`。
   - Windows 打包配置使用 `assets/icon.ico`。
   - Linux 打包配置使用 `assets/icon.png`。
   - 理由：0.9 试用版需要在系统任务栏、文件图标和 GUI 内保持统一识别。

3. 浅色主题
   - 新增“浅色主题/深色主题”切换按钮，位于顶部“视图”菜单。
   - 浅色主题使用米黄色和淡紫色：
     - 背景主色 `#f7f0df`
     - 面板背景 `#fffaf0`
     - 输入背景 `#f3ead9`
     - 边框 `#d9cdbb`
     - 主文字 `#28222d`
     - 强调色 `#9f8bd3`
     - 强调悬停 `#7f68bd`
   - 主题选择保存到 `localStorage`，下次打开会恢复。

4. 验证
   - JS 语法检查通过。
   - DOM 引用检查通过。
   - `npm run release:check` 通过。

## 第二十四轮升级记录：打包前收口修复

1. 图形化预览
   - 修复：报告中心“图形预览”卡片现在可以点击打开对应 SVG/HTML/Verilog/HTML 报告产物。
   - 原因：此前点击监听只绑定在“构建产物”区域，图形预览区域复用了按钮但没有绑定事件。

2. 工具链自动检测
   - 修改：进入“工具链”页面后会自动运行环境验收。
   - 修改：检测前会先应用当前工程中的 OSS CAD Suite 路径。
   - 修改：工具链路径提示改为“自动搜索 OSS CAD Suite，或手动选择安装目录”，不再暗示软件内置工具链。

3. 打包策略
   - 修改：`package.json` 移除 `extraResources` 中的 OSS CAD Suite 打包项。
   - 修改：打包文件列表加入 `README*.md` 和 `docs/**/*`。
   - 理由：0.9 试用版不内置 OSS CAD Suite，用户需自行安装并在 Vflux 中选择路径。

4. 自定义板卡 GUI
   - 新增：板卡页加入“图形化创建自定义板卡包”表单。
   - 用户可填写板卡名称、厂商、芯片族、器件、封装、speed、时钟、LED、按键和烧录工具。
   - 保存后会写入当前工程目录的 `boards/*.yaml`，并立即选择为当前板卡。
   - 主进程 `board:list` / `board:load` 现在支持读取工程目录下的板卡包，工程板卡以 `project:boards/...` 标识。

5. README
   - 更新中文 README，明确 OSS CAD Suite 需用户自行安装。
   - 新增英文 README：`README.en.md`。
   - README 中说明当前已支持基础 GUI 自定义板卡包，复杂板卡仍可继续手动编辑 YAML。

6. 顶部菜单与浅色主题
   - 顶部菜单移动到 logo 右侧，更接近传统工程软件的左上菜单布局。
   - 修复浅色主题下顶部栏、侧边栏、状态栏仍偏深的问题。

## 第二十五轮升级记录：英语界面与 GitHub 发布准备

1. 英语界面
   - 新增 `renderer/i18n.js`。
   - 新增首次启动语言选择弹窗，支持中文界面和 English UI。
   - 顶部“视图”菜单新增语言切换按钮。
   - 语言选择保存到 `localStorage`，再次打开会恢复。
   - 当前翻译覆盖主菜单、左侧工作流、主要工作台标题、按钮、表单标签、占位符和常见静态文案。
   - 动态工具诊断文本仍以中文为主，后续可继续精翻。

2. 工具链与图形预览
   - 工具链页进入后自动检测已保留。
   - 报告中心图形预览点击修复已保留。

3. GitHub 准备
   - 新增 `.gitignore`，排除 `node_modules/`、`dist/`、临时文件和用户原始图标源文件。
   - 新增 `docs/github-release-checklist.md`，记录 Git 初始化、推送、Windows portable 构建和 GitHub Release 文案。
   - `package.json` 保持不打包 OSS CAD Suite。

4. README
   - 中文 README 增加中英文界面说明。
   - 英文 README 增加中英文界面说明。

5. 验证
   - JS 语法检查通过。
   - DOM 引用检查通过。
   - `npm run release:check` 通过。
   - GitHub/package 准备检查通过。
## 第二十六轮升级记录：0.9 工具链记忆与报告产物修复

1. OSS CAD Suite 路径记忆
   - 修改：新建工程会自动沿用上一次保存的 OSS CAD Suite 路径。
   - 修改：打开已有工程时，如果工程文件里有工具链路径，会同步写入本机全局偏好。
   - 修改：工具链页面刷新时会优先使用全局路径，避免每个新工程第一次进入工具链页都重新变红。
   - 修改：自动搜索 OSS CAD Suite 成功后会把搜索结果写入全局偏好。
   - 理由：OSS CAD Suite 是机器级安装位置，不应该被每个工程割裂保存，否则 0.9 试用版体验会显得不稳定。
2. 工具链自动检测
   - 修改：进入工具链工作台时，自动检测的缓存 key 加入工程目录。
   - 修改：只有在同一工程、同一工具链路径、同一板卡族，并且当前工具链状态已成功时，才跳过重复检测。
   - 理由：切换工程后应该重新确认状态，但已经成功的同一环境不需要反复跑。
3. 报告工作台产物显示
   - 修改：报告页现在只给真实存在的 SVG、SDF、门级 Verilog、Floorplan HTML、HTML 报告显示打开按钮。
   - 修改：SDF、门级 Verilog、内部布线 HTML、HTML 总报告会明确显示“已生成/未生成”。
   - 修改：图形预览区域不再展示不存在的产物按钮，而是提示用户到对应工作台启用输出后重新构建。
   - 理由：报告中心应该是“事实面板”，不能把尚未生成的可选产物伪装成可打开入口。
4. 一键验收报告
   - 修改：一键构建/例程验收成功后，会自动生成 `output/reports/vflux-report.html`。
   - 理由：用户跑完例程后进入报告工作台，应立即看到可分享、可打开的 HTML 总报告，而不是手动补导出。
5. 仿真波形入口
   - 修改：仿真结束后会扫描 `output/simulation` 下的 `.vcd` / `.fst` 文件，找到真实波形后才提示“可打开波形”。
   - 修改：打开波形不再固定依赖 `dump.vcd`，会优先识别 `dump.vcd`、`wave.vcd`、`sim.vcd`、`dump.fst`、`wave.fst`、`sim.fst`，再匹配其它 VCD/FST 文件。
   - 修改：如果仿真成功但没有波形产物，会提示检查 Testbench 中的 `$dumpfile` / `$dumpvars`，而不是让用户点开一个不存在的文件。
   - 理由：仿真“运行成功”和“生成波形成功”是两件事，GUI 必须把这两个状态分清。
6. 验证
   - `node --check renderer/config.js` 通过。
   - `node --check renderer/panels/toolchain.js` 通过。
   - `node --check renderer/panels/report.js` 通过。
   - `node --check renderer/panels/simulation.js` 通过。
   - `node --check renderer/panels/build-all.js` 通过。
   - `npm run release:check` 通过。

## 第二十七轮升级记录：专业工程骨架生成

1. 新建工程
   - 新增：新建工程弹窗加入“同时生成 SDC/TCL/VH/形式验证等专业工程骨架”选项，默认开启。
   - 新增：创建工程时除顶层 RTL、Testbench、板卡 PCF 外，还会生成常用高级工程文件。
   - 理由：0.9 试用版面向学习和专业化过渡，用户新建工程时应该直接得到接近真实 FPGA 项目的目录结构。
2. 例程工程
   - 新增：例程工作台加入“同时补齐专业工程骨架”选项，默认开启。
   - 新增：复制内置例程时可自动补齐高级骨架文件，但不会覆盖例程已有文件。
   - 理由：例程既要能一键跑通，也应该能作为用户继续扩展的工程起点。
3. 生成文件
   - `src/vflux_defs.vh`：工程级宏定义头文件。
   - `constraints/<top>.sdc`：可选时序约束文件。
   - `constraints/README.md`：约束目录说明。
   - `scripts/yosys_extra.ys`：可选 Yosys 脚本片段。
   - `scripts/nextpnr_pre_pack.py`、`nextpnr_pre_place.py`、`nextpnr_pre_route.py`、`nextpnr_post_route.py`：nextpnr hook 脚本占位。
   - `formal/<top>.sby`：SymbiYosys 形式验证配置草稿。
   - `mcy/<top>.cfg`：MCY 覆盖配置草稿。
   - `docs/design-notes.md`：工程设计记录。
4. 实现策略
   - 骨架生成只创建缺失文件，不覆盖用户或例程已有文件。
   - 空的 `.sdc` 会生成在约束目录中，但不会自动加入主约束列表，避免 iCE40 流程把它误当 PCF 传给 nextpnr。
   - `project:createDir` 同步创建 `scripts`、`formal`、`mcy`、`docs` 目录。
5. 验证
   - `node --check src/main.js` 通过。
   - `node --check src/preload.js` 通过。
   - `node --check renderer/panels/new-project-modal.js` 通过。
   - `node --check renderer/panels/examples.js` 通过。
   - `npm run release:check` 通过。

## 第二十八轮升级记录：Linux OSS CAD Suite 适配起步

1. OSS CAD Suite 路径识别
   - 修改：工具链根目录校验不再只认 `environment.bat`。
   - 新增：支持 Linux 常见的 `environment` 和 `environment.sh`。
   - 新增：自动搜索会检查 `YOSYSHQ_ROOT`、`OSS_CAD_SUITE`、`~/oss-cad-suite`、`/opt/oss-cad-suite` 等路径。
   - 理由：Linux 版 OSS CAD Suite 和 Windows 版目录结构相似，但环境入口文件不同。
2. 工具命令跨平台解析
   - 修改：主进程运行工具时会同时尝试 `tool.exe` 和 `tool` 两种名称。
   - 修改：Linux 下 renderer 传入的 `yosys.exe`、`nextpnr-ice40.exe`、`icepack.exe` 等会解析为无扩展名可执行文件。
   - 修改：工具链验收页在 Linux 下显示无 `.exe` 的工具名。
   - 理由：上层 GUI 可以继续复用原有流程，底层根据平台自动选择真实可执行文件。
3. 环境变量
   - 修改：`PATH` 使用 `path.delimiter` 组装，Windows 为 `;`，Linux 为 `:`。
   - 修改：`PYTHON_EXECUTABLE` 在 Windows 使用 `python3.exe`，Linux 使用 `python3`。
   - 保留：`YOSYSHQ_ROOT`、`QT_PLUGIN_PATH`、`OPENFPGALOADER_SOJ_DIR`、`SSL_CERT_FILE` 等 OSS CAD Suite 运行所需变量。
4. 文档
   - 新增 `docs/linux-1.0-adaptation.md`。
   - 记录 Linux OSS CAD Suite 目录要求、运行时变化、AppImage 打包命令和 1.0 Linux 验收清单。
5. 后续建议
   - 增加 Linux 烧录权限诊断，尤其是 udev 规则、USB/JTAG 权限、用户组权限。
   - 在 README 中补充 Linux OSS CAD Suite 安装与 USB 权限说明。
   - 在 Ubuntu LTS 和至少一个滚动发行版上验证 AppImage。

## 第二十九轮升级记录：1.0 工程稳定性收口

1. 工程 schema
   - 新增：工程配置根节点加入 `schema_version` 和 `app_version`。
   - 新增：新建工程、保存工程时会写入 `schema_version: 1`。
   - 新增：打开旧工程时会自动补默认 schema，保存后即可升级为 1.0 工程格式。
   - 理由：1.0 以后工程文件需要可迁移、可验证，不能继续依赖隐式字段。
2. 工程体检
   - 新增：顶部“工程”菜单加入“工程体检”入口。
   - 新增：工程页加入“工程体检”按钮和结果面板。
   - 检查项包括：工程格式、工程名称、工程目录、源文件、约束文件、顶层模块、板卡包、OSS CAD Suite 路径、输出目录可写性。
   - 体检结果写入 `output/reports/project-health.json`。
   - 理由：代码检查和工程健康检查是两类问题，1.0 需要把“工程是不是配置完整”单独可视化。
3. 诊断包导出
   - 新增：报告中心加入“导出诊断包”按钮。
   - 导出目录位于 `output/reports/vflux-diagnostic-<timestamp>`。
   - 包含：工程配置、验收 JSON、工具链验收 JSON、工程体检 JSON、烧录诊断 JSON、HTML 报告、报告目录下的日志和可视化产物摘要。
   - 策略：默认不主动复制完整 RTL 源码，减少用户反馈问题时泄露设计源码的风险。
4. iCESugar 烧录体验
   - 修改：当烧录方式为“板卡默认”且板卡名包含 iCESugar 时，默认使用“拖拽盘符”路径。
   - 理由：实测 iCESugar 拖拽盘符已经能稳定烧录，1.0 应把可用路径放在最前面，而不是让用户反复面对 FTDI/DFU 检测失败。
5. 验证
   - `node --check src/main.js` 通过。
   - `node --check src/preload.js` 通过。
   - `node --check renderer/config.js` 通过。
   - `node --check renderer/app.js` 通过。
   - `node --check renderer/panels/project.js` 通过。
   - `node --check renderer/panels/report.js` 通过。
   - `node --check renderer/panels/program.js` 通过。
   - `npm run release:check` 通过。

## 第三十轮升级记录：首次启动向导与 1.0 发布清单

1. 首次启动向导
   - 新增 `renderer/onboarding.js`。
   - 新增 Vflux 1.0 启动向导弹窗，引导用户完成界面设置、OSS CAD Suite 配置、创建工程或运行例程。
   - 向导会等待语言选择完成后再显示，避免首次启动多个弹窗叠加。
   - 支持“下次不再显示”，状态保存到 `localStorage`。
   - 理由：1.0 面向更广泛用户，必须让第一次打开软件的人知道下一步该做什么。
2. 错误诊断词典扩充
   - 扩充重复定义、多重驱动、锁存器推断、include 缺失、重复约束、未知器件/封装、USB 权限、工具链命令缺失、波形文件缺失等规则。
   - 理由：失败时不能只给英文日志，应尽量把常见失败归类成用户能理解的修复方向。
3. 1.0 发布文档
   - 新增 `docs/release-1.0-checklist.md`。
   - 覆盖干净构建、首次启动、工具链、工程流程、例程、报告、烧录、UI、打包、Release notes。
   - 新增 `docs/vflux-1.0-roadmap.md`。
   - 明确 1.0 核心目标、可选目标和不强求范围。
4. 验证建议
   - 下一次打包前按 `docs/release-1.0-checklist.md` 逐项人工验收。

## 第三十一轮升级记录：1.0 内置例程扩展

1. PWM 呼吸灯例程
   - 新增 `examples/icesugar-pwm-breathing`。
   - 包含 `example.yaml`、`project.vflux.yaml`、`README.md`、`constraints/top.pcf`、`src/top.v`。
   - 目标：展示 PWM、占空比渐变、寄存器计数器和 iCESugar 拖拽烧录流程。
2. 按键消抖例程
   - 新增 `examples/icesugar-button-debounce`。
   - 包含 `src/debounce.v` 和 `src/top.v`，覆盖同步、消抖计数和边沿检测。
   - 目标：给用户一个输入外设工程模板，而不仅是输出 LED。
3. UART echo 例程
   - 新增 `examples/icesugar-uart-echo`。
   - 包含 `src/uart_rx.v`、`src/uart_tx.v` 和 `src/top.v`。
   - 默认 12 MHz / 115200 baud，使用 iCESugar 板卡包中的 UART 引脚。
   - 目标：提供多模块串口工程模板，后续可扩展为调试串口或简单通信例程。
4. 验证
   - `npm run release:check` 通过。
   - `node --check scripts/validate-examples.js` 通过。
   - 当前环境 PATH 中未找到 Yosys，因此新增 HDL 例程的 Yosys 语法烟测已跳过，后续应在配置 OSS CAD Suite 后用一键验收实跑。

## 第三十二轮升级记录：FSM 仿真例程与 README 例程清单

1. FSM 仿真例程
   - 新增 `examples/verilog-fsm-sim`。
   - 包含 `traffic_fsm.v` 和 `tb_traffic_fsm.v`。
   - 目标：演示纯 Verilog 状态机、testbench、VCD 波形生成和仿真工作台。
2. README 更新
   - 中文 README 和英文 README 的内置例程表已加入：
     - iCESugar PWM Breathing LED
     - iCESugar Button Debounce
     - iCESugar UART Echo
     - Verilog FSM Simulation
3. 验证
   - `npm run release:check` 通过。
   - `node --check scripts/validate-examples.js` 通过。

## 第三十三轮升级记录：板卡包体检与例程验收加严

1. 自定义板卡包体检
   - 新增：板卡选择页的“图形化创建自定义板卡包”表单会在输入时自动显示体检结果。
   - 检查内容包括：板卡名称、芯片族、器件型号、封装、常见器件/封装格式、烧录工具与芯片族匹配度、时钟频率格式、重复引脚、LED/按键/时钟资源完整度。
   - 保存策略：必填字段缺失或重复引脚会阻止保存；不常见器件、封装、烧录工具会给出建议但允许继续。
   - 理由：自定义板卡包是 1.0 专业化入口，不能只把 YAML 写出去，必须在写入前尽量发现明显错误。

2. 例程静态验收加严
   - 重写 `scripts/validate-examples.js`，输出恢复为可读中文。
   - 新增检查：`README.md`、`schema_version`、`app_version`、`project.name`、`project.top_module`、顶层模块是否真实存在、include 文件是否存在、仿真例程 testbench 是否存在。
   - 保留检查：例程元数据、工程配置、源文件、约束文件、板卡包存在性。
   - 理由：发布前的例程检查应该更接近用户实际“一键创建/一键验收”的入口质量，而不是只看文件是否粗略存在。

3. 旧例程格式补齐
   - 为早期例程补充 `schema_version: 1` 和 `app_version: 1.0.0-preview`。
   - 涉及：`icesugar-blinky`、`icesugar-multifile-counter`、`icesugar-pro-blinky`、`tang-nano-9k-blinky`、`verilog-counter-sim`。

4. 验证
   - `node --check scripts/validate-examples.js` 通过。
   - `node --check renderer/panels/board.js` 通过。
   - `npm run release:check` 通过。

## 第三十四轮升级记录：工程体检接入板卡包结构校验

1. 工程体检增强
   - 新增：工程体检会根据 `board.filename` 读取内置板卡包或工程目录下的 `project:boards/*.yaml`。
   - 新增：体检会检查板卡包 YAML 是否存在、是否能解析、是否包含 `fpga.family`、`fpga.device`、`fpga.package`、基础工具链字段和基础资源字段。
   - 新增：体检会发现板卡包资源里的重复引脚，并将其标为阻塞问题。
   - 新增：缺少 clock、program 工具、pnr/pack/synth 工具、constraints 键等会显示为注意项。

2. 理由
   - 1.0 允许用户图形化创建自定义板卡包，因此打开已有工程时也必须能检查板卡包质量。
   - 仅检查工程缓存里的板卡摘要不够可靠，真正影响构建的是板卡 YAML 文件本身。

3. 验证
   - `node --check src/main.js` 通过。
   - `node --check renderer/panels/project.js` 通过。
   - `npm run release:check` 通过。

## 第三十五轮升级记录：报告中心发布前检查

1. 发布前检查卡片
   - 新增：报告中心加入“发布前检查”卡片。
   - 汇总内容包括：工程配置、工具链环境、核心构建、报告材料、图形产物、烧录准备、最近验收。
   - 状态分为绿色可用、黄色注意、红色阻塞，并给出可读原因。

2. 数据来源
   - 读取 `output/reports/project-health.json` 判断工程体检结果。
   - 读取 `output/reports/toolchain-acceptance.json` 判断 OSS CAD Suite 验收结果。
   - 读取 `output/reports/vflux-acceptance.json` 判断最近一次一键验收结果。
   - 同时结合当前流水线状态和真实产物存在性判断 bitstream、HTML 报告、图形产物和烧录准备。

3. 理由
   - 1.0 试用版需要一个更直接的“我现在能不能发给别人试用/能不能烧录/缺什么”的总览，而不是让用户分散查看多个工作台。

4. 验证
   - `node --check renderer/panels/report.js` 通过。
   - `node --check src/main.js` 通过。
   - `npm run release:check` 通过。

## 第三十六轮升级记录：1.0 发布前自动验收按钮

1. 自动验收入口
   - 新增：报告中心按钮“1.0 发布前自动验收”。
   - 执行顺序：工程体检 -> 工具链验收 -> 一键构建与验收 -> 导出 HTML 报告 -> 刷新发布前检查。
   - 如果核心构建失败，会保留失败步骤并在报告中心给出阻塞提示。

2. 开发者可读性
   - 在自动验收编排函数旁加入简短英文注释，说明该函数只做流程编排，各工作台仍负责各自的细节逻辑。
   - 在发布前检查摘要函数旁加入英文注释，说明它同时服务可视化卡片和自动验收结论。

3. 理由
   - 打包 1.0 前需要减少人工重复操作，让用户从报告中心就能完成“工程是否可发布/可试用”的一次性检查。

4. 验证
   - `node --check renderer/panels/report.js` 通过。
   - `node --check renderer/panels/build-all.js` 通过。
   - `npm run release:check` 通过。

## 第三十七轮升级记录：1.0.0-rc.1 版本与发布文档收口

1. 版本号
   - 将 `package.json` 和 `package-lock.json` 从 `0.9.0` 更新为 `1.0.0-rc.1`。
   - 理由：当前功能已经进入 1.0 试用候选阶段，版本号应反映 RC 状态。

2. README 收口
   - 重写中文 `README.md`，修复终端显示乱码风险，并统一描述 1.0.0-rc.1。
   - 补充第一次使用流程、报告中心、发布前自动验收、FAQ、Windows RC 打包说明和当前边界。
   - 同步更新 `README.en.md`，补充 RC 版本、Report Center、Release Preflight 和 FAQ。

3. 发布文档
   - 新增 `docs/release-1.0.0-rc.1-notes.md`。
   - 新增 `docs/hardware-validation-1.0.0-rc.1.md`。
   - 硬件验收清单覆盖 iCESugar LED、Multi-file Counter、PWM、Button Debounce、UART Echo 和仿真例程。

4. 理由
   - 1.0 RC 前需要把“软件怎么用、怎么验收、怎么发布、已知边界是什么”写清楚。
   - 真实硬件验收无法由代码静态检查替代，因此需要单独的人工 checklist。

## 第三十八轮升级记录：英文主 README 与双版本打包准备

1. README 结构
   - 将 `README.md` 调整为英文主入口。
   - 新增/保留 `README.zh-CN.md` 作为中文指南，并在英文 README 顶部提供链接。
   - `README.en.md` 仍保留为英文副本，便于历史链接不失效。

2. 版本策略
   - 将 `package.json` 和 `package-lock.json` 更新为 `1.0.0`，用于 Windows 正式 portable 构建。
   - Linux AppImage 仍按 `0.9.1` preview 打包，通过独立脚本覆盖 metadata version 和 artifactName。
   - 理由：Windows 已进入 1.0.0 发布准备，Linux 仍缺少真实机器验收，不应标为 1.0.0。

3. 打包脚本
   - `npm run pack:win` / `npm run pack:win:1.0.0`：输出 Windows 1.0.0 portable。
   - `npm run pack:win:zip`：输出 Windows 1.0.0 ZIP。
   - `npm run pack:linux` / `npm run pack:linux:0.9.1`：输出 Linux 0.9.1 AppImage preview。

4. 发布文档
   - 将发布说明整理为 `docs/release-1.0.0-win-0.9.1-linux-notes.md`。
   - 将硬件验收清单整理为 `docs/hardware-validation-1.0.0-win.md`。
