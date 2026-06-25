[CmdletBinding()]
param(
    [string]$CodeServerVersion = "4.93.1",
    [string[]]$Extensions = @(
        "yzhang.markdown-all-in-one",
        "tomoki1207.pdf",
        "foam.foam-vscode"
    )
)

$ErrorActionPreference = "Stop"

function Test-Command {
    param([Parameter(Mandatory)][string]$Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-CommandPath {
    param(
        [Parameter(Mandatory)][string]$Name,
        [string[]]$FallbackPaths = @()
    )

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    foreach ($fallbackPath in $FallbackPaths) {
        if (Test-Path -LiteralPath $fallbackPath) {
            return $fallbackPath
        }
    }

    return $null
}

function Invoke-Npm {
    $npmCmd = Get-CommandPath "npm.cmd" @("C:\Program Files\nodejs\npm.cmd")
    if (-not $npmCmd) {
        throw "npm.cmd is unavailable"
    }
    & $npmCmd @args
    if ($LASTEXITCODE -ne 0) {
        throw "npm failed with exit code ${LASTEXITCODE}: $args"
    }
}

function Invoke-CodeServer {
    $codeServerCmd = Get-CommandPath "code-server.cmd" @((Join-Path $env:APPDATA "npm\code-server.cmd"))
    if (-not $codeServerCmd) {
        throw "code-server.cmd is unavailable"
    }
    & $codeServerCmd @args
    if ($LASTEXITCODE -ne 0) {
        throw "code-server failed with exit code ${LASTEXITCODE}: $args"
    }
}

function Refresh-Path {
    $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machinePath;$userPath;C:\Program Files\nodejs;$(Join-Path $env:APPDATA "npm")"
}

if (-not (Test-Command winget)) {
    throw "winget is required to install Node.js automatically. Install Node.js LTS manually, then rerun this script."
}

if (-not (Get-CommandPath "node.exe" @("C:\Program Files\nodejs\node.exe")) -or -not (Get-CommandPath "npm.cmd" @("C:\Program Files\nodejs\npm.cmd"))) {
    Write-Host "[INFO] Node.js/npm not found. Installing OpenJS Node.js 20 with winget..."
    winget install --id OpenJS.NodeJS.20 --accept-package-agreements --accept-source-agreements
    Refresh-Path
}

$nodeExe = Get-CommandPath "node.exe" @("C:\Program Files\nodejs\node.exe")
$npmCmd = Get-CommandPath "npm.cmd" @("C:\Program Files\nodejs\npm.cmd")
if (-not $nodeExe -or -not $npmCmd) {
    throw "npm is still unavailable after Node.js installation. Open a new PowerShell session and rerun this script."
}

Write-Host "[INFO] Node version: $(& $nodeExe --version)"
Write-Host "[INFO] npm version: $(& $npmCmd --version)"

$nodeMajor = [int]((& $nodeExe --version).TrimStart("v").Split(".")[0])
if ($nodeMajor -ne 20) {
    Write-Host "[INFO] code-server@$CodeServerVersion expects Node.js 20.x. Installing OpenJS.NodeJS.20 with winget..."
    winget install --id OpenJS.NodeJS.20 --accept-package-agreements --accept-source-agreements
    Refresh-Path
    $nodeExe = Get-CommandPath "node.exe" @("C:\Program Files\nodejs\node.exe")
    $nodeMajor = [int]((& $nodeExe --version).TrimStart("v").Split(".")[0])
}
if ($nodeMajor -ne 20) {
    throw "Node.js 20.x is required for code-server@$CodeServerVersion. Current version: $(& $nodeExe --version)"
}

$gitBash = "C:\Program Files\Git\bin\bash.exe"
if (-not (Test-Path -LiteralPath $gitBash)) {
    throw "Git Bash is required for code-server's Windows npm postinstall script. Missing: $gitBash"
}
Invoke-Npm config set script-shell $gitBash
Write-Host "[INFO] npm script-shell: $(& $npmCmd config get script-shell)"

$codeServerCmd = Get-CommandPath "code-server.cmd" @((Join-Path $env:APPDATA "npm\code-server.cmd"))
if ($codeServerCmd) {
    Write-Host "[INFO] Checking existing code-server installation..."
    & $codeServerCmd --version | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[WARN] Existing code-server command is broken. Reinstalling..."
        & $npmCmd uninstall --global code-server
        $npmPrefix = (& $npmCmd config get prefix).Trim()
        Remove-Item -LiteralPath (Join-Path $npmPrefix "node_modules\code-server") -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath (Join-Path $npmPrefix "code-server.cmd") -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath (Join-Path $npmPrefix "code-server.ps1") -Force -ErrorAction SilentlyContinue
    }
}

$codeServerCmd = Get-CommandPath "code-server.cmd" @((Join-Path $env:APPDATA "npm\code-server.cmd"))
if (-not $codeServerCmd) {
    Write-Host "[INFO] Installing code-server@$CodeServerVersion globally with npm..."
    Invoke-Npm install --global "code-server@$CodeServerVersion"
    Refresh-Path
}

$codeServerCmd = Get-CommandPath "code-server.cmd" @((Join-Path $env:APPDATA "npm\code-server.cmd"))
if (-not $codeServerCmd) {
    throw "code-server was not found after npm installation. Check npm global prefix and PATH."
}

Write-Host "[INFO] code-server version:"
Invoke-CodeServer --version

$runtimeRoot = Join-Path $env:LOCALAPPDATA "EvilRead\code-server"
$extensionsDir = Join-Path $runtimeRoot "extensions"
New-Item -ItemType Directory -Force -Path $extensionsDir | Out-Null

foreach ($extension in $Extensions) {
    Write-Host "[INFO] Installing extension $extension"
    Invoke-CodeServer --extensions-dir $extensionsDir --install-extension $extension --force
}

Write-Host "[OK] code-server is installed."
Write-Host "[OK] Runtime root: $runtimeRoot"
Write-Host "[OK] Start with: .\deploy\code-server\start.ps1"
