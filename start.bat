@echo off
REM ============================================================================
REM Vflux 启动脚本 (Windows)
REM 配合 OSS CAD Suite 使用
REM ============================================================================

setlocal enabledelayedexpansion

REM 获取脚本所在目录
set "VFLUX_ROOT=%~dp0"

REM 检查 OSS CAD Suite 目录
if not exist "%VFLUX_ROOT%oss-cad-suite\environment.bat" (
    echo [Vflux] 警告: 未找到 oss-cad-suite 目录，工具链可能不可用
    echo [Vflux] 请将 oss-cad-suite 放置在 vflux 同级目录
)

REM 检查 Electron 是否已安装
if not exist "%VFLUX_ROOT%node_modules\electron\dist\electron.exe" (
    echo [Vflux] 正在安装依赖...
    cd /d "%VFLUX_ROOT%"
    call npm install
    if errorlevel 1 (
        echo [Vflux] 错误: npm install 失败
        pause
        exit /b 1
    )
)

REM 启动 Vflux
echo [Vflux] 启动中...
cd /d "%VFLUX_ROOT%"
call npx electron .
if errorlevel 1 (
    echo [Vflux] 启动失败
    pause
)
