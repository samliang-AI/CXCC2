# 录音清单每日API查询任务脚本
# 执行3月2日至3月24日的每日API查询任务

$API_BASE_URL = $env:API_BASE_URL -or 'http://127.0.0.1:5000'
$LOG_DIR = Join-Path $PSScriptRoot '..' 'data' 'local-sync'
$logFile = Join-Path $LOG_DIR "daily_api_query_$(Get-Date -Format 'yyyyMMdd_HHmmss').log"
$errorLogFile = Join-Path $LOG_DIR "daily_api_query_$(Get-Date -Format 'yyyyMMdd_HHmmss')_error.log"

# 确保日志目录存在
if (-not (Test-Path $LOG_DIR)) {
    New-Item -ItemType Directory -Path $LOG_DIR -Force | Out-Null
}

function Write-Log {
    param (
        [string]$Message,
        [string]$Level = 'INFO'
    )
    $timestamp = Get-Date -Format 'yyyy-MM-ddTHH:mm:ss.fffzzz'
    $logMessage = "[$timestamp] [$Level] $Message"
    Write-Host $logMessage
    Add-Content -Path $logFile -Value $logMessage
    
    if ($Level -eq 'ERROR') {
        Add-Content -Path $errorLogFile -Value $logMessage
    }
}

function Send-Alert {
    param (
        [string]$Message
    )
    Write-Log "告警: $Message" -Level 'ERROR'
}

function Format-Date {
    param (
        [DateTime]$Date
    )
    return $Date.ToString('yyyy-MM-dd')
}

function Get-DateRange {
    param (
        [DateTime]$StartDate,
        [DateTime]$EndDate
    )
    $dates = @()
    $currentDate = $StartDate
    
    while ($currentDate -le $EndDate) {
        $dates += $currentDate
        $currentDate = $currentDate.AddDays(1)
    }
    
    return $dates
}

function Invoke-APIRequest {
    param (
        [string]$Url,
        [string]$Method = 'GET',
        [object]$Body = $null
    )
    try {
        $headers = @{'Content-Type' = 'application/json'}
        $params = @{
            Uri = $Url
            Method = $Method
            Headers = $headers
            UseBasicParsing = $true
        }
        
        if ($Body) {
            $params.Body = $Body | ConvertTo-Json
        }
        
        $response = Invoke-WebRequest @params
        return $response.Content | ConvertFrom-Json
    } catch {
        Write-Log "API请求失败: $($_.Exception.Message)" -Level 'ERROR'
        throw
    }
}

function Query-ApiForDate {
    param (
        [DateTime]$Date
    )
    $dateStr = Format-Date $Date
    Write-Log "开始 $dateStr 的API查询任务..."
    
    try {
        # 构建请求参数
        $body = @{
            startTime = "$dateStr 00:00:00"
            endTime = "$dateStr 23:59:59"
        }
        
        # 调用API获取录音清单数据
        Write-Log "  发送API请求，时间范围：$($body.startTime) 至 $($body.endTime)"
        $result = Invoke-APIRequest "$API_BASE_URL/api/internal/sync/recordings" -Method 'POST' -Body $body
        
        if ($result.code -eq 200) {
            Write-Log " $dateStr API查询成功" -Level 'SUCCESS'
            Write-Log "  - 获取记录数：$($result.data.fetched)"
            Write-Log "  - 入库记录数：$($result.data.upserted)"
            Write-Log "  - 失败记录数：$($result.data.failed)"
            Write-Log "  - 存储模式：$($result.data.storageMode)"
            
            if ($result.data.localFiles) {
                Write-Log "  - 本地文件：$($result.data.localFiles -join ', ')"
            }
            
            return $true
        } else {
            Write-Log " $dateStr API查询失败：$($result.message)" -Level 'ERROR'
            if ($result.details) {
                Write-Log "  详情：$($result.details)" -Level 'ERROR'
            }
            Send-Alert " $dateStr API查询失败：$($result.message)"
            return $false
        }
    } catch {
        Write-Log " $dateStr API查询异常：$($_.Exception.Message)" -Level 'ERROR'
        Send-Alert " $dateStr API查询异常：$($_.Exception.Message)"
        return $false
    }
}

function Validate-LocalData {
    param (
        [DateTime]$Date
    )
    $dateStr = Format-Date $Date
    $filePath = Join-Path $LOG_DIR "qms_recording_list_$dateStr.json"
    
    Write-Log "验证 $dateStr 的本地数据..."
    
    if (-not (Test-Path $filePath)) {
        Write-Log "验证失败：$filePath 不存在" -Level 'ERROR'
        return $false
    } else {
        try {
            $content = Get-Content -Path $filePath -Raw
            $data = $content | ConvertFrom-Json
            if ($data -is [array] -and $data.Length -gt 0) {
                Write-Log "验证通过：$filePath 包含 $($data.Length) 条记录" -Level 'SUCCESS'
                return $true
            } else {
                Write-Log "验证失败：$filePath 为空或格式错误" -Level 'ERROR'
                return $false
            }
        } catch {
            Write-Log "验证失败：$filePath 读取或解析失败: $($_.Exception.Message)" -Level 'ERROR'
            return $false
        }
    }
}

# 主函数
Write-Log '========================================'
Write-Log '开始录音清单每日API查询任务'
Write-Log '日期范围：2026-03-02 至 2026-03-24'
Write-Log '========================================'

$startDate = Get-Date '2026-03-02'
$endDate = Get-Date '2026-03-24'
$dates = Get-DateRange $startDate $endDate
Write-Log "共需查询 $($dates.Length) 天的数据"

$successCount = 0
$failCount = 0
$validationSuccessCount = 0
$validationFailCount = 0

foreach ($date in $dates) {
    Write-Log "
处理日期：$(Format-Date $date)"
    
    # 执行API查询
    $querySuccess = Query-ApiForDate $date
    if ($querySuccess) {
        $successCount++
        
        # 验证本地数据
        $validationSuccess = Validate-LocalData $date
        if ($validationSuccess) {
            $validationSuccessCount++
        } else {
            $validationFailCount++
        }
    } else {
        $failCount++
        $validationFailCount++
    }
    
    # 避免请求过于频繁
    Write-Log '等待1秒后继续...'
    Start-Sleep -Seconds 1
}

Write-Log ''
Write-Log '========================================'
Write-Log '查询任务完成总结' -Level 'SUCCESS'
Write-Log '========================================'
Write-Log "日期范围：2026-03-02 至 2026-03-24"
Write-Log "总天数：$($dates.Length)"
Write-Log "API查询成功：$successCount"
Write-Log "API查询失败：$failCount"
Write-Log "数据验证成功：$validationSuccessCount"
Write-Log "数据验证失败：$validationFailCount"
Write-Log "日志文件：$logFile"

if (Test-Path $errorLogFile) {
    Write-Log "错误日志：$errorLogFile"
}

Write-Log '========================================'

if ($failCount -gt 0 -or $validationFailCount -gt 0) {
    Send-Alert '录音清单每日API查询任务存在失败项，请检查日志'
    exit 1
} else {
    Write-Log '录音清单每日API查询任务全部完成' -Level 'SUCCESS'
    exit 0
}