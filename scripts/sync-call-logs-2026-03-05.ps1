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
Add-Content -Path $logFile -Value "[$timestamp] [Info] 开始同步 $targetDate 的通话清单数据"
Write-Host "开始同步 $targetDate 的通话清单数据"

# 构建查询参数
$startTime = "$targetDate 00:00:00"
$endTime = "$targetDate 23:59:59"

# 1. 从API获取数据
Add-Content -Path $logFile -Value "[$timestamp] [Info] 从API查询 $targetDate 的通话数据"
Write-Host "从API查询 $targetDate 的通话数据"

try {
    $body = @{
        pageNum = 1
        pageSize = 100000
        startTime = $startTime
        endTime = $endTime
    } | ConvertTo-Json
    
    $apiResponse = Invoke-RestMethod -Uri $apiUrl -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
    
    if ($apiResponse.code -ne 0) {
        throw "API查询失败: $($apiResponse.message)"
    }
    
    $apiCount = $apiResponse.total
    Add-Content -Path $logFile -Value "[$timestamp] [Info] API查询完成，共获取 $apiCount 条记录"
    Write-Host "API查询完成，共获取 $apiCount 条记录"
    
    # 2. 读取本地文件数据
    Add-Content -Path $logFile -Value "[$timestamp] [Info] 读取本地 $targetDate 的通话数据文件"
    Write-Host "读取本地 $targetDate 的通话数据文件"
    
    if (Test-Path $localFile) {
        $localContent = Get-Content -Path $localFile -Raw | ConvertFrom-Json
        $localCount = $localContent.Length
    } else {
        $localCount = 0
        Add-Content -Path $logFile -Value "[$timestamp] [Info] 本地文件不存在，创建空白文件"
        Write-Host "本地文件不存在，创建空白文件"
        @() | ConvertTo-Json | Out-File -FilePath $localFile -Encoding UTF8
    }
    
    Add-Content -Path $logFile -Value "[$timestamp] [Info] 本地文件中有 $localCount 条记录"
    Write-Host "本地文件中有 $localCount 条记录"
    
    # 3. 对比数据条数
    if ($apiCount -ne $localCount) {
        Add-Content -Path $logFile -Value "[$timestamp] [Info] 数据条数存在差异：API($apiCount) vs 本地($localCount)，开始更新本地文件"
        Write-Host "数据条数存在差异：API($apiCount) vs 本地($localCount)，开始更新本地文件"
        
        # 4. 调用更新API
        $updateResponse = Invoke-RestMethod -Uri $updateApiUrl -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
        
        if ($updateResponse.code -ne 0) {
            throw "更新本地文件失败: $($updateResponse.message)"
        }
        
        $upsertedCount = $updateResponse.data.upserted
        Add-Content -Path $logFile -Value "[$timestamp] [Info] 本地文件更新完成，共写入 $upsertedCount 条记录"
        Write-Host "本地文件更新完成，共写入 $upsertedCount 条记录"
        
        Add-Content -Path $logFile -Value "[$timestamp] [Info] 同步任务完成: API记录数=$apiCount, 本地记录数=$localCount, 更新记录数=$upsertedCount"
        Write-Host "同步任务完成: API记录数=$apiCount, 本地记录数=$localCount, 更新记录数=$upsertedCount"
    } else {
        Add-Content -Path $logFile -Value "[$timestamp] [Info] 数据条数一致：API($apiCount) vs 本地($localCount)，无需更新"
        Write-Host "数据条数一致：API($apiCount) vs 本地($localCount)，无需更新"
        
        Add-Content -Path $logFile -Value "[$timestamp] [Info] 同步任务完成: API记录数=$apiCount, 本地记录数=$localCount, 更新记录数=0"
        Write-Host "同步任务完成: API记录数=$apiCount, 本地记录数=$localCount, 更新记录数=0"
    }
} catch {
    $errorMsg = $_.Exception.Message
    Add-Content -Path $logFile -Value "[$timestamp] [Error] 同步过程中发生错误: $errorMsg"
    Write-Host "错误: $errorMsg" -ForegroundColor Red
    Add-Content -Path $logFile -Value "[$timestamp] [Error] 同步任务失败: $errorMsg"
    Write-Host "同步任务失败: $errorMsg" -ForegroundColor Red
}

Add-Content -Path $logFile -Value "[$timestamp] [Info] 同步任务执行完毕"
Write-Host "同步任务执行完毕"
