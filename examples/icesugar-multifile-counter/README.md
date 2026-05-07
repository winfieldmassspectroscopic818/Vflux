# iCESugar Multi-file Counter

这个例程用于验证 Vflux 能否正确处理：

- 多个 Verilog 源文件
- `include` 宏定义头文件
- 子模块层次
- iCESugar UP5K 的检查、综合、布局布线、比特流生成
- 拖拽盘符烧录流程

顶层模块是 `top`，宏定义文件是 `src/vflux_defs.vh`。
