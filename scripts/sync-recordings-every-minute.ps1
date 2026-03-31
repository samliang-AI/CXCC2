# Recording list auto sync script

# Set error handling
$ErrorActionPreference = "Stop"

# Log file path
$logFile = "K:\CXCC2\logs\sync-recordings-every-minute.log"

# Ensure log directory exists
$logDir = Split-Path -Parent $logFile
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

# Write log function
function Write-Log {
    param (
        [string]$Message,
        [string]$Level = "INFO"
    )
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] $Message"
    # Only write to log file, not to console
    Add-Content -Path $logFile -Value $logEntry
}

Write-Log "Start recording list sync task"

try {
    # Get current date
    $currentDate = Get-Date -Format "yyyy-MM-dd"
    
    # Build API request parameters
    $startTime = "$currentDate 00:00:00"
    $endTime = "$currentDate 23:59:59"
    
    Write-Log "Sync date: $currentDate"
    Write-Log "Time range: $startTime to $endTime"
    
    # Call API to update local file
    $apiUrl = "http://localhost:3000/api/cxcc/recordings/update-local"
    $body = @{
        pageNum = 1
        pageSize = 100000
        agentNo = ""
        projectId = ""
        startTime = $startTime
        endTime = $endTime
    } | ConvertTo-Json
    
    Write-Log "Calling API to update local recording list file"
    
    # Send API request
    $response = Invoke-WebRequest -Uri $apiUrl -Method POST -Headers @{"Content-Type"="application/json"} -Body $body -UseBasicParsing
    
    # Parse response
    $responseData = $response.Content | ConvertFrom-Json
    
    if ($responseData.code -eq 0) {
        Write-Log "Recording list sync successful: $($responseData.data.message)" -Level "SUCCESS"
    } else {
        Write-Log "Recording list sync failed: $($responseData.message)" -Level "ERROR"
    }
    
} catch {
    Write-Log "Error during sync: $($_.Exception.Message)" -Level "ERROR"
}

Write-Log "Recording list sync task completed"
