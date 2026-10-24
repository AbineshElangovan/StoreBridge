# scripts/clean-ports.ps1
# Safe Port 3000 & Next.js Dev Process Verification and Cleanup for StoreBridge

$tunnelId = "interesting-mountain-116tjtx.inc1"
$targetPort = 3000
$workspace = (Get-Location).Path
$myPid = $PID

# Check and refresh Microsoft Dev Tunnel expiration (30 days)
Write-Host "[Tunnel] Checking Microsoft Dev Tunnel ($tunnelId)..." -ForegroundColor Cyan
try {
    $renewOutput = & devtunnel update $tunnelId -e 30d 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[Tunnel] Dev Tunnel expiration successfully renewed for 30 days." -ForegroundColor Green
    } else {
        Write-Host "[Tunnel] Notice: Dev tunnel renewal returned: $($renewOutput.Trim())" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[Tunnel] Notice: Could not update tunnel expiration: $_" -ForegroundColor Yellow
}

# 1. Clean up any stale devtunnel processes hosting this specific tunnel
try {
    $allTunnelProcs = Get-Process -Name devtunnel -ErrorAction SilentlyContinue
    foreach ($tp in $allTunnelProcs) {
        $tunnelCim = Get-CimInstance Win32_Process -Filter "ProcessId = $($tp.Id)" -ErrorAction SilentlyContinue
        $tunnelCmd = if ($tunnelCim -and $tunnelCim.CommandLine) { $tunnelCim.CommandLine } else { "" }
        if ($tunnelCmd -like "*$tunnelId*" -or $tunnelCmd -like "*host*") {
            Write-Host "[TunnelCheck] Terminating stale devtunnel process (PID: $($tp.Id))..." -ForegroundColor Yellow
            Stop-Process -Id $tp.Id -Force -ErrorAction SilentlyContinue
        }
    }
} catch {}

# 2. Check Port 3000
try {
    $conn = Get-NetTCPConnection -LocalPort $targetPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
} catch {
    $conn = $null
}

function Show-StoreBridgeBanner {
    Write-Host ""
    Write-Host "================================================================================" -ForegroundColor Cyan
    Write-Host " StoreBridge Quick Links by Store (Tunnel & Vercel):" -ForegroundColor Green
    Write-Host ""
    Write-Host " [Master] Coimbatore Store:" -ForegroundColor White
    Write-Host "   Local (Tunnel): https://dz50mdfc-3000.inc1.devtunnels.ms/products?shop=eshan-coimbatore-store-8jjdfk4t.myshopify.com" -ForegroundColor Yellow
    Write-Host "   Live (Shopify): https://admin.shopify.com/store/eshan-coimbatore-store-8jjdfk4t/apps/f82dbdee74418429d3510c35ca99aae3/products" -ForegroundColor Cyan
    Write-Host ""
    Write-Host " ESHAN Chennai Store (Inventory Solutions):" -ForegroundColor White
    Write-Host "   Local (Tunnel): https://dz50mdfc-3000.inc1.devtunnels.ms/products?shop=eshan-inventory-solutions.myshopify.com" -ForegroundColor Yellow
    Write-Host "   Live (Shopify): https://admin.shopify.com/store/eshan-inventory-solutions/apps/f82dbdee74418429d3510c35ca99aae3/products" -ForegroundColor Cyan
    Write-Host ""
    Write-Host " Karur Store:" -ForegroundColor White
    Write-Host "   Local (Tunnel): https://dz50mdfc-3000.inc1.devtunnels.ms/products?shop=eshan-karur-store.myshopify.com" -ForegroundColor Yellow
    Write-Host "   Live (Shopify): https://admin.shopify.com/store/eshan-karur-store/apps/f82dbdee74418429d3510c35ca99aae3/products" -ForegroundColor Cyan
    Write-Host ""
    Write-Host " Namakkal Store:" -ForegroundColor White
    Write-Host "   Local (Tunnel): https://dz50mdfc-3000.inc1.devtunnels.ms/products?shop=eshan-namakkal.myshopify.com" -ForegroundColor Yellow
    Write-Host "   Live (Shopify): https://admin.shopify.com/store/eshan-namakkal/apps/f82dbdee74418429d3510c35ca99aae3/products" -ForegroundColor Cyan
    Write-Host "================================================================================" -ForegroundColor Cyan
    Write-Host ""
}

if (-not $conn) {
    Write-Host "[PortCheck] Port $targetPort is available." -ForegroundColor Green
    Show-StoreBridgeBanner
    exit 0
}

$occupiedPid = $conn.OwningProcess

if (-not $occupiedPid -or $occupiedPid -eq 0 -or $occupiedPid -eq $myPid) {
    Show-StoreBridgeBanner
    exit 0
}

# Identify process details
$proc = Get-Process -Id $occupiedPid -ErrorAction SilentlyContinue
$procName = if ($proc) { $proc.ProcessName } else { "Unknown" }

$cimProc = Get-CimInstance Win32_Process -Filter "ProcessId = $occupiedPid" -ErrorAction SilentlyContinue
$cmdLine = if ($cimProc -and $cimProc.CommandLine) { $cimProc.CommandLine } else { "" }

# Determine whether this process belongs to the StoreBridge workspace
# Strictly check command line or parent command line matching this workspace
$isStoreBridge = ($cmdLine -like "*$workspace*") -or 
                 ($cmdLine -like "*shopify-sync-master*") -or 
                 ($cmdLine -like "*Product-storebridge*") -or
                 ($cmdLine -like "*storebridge*")

if (-not $isStoreBridge -and $cimProc -and $cimProc.ParentProcessId) {
    $parentCim = Get-CimInstance Win32_Process -Filter "ProcessId = $($cimProc.ParentProcessId)" -ErrorAction SilentlyContinue
    if ($parentCim -and $parentCim.CommandLine) {
        $parentCmd = $parentCim.CommandLine
        if (($parentCmd -like "*$workspace*") -or 
            ($parentCmd -like "*shopify-sync-master*") -or 
            ($parentCmd -like "*Product-storebridge*") -or
            ($parentCmd -like "*storebridge*")) {
            $isStoreBridge = $true
        }
    }
}

if ($isStoreBridge) {
    Write-Host "[PortCheck] Stale StoreBridge process detected on port $targetPort (PID: $occupiedPid, Process: $procName)." -ForegroundColor Yellow
    Write-Host "[PortCheck] Safely terminating stale StoreBridge process tree $occupiedPid..." -ForegroundColor Yellow
    & taskkill.exe /F /T /PID $occupiedPid 2>$null | Out-Null
    Start-Sleep -Milliseconds 600
    Write-Host "[PortCheck] Port $targetPort successfully freed." -ForegroundColor Green
    Show-StoreBridgeBanner
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
    Write-Host "Please stop the conflicting application or free port $targetPort before starting dev." -ForegroundColor Red
    Write-Host "================================================================================" -ForegroundColor Red
    Write-Host ""
    exit 1
}
