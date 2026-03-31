# March 1-4 Call Logs Sync Script
# Function: Daily sync for March 1-4, compare with local files, update if different

# Configuration
$startDate = "2026-03-01"
$endDate = "2026-03-04"
$apiUrl = "http://localhost:5000/api/cxcc/call-logs"
$updateApiUrl = "http://localhost:5000/api/cxcc/call-logs/update-local"
$dataDir = "K:\CXCC2\data\local-sync"
$logFile = "K:\CXCC2\logs\sync-call-logs-march-1-to-4.log"

# Ensure log directory exists
if (!(Test-Path "K:\CXCC2\logs")) {
    New-Item -ItemType Directory -Path "K:\CXCC2\logs" -Force
}

# Write log
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path $logFile -Value "[$timestamp] [Info] Starting sync for March 1-4 call logs"
Write-Host "Starting sync for March 1-4 call logs"

# Generate date range
$currentDate = Get-Date $startDate
$endDateObj = Get-Date $endDate
$results = @()

while ($currentDate -le $endDateObj) {
    $dateStr = $currentDate.ToString("yyyy-MM-dd")
    $localFile = "$dataDir\qms_call_log_list_$dateStr.json"
    
    Add-Content -Path $logFile -Value "[$timestamp] [Info] Starting sync for $dateStr"
    Write-Host "Starting sync for $dateStr"
    
    try {
        # 1. Query API
        $startTime = "$dateStr 00:00:00"
        $endTime = "$dateStr 23:59:59"
        
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
        
        # 2. Read local file
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
        
        # 3. Compare and update if different
        if ($apiCount -ne $localCount) {
            $logMsg = "[$timestamp] [Info] Record count mismatch: API($apiCount) vs Local($localCount), updating local file"
            Add-Content -Path $logFile -Value $logMsg
            Write-Host $logMsg
            
            $updateResponse = Invoke-RestMethod -Uri $updateApiUrl -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
            
            if ($updateResponse.code -ne 0) {
                throw "Failed to update local file: $($updateResponse.message)"
            }
            
            $upsertedCount = $updateResponse.data.upserted
            $logMsg = "[$timestamp] [Info] Local file updated successfully, wrote $upsertedCount records"
            Add-Content -Path $logFile -Value $logMsg
            Write-Host $logMsg
            
            $results += @{ success = $true; date = $dateStr; apiCount = $apiCount; localCount = $localCount; upsertedCount = $upsertedCount }
        } else {
            $logMsg = "[$timestamp] [Info] Record counts match: API($apiCount) vs Local($localCount), no update needed"
            Add-Content -Path $logFile -Value $logMsg
            Write-Host $logMsg
            
            $results += @{ success = $true; date = $dateStr; apiCount = $apiCount; localCount = $localCount; upsertedCount = 0 }
        }
        
    } catch {
        $errorMsg = $_.Exception.Message
        $logMsg = "[$timestamp] [Error] Error syncing $dateStr: $errorMsg"
        Add-Content -Path $logFile -Value $logMsg
        Write-Host "Error: $errorMsg" -ForegroundColor Red
        $results += @{ success = $false; date = $dateStr; error = $errorMsg }
    }
    
    # Move to next day
    $currentDate = $currentDate.AddDays(1)
    
    # Pause to avoid API rate limiting
    Start-Sleep -Seconds 1
}

# Summary
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
        $logMsg = "[$timestamp] [Info] $($result.date): API=$($result.apiCount), Local=$($result.localCount), Updated=$($result.upsertedCount)"
        Add-Content -Path $logFile -Value $logMsg
        Write-Host $logMsg
    } else {
        $failedCount++
        $logMsg = "[$timestamp] [Error] $($result.date): Failed - $($result.error)"
        Add-Content -Path $logFile -Value $logMsg
        Write-Host $logMsg -ForegroundColor Red
    }
}

$logMsg = "[$timestamp] [Info] Sync completed: $successCount days successful, $failedCount days failed"
Add-Content -Path $logFile -Value $logMsg
Write-Host $logMsg

$logMsg = "[$timestamp] [Info] Total API records: $totalApiCount"
Add-Content -Path $logFile -Value $logMsg
Write-Host $logMsg

$logMsg = "[$timestamp] [Info] Total local records: $totalLocalCount"
Add-Content -Path $logFile -Value $logMsg
Write-Host $logMsg

$logMsg = "[$timestamp] [Info] Total updated records: $totalUpsertedCount"
Add-Content -Path $logFile -Value $logMsg
Write-Host $logMsg

$logMsg = "[$timestamp] [Info] Sync task completed"
Add-Content -Path $logFile -Value $logMsg
Write-Host "Sync task completed"
