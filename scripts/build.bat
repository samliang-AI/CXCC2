@echo off
setlocal

REM 构建脚本 - Windows 版本

echo Installing dependencies...
pnpm install --prefer-frozen-lockfile --prefer-offline

echo Building the project...
npx next build

echo Build completed successfully!

endlocal
