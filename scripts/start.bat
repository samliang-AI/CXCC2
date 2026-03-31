@echo off
setlocal

REM 启动脚本 - Windows 版本
set PORT=5000
if not "%DEPLOY_RUN_PORT%" == "" set PORT=%DEPLOY_RUN_PORT%

echo Starting HTTP service on port %PORT% for deploy...
npx next start --port %PORT%

endlocal
