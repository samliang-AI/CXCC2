# 3月5日通话清单同步脚本
# 功能：查询3月5日的API数据，对比本地文件，如有差异则更新

# 配置参数
$targetDate = "2026-03-05"
$apiUrl = "http://localhost:5000/api/cxcc/call-logs"
$updateApiUrl = "http://localhost:5000/api/cxcc/call-logs/update-local"
$dataDir = "K:\CXCC2\data\local-sync"
$localFile = "$dataDir\qms_call_log_list_$targetDate.json"
$logFile = "K:\CXCC2\logs\sync-call-logs-$targetDate.log"

# 确保日志目录存在
if (!(Test-Path "K:\CXCC2\logs")) {
    New-Item -ItemType Directory -Path "K:\CXCC2\logs" -Force
}

# 写入日志
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path $logFile -Value "[$timestamp] [Info] Starting sync for $targetDate call logs"
Write-Host "Starting sync for $targetDate call logs"

# 构建查询参数
$startTime = "$targetDate 00:00:00"
$endTime = "$targetDate 23:59:59"

# 1. 从API获取数据
Add-Content -Path $logFile -Value "[$timestamp] [Info] Querying API for $targetDate call data"
Write-Host "Querying API for $targetDate call data"

try {
    $body = @{
        pageNum = 1
        pageSize = 100000
        startTime = $startTime
        endTime = $endTime
    } | ConvertTo-Json
    
    $apiResponse = Invoke-RestMethod -Uri $apiUrl -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
    
    if ($apiResponse.code -ne 0) {
        throw "API query failed: $($apiResponse.message)"
    }
    
    $apiCount = $apiResponse.total
    $logMsg = "[$timestamp] [Info] API query completed, retrieved $apiCount records"
    Add-Content -Path $logFile -Value $logMsg
    Write-Host $logMsg
    
    # 2. 读取本地文件数据
    $logMsg = "[$timestamp] [Info] Reading local $targetDate call data file"
    Add-Content -Path $logFile -Value $logMsg
    Write-Host $logMsg
    
    if (Test-Path $localFile) {
        $localContent = Get-Content -Path $localFile -Raw | ConvertFrom-Json
        $localCount = $localContent.Length
    } else {
        $localCount = 0
        $logMsg = "[$timestamp] [Info] Local file does not exist, creating empty file"
        Add-Content -Path $logFile -Value $logMsg
        Write-Host $logMsg
        @() | ConvertTo-Json | Out-File -FilePath $localFile -Encoding UTF8
    }
    
    $logMsg = "[$timestamp] [Info] Local file has $localCount records"
    Add-Content -Path $logFile -Value $logMsg
    Write-Host $logMsg
    
    # 3. 对比数据条数
    if ($apiCount -ne $localCount) {
        $logMsg = "[$timestamp] [Info] Record count mismatch: API($apiCount) vs Local($localCount), updating local file"
        Add-Content -Path $logFile -Value $logMsg
        Write-Host $logMsg
        
        # 4. 调用更新API
        $updateResponse = Invoke-RestMethod -Uri $updateApiUrl -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
        
        if ($updateResponse.code -ne 0) {
            throw "Failed to update local file: $($updateResponse.message)"
        }
        
        $upsertedCount = $updateResponse.data.upserted
        $logMsg = "[$timestamp] [Info] Local file updated successfully, wrote $upsertedCount records"
        Add-Content -Path $logFile -Value $logMsg
        Write-Host $logMsg
        
        $logMsg = "[$timestamp] [Info] Sync completed: API records=$apiCount, Local records=$localCount, Updated records=$upsertedCount"
        Add-Content -Path $logFile -Value $logMsg
        Write-Host $logMsg
    } else {
        $logMsg = "[$timestamp] [Info] Record counts match: API($apiCount) vs Local($localCount), no update needed"
        Add-Content -Path $logFile -Value $logMsg
        Write-Host $logMsg
        
        $logMsg = "[$timestamp] [Info] Sync completed: API records=$apiCount, Local records=$localCount, Updated records=0"
        Add-Content -Path $logFile -Value $logMsg
        Write-Host $logMsg
    }
} catch {
    $errorMsg = $_.Exception.Message
    $logMsg = "[$timestamp] [Error] Error during sync: $errorMsg"
    Add-Content -Path $logFile -Value $logMsg
    Write-Host "Error: $errorMsg" -ForegroundColor Red
    $logMsg = "[$timestamp] [Error] Sync failed: $errorMsg"
    Add-Content -Path $logFile -Value $logMsg
    Write-Host "Sync failed: $errorMsg" -ForegroundColor Red
}

$logMsg = "[$timestamp] [Info] Sync task completed"
Add-Content -Path $logFile -Value $logMsg
Write-Host "Sync task completed"
