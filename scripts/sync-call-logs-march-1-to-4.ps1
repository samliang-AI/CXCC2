# 3月1日到3月4日通话清单同步脚本
# 功能：逐日查询3月1日到3月4日的API数据，对比本地文件，如有差异则更新

# 配置参数
$startDate = "2026-03-01"
$endDate = "2026-03-04"
$apiUrl = "http://localhost:5000/api/cxcc/call-logs"
$updateApiUrl = "http://localhost:5000/api/cxcc/call-logs/update-local"
$dataDir = "K:\CXCC2\data\local-sync"
$logFile = "K:\CXCC2\logs\sync-call-logs-march-1-to-4.log"

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
}

# 同步单个日期的通话清单
function Sync-CallLogsForDate {
    param(
        [string]$date
    )
    
    try {
        Write-Log "开始同步 $date 的通话清单数据"
        
        # 构建查询参数
        $startTime = "$date 00:00:00"
        $endTime = "$date 23:59:59"
        $localFile = "$dataDir\qms_call_log_list_$date.json"
        
        # 1. 从API获取数据
        Write-Log "从API查询 $date 的通话数据"
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
        Write-Log "API查询完成，共获取 $apiCount 条记录"
        
        # 2. 读取本地文件数据
        Write-Log "读取本地 $date 的通话数据文件"
        if (Test-Path $localFile) {
            $localContent = Get-Content -Path $localFile -Raw | ConvertFrom-Json
            $localCount = $localContent.Length
        } else {
            $localCount = 0
            Write-Log "本地文件不存在，创建空白文件"
            @() | ConvertTo-Json | Out-File -FilePath $localFile -Encoding UTF8
        }
        
        Write-Log "本地文件中有 $localCount 条记录"
        
        # 3. 对比数据条数
        if ($apiCount -ne $localCount) {
            Write-Log "数据条数存在差异：API($apiCount) vs 本地($localCount)，开始更新本地文件"
            
            # 4. 调用更新API
            $updateResponse = Invoke-RestMethod -Uri $updateApiUrl -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
            
            if ($updateResponse.code -ne 0) {
                throw "更新本地文件失败: $($updateResponse.message)"
            }
            
            $upsertedCount = $updateResponse.data.upserted
            Write-Log "本地文件更新完成，共写入 $upsertedCount 条记录"
            return @{ success = $true; date = $date; apiCount = $apiCount; localCount = $localCount; upsertedCount = $upsertedCount }
        } else {
            Write-Log "数据条数一致：API($apiCount) vs 本地($localCount)，无需更新"
            return @{ success = $true; date = $date; apiCount = $apiCount; localCount = $localCount; upsertedCount = 0 }
        }
        
    } catch {
        $errorMsg = $_.Exception.Message
        Write-Log "同步 $date 时发生错误: $errorMsg" "Error"
        return @{ success = $false; date = $date; error = $errorMsg }
    }
}

# 主函数
function Sync-AllDates {
    Write-Log "开始同步3月1日到3月4日的通话清单数据"
    
    # 生成日期范围
    $currentDate = Get-Date $startDate
    $endDateObj = Get-Date $endDate
    $results = @()
    
    while ($currentDate -le $endDateObj) {
        $dateStr = $currentDate.ToString("yyyy-MM-dd")
        $result = Sync-CallLogsForDate -date $dateStr
        $results += $result
        
        # 移动到下一天
        $currentDate = $currentDate.AddDays(1)
        
        # 暂停1秒，避免API请求过于频繁
        Start-Sleep -Seconds 1
    }
    
    # 汇总结果
    Write-Log "同步任务执行完毕，汇总结果："
    $totalApiCount = 0
    $totalLocalCount = 0
    $totalUpsertedCount = 0
    $successCount = 0
    $failedCount = 0
    
    foreach ($result in $results) {
        if ($result.success) {
            $successCount++
            $totalApiCount += $result.apiCount
            $totalLocalCount += $result.localCount
            $totalUpsertedCount += $result.upsertedCount
            Write-Log "$($result.date): API=$($result.apiCount), 本地=$($result.localCount), 更新=$($result.upsertedCount)"
        } else {
            $failedCount++
            Write-Log "$($result.date): 失败 - $($result.error)" "Error"
        }
    }
    
    Write-Log "总计：成功 $successCount 天，失败 $failedCount 天"
    Write-Log "API总记录数：$totalApiCount"
    Write-Log "本地总记录数：$totalLocalCount"
    Write-Log "更新总记录数：$totalUpsertedCount"
    
    return $results
}

# 执行同步
Sync-AllDates
