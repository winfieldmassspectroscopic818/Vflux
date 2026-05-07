@echo off
REM ============================================================================
REM Vflux 开发模式启动脚本
REM ============================================================================

setlocal

set "VFLUX_ROOT=%~dp0"

cd /d "%VFLUX_ROOT%"

echo [Vflux Dev] 安装依赖...
call npm install

echo [Vflux Dev] 启动 Electron 开发模式...
call npx electron . --dev

pause
