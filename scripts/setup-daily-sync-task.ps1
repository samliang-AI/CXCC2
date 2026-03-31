#!/usr/bin/env pwsh

# Setup Windows scheduled task for daily data sync backup

$taskName = "CXCC Daily Backup Sync"
$scriptPath = "$PSScriptRoot\daily-backup-sync.js"
$logPath = "$PSScriptRoot\..\data\local-sync\task-scheduler.log"

# Ensure log directory exists
$logDir = Split-Path -Path $logPath -Parent
if (-not (Test-Path -Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force
}

# Write log function
function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] $Message"
    Write-Host $logEntry
    Add-Content -Path $logPath -Value $logEntry
}

Write-Log "Starting setup of daily data sync backup task"

# Check if Node.js is installed
if (-not (Get-Command "node" -ErrorAction SilentlyContinue)) {
    Write-Log "Error: Node.js not found, please install Node.js first" "ERROR"
    exit 1
}

# Check if script exists
if (-not (Test-Path -Path $scriptPath)) {
    Write-Log "Error: Sync script not found: $scriptPath" "ERROR"
    exit 1
}

# Test if script can run normally
Write-Log "Testing sync script..."
try {
    $testOutput = & node $scriptPath --test 2>&1
    Write-Log "Script test successful" "SUCCESS"
} catch {
    Write-Log "Script test failed: $($_.Exception.Message)" "ERROR"
    exit 1
}

# Create scheduled task
Write-Log "Creating Windows scheduled task..."

try {
    # First unregister existing task if it exists
    if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
        Write-Log "Removing existing task: $taskName" "INFO"
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    }
    
    # Build task action
    $action = New-ScheduledTaskAction -Execute "node.exe" -Argument "$scriptPath"
    
    # Build task trigger (daily at 19:30)
    $trigger = New-ScheduledTaskTrigger -Daily -At "7:30 PM"
    
    # Build task settings
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5)
    
    # Register task
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "CXCC system daily data sync backup task, sync recording list, call log list, team and agent data"
    
    Write-Log "Scheduled task created successfully: $taskName" "SUCCESS"
    Write-Log "Task will run automatically at 19:30 every day" "INFO"
    
    # Display task information
    Write-Log "Task details:"
    $task = Get-ScheduledTask -TaskName $taskName
    Write-Log "  Task name: $($task.TaskName)"
    Write-Log "  Description: $($task.Description)"
    $triggerTime = $task.Triggers[0].StartBoundary
    $dateTime = [DateTime]::Parse($triggerTime)
    $timeOnly = $dateTime.ToString('HH:mm')
    Write-Log "  Trigger: Daily at $timeOnly"
    Write-Log "  Action: $($task.Actions[0].Execute) $($task.Actions[0].Arguments)"
    
} catch {
    Write-Log "Failed to create scheduled task: $($_.Exception.Message)" "ERROR"
    exit 1
}

Write-Log "Daily data sync backup task setup completed" "SUCCESS"
