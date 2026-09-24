# scripts/clean-ports.ps1
# Safe Port 3000 Verification and Cleanup for StoreBridge

# Automatically refresh Microsoft Dev Tunnel expiration for another 30 days
try {
    devtunnel update interesting-mountain-116tjtx.inc1 -e 30d 2>$null | Out-Null
} catch {}

$targetPort = 3000
$workspace = (Get-Location).Path
$myPid = $PID

try {
    $conn = Get-NetTCPConnection -LocalPort $targetPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
} catch {
    $conn = $null
}

if (-not $conn) {
    Write-Host "[PortCheck] Port $targetPort is available." -ForegroundColor Green
    exit 0
}

$occupiedPid = $conn.OwningProcess

if (-not $occupiedPid -or $occupiedPid -eq 0 -or $occupiedPid -eq $myPid) {
    exit 0
}

# Identify process details
$proc = Get-Process -Id $occupiedPid -ErrorAction SilentlyContinue
$procName = if ($proc) { $proc.ProcessName } else { "Unknown" }

$cimProc = Get-CimInstance Win32_Process -Filter "ProcessId = $occupiedPid" -ErrorAction SilentlyContinue
$cmdLine = if ($cimProc -and $cimProc.CommandLine) { $cimProc.CommandLine } else { "" }

# Determine whether this process belongs to the StoreBridge workspace
$isStoreBridge = ($cmdLine -like "*$workspace*") -or 
                 ($cmdLine -like "*shopify-sync-master*") -or 
                 ($cmdLine -like "*storebridge*")

if ($isStoreBridge) {
    Write-Host "[PortCheck] Stale StoreBridge process detected on port $targetPort (PID: $occupiedPid, Process: $procName)." -ForegroundColor Yellow
    Write-Host "[PortCheck] Safely terminating stale StoreBridge process $occupiedPid..." -ForegroundColor Yellow
    Stop-Process -Id $occupiedPid -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 600
    Write-Host "[PortCheck] Port $targetPort successfully freed." -ForegroundColor Green
    exit 0
} else {
    Write-Host ""
    Write-Host "================================================================================" -ForegroundColor Red
    Write-Host "[PORT CONFLICT] Port $targetPort is currently in use by an UNRELATED application!" -ForegroundColor Red
    Write-Host "  - PID:          $occupiedPid" -ForegroundColor Yellow
    Write-Host "  - Process:      $procName" -ForegroundColor Yellow
    if ($cmdLine) {
        Write-Host "  - Command Line: $cmdLine" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "StoreBridge will NOT terminate unrelated applications automatically." -ForegroundColor Red
    Write-Host "Please stop the conflicting application or free port $targetPort before running npm run dev." -ForegroundColor Red
    Write-Host "================================================================================" -ForegroundColor Red
    Write-Host ""
    exit 1
}
