# 每日文件生成脚本（简化版）
# 功能：在每日0时0分生成当日所需的JSON文件

# 日志文件路径
$logFile = "K:\CXCC2\logs\daily-file-generator.log"
$errorLogFile = "K:\CXCC2\logs\daily-file-generator-error.log"

# 数据存储路径
$dataDir = "K:\CXCC2\data\local-sync"

# 确保日志目录存在
if (!(Test-Path "K:\CXCC2\logs")) {
    New-Item -ItemType Directory -Path "K:\CXCC2\logs" -Force
}

# 写入日志函数
function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "Info"
    )
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] $Message"
    Write-Host $logEntry
    Add-Content -Path $logFile -Value $logEntry
    if ($Level -eq "Error") {
        Add-Content -Path $errorLogFile -Value $logEntry
    }
}

# 生成当日日期字符串
$today = Get-Date -Format "yyyy-MM-dd"

Write-Log "开始执行每日文件生成任务"
Write-Log "生成日期: $today"

# 1. 生成当日录音清单JSON文件
Write-Log "开始生成当日录音清单JSON文件"
try {
    $recordingFile = "$dataDir\qms_recording_list_$today.json"
    # 检查文件是否存在，不存在则创建空白文件
    if (!(Test-Path $recordingFile)) {
        Write-Log "创建空白录音清单文件: $recordingFile"
        @() | ConvertTo-Json -Depth 3 | Out-File -FilePath $recordingFile -Encoding UTF8
        Write-Log "录音清单文件创建成功"
    } else {
        Write-Log "录音清单文件已存在: $recordingFile"
    }
} catch {
    Write-Log "生成录音清单文件失败: $($_.Exception.Message)" "Error"
}

# 2. 生成当日通话清单JSON文件
Write-Log "开始生成当日通话清单JSON文件"
try {
    $callLogFile = "$dataDir\qms_call_log_list_$today.json"
    # 检查文件是否存在，不存在则创建空白文件
    if (!(Test-Path $callLogFile)) {
        Write-Log "创建空白通话清单文件: $callLogFile"
        @() | ConvertTo-Json -Depth 3 | Out-File -FilePath $callLogFile -Encoding UTF8
        Write-Log "通话清单文件创建成功"
    } else {
        Write-Log "通话清单文件已存在: $callLogFile"
    }
} catch {
    Write-Log "生成通话清单文件失败: $($_.Exception.Message)" "Error"
}

# 3. 创建外呼团队当日配置JSON文件
Write-Log "开始创建外呼团队当日配置JSON文件"
try {
    $teamFile = "$dataDir\qms_team_list_$today.json"
    # 检查文件是否存在，不存在则创建空白文件
    if (!(Test-Path $teamFile)) {
        Write-Log "创建空白外呼团队配置文件: $teamFile"
        @() | ConvertTo-Json -Depth 3 | Out-File -FilePath $teamFile -Encoding UTF8
        Write-Log "外呼团队配置文件创建成功"
    } else {
        Write-Log "外呼团队配置文件已存在: $teamFile"
    }
} catch {
    Write-Log "创建外呼团队配置文件失败: $($_.Exception.Message)" "Error"
}

# 4. 生成坐席当日设置JSON文件
Write-Log "开始生成坐席当日设置JSON文件"
try {
    $agentFile = "$dataDir\qms_agent_list_$today.json"
    # 检查文件是否存在，不存在则创建空白文件
    if (!(Test-Path $agentFile)) {
        Write-Log "创建空白坐席设置文件: $agentFile"
        @() | ConvertTo-Json -Depth 3 | Out-File -FilePath $agentFile -Encoding UTF8
        Write-Log "坐席设置文件创建成功"
    } else {
        Write-Log "坐席设置文件已存在: $agentFile"
    }
} catch {
    Write-Log "生成坐席设置文件失败: $($_.Exception.Message)" "Error"
}

Write-Log "每日文件生成任务执行完成"
Write-Log "====================================="
