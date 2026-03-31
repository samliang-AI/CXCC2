@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================
echo   外呼数据分析系统 - 快速启动脚本
echo ========================================
echo.

:: 检查 Python 是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 Python，请先安装 Python 3.9+
    pause
    exit /b 1
)

echo [1/4] 检查 Python 环境... ✓
echo.

:: 安装 Python 依赖
echo [2/4] 安装 Python 后端依赖...
cd python-backend
pip install -r requirements.txt -q
if errorlevel 1 (
    echo [错误] Python 依赖安装失败
    pause
    exit /b 1
)
echo [2/4] Python 依赖安装完成 ✓
echo.

:: 返回项目根目录
cd ..

:: 检查 Node.js 是否安装
node --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)

echo [3/4] 检查 Node.js 环境... ✓
echo.

:: 启动后端服务
echo [4/4] 启动服务...
echo.
echo ========================================
echo   正在启动 Python 后端...
echo   访问地址：http://localhost:8000
echo   API 文档：http://localhost:8000/docs
echo ========================================
echo.

:: 在新窗口启动后端
start "Python 后端服务" cmd /k "cd /d %~dp0python-backend && echo 启动后端服务... && python main.py"

:: 等待后端启动
echo 等待后端服务启动 (5 秒)...
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo   正在启动 Next.js 前端...
echo   访问地址：http://localhost:5000
echo ========================================
echo.

:: 启动前端
start "Next.js 前端服务" cmd /k "cd /d %~dp0 && echo 启动前端服务... && pnpm dev"

echo.
echo ========================================
echo   启动完成!
echo.
echo   📊 前端地址：http://localhost:5000
echo   🔌 后端地址：http://localhost:8000
echo   📖 API 文档：http://localhost:8000/docs
echo.
echo   按任意键关闭此窗口 (服务仍在运行)
echo ========================================

pause >nul
