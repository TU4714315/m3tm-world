param([int]$Port = 3102)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$nodeCommand = (Get-Command node).Source
if ([int]((& $nodeCommand -p "process.versions.node.split('.')[0]")) -lt 22) {
    $nodeCommand = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
}
if (!(Test-Path -LiteralPath '.next/standalone/server.js')) {
    throw 'Run npm run build before starting the production preview.'
}
Copy-Item -LiteralPath 'public' -Destination '.next/standalone' -Recurse -Force
Copy-Item -LiteralPath '.next/static' -Destination '.next/standalone/.next' -Recurse -Force
$env:PORT = "$Port"
$env:HOSTNAME = '127.0.0.1'
& $nodeCommand '.next/standalone/server.js'