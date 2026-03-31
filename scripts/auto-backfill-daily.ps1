# Auto Backfill Task - Single Day Version
param(
  [Parameter(Mandatory = $true)]
  [string]$Date,
  
  [string]$ApiBaseUrl = "http://127.0.0.1:5000",
  [int]$MaxRetries = 5,
  [int]$RetryDelaySeconds = 60,
  [string]$LogDir = "data\local-sync\logs"
)

$ErrorActionPreference = "Stop"
$StartTime = Get-Date
$TotalFetched = 0
$TotalUpserted = 0
$TotalFailed = 0
$Success = $true
$LogFile = "$LogDir\backfill_$Date.log"

if (-not (Test-Path $LogDir)) {
  New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

function Log-Info {
  param([string]$text)
  $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
  $line = "[$timestamp] [INFO] $text"
  Write-Host $line -ForegroundColor White
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

function Log-Success {
  param([string]$text)
  $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
  $line = "[$timestamp] [SUCCESS] $text"
  Write-Host $line -ForegroundColor Green
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

function Log-Error {
  param([string]$text)
  $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
  $line = "[$timestamp] [ERROR] $text"
  Write-Host $line -ForegroundColor Red
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

function Log-Warn {
  param([string]$text)
  $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
  $line = "[$timestamp] [WARN] $text"
  Write-Host $line -ForegroundColor Yellow
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

function Invoke-Backfill {
  param([string]$DataType, [string]$Endpoint)
  
  $startTime = Get-Date
  $attempt = 1
  $success = $false
  $lastError = ""
  $result = $null
  
  while (-not $success -and $attempt -le $MaxRetries) {
    try {
      Log-Info "  [$DataType] Attempt $attempt`: $Date"
      
      $payload = @{
        startTime = $Date + " 00:00:00"
        endTime   = $Date + " 23:59:59"
      } | ConvertTo-Json -Compress
      
      $url = $ApiBaseUrl + $Endpoint
      $resp = Invoke-WebRequest -Uri $url -Method POST -ContentType "application/json" -Body $payload -TimeoutSec 300
      $respObj = $resp.Content | ConvertFrom-Json
      
      if ($respObj.code -eq 200) {
        $fetched = $respObj.data.fetched
        $upserted = $respObj.data.upserted
        $failed = $respObj.data.failed
        $elapsed = ((Get-Date) - $startTime).TotalSeconds
        
        Log-Success "  [$DataType] SUCCESS: fetched=$fetched, upserted=$upserted, failed=$failed, elapsed=${elapsed}s"
        
        $script:TotalFetched += $fetched
        $script:TotalUpserted += $upserted
        $script:TotalFailed += $failed
        
        $success = $true
        $result = @{Success = $true; Fetched = $fetched; Upserted = $upserted; Failed = $failed; Elapsed = $elapsed; Attempt = $attempt}
      } else {
        throw "API error: " + $respObj.message
      }
    } catch {
      $lastError = $_.Exception.Message
      Log-Warn "  [$DataType] Attempt $attempt failed: $lastError"
      
      if ($attempt -lt $MaxRetries) {
        Log-Info "  [$DataType] Retrying in $RetryDelaySeconds seconds..."
        Start-Sleep -Seconds $RetryDelaySeconds
      }
      
      $attempt++
    }
  }
  
  if (-not $success) {
    Log-Error "  [$DataType] Failed after $MaxRetries attempts: $lastError"
    $script:Success = $false
    $result = @{Success = $false; Fetched = 0; Upserted = 0; Failed = 0; Elapsed = 0; Attempt = $attempt; Error = $lastError}
  }
  
  return $result
}

try {
  $dateObj = [datetime]::ParseExact($Date, "yyyy-MM-dd", $null)
  
  Log-Info ""
  Log-Info "======================================================================"
  Log-Info "Auto Backfill Task - Single Day"
  Log-Info "======================================================================"
  Log-Info "Configuration:"
  Log-Info "  Date: $Date"
  Log-Info "  API URL: $ApiBaseUrl"
  Log-Info "  Max retries: $MaxRetries"
  Log-Info "  Retry delay: $RetryDelaySeconds seconds"
  Log-Info "  Log file: $LogFile"
  Log-Info "======================================================================"
  
  Log-Info ""
  Log-Info "Starting recordings backfill..."
  $recordingResult = Invoke-Backfill -DataType "Recordings" -Endpoint "/api/internal/sync/recordings/backfill/quick"
  
  if (-not $recordingResult.Success) {
    Log-Error "Recordings backfill failed, skipping call logs"
    $Success = $false
  } else {
    Log-Info ""
    Log-Info "Starting call logs backfill..."
    $callLogResult = Invoke-Backfill -DataType "Call Logs" -Endpoint "/api/internal/sync/call-logs/backfill/quick"
    
    if (-not $callLogResult.Success) {
      $Success = $false
    }
  }
  
  $totalElapsed = ((Get-Date) - $StartTime).TotalSeconds
  $totalElapsedFormatted = [TimeSpan]::FromSeconds($totalElapsed).ToString("hh\:mm\:ss")
  
  Log-Info ""
  Log-Info "======================================================================"
  Log-Info "Task Completed"
  Log-Info "======================================================================"
  Log-Info "Statistics:"
  Log-Info "  Date: $Date"
  if ($Success) { Log-Info "  Status: SUCCESS" } else { Log-Info "  Status: FAILED" }
  Log-Info "  Total fetched: $TotalFetched"
  Log-Info "  Total upserted: $TotalUpserted"
  Log-Info "  Total failed: $TotalFailed"
  Log-Info "  Total elapsed: $totalElapsedFormatted"
  Log-Info "======================================================================"
  
  $callLogResultData = $null
  if ($recordingResult.Success -and $Success) {
    $callLogResultData = $callLogResult
  }
  
  $progressReport = @{
    Date = $Date
    Status = "SUCCESS"
    TotalFetched = $TotalFetched
    TotalUpserted = $TotalUpserted
    TotalFailed = $TotalFailed
    ElapsedSeconds = $totalElapsed
    ElapsedFormatted = $totalElapsedFormatted
    Recording = $recordingResult
    CallLog = $callLogResultData
    StartTime = $StartTime.ToString("yyyy-MM-dd HH:mm:ss")
    EndTime = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
  }
  
  if (-not $Success) {
    $progressReport.Status = "FAILED"
  }
  
  $progressJson = $progressReport | ConvertTo-Json -Depth 10
  $progressPath = "$LogDir\backfill_$Date\_progress.json"
  $progressJson | Out-File -FilePath $progressPath -Encoding UTF8
  Log-Info "Progress report saved: $progressPath"
  
  if ($Success) {
    Log-Success "Task completed successfully!"
    exit 0
  } else {
    Log-Error "Task failed, check logs for details"
    exit 1
  }
  
} catch {
  Log-Info ""
  Log-Error "Task exception: $($_.Exception.Message)"
  Log-Error "Stack trace: $($_.ScriptStackTrace)"
  exit 1
}
