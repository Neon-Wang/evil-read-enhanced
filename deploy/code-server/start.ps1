[CmdletBinding()]
param(
    [string]$BindAddress = "127.0.0.1:18080",
    [string]$CodeServerInstallRoot = "C:\cs117",
    [switch]$Background
)

$ErrorActionPreference = "Stop"

function Get-RequiredCommand {
    param(
        [Parameter(Mandatory)][string]$CommandName,
        [string[]]$FallbackPaths = @()
    )

    $command = Get-Command $CommandName -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    foreach ($fallbackPath in $FallbackPaths) {
        if (Test-Path -LiteralPath $fallbackPath) {
            return $fallbackPath
        }
    }

    throw "$CommandName is not installed or not on PATH. Run deploy\code-server\install.ps1 first."
}

function ConvertTo-CodeServerWebPath {
    param([Parameter(Mandatory)][string]$Path)
    $fullPath = [System.IO.Path]::GetFullPath($Path).Replace("\", "/")
    if ($fullPath -match "^[A-Za-z]:/") {
        return "/$fullPath"
    }
    return $fullPath
}

function Resolve-RepoPath {
    param([Parameter(Mandatory)][string]$Path)
    $resolved = Resolve-Path -LiteralPath $Path -ErrorAction Stop
    return $resolved.Path
}

$workspaceRepo = Resolve-RepoPath "C:\GitClient\windows\repos\evilread-workspace"
$toolsRepo = Resolve-RepoPath "C:\Users\O2\Documents\GitHub\evil-read-enhanced"
$workspaceFile = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "evilread.code-workspace") -ErrorAction Stop

$runtimeRoot = Join-Path $env:LOCALAPPDATA "EvilRead\code-server"
$userDataDir = Join-Path $runtimeRoot "user-data"
$extensionsDir = Join-Path $runtimeRoot "extensions"
$disabledExtensionsDir = Join-Path $runtimeRoot "extensions-disabled"
$pidFile = Join-Path $runtimeRoot "code-server.pid"
$stdoutLogFile = Join-Path $runtimeRoot "code-server.out.log"
$stderrLogFile = Join-Path $runtimeRoot "code-server.err.log"

New-Item -ItemType Directory -Force -Path $userDataDir, $extensionsDir, $disabledExtensionsDir | Out-Null

Get-ChildItem -LiteralPath $extensionsDir -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "jishii1204.markdown-live-editor-*" } |
    ForEach-Object {
        $targetPath = Join-Path $disabledExtensionsDir $_.Name
        if (Test-Path -LiteralPath $targetPath) {
            Remove-Item -LiteralPath $targetPath -Recurse -Force
        }
        Move-Item -LiteralPath $_.FullName -Destination $targetPath
        Write-Host "[INFO] Disabled Markdown Live Editor extension: $targetPath"
    }

$nodeExe = Get-RequiredCommand "node.exe" @("C:\Program Files\nodejs\node.exe")
$npmCmd = Get-RequiredCommand "npm.cmd" @("C:\Program Files\nodejs\npm.cmd")

$shortPathCodeServerEntry = Join-Path $CodeServerInstallRoot "node_modules\code-server\out\node\entry.js"
if (Test-Path -LiteralPath $shortPathCodeServerEntry) {
    $codeServerEntry = $shortPathCodeServerEntry
}
else {
    $npmPrefix = (& $npmCmd config get prefix).Trim()
    $codeServerEntry = Join-Path $npmPrefix "node_modules\code-server\out\node\entry.js"
}
if (-not (Test-Path -LiteralPath $codeServerEntry)) {
    throw "code-server entrypoint not found: $codeServerEntry"
}

$workspaceWebPath = ConvertTo-CodeServerWebPath $workspaceFile.Path
$coderSettingsFile = Join-Path $userDataDir "coder.json"
$coderSettings = @{}
if (Test-Path -LiteralPath $coderSettingsFile) {
    $rawSettings = Get-Content -LiteralPath $coderSettingsFile -Raw
    if ($rawSettings.Trim().Length -gt 0) {
        $existingSettings = $rawSettings | ConvertFrom-Json
        foreach ($property in $existingSettings.PSObject.Properties) {
            $coderSettings[$property.Name] = $property.Value
        }
    }
}
$coderSettings["query"] = @{ workspace = $workspaceWebPath }
$coderSettings | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $coderSettingsFile -Encoding utf8

$codeServerArgs = @(
    "--bind-addr", $BindAddress,
    "--auth", "none",
    "--user-data-dir", $userDataDir,
    "--extensions-dir", $extensionsDir,
    "--enable-proposed-api", "openai.chatgpt",
    "--disable-telemetry"
)

Write-Host "[INFO] Workspace repo: $workspaceRepo"
Write-Host "[INFO] Tools repo: $toolsRepo"
Write-Host "[INFO] Workspace file: $($workspaceFile.Path)"
Write-Host "[INFO] Runtime root: $runtimeRoot"
Write-Host "[INFO] code-server entry: $codeServerEntry"
Write-Host "[INFO] URL: http://$BindAddress"
Write-Host "[INFO] Auth: none; keep this listener loopback/private and put Cloudflare Access in front before any public exposure."

if ($Background) {
    $nodeArgs = @($codeServerEntry) + $codeServerArgs
    $process = Start-Process -FilePath $nodeExe -ArgumentList $nodeArgs -WorkingDirectory $workspaceRepo -RedirectStandardOutput $stdoutLogFile -RedirectStandardError $stderrLogFile -WindowStyle Hidden -PassThru
    Set-Content -LiteralPath $pidFile -Value $process.Id -Encoding ascii
    Write-Host "[OK] code-server started in background. PID: $($process.Id)"
    Write-Host "[OK] stdout log: $stdoutLogFile"
    Write-Host "[OK] stderr log: $stderrLogFile"
    Write-Host "[OK] Stop with: .\deploy\code-server\stop.ps1"
    exit 0
}

Push-Location $workspaceRepo
try {
    & $nodeExe $codeServerEntry @codeServerArgs
}
finally {
    Pop-Location
}
