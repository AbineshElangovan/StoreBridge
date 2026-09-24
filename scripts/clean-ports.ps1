# scripts/clean-ports.ps1
# Automatically cleans up zombie processes and ports before dev starts

$workspace = (Get-Location).Path
$myPid = $PID

# 1. Free ports 3000 and 3457
$ports = @(3000, 3457)
foreach ($port in $ports) {
    try {
        $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        if ($conns) {
            $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
            foreach ($p in $pids) {
                if ($p -and $p -ne $myPid) {
                    Write-Host "[CleanPorts] Freeing port $port (PID: $p)..." -ForegroundColor Yellow
                    Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
                }
            }
        }
    } catch {}
}

# 2. Kill leftover Next.js / Shopify CLI processes from this folder
try {
    Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue | Where-Object {
        $_.ProcessId -ne $myPid -and (
            $_.CommandLine -like "*$workspace*" -and (
                $_.CommandLine -like "*next*" -or 
                $_.CommandLine -like "*shopify*"
            )
        )
    } | ForEach-Object {
        Write-Host "[CleanPorts] Stopping leftover dev process (PID: $($_.ProcessId))..." -ForegroundColor Yellow
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
} catch {}

Start-Sleep -Milliseconds 600
