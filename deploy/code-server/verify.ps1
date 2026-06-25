[CmdletBinding()]
param(
    [string]$Url = "http://127.0.0.1:18080/"
)

$ErrorActionPreference = "Stop"

$workspaceRepo = "C:\GitClient\windows\repos\evilread-workspace"
$toolsRepo = "C:\Users\O2\Documents\GitHub\evil-read-enhanced"
$deployRoot = $PSScriptRoot

function Enable-GitNetworkEnvironment {
    $sshConfig = "C:\GitClient\windows\.ssh\config"
    if (Test-Path -LiteralPath $sshConfig) {
        $env:GIT_SSH_COMMAND = "ssh -F `"$sshConfig`""
        Write-Host "[INFO] Using Git SSH config: $sshConfig"
    }

    foreach ($port in @(7897, 7890)) {
        $client = New-Object System.Net.Sockets.TcpClient
        try {
            $asyncResult = $client.BeginConnect("127.0.0.1", $port, $null, $null)
            if ($asyncResult.AsyncWaitHandle.WaitOne(1000)) {
                $client.EndConnect($asyncResult)
                $proxy = "http://127.0.0.1:$port"
                $env:http_proxy = $proxy
                $env:https_proxy = $proxy
                $env:all_proxy = "socks5://127.0.0.1:$port"
                Write-Host "[INFO] Using Git proxy on 127.0.0.1:$port"
                return
            }
        }
        catch {
        }
        finally {
            $client.Close()
        }
    }

    Write-Host "[WARN] No local Git proxy detected on 127.0.0.1:7897 or 127.0.0.1:7890"
}

Write-Host "[INFO] Checking code-server HTTP endpoint: $Url"
$response = Invoke-WebRequest -UseBasicParsing $Url -TimeoutSec 10
if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 500) {
    throw "Unexpected HTTP status from code-server: $($response.StatusCode)"
}
Write-Host "[OK] code-server HTTP status: $($response.StatusCode)"

Write-Host "[INFO] Checking required workspace paths"
foreach ($path in @(
    $workspaceRepo,
    $toolsRepo,
    (Join-Path $toolsRepo "README.md"),
    (Join-Path $workspaceRepo "zotero\library\items\C43KBR9V.pdf")
)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Missing required path: $path"
    }
    Write-Host "[OK] $path"
}

Write-Host "[INFO] Running Git checks"
Enable-GitNetworkEnvironment
git -C $workspaceRepo status --short --branch
git -C $workspaceRepo fetch --dry-run
git -C $toolsRepo status --short --branch
git -C $toolsRepo fetch --dry-run

Write-Host "[INFO] Running EvilRead smoke test"
& (Join-Path $toolsRepo ".venv\Scripts\python.exe") (Join-Path $toolsRepo "tools\tests\smoke_loop.py")

Write-Host "[INFO] Scanning deployment files for obvious secrets"
$patterns = @(
    "password\s*[:=]",
    "token\s*[:=]",
    "secret\s*[:=]",
    "BEGIN (RSA|OPENSSH|PRIVATE) KEY",
    "CF_[A-Z0-9_]*TOKEN",
    ("cloud" + "flared.*" + "token")
)
$files = Get-ChildItem -LiteralPath $deployRoot -Recurse -File | Where-Object {
    $_.FullName -notmatch "\\.git\\" -and $_.Extension -notin @(".png", ".jpg", ".jpeg", ".gif", ".pdf")
}
foreach ($file in $files) {
    $content = Get-Content -LiteralPath $file.FullName -Raw -ErrorAction Stop
    foreach ($pattern in $patterns) {
        if ($content -match $pattern) {
            throw "Potential secret pattern '$pattern' found in $($file.FullName)"
        }
    }
}
Write-Host "[OK] No obvious secret patterns found in deploy/code-server"

Write-Host "[OK] code-server deployment verification passed"
