@echo off

REM 录音清单数据同步批处理脚本
REM 同步3月2日至3月24日的数据

echo 开始录音清单数据同步
echo 日期范围：2026-03-02 至 2026-03-24
echo ========================================

REM 定义变量
set API_BASE_URL=http://127.0.0.1:5000
set DATA_DIR=data\local-sync
set LOG_FILE=%DATA_DIR%\sync_batch_%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%.log

REM 确保日志目录存在
if not exist %DATA_DIR% mkdir %DATA_DIR%

REM 定义同步函数
:SyncDate
setlocal
set DATE_STR=%1
echo 处理日期：%DATE_STR%
echo 开始同步 %DATE_STR% 的数据... >> %LOG_FILE%

REM 构建请求体
set REQUEST_BODY={"startTime":"%DATE_STR% 00:00:00","endTime":"%DATE_STR% 23:59:59"}

REM 执行同步
curl -X POST %API_BASE_URL%/api/internal/sync/recordings -H "Content-Type: application/json" -d "%REQUEST_BODY%" >> %LOG_FILE%
echo. >> %LOG_FILE%

REM 验证本地数据
set FILE_PATH=%DATA_DIR%\qms_recording_list_%DATE_STR%.json
echo 验证 %DATE_STR% 的本地数据... >> %LOG_FILE%
if exist %FILE_PATH% (
    echo 文件存在: %FILE_PATH% >> %LOG_FILE%
) else (
    echo 文件不存在: %FILE_PATH% >> %LOG_FILE%
)
echo. >> %LOG_FILE%

echo 等待1秒后继续...
timeout /t 1 /nobreak >nul
endlocal
goto :eof

REM 主循环
set START_DATE=2026-03-02
set END_DATE=2026-03-24

REM 计算日期范围
REM 注意：批处理中日期计算比较复杂，这里直接列出所有日期
set DATES=2026-03-02 2026-03-03 2026-03-04 2026-03-05 2026-03-06 2026-03-07 2026-03-08 2026-03-09 2026-03-10 2026-03-11 2026-03-12 2026-03-13 2026-03-14 2026-03-15 2026-03-16 2026-03-17 2026-03-18 2026-03-19 2026-03-20 2026-03-21 2026-03-22 2026-03-23 2026-03-24

REM 执行同步
for %%d in (%DATES%) do (
    call :SyncDate %%d
)

echo ========================================
echo 同步任务完成
echo 日志文件：%LOG_FILE%
echo ========================================
pause