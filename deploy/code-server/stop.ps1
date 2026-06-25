[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$runtimeRoot = Join-Path $env:LOCALAPPDATA "EvilRead\code-server"
$pidFile = Join-Path $runtimeRoot "code-server.pid"
$port = 18080

if (-not (Test-Path -LiteralPath $pidFile)) {
    Write-Host "[INFO] No PID file found at $pidFile"
    exit 0
}

$pidText = (Get-Content -LiteralPath $pidFile -ErrorAction Stop | Select-Object -First 1).Trim()
if (-not $pidText) {
    Remove-Item -LiteralPath $pidFile -Force
    Write-Host "[INFO] Removed empty PID file."
    exit 0
}

$process = Get-Process -Id ([int]$pidText) -ErrorAction SilentlyContinue
if ($process) {
    Stop-Process -Id $process.Id -Force
    Write-Host "[OK] Stopped code-server PID $($process.Id)"
}
else {
    Write-Host "[INFO] PID $pidText is not running."
}

Remove-Item -LiteralPath $pidFile -Force

$listeners = netstat -ano | Select-String ":$port\s+.*LISTENING"
foreach ($listener in $listeners) {
    $parts = ($listener.Line -split "\s+") | Where-Object { $_ }
    $listenerPid = [int]$parts[-1]
    $listenerProcess = Get-Process -Id $listenerPid -ErrorAction SilentlyContinue
    if ($listenerProcess) {
        Stop-Process -Id $listenerProcess.Id -Force
        Write-Host "[OK] Stopped process listening on $port. PID: $($listenerProcess.Id)"
    }
}
