#!/usr/bin/env pwsh

# Setup Windows scheduled task for recording list sync every minute

$taskName = "CXCC Recording Sync Every Minute"
$scriptPath = "$PSScriptRoot\sync-recordings-every-minute.ps1"
$logPath = "$PSScriptRoot\..\logs\setup-recording-sync-task.log"

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

Write-Log "Starting setup of recording list sync every minute task"

# Check if script exists
if (-not (Test-Path -Path $scriptPath)) {
    Write-Log "Error: Sync script not found: $scriptPath" "ERROR"
    exit 1
}

# Test if script can run normally
Write-Log "Testing sync script..."
try {
    $testOutput = & powershell -ExecutionPolicy Bypass -File $scriptPath 2>&1
    Write-Log "Script test successful" "SUCCESS"
} catch {
    Write-Log "Script test failed: $($_.Exception.Message)" "ERROR"
    exit 1
}

# Create scheduled task
Write-Log "Creating Windows scheduled task..."

try {
    # Remove existing task if it exists
    Write-Log "Checking for existing task..."
    $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($existingTask) {
        Write-Log "Removing existing task..."
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        Write-Log "Existing task removed successfully" "SUCCESS"
    }
    
    # Build task action
    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File $scriptPath"
    
    # Build task trigger (every minute)
    $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration (New-TimeSpan -Days 365)
    
    # Build task settings
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5) -Hidden
    
    # Register task
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "CXCC system recording list sync every minute task"
    
    Write-Log "Scheduled task created successfully: $taskName" "SUCCESS"
    Write-Log "Task will run automatically every minute" "INFO"
    
    # Display task information
    Write-Log "Task details:"
    $task = Get-ScheduledTask -TaskName $taskName
    Write-Log "  Task name: $($task.TaskName)"
    Write-Log "  Description: $($task.Description)"
    Write-Log "  Trigger: Every minute"
    Write-Log "  Action: $($task.Actions[0].Execute) $($task.Actions[0].Arguments)"
    
} catch {
    Write-Log "Failed to create scheduled task: $($_.Exception.Message)" "ERROR"
    exit 1
}

Write-Log "Recording list sync every minute task setup completed" "SUCCESS"