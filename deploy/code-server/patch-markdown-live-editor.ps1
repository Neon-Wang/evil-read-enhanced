[CmdletBinding()]
param(
    [string]$ExtensionsDir = (Join-Path $env:LOCALAPPDATA "EvilRead\code-server\extensions")
)

$ErrorActionPreference = "Stop"

function Update-TextFile {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][scriptblock]$Mutate
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "File not found: $Path"
    }

    $utf8NoBom = [System.Text.UTF8Encoding]::new($false, $true)
    $content = [System.IO.File]::ReadAllText($Path, $utf8NoBom)
    $updated = & $Mutate $content

    if ($updated -eq $content) {
        Write-Host "[OK] Already patched: $Path"
        return
    }

    [System.IO.File]::WriteAllText($Path, $updated, $utf8NoBom)
    Write-Host "[OK] Patched: $Path"
}

if (-not (Test-Path -LiteralPath $ExtensionsDir)) {
    throw "Extensions directory not found: $ExtensionsDir"
}

$extension = Get-ChildItem -LiteralPath $ExtensionsDir -Directory |
    Where-Object { $_.Name -like "jishii1204.markdown-live-editor-*" } |
    Sort-Object Name -Descending |
    Select-Object -First 1

if (-not $extension) {
    throw "Markdown Live Editor extension not found in $ExtensionsDir"
}

$messageValidatorNeedle = 'case"syncDebugLog":return e.source==="view"'
$openLinkValidator = 'case"openLink":return typeof e.href=="string";'
$messageHandlerNeedle = 'case"syncDebugLog":{if(!y())break;'
$openLinkHandler = 'case"openLink":{let i=a.href;if(/^https?:\/\//i.test(i)||/^mailto:/i.test(i)){await s.env.openExternal(s.Uri.parse(i));break}let d=decodeURIComponent(i.split("#")[0].split("?")[0]);if(!d)break;let u=s.Uri.joinPath(r,...d.split(/[\\/]+/));await s.commands.executeCommand("vscode.open",u);break}'

foreach ($relativePath in @("dist\extension.js", "dist\web\extension.js")) {
    $scriptPath = Join-Path $extension.FullName $relativePath
    Update-TextFile -Path $scriptPath -Mutate {
        param($content)

        if (-not $content.Contains($messageValidatorNeedle)) {
            throw "Message validator patch point not found in $scriptPath"
        }
        $content = $content.Replace($openLinkValidator, "")
        $content = $content.Replace($messageValidatorNeedle, $openLinkValidator + $messageValidatorNeedle)

        if (-not $content.Contains($messageHandlerNeedle)) {
            throw "Message handler patch point not found in $scriptPath"
        }
        $content = $content.Replace($openLinkHandler, "")
        $content = $content.Replace($messageHandlerNeedle, $openLinkHandler + $messageHandlerNeedle)

        return $content
    }
}

$viewScriptPath = Join-Path $extension.FullName "media\view.js"
$linkClickHandlerNeedle = 'var es=acquireVsCodeApi();'
$linkClickHandler = 'document.addEventListener("click",e=>{let t=e.target instanceof Element?e.target.closest("a[href]"):null;if(!t)return;let r=t.getAttribute("href")||"";if(!r||r.startsWith("#")||r.toLowerCase().startsWith("javascript:"))return;e.preventDefault(),e.stopPropagation(),es.postMessage({type:"openLink",href:r})},!0);'

Update-TextFile -Path $viewScriptPath -Mutate {
    param($content)

    if (-not $content.Contains($linkClickHandlerNeedle)) {
        throw "Link click handler patch point not found in $viewScriptPath"
    }

    $content = $content.Replace($linkClickHandler, "")
    return $content.Replace($linkClickHandlerNeedle, $linkClickHandlerNeedle + $linkClickHandler)
}

Write-Host "[OK] Markdown Live Editor relative links now open through VS Code."
