param(
    [string]$Workspace = "C:\GitClient\windows\repos\evilread-workspace",
    [string]$Remote = $env:EVILREAD_WORKSPACE_REMOTE,
    [string]$Credentials = "",
    [string]$PassphraseEnv = "EVILREAD_RELAY_PASSPHRASE",
    [string]$GitCaCert = "",
    [switch]$UseLocalRelay,
    [switch]$BeforeStartMyDay,
    [switch]$AfterStartMyDay,
    [switch]$NoPush
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
    return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Read-RelayCredentials {
    param([string]$Path)
    if (-not $Path) { return @{} }
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "credential file not found: $Path"
    }
    $repoRoot = Get-RepoRoot
    $python = Join-Path $repoRoot ".venv\Scripts\python.exe"
    if (-not (Test-Path -LiteralPath $python)) {
        $python = "python"
    }
    $json = & $python (Join-Path $repoRoot "tools\relay_credentials.py") decrypt --input $Path --passphrase-env $PassphraseEnv
    if ($LASTEXITCODE -ne 0) {
        throw "failed to decrypt relay credentials"
    }
    return $json | ConvertFrom-Json
}

function Invoke-Git {
    param(
        [string]$Cwd,
        [string[]]$GitArgs,
        [string[]]$GitConfig
    )
    & git @GitConfig -C $Cwd @GitArgs
    if ($LASTEXITCODE -ne 0) {
        throw "git $($GitArgs -join ' ') failed in $Cwd"
    }
}

$creds = Read-RelayCredentials -Path $Credentials
if ($UseLocalRelay -and $creds -and $creds.PSObject.Properties.Name -contains "local_test_remote") {
    $Remote = [string]$creds.local_test_remote
}
if (-not $Remote -and $creds -and $creds.PSObject.Properties.Name -contains "workspace_remote") {
    $Remote = [string]$creds.workspace_remote
}
if (-not $Remote) {
    throw "workspace remote is required. Set EVILREAD_WORKSPACE_REMOTE or provide encrypted credentials with workspace_remote."
}
if (-not $GitCaCert -and $creds -and $creds.PSObject.Properties.Name -contains "git_ca_cert") {
    $GitCaCert = [string]$creds.git_ca_cert
}

$gitConfig = @()
if ($GitCaCert) {
    $caCandidate = $GitCaCert
    if (-not [System.IO.Path]::IsPathRooted($caCandidate)) {
        $caCandidate = Join-Path (Get-RepoRoot) $caCandidate
    }
    $resolvedCaCert = (Resolve-Path -LiteralPath $caCandidate).Path
    $gitConfig += @("-c", "http.sslBackend=openssl")
    $gitConfig += @("-c", "http.sslCAInfo=$resolvedCaCert")
}
if ($creds -and ($creds.PSObject.Properties.Name -contains "git_username") -and ($creds.PSObject.Properties.Name -contains "git_token")) {
    $username = [string]$creds.git_username
    $credentialSecret = [string]$creds.git_token
    if ($username -and $credentialSecret) {
        $basic = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("${username}:${credentialSecret}"))
        $gitConfig += @("-c", "http.extraHeader=Authorization: Basic $basic")
    }
}

$workspaceParent = Split-Path -Parent $Workspace
if (-not (Test-Path -LiteralPath $workspaceParent)) {
    New-Item -ItemType Directory -Force -Path $workspaceParent | Out-Null
}

if (-not (Test-Path -LiteralPath (Join-Path $Workspace ".git"))) {
    git @gitConfig clone $Remote $Workspace
    if ($LASTEXITCODE -ne 0) {
        throw "git clone failed: $Remote -> $Workspace"
    }
}

Invoke-Git -Cwd $Workspace -GitArgs @("remote", "set-url", "origin", $Remote) -GitConfig $gitConfig
Invoke-Git -Cwd $Workspace -GitArgs @("fetch", "origin") -GitConfig $gitConfig
Invoke-Git -Cwd $Workspace -GitArgs @("pull", "--ff-only", "origin", "main") -GitConfig $gitConfig

if ($BeforeStartMyDay) {
    Write-Output "workspace synchronized before start-my-day: $Workspace"
    exit 0
}

if ($AfterStartMyDay -and -not $NoPush) {
    $status = (& git -C $Workspace status --short)
    if ($status) {
        Write-Output "workspace has uncommitted changes; start-my-day orchestrator should commit with explicit paths before push"
    }
    Invoke-Git -Cwd $Workspace -GitArgs @("push", "origin", "main") -GitConfig $gitConfig
    Write-Output "workspace pushed after start-my-day: $Workspace"
}
