# Cadence Implementation - Ralph Wiggum Batch Processing Script
# Run this script to execute all implementation phases sequentially
# Each task uses the Ralph Loop pattern for iterative completion
#
# Usage:
#   .\cadence-batch.ps1                         # Run all phases
#   .\cadence-batch.ps1 -StartPhase 3           # Start from Phase 3
#   .\cadence-batch.ps1 -Phase 2                # Run only Phase 2
#   .\cadence-batch.ps1 -StartTask "1.4"        # Resume from Phase 1, Task 4
#   .\cadence-batch.ps1 -ListTasks              # List all tasks without running
#   .\cadence-batch.ps1 -Resume                 # Resume from last incomplete task
#   .\cadence-batch.ps1 -ResetProgress          # Clear progress and start fresh

param(
    [int]$StartPhase = 1,
    [int]$Phase = 0,
    [string]$StartTask = "",
    [switch]$ListTasks,
    [switch]$Resume,
    [switch]$ResetProgress,
    [int]$MaxIterations = 50
)

$ProjectRoot = "C:\Users\Justi\Repos\Cadence"
$BatchDir = Join-Path $ProjectRoot "batch"
$ProgressFile = Join-Path $BatchDir "progress.json"
$LogDir = Join-Path $BatchDir "logs"

# Ensure log directory exists
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

# Progress tracking functions
function Get-Progress {
    if (Test-Path $ProgressFile) {
        return Get-Content $ProgressFile | ConvertFrom-Json
    }
    return @{
        completedTasks = @()
        failedTasks = @()
        currentTask = $null
        lastRun = $null
    }
}

function Save-Progress {
    param([hashtable]$Progress)
    $Progress | ConvertTo-Json -Depth 10 | Set-Content $ProgressFile
}

function Mark-TaskComplete {
    param([string]$TaskId, [string]$TaskName)
    $progress = Get-Progress

    # Convert to hashtable if needed
    if ($progress -is [PSCustomObject]) {
        $progress = @{
            completedTasks = @($progress.completedTasks)
            failedTasks = @($progress.failedTasks)
            currentTask = $progress.currentTask
            lastRun = $progress.lastRun
        }
    }

    if ($progress.completedTasks -notcontains $TaskId) {
        $progress.completedTasks += $TaskId
    }
    $progress.failedTasks = @($progress.failedTasks | Where-Object { $_ -ne $TaskId })
    $progress.currentTask = $null
    $progress.lastRun = (Get-Date).ToString("o")
    Save-Progress $progress

    Write-Host "  [PROGRESS] Task $TaskId marked complete" -ForegroundColor DarkGreen
}

function Mark-TaskFailed {
    param([string]$TaskId, [string]$TaskName, [string]$Error)
    $progress = Get-Progress

    # Convert to hashtable if needed
    if ($progress -is [PSCustomObject]) {
        $progress = @{
            completedTasks = @($progress.completedTasks)
            failedTasks = @($progress.failedTasks)
            currentTask = $progress.currentTask
            lastRun = $progress.lastRun
        }
    }

    if ($progress.failedTasks -notcontains $TaskId) {
        $progress.failedTasks += $TaskId
    }
    $progress.currentTask = $null
    $progress.lastRun = (Get-Date).ToString("o")
    Save-Progress $progress

    Write-Host "  [PROGRESS] Task $TaskId marked failed" -ForegroundColor Red
}

function Mark-TaskStarted {
    param([string]$TaskId, [string]$TaskName)
    $progress = Get-Progress

    # Convert to hashtable if needed
    if ($progress -is [PSCustomObject]) {
        $progress = @{
            completedTasks = @($progress.completedTasks)
            failedTasks = @($progress.failedTasks)
            currentTask = $progress.currentTask
            lastRun = $progress.lastRun
        }
    }

    $progress.currentTask = @{
        id = $TaskId
        name = $TaskName
        startedAt = (Get-Date).ToString("o")
    }
    Save-Progress $progress
}

function Is-TaskComplete {
    param([string]$TaskId)
    $progress = Get-Progress
    return $progress.completedTasks -contains $TaskId
}

function Get-NextIncompleteTask {
    param([hashtable]$AllPhases)

    foreach ($PhaseNum in ($AllPhases.Keys | Sort-Object)) {
        $Tasks = $AllPhases[$PhaseNum].Tasks
        $TaskNum = 1
        foreach ($Task in $Tasks) {
            $TaskId = "$PhaseNum.$TaskNum"
            if (-not (Is-TaskComplete $TaskId)) {
                return @{
                    PhaseNum = $PhaseNum
                    TaskNum = $TaskNum
                    TaskId = $TaskId
                    Task = $Task
                }
            }
            $TaskNum++
        }
    }
    return $null
}

# Helper function to run a Ralph Loop task
function Invoke-RalphLoop {
    param(
        [string]$TaskId,
        [string]$TaskName,
        [string]$Prompt,
        [int]$Iterations = $MaxIterations
    )

    # Skip if already complete
    if (Is-TaskComplete $TaskId) {
        Write-Host "`n[SKIP] $TaskName (already complete)" -ForegroundColor DarkGray
        return $true
    }

    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "STARTING TASK: $TaskId - $TaskName" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan

    Set-Location $ProjectRoot
    Mark-TaskStarted $TaskId $TaskName

    # Create log file for this task
    $LogFile = Join-Path $LogDir "$($TaskId -replace '\.', '-')-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"

    # Escape single quotes in prompt for command line
    $EscapedPrompt = $Prompt -replace "'", "''"

    try {
        # Run Claude with the Ralph Loop and capture output
        $output = claude -p "/ralph-loop:ralph-loop '$EscapedPrompt' --max-iterations $Iterations" 2>&1
        $output | Out-File -FilePath $LogFile -Encoding utf8

        # Check for success indicators in output
        $outputText = $output -join "`n"
        $promisePattern = "<promise>PHASE_\d+_\d+_COMPLETE</promise>"

        if ($outputText -match $promisePattern -or $outputText -match "COMPLETE" -or $LASTEXITCODE -eq 0) {
            Mark-TaskComplete $TaskId $TaskName
            Write-Host "`n----------------------------------------" -ForegroundColor Green
            Write-Host "COMPLETED: $TaskId - $TaskName" -ForegroundColor Green
            Write-Host "Log: $LogFile" -ForegroundColor DarkGray
            Write-Host "----------------------------------------`n" -ForegroundColor Green
            return $true
        } else {
            # Check for known error conditions
            if ($outputText -match "Prompt is too long") {
                Mark-TaskFailed $TaskId $TaskName "Prompt too long - needs to be split"
                Write-Host "`n[ERROR] Prompt too long for task $TaskId" -ForegroundColor Red
            } else {
                Mark-TaskFailed $TaskId $TaskName "Unknown failure"
            }
            Write-Host "Log: $LogFile" -ForegroundColor DarkGray
            return $false
        }
    }
    catch {
        $errorMsg = $_.Exception.Message
        Mark-TaskFailed $TaskId $TaskName $errorMsg
        Write-Host "`n[ERROR] Task $TaskId failed: $errorMsg" -ForegroundColor Red
        Write-Host "Log: $LogFile" -ForegroundColor DarkGray
        return $false
    }
}

# Load phase files
function Get-PhaseTasks {
    param([int]$PhaseNum)

    $PhaseFile = Join-Path $BatchDir "phase-$PhaseNum.ps1"
    if (Test-Path $PhaseFile) {
        & $PhaseFile
    } else {
        Write-Host "Phase file not found: $PhaseFile" -ForegroundColor Red
        return @()
    }
}

# Get all phases
$AllPhases = @{
    1 = @{ Name = "Foundation + Daily Notes"; Tasks = (Get-PhaseTasks 1) }
    2 = @{ Name = "Full Periodic Notes Hierarchy"; Tasks = (Get-PhaseTasks 2) }
    3 = @{ Name = "Named Templates"; Tasks = (Get-PhaseTasks 3) }
    4 = @{ Name = "Task Management"; Tasks = (Get-PhaseTasks 4) }
    5 = @{ Name = "Context & Search"; Tasks = (Get-PhaseTasks 5) }
    6 = @{ Name = "Polish & Distribution"; Tasks = (Get-PhaseTasks 6) }
}

# Reset progress mode
if ($ResetProgress) {
    if (Test-Path $ProgressFile) {
        Remove-Item $ProgressFile -Force
        Write-Host "Progress reset. Starting fresh." -ForegroundColor Yellow
    } else {
        Write-Host "No progress file to reset." -ForegroundColor Yellow
    }
    exit 0
}

# List tasks mode
if ($ListTasks) {
    $progress = Get-Progress

    Write-Host "`nCadence Implementation Tasks" -ForegroundColor Cyan
    Write-Host "============================`n" -ForegroundColor Cyan

    foreach ($PhaseNum in ($AllPhases.Keys | Sort-Object)) {
        $PhaseInfo = $AllPhases[$PhaseNum]
        Write-Host "Phase $PhaseNum : $($PhaseInfo.Name)" -ForegroundColor Yellow

        $TaskNum = 1
        foreach ($Task in $PhaseInfo.Tasks) {
            $TaskId = "$PhaseNum.$TaskNum"
            $status = ""
            $color = "White"

            if ($progress.completedTasks -contains $TaskId) {
                $status = " [DONE]"
                $color = "Green"
            } elseif ($progress.failedTasks -contains $TaskId) {
                $status = " [FAILED]"
                $color = "Red"
            } elseif ($progress.currentTask.id -eq $TaskId) {
                $status = " [IN PROGRESS]"
                $color = "Yellow"
            }

            Write-Host "  $TaskId - $($Task.Name)$status" -ForegroundColor $color
            $TaskNum++
        }
        Write-Host ""
    }

    $TotalTasks = ($AllPhases.Values | ForEach-Object { $_.Tasks.Count } | Measure-Object -Sum).Sum
    $CompletedCount = @($progress.completedTasks).Count
    $FailedCount = @($progress.failedTasks).Count

    Write-Host "Progress: $CompletedCount/$TotalTasks complete" -ForegroundColor $(if ($CompletedCount -eq $TotalTasks) { "Green" } else { "Yellow" })
    if ($FailedCount -gt 0) {
        Write-Host "Failed: $FailedCount tasks need attention" -ForegroundColor Red
    }
    exit 0
}

# Determine starting point
$StartFromPhase = $StartPhase
$StartFromTask = 1

if ($Resume) {
    $nextTask = Get-NextIncompleteTask $AllPhases
    if ($null -eq $nextTask) {
        Write-Host "All tasks complete! Nothing to resume." -ForegroundColor Green
        exit 0
    }
    $StartFromPhase = $nextTask.PhaseNum
    $StartFromTask = $nextTask.TaskNum
    Write-Host "Resuming from task $($nextTask.TaskId): $($nextTask.Task.Name)" -ForegroundColor Yellow
}
elseif ($StartTask -ne "") {
    # Parse StartTask like "1.4" or "2.3"
    $parts = $StartTask -split '\.'
    if ($parts.Count -eq 2) {
        $StartFromPhase = [int]$parts[0]
        $StartFromTask = [int]$parts[1]
    } else {
        Write-Host "Invalid StartTask format. Use 'Phase.Task' like '1.4' or '2.3'" -ForegroundColor Red
        exit 1
    }
}

# Determine which phases to run
if ($Phase -gt 0) {
    $PhasesToRun = @($Phase)
} else {
    $PhasesToRun = $AllPhases.Keys | Sort-Object | Where-Object { $_ -ge $StartFromPhase }
}

# Display execution plan
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "CADENCE BATCH IMPLEMENTATION" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Project Root: $ProjectRoot" -ForegroundColor White
Write-Host "Max Iterations per Task: $MaxIterations" -ForegroundColor White
Write-Host "Phases to Run: $($PhasesToRun -join ', ')" -ForegroundColor White
if ($StartFromTask -gt 1) {
    Write-Host "Starting from Task: $StartFromPhase.$StartFromTask" -ForegroundColor White
}
Write-Host "Progress File: $ProgressFile" -ForegroundColor DarkGray
Write-Host "========================================`n" -ForegroundColor Cyan

# Execute phases
$FailedTasks = @()

foreach ($PhaseNum in $PhasesToRun) {
    $PhaseInfo = $AllPhases[$PhaseNum]

    Write-Host "`n########################################" -ForegroundColor Magenta
    Write-Host "PHASE $PhaseNum : $($PhaseInfo.Name)" -ForegroundColor Magenta
    Write-Host "########################################`n" -ForegroundColor Magenta

    $TaskNum = 1
    foreach ($Task in $PhaseInfo.Tasks) {
        $TaskId = "$PhaseNum.$TaskNum"

        # Skip tasks before start point
        if ($PhaseNum -eq $StartFromPhase -and $TaskNum -lt $StartFromTask) {
            Write-Host "[SKIP] $TaskId - $($Task.Name) (before start point)" -ForegroundColor DarkGray
            $TaskNum++
            continue
        }

        $success = Invoke-RalphLoop -TaskId $TaskId -TaskName $Task.Name -Prompt $Task.Prompt -Iterations $MaxIterations

        if (-not $success) {
            $FailedTasks += $TaskId
            Write-Host "`n[WARNING] Task $TaskId failed. Continuing with next task..." -ForegroundColor Yellow
        }

        $TaskNum++
    }

    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "PHASE $PhaseNum COMPLETE" -ForegroundColor Green
    Write-Host "========================================`n" -ForegroundColor Green
}

# Completion message
Write-Host "`n" -ForegroundColor Cyan
Write-Host "########################################" -ForegroundColor Cyan
if ($FailedTasks.Count -eq 0) {
    Write-Host "ALL PHASES COMPLETE" -ForegroundColor Green
} else {
    Write-Host "BATCH COMPLETE WITH FAILURES" -ForegroundColor Yellow
}
Write-Host "########################################" -ForegroundColor Cyan

$progress = Get-Progress
$TotalTasks = ($AllPhases.Values | ForEach-Object { $_.Tasks.Count } | Measure-Object -Sum).Sum
$CompletedCount = @($progress.completedTasks).Count

Write-Host "`nProgress: $CompletedCount/$TotalTasks tasks complete" -ForegroundColor $(if ($CompletedCount -eq $TotalTasks) { "Green" } else { "Yellow" })

if ($FailedTasks.Count -gt 0) {
    Write-Host "`nFailed tasks this run:" -ForegroundColor Red
    foreach ($taskId in $FailedTasks) {
        Write-Host "  - $taskId" -ForegroundColor Red
    }
    Write-Host "`nTo retry failed tasks, run: .\cadence-batch.ps1 -StartTask $($FailedTasks[0])" -ForegroundColor Yellow
}

Write-Host "`nTo see full progress: .\cadence-batch.ps1 -ListTasks" -ForegroundColor DarkGray
Write-Host "To resume from where you left off: .\cadence-batch.ps1 -Resume" -ForegroundColor DarkGray
Write-Host "Run 'pnpm test' to verify all tests pass." -ForegroundColor Yellow
Write-Host "Run 'pnpm build' to build all packages." -ForegroundColor Yellow
