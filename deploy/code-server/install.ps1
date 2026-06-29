[CmdletBinding()]
param(
    [string]$CodeServerVersion = "4.117.0",
    [string]$CodeServerInstallRoot = "C:\cs117",
    [switch]$SkipCodexPreRelease,
    [string]$OaiCompatibleCopilotVersion = "0.3.6",
    [string[]]$Extensions = @(
        "yzhang.markdown-all-in-one",
        "jishii1204.markdown-live-editor",
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
    param([Parameter(ValueFromRemainingArguments = $true)]$CodeServerArgs)

    $codeServerCmd = Get-CommandPath "code-server.cmd" @((Join-Path $env:APPDATA "npm\code-server.cmd"))
    if (-not $codeServerCmd) {
        throw "code-server.cmd is unavailable"
    }
    & $codeServerCmd @CodeServerArgs
    if ($LASTEXITCODE -ne 0) {
        throw "code-server failed with exit code ${LASTEXITCODE}: $CodeServerArgs"
    }
}

function Refresh-Path {
    $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machinePath;$userPath;C:\Program Files\nodejs;$(Join-Path $env:APPDATA "npm")"
}

function Get-CodeServerRequiredNodeMajor {
    param([Parameter(Mandatory)][string]$Version)

    $versionParts = $Version.Split(".")
    if ($versionParts.Count -lt 2) {
        return 20
    }

    $minor = [int]$versionParts[1]
    if ($minor -ge 101) {
        return 22
    }

    return 20
}

function Get-CodeServerVersion {
    param([Parameter(Mandatory)][string]$CodeServerCmd)

    $versionLine = (& $CodeServerCmd --version | Select-Object -First 1)
    if ($LASTEXITCODE -ne 0 -or -not $versionLine) {
        return $null
    }

    return ($versionLine -split "\s+")[0]
}

function Get-InstalledCodeServerCommand {
    param([Parameter(Mandatory)][string]$InstallRoot)

    $commandPath = Join-Path $InstallRoot "node_modules\.bin\code-server.cmd"
    if (Test-Path -LiteralPath $commandPath) {
        return $commandPath
    }

    return $null
}

function Install-CodexPreRelease {
    param(
        [Parameter(Mandatory)][string]$ExtensionsDir,
        [Parameter(Mandatory)][string]$CodeServerCmd
    )

    $vsixCacheDir = Join-Path $runtimeRoot "vsix-cache"
    New-Item -ItemType Directory -Force -Path $vsixCacheDir | Out-Null

    $queryBody = @{
        filters = @(@{
            criteria = @(
                @{ filterType = 7; value = "openai.chatgpt" }
            )
        })
        flags = 914
    } | ConvertTo-Json -Depth 10

    $headers = @{
        "Accept" = "application/json;api-version=7.2-preview.1"
        "Content-Type" = "application/json"
        "User-Agent" = "evilread-code-server-install"
    }

    Write-Host "[INFO] Querying latest OpenAI Codex VSIX from Marketplace..."
    $response = Invoke-RestMethod -Method Post -Uri "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery" -Headers $headers -Body $queryBody
    $extension = $response.results[0].extensions[0]
    $version = $extension.versions |
        Where-Object { $_.targetPlatform -eq "win32-x64" } |
        Select-Object -First 1

    if (-not $version) {
        throw "Could not find openai.chatgpt win32-x64 VSIX in Marketplace response."
    }

    $vsixUrl = ($version.files | Where-Object { $_.assetType -eq "Microsoft.VisualStudio.Services.VSIXPackage" } | Select-Object -First 1).source
    if (-not $vsixUrl) {
        throw "Could not find VSIX package URL for openai.chatgpt@$($version.version)."
    }

    $vsixPath = Join-Path $vsixCacheDir "openai.chatgpt-$($version.version)-win32-x64.vsix"
    Write-Host "[INFO] Downloading openai.chatgpt@$($version.version) to $vsixPath"
    Invoke-WebRequest -UseBasicParsing -Uri $vsixUrl -OutFile $vsixPath

    Write-Host "[INFO] Installing Codex pre-release VSIX..."
    & $CodeServerCmd --extensions-dir $ExtensionsDir --install-extension $vsixPath --force
    if ($LASTEXITCODE -ne 0) {
        throw "Codex VSIX install failed with exit code $LASTEXITCODE"
    }
}

function Install-OaiCompatibleCopilot {
    param(
        [Parameter(Mandatory)][string]$ExtensionsDir,
        [Parameter(Mandatory)][string]$CodeServerCmd,
        [Parameter(Mandatory)][string]$Version
    )

    $vsixCacheDir = Join-Path $runtimeRoot "vsix-cache"
    New-Item -ItemType Directory -Force -Path $vsixCacheDir | Out-Null

    $vsixUrl = "https://marketplace.visualstudio.com/_apis/public/gallery/publishers/johnny-zhao/vsextensions/oai-compatible-copilot/$Version/vspackage"
    $vsixPath = Join-Path $vsixCacheDir "johnny-zhao.oai-compatible-copilot-$Version.vsix"

    Write-Host "[INFO] Downloading johnny-zhao.oai-compatible-copilot@$Version to $vsixPath"
    Invoke-WebRequest -UseBasicParsing -Uri $vsixUrl -OutFile $vsixPath

    Write-Host "[INFO] Installing OAI Compatible Provider for Copilot VSIX..."
    & $CodeServerCmd --extensions-dir $ExtensionsDir --install-extension $vsixPath --force
    if ($LASTEXITCODE -ne 0) {
        throw "OAI Compatible Provider for Copilot VSIX install failed with exit code $LASTEXITCODE"
    }
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

$requiredNodeMajor = Get-CodeServerRequiredNodeMajor $CodeServerVersion
$nodeMajor = [int]((& $nodeExe --version).TrimStart("v").Split(".")[0])
if ($nodeMajor -ne $requiredNodeMajor) {
    Write-Host "[INFO] code-server@$CodeServerVersion expects Node.js $requiredNodeMajor.x. Installing OpenJS.NodeJS.$requiredNodeMajor with winget..."
    winget install --id "OpenJS.NodeJS.$requiredNodeMajor" --accept-package-agreements --accept-source-agreements
    Refresh-Path
    $nodeExe = Get-CommandPath "node.exe" @("C:\Program Files\nodejs\node.exe")
    $nodeMajor = [int]((& $nodeExe --version).TrimStart("v").Split(".")[0])
}
if ($nodeMajor -ne $requiredNodeMajor) {
    throw "Node.js $requiredNodeMajor.x is required for code-server@$CodeServerVersion. Current version: $(& $nodeExe --version)"
}

$gitBash = "C:\Program Files\Git\bin\bash.exe"
if (-not (Test-Path -LiteralPath $gitBash)) {
    throw "Git Bash is required for code-server's Windows npm postinstall script. Missing: $gitBash"
}
Invoke-Npm config set script-shell $gitBash
Write-Host "[INFO] npm script-shell: $(& $npmCmd config get script-shell)"

$codeServerCmd = Get-InstalledCodeServerCommand $CodeServerInstallRoot
if ($codeServerCmd) {
    $installedCodeServerVersion = Get-CodeServerVersion $codeServerCmd
}
else {
    $installedCodeServerVersion = $null
}

if (-not $codeServerCmd -or $installedCodeServerVersion -ne $CodeServerVersion) {
    Write-Host "[INFO] Installing code-server@$CodeServerVersion to $CodeServerInstallRoot with npm..."
    New-Item -ItemType Directory -Force -Path $CodeServerInstallRoot | Out-Null
    Invoke-Npm install --prefix $CodeServerInstallRoot "code-server@$CodeServerVersion" --no-audit --no-fund
}

$codeServerCmd = Get-InstalledCodeServerCommand $CodeServerInstallRoot
if (-not $codeServerCmd) {
    throw "code-server was not found after npm installation: $CodeServerInstallRoot"
}

Write-Host "[INFO] code-server version:"
& $codeServerCmd --version
if ($LASTEXITCODE -ne 0) {
    throw "code-server failed with exit code $LASTEXITCODE"
}

$runtimeRoot = Join-Path $env:LOCALAPPDATA "EvilRead\code-server"
$extensionsDir = Join-Path $runtimeRoot "extensions"
New-Item -ItemType Directory -Force -Path $extensionsDir | Out-Null

foreach ($extension in $Extensions) {
    Write-Host "[INFO] Installing extension $extension"
    & $codeServerCmd --extensions-dir $extensionsDir --install-extension $extension --force
    if ($LASTEXITCODE -ne 0) {
        throw "code-server extension install failed with exit code ${LASTEXITCODE}: $extension"
    }
}

if (-not $SkipCodexPreRelease) {
    Install-CodexPreRelease -ExtensionsDir $extensionsDir -CodeServerCmd $codeServerCmd
}

Install-OaiCompatibleCopilot -ExtensionsDir $extensionsDir -CodeServerCmd $codeServerCmd -Version $OaiCompatibleCopilotVersion

$patchMarkdownLiveEditor = Join-Path $PSScriptRoot "patch-markdown-live-editor.ps1"
if (Test-Path -LiteralPath $patchMarkdownLiveEditor) {
    Write-Host "[INFO] Patching Markdown Live Editor relative link handling..."
    & $patchMarkdownLiveEditor -ExtensionsDir $extensionsDir
}

Write-Host "[OK] code-server is installed."
Write-Host "[OK] Runtime root: $runtimeRoot"
Write-Host "[OK] Start with: .\deploy\code-server\start.ps1"
