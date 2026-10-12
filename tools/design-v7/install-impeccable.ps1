param(
    [switch]$Execute,
    [switch]$RunAudit
)
$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
if (-not (Test-Path (Join-Path $repoRoot ".git"))) { throw "Run only inside a git checkout." }
$branch = (& git -C $repoRoot branch --show-current).Trim()
if ($branch -in @("main","master")) { throw "Production/default branch is not allowed." }
Write-Host "M3TM V7 / $branch / local-only / no hooks"
Write-Host "Planned: npx --yes impeccable@4.5.2 install -y --providers=cursor --scope=project --no-hooks"
if (-not $Execute) {
  Write-Host "DRY RUN. Pass -Execute to install after reviewing upstream."
  return
}
if (-not (Get-Command npx.cmd -ErrorAction SilentlyContinue)) { throw "npx.cmd is required." }
Push-Location $repoRoot
try {
  & npx.cmd --yes impeccable@4.5.2 install -y --providers=cursor --scope=project --no-hooks
  if ($LASTEXITCODE -ne 0) { throw "Impeccable install failed: $LASTEXITCODE" }
  if ($RunAudit) {
    & npx.cmd --yes impeccable@4.5.2 detect src/
    if ($LASTEXITCODE -ne 0) { throw "Design audit returned findings/error: $LASTEXITCODE" }
  }
} finally { Pop-Location }
