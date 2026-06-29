param(
    [string]$ListenHost = "127.0.0.1",
    [int]$ListenPort = 18083,
    [string]$Upstream = "http://127.0.0.1:3000",
    [switch]$Foreground
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$python = Join-Path $repoRoot ".venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $python)) {
    $python = "python"
}

$args = @(
    (Join-Path $repoRoot "tools\git_tls_relay.py"),
    "--listen-host", $ListenHost,
    "--listen-port", [string]$ListenPort,
    "--upstream", $Upstream,
    "--cert", (Join-Path $repoRoot "deploy\relay\git-relay.local.crt"),
    "--key", (Join-Path $repoRoot "deploy\relay\git-relay.local.key")
)

if ($Foreground) {
    & $python @args
    exit $LASTEXITCODE
}

$process = Start-Process -WindowStyle Hidden -FilePath $python -ArgumentList $args -PassThru
Write-Output "git TLS relay started: pid=$($process.Id) https://$ListenHost`:$ListenPort -> $Upstream"
