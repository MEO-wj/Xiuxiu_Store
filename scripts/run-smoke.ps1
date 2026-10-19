# T9 smoke: kill stale server -> start production server -> run contract smoke -> kill process tree
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-smoke.ps1
$ErrorActionPreference = "Continue"
Set-Location (Split-Path -Parent $PSScriptRoot)
New-Item -ItemType Directory -Force -Path logs | Out-Null

function Stop-Port3000 {
  $listeners = netstat -ano | Select-String ':3000\s+.*LISTENING'
  foreach ($l in $listeners) {
    $procId = ($l.Line -split '\s+')[-1]
    if ($procId -match '^\d+$') {
      Write-Host "killing stale listener PID $procId"
      taskkill /PID $procId /T /F 2>&1 | Out-Null
    }
  }
  Start-Sleep -Seconds 2
}

Stop-Port3000

$proc = Start-Process -FilePath "cmd.exe" -ArgumentList '/c','pnpm start > logs\server.log 2>&1' -PassThru -WindowStyle Hidden

$ready = $false
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Seconds 1
  try {
    $res = Invoke-WebRequest -Uri "http://localhost:3000/" -UseBasicParsing -TimeoutSec 3
    if ($res.StatusCode -eq 200) { $ready = $true; break }
  } catch { }
}

if (-not $ready) {
  Write-Host "server not ready, log tail:"
  Get-Content logs\server.log -Tail 20
  taskkill /PID $proc.Id /T /F 2>&1 | Out-Null
  exit 1
}

# 确认没有 EADDRINUSE（启动失败但仍能访问即说明打到了旧进程）
$logText = Get-Content logs\server.log -Raw
if ($logText -match 'EADDRINUSE') {
  Write-Host "detected EADDRINUSE in server log, aborting to avoid stale-server results"
  Get-Content logs\server.log -Tail 10
  taskkill /PID $proc.Id /T /F 2>&1 | Out-Null
  exit 1
}

Write-Host "server ready, running smoke ..."
node scripts/smoke-api.mjs
$code = $LASTEXITCODE

Write-Host "stopping server (process tree) ..."
taskkill /PID $proc.Id /T /F 2>&1 | Out-Null
Stop-Port3000

exit $code
