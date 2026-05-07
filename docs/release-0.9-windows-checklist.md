# Vflux 0.9 Windows 试用版打包清单

## 目标

Vflux 0.9 是 Windows portable 试用版，重点验证：

- iCESugar 拖拽盘符烧录闭环
- 内置例程可创建、可构建
- 工具链环境验收能给出可读结论
- 报告中心能导出 HTML 报告

注意：0.9 打包产物不内置 OSS CAD Suite，用户需要先自行安装 OSS CAD Suite，并在 Vflux 工具链页面选择安装目录。

## 打包前检查

1. 安装依赖：

   ```powershell
   npm install
   ```

2. 检查内置例程文件完整性：

   ```powershell
   npm run validate:examples
   ```

3. 启动开发版：

   ```powershell
   npm start
   ```

4. 在 GUI 中运行：

   - 先安装并选择 OSS CAD Suite 目录
   - 工具链页：运行环境验收
   - 例程页：创建并验收 `iCESugar LED Blinky`
   - 例程页：创建并验收 `iCESugar Multi-file Counter`
   - 报告中心：导出 HTML 报告
   - 烧录页：选择拖拽盘符，确认 iCESugar 可烧录

## Windows portable 打包

```powershell
npm run pack:win
```

输出目录：

```text
dist/
```

## 0.9 已知边界

- Windows 试用版优先；Linux AppImage 脚本已预留，但 1.0 前需要单独验证。
- 板卡包编辑器目前支持基础 GUI 创建和导出草稿，复杂外设仍建议手动编辑 YAML。
- OSS CAD Suite 不随 Vflux 打包，需要用户单独安装。
- 报告中心现在能打开 SVG/HTML 产物，后续 1.0 再考虑内嵌预览。
- 部分 Gowin/ECP5 高级参数仍需更多真实板卡验证。

## 迈向 1.0 的建议

- 做 Windows + Linux 双平台验收矩阵。
- 给 Vflux 增加正式图标和安装包元数据。
- 扩充真实板卡例程，至少覆盖 iCE40、ECP5、Gowin 各一个硬件闭环。
- 把烧录诊断结果纳入 HTML 报告。
