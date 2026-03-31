@echo off

REM 每日文件生成脚本
REM 功能：在每日0时0分生成当日所需的JSON文件

set "logFile=K:\CXCC2\logs\daily-file-generator.log"
set "errorLogFile=K:\CXCC2\logs\daily-file-generator-error.log"
set "dataDir=K:\CXCC2\data\local-sync"

REM 确保日志目录存在
if not exist "K:\CXCC2\logs" mkdir "K:\CXCC2\logs"

REM 生成当日日期字符串
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do set "today=%%c-%%a-%%b"

REM 写入日志
set "timestamp=%date% %time%"
echo [%timestamp%] [Info] 开始执行每日文件生成任务 >> %logFile%
echo [%timestamp%] [Info] 生成日期: %today% >> %logFile%

echo 开始执行每日文件生成任务
echo 生成日期: %today%

REM 1. 生成当日录音清单JSON文件
echo [%timestamp%] [Info] 开始生成当日录音清单JSON文件 >> %logFile%
echo 开始生成当日录音清单JSON文件
set "recordingFile=%dataDir%\qms_recording_list_%today%.json"
if not exist "%recordingFile%" (
    echo [%timestamp%] [Info] 创建空白录音清单文件: %recordingFile% >> %logFile%
    echo 创建空白录音清单文件: %recordingFile%
    echo [] > "%recordingFile%"
    echo [%timestamp%] [Info] 录音清单文件创建成功 >> %logFile%
    echo 录音清单文件创建成功
) else (
    echo [%timestamp%] [Info] 录音清单文件已存在: %recordingFile% >> %logFile%
    echo 录音清单文件已存在: %recordingFile%
)

REM 2. 生成当日通话清单JSON文件
echo [%timestamp%] [Info] 开始生成当日通话清单JSON文件 >> %logFile%
echo 开始生成当日通话清单JSON文件
set "callLogFile=%dataDir%\qms_call_log_list_%today%.json"
if not exist "%callLogFile%" (
    echo [%timestamp%] [Info] 创建空白通话清单文件: %callLogFile% >> %logFile%
    echo 创建空白通话清单文件: %callLogFile%
    echo [] > "%callLogFile%"
    echo [%timestamp%] [Info] 通话清单文件创建成功 >> %logFile%
    echo 通话清单文件创建成功
) else (
    echo [%timestamp%] [Info] 通话清单文件已存在: %callLogFile% >> %logFile%
    echo 通话清单文件已存在: %callLogFile%
)

REM 3. 创建外呼团队当日配置JSON文件
echo [%timestamp%] [Info] 开始创建外呼团队当日配置JSON文件 >> %logFile%
echo 开始创建外呼团队当日配置JSON文件
set "teamFile=%dataDir%\qms_team_list_%today%.json"
if not exist "%teamFile%" (
    echo [%timestamp%] [Info] 创建空白外呼团队配置文件: %teamFile% >> %logFile%
    echo 创建空白外呼团队配置文件: %teamFile%
    echo [] > "%teamFile%"
    echo [%timestamp%] [Info] 外呼团队配置文件创建成功 >> %logFile%
    echo 外呼团队配置文件创建成功
) else (
    echo [%timestamp%] [Info] 外呼团队配置文件已存在: %teamFile% >> %logFile%
    echo 外呼团队配置文件已存在: %teamFile%
)

REM 4. 生成坐席当日设置JSON文件
echo [%timestamp%] [Info] 开始生成坐席当日设置JSON文件 >> %logFile%
echo 开始生成坐席当日设置JSON文件
set "agentFile=%dataDir%\qms_agent_list_%today%.json"
if not exist "%agentFile%" (
    echo [%timestamp%] [Info] 创建空白坐席设置文件: %agentFile% >> %logFile%
    echo 创建空白坐席设置文件: %agentFile%
    echo [] > "%agentFile%"
    echo [%timestamp%] [Info] 坐席设置文件创建成功 >> %logFile%
    echo 坐席设置文件创建成功
) else (
    echo [%timestamp%] [Info] 坐席设置文件已存在: %agentFile% >> %logFile%
    echo 坐席设置文件已存在: %agentFile%
)

echo [%timestamp%] [Info] 每日文件生成任务执行完成 >> %logFile%
echo [%timestamp%] [Info] ===================================== >> %logFile%
echo 每日文件生成任务执行完成
echo =====================================
