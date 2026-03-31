# Daily file generation script
$logFile = "K:\CXCC2\logs\daily-file-generator.log"
$dataDir = "K:\CXCC2\data\local-sync"

# Ensure log directory exists
if (!(Test-Path "K:\CXCC2\logs")) {
    New-Item -ItemType Directory -Path "K:\CXCC2\logs" -Force
}

# Generate today's date string
$today = Get-Date -Format "yyyy-MM-dd"

# Write log
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path $logFile -Value "[$timestamp] [Info] Starting daily file generation task"
Add-Content -Path $logFile -Value "[$timestamp] [Info] Generation date: $today"

# 1. Generate today's recording list JSON file
$recordingFile = "$dataDir\qms_recording_list_$today.json"
if (!(Test-Path $recordingFile)) {
    Add-Content -Path $logFile -Value "[$timestamp] [Info] Creating blank recording list file: $recordingFile"
    @() | ConvertTo-Json | Out-File -FilePath $recordingFile -Encoding UTF8
    Add-Content -Path $logFile -Value "[$timestamp] [Info] Recording list file created successfully"
} else {
    Add-Content -Path $logFile -Value "[$timestamp] [Info] Recording list file already exists: $recordingFile"
}

# 2. Generate today's call log list JSON file
$callLogFile = "$dataDir\qms_call_log_list_$today.json"
if (!(Test-Path $callLogFile)) {
    Add-Content -Path $logFile -Value "[$timestamp] [Info] Creating blank call log list file: $callLogFile"
    @() | ConvertTo-Json | Out-File -FilePath $callLogFile -Encoding UTF8
    Add-Content -Path $logFile -Value "[$timestamp] [Info] Call log list file created successfully"
} else {
    Add-Content -Path $logFile -Value "[$timestamp] [Info] Call log list file already exists: $callLogFile"
}

# 3. Create outbound team configuration JSON file for today
$teamFile = "$dataDir\qms_team_list_$today.json"
if (!(Test-Path $teamFile)) {
    Add-Content -Path $logFile -Value "[$timestamp] [Info] Creating blank outbound team configuration file: $teamFile"
    @() | ConvertTo-Json | Out-File -FilePath $teamFile -Encoding UTF8
    Add-Content -Path $logFile -Value "[$timestamp] [Info] Outbound team configuration file created successfully"
} else {
    Add-Content -Path $logFile -Value "[$timestamp] [Info] Outbound team configuration file already exists: $teamFile"
}

# 4. Generate agent settings JSON file for today
$agentFile = "$dataDir\qms_agent_list_$today.json"
if (!(Test-Path $agentFile)) {
    Add-Content -Path $logFile -Value "[$timestamp] [Info] Creating blank agent settings file: $agentFile"
    @() | ConvertTo-Json | Out-File -FilePath $agentFile -Encoding UTF8
    Add-Content -Path $logFile -Value "[$timestamp] [Info] Agent settings file created successfully"
} else {
    Add-Content -Path $logFile -Value "[$timestamp] [Info] Agent settings file already exists: $agentFile"
}

Add-Content -Path $logFile -Value "[$timestamp] [Info] Daily file generation task completed"
