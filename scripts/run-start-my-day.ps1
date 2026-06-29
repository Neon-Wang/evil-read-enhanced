param(
    [string]$Workspace = "C:\GitClient\windows\repos\evilread-workspace",
    [string]$Date = (Get-Date -Format "yyyy-MM-dd"),
    [string]$To = "487844383@qq.com",
    [string]$AgentDecisions = "",
    [switch]$NoSendEmail,
    [switch]$SkipGit,
    [switch]$SkipZoteroImport,
    [switch]$NoHumanizeDaily
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Test-EnvPresence {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Names
    )

    $missing = @()
    foreach ($name in $Names) {
        $present = $false
        foreach ($scope in @("Process", "User", "Machine")) {
            if (-not [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name, $scope))) {
                $present = $true
                break
            }
        }
        if (-not $present) {
            $missing += $name
        }
    }
    return $missing
}

function Get-EnvPresenceText {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [string]$Default = ""
    )

    foreach ($scope in @("Process", "User", "Machine")) {
        $value = [Environment]::GetEnvironmentVariable($Name, $scope)
        if (-not [string]::IsNullOrWhiteSpace($value)) {
            return $value
        }
    }
    return $Default
}

function Get-RequiredMailEnvNames {
    $provider = Get-EnvPresenceText -Name "CAT_EMAIL_PROVIDER" -Default "cf_relay"
    $provider = $provider.ToLowerInvariant()

    switch ($provider) {
        "cf_relay" {
            return @("CAT_CF_RELAY_URL", "CAT_CF_RELAY_SECRET")
        }
        "resend" {
            return @("CAT_RESEND_API_KEY", "CAT_FROM_EMAIL")
        }
        "smtp" {
            return @("CAT_SMTP_HOST", "CAT_SMTP_PORT", "CAT_SMTP_USER", "CAT_SMTP_PASSWORD", "CAT_FROM_EMAIL")
        }
        default {
            Write-Host "[ERR] Unsupported CAT_EMAIL_PROVIDER: $provider"
            exit 3
        }
    }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$pythonExe = Join-Path $repoRoot ".venv\Scripts\python.exe"
$orchestrator = Join-Path $repoRoot "tools\start_my_day_orchestrator.py"
$relaySync = Join-Path $repoRoot "scripts\sync-zotero-workspace.ps1"
$gitSshConfig = "C:\GitClient\windows\.ssh\config"
$relayCredentials = Get-EnvPresenceText -Name "EVILREAD_RELAY_CREDENTIALS"
$relayUseLocal = (Get-EnvPresenceText -Name "EVILREAD_RELAY_USE_LOCAL").ToLowerInvariant() -in @("1", "true", "yes")

Write-Host "[INFO] EvilRead Start My Day scheduler entry"
Write-Host "[INFO] Repo: $repoRoot"
Write-Host "[INFO] Workspace: $Workspace"
Write-Host "[INFO] Date: $Date"
Write-Host "[INFO] Send email: $(-not $NoSendEmail.IsPresent)"
Write-Host "[INFO] Skip git: $($SkipGit.IsPresent)"
Write-Host "[INFO] Skip Zotero import: $($SkipZoteroImport.IsPresent)"
Write-Host "[INFO] Humanize daily: $(-not $NoHumanizeDaily.IsPresent)"
Write-Host "[INFO] Agent decisions: $(if ([string]::IsNullOrWhiteSpace($AgentDecisions)) { 'not supplied' } else { $AgentDecisions })"
Write-Host "[INFO] Relay credentials: $(if ([string]::IsNullOrWhiteSpace($relayCredentials)) { 'not supplied' } else { 'supplied' })"

if ([string]::IsNullOrWhiteSpace($env:GIT_SSH_COMMAND) -and (Test-Path -LiteralPath $gitSshConfig)) {
    $gitSshConfigForGit = $gitSshConfig.Replace("\", "/")
    $env:GIT_SSH_COMMAND = "ssh -F `"$gitSshConfigForGit`""
    Write-Host "[OK] Git SSH command configured for local Gitea alias."
}

if (-not $NoSendEmail.IsPresent) {
    $requiredMailEnv = @(Get-RequiredMailEnvNames)
    $missingMailEnv = @(Test-EnvPresence -Names $requiredMailEnv)
    if ($missingMailEnv.Count -gt 0) {
        Write-Host "[ERR] Missing required mail environment variables: $($missingMailEnv -join ', ')"
        Write-Host "[ERR] Values were not printed."
        exit 3
    }
    Write-Host "[OK] Required mail environment variables are present. Values were not printed."
}

if (-not [string]::IsNullOrWhiteSpace($relayCredentials)) {
    $relayArgs = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $relaySync, "-Workspace", $Workspace, "-Credentials", $relayCredentials, "-BeforeStartMyDay")
    if ($relayUseLocal) {
        $relayArgs += "-UseLocalRelay"
    }
    Write-Host "[INFO] Syncing workspace relay before Start My Day"
    & powershell.exe @relayArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERR] Relay sync before Start My Day failed."
        exit $LASTEXITCODE
    }
}

$orchestratorArgs = @(
    $orchestrator,
    "--workspace", $Workspace,
    "--date", $Date,
    "--to", $To
)

if (-not $NoSendEmail.IsPresent) {
    $orchestratorArgs += "--send-email"
}
if ($SkipGit.IsPresent) {
    $orchestratorArgs += "--skip-git"
}
if ($SkipZoteroImport.IsPresent) {
    $orchestratorArgs += "--skip-zotero-import"
}
if ($NoHumanizeDaily.IsPresent) {
    $orchestratorArgs += "--no-humanize-daily"
}
if (-not [string]::IsNullOrWhiteSpace($AgentDecisions)) {
    $orchestratorArgs += @("--agent-decisions", $AgentDecisions)
}

Write-Host "[INFO] Running Start My Day orchestrator"
& $pythonExe @orchestratorArgs
$exitCode = $LASTEXITCODE
Write-Host "[INFO] Start My Day orchestrator exited with code $exitCode"
if ($exitCode -eq 0 -and -not [string]::IsNullOrWhiteSpace($relayCredentials) -and -not $SkipGit.IsPresent) {
    $relayArgs = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $relaySync, "-Workspace", $Workspace, "-Credentials", $relayCredentials, "-AfterStartMyDay")
    if ($relayUseLocal) {
        $relayArgs += "-UseLocalRelay"
    }
    Write-Host "[INFO] Syncing workspace relay after Start My Day"
    & powershell.exe @relayArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERR] Relay sync after Start My Day failed."
        exit $LASTEXITCODE
    }
}
exit $exitCode
