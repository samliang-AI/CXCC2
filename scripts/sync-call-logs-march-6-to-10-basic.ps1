# March 6-10 Call Logs Sync Script

# Configuration
$apiUrl = "http://localhost:5000/api/cxcc/call-logs"
$updateApiUrl = "http://localhost:5000/api/cxcc/call-logs/update-local"
$dataDir = "K:\CXCC2\data\local-sync"
$logFile = "K:\CXCC2\logs\sync-call-logs-march-6-to-10.log"

# Ensure log directory exists
if (!(Test-Path "K:\CXCC2\logs")) {
    New-Item -ItemType Directory -Path "K:\CXCC2\logs" -Force
}

# Dates to sync
$dates = @("2026-03-06", "2026-03-07", "2026-03-08", "2026-03-09", "2026-03-10")

# Log header
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path $logFile -Value "[$timestamp] [Info] Starting sync for March 6-10 call logs"
Write-Host "Starting sync for March 6-10 call logs"

# Process each date
foreach ($date in $dates) {
    $localFile = "$dataDir\qms_call_log_list_$date.json"
    
    Add-Content -Path $logFile -Value "[$timestamp] [Info] Processing $date"
    Write-Host "Processing $date"
    
    try {
        # 1. Query API
        $startTime = "$date 00:00:00"
        $endTime = "$date 23:59:59"
        
        $body = '{"pageNum": 1, "pageSize": 100000, "startTime": "' + $startTime + '", "endTime": "' + $endTime + '"}'
        
        $apiResponse = Invoke-RestMethod -Uri $apiUrl -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
        
        if ($apiResponse.code -ne 0) {
            throw "API query failed"
        }
        
        $apiCount = $apiResponse.total
        Add-Content -Path $logFile -Value "[$timestamp] [Info] API returned $apiCount records"
        Write-Host "API returned $apiCount records"
        
        # 2. Read local file
        if (Test-Path $localFile) {
            $localContent = Get-Content -Path $localFile -Raw | ConvertFrom-Json
            $localCount = $localContent.Length
        } else {
            $localCount = 0
            Add-Content -Path $logFile -Value "[$timestamp] [Info] Local file does not exist, creating empty file"
            Write-Host "Local file does not exist, creating empty file"
            @() | ConvertTo-Json | Out-File -FilePath $localFile -Encoding UTF8
        }
        
        Add-Content -Path $logFile -Value "[$timestamp] [Info] Local file has $localCount records"
        Write-Host "Local file has $localCount records"
        
        # 3. Compare and update if different
        if ($apiCount -ne $localCount) {
            Add-Content -Path $logFile -Value "[$timestamp] [Info] Record count mismatch, updating local file"
            Write-Host "Record count mismatch, updating local file"
            
            $updateResponse = Invoke-RestMethod -Uri $updateApiUrl -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
            
            if ($updateResponse.code -ne 0) {
                throw "Update failed"
            }
            
            $upsertedCount = $updateResponse.data.upserted
            Add-Content -Path $logFile -Value "[$timestamp] [Info] Updated $upsertedCount records"
            Write-Host "Updated $upsertedCount records"
        } else {
            Add-Content -Path $logFile -Value "[$timestamp] [Info] Record counts match, no update needed"
            Write-Host "Record counts match, no update needed"
        }
        
    } catch {
        $errorMsg = $_.Exception.Message
        Add-Content -Path $logFile -Value "[$timestamp] [Error] Error: $errorMsg"
        Write-Host "Error: $errorMsg" -ForegroundColor Red
    }
    
    # Pause
    Start-Sleep -Seconds 1
}

Add-Content -Path $logFile -Value "[$timestamp] [Info] Sync completed"
Write-Host "Sync completed"
