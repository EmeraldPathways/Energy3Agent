param(
  [switch]$ForceRestart
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverLog = Join-Path $repoRoot 'server.dev.log'
$clientLog = Join-Path $repoRoot 'frontend.dev.log'
$serverPort = 3001
$clientPort = 3000
$serverUrl = "http://127.0.0.1:${serverPort}/api/health"
$clientUrl = "http://localhost:${clientPort}"
$nodeExe = 'C:\nvm4w\nodejs\node.exe'
$npmCli = 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js'

function Test-UrlAvailable {
  param([string]$Url)

  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
  }

  return $false
}

function Stop-ListenerProcess {
  param([int]$Port)

  try {
    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop
  } catch {
    return
  }

  $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($pid in $pids) {
    try {
      Stop-Process -Id $pid -Force -ErrorAction Stop
    } catch {
      Write-Warning "Could not stop PID $pid on port ${Port}: $($_.Exception.Message)"
    }
  }
}

function Start-ServiceProcess {
  param(
    [string]$Name,
    [string]$Command,
    [string]$LogPath
  )

  if (-not (Test-Path -LiteralPath $LogPath)) {
    New-Item -ItemType File -Path $LogPath | Out-Null
  }

  Start-Process `
    -FilePath 'cmd.exe' `
    -ArgumentList @(
      '/c',
      "cd /d `"$repoRoot`" && $Command >> `"$LogPath`" 2>&1"
    ) `
    -WorkingDirectory $repoRoot `
    -WindowStyle Hidden

  Write-Host "Started $Name."
}

function Wait-ForPort {
  param(
    [string]$Name,
    [int]$Port,
    [string]$Url,
    [string]$LogPath
  )

  for ($i = 0; $i -lt 60; $i++) {
    if (Test-UrlAvailable -Url $Url) {
      Write-Host "$Name is ready on http://localhost:${Port}"
      return
    }

    Start-Sleep -Milliseconds 500
  }

  throw "$Name did not start on port ${Port}. Check $LogPath"
}

if ($ForceRestart) {
  Stop-ListenerProcess -Port $serverPort
  Stop-ListenerProcess -Port $clientPort
}

if (-not (Test-Path -LiteralPath (Join-Path $repoRoot 'node_modules'))) {
  throw "Dependencies are missing. Run 'npm.cmd install' first."
}

if (-not (Test-UrlAvailable -Url $serverUrl)) {
  Start-ServiceProcess -Name 'server' -Command "set `"DOTENV_CONFIG_PATH=$repoRoot\.env`" && `"$nodeExe`" `"$npmCli`" run dev:server" -LogPath $serverLog
}

if (-not (Test-UrlAvailable -Url $clientUrl)) {
  Start-ServiceProcess -Name 'client' -Command "`"$nodeExe`" `"$npmCli`" run dev:client" -LogPath $clientLog
}

Wait-ForPort -Name 'Server' -Port $serverPort -Url $serverUrl -LogPath $serverLog
Wait-ForPort -Name 'Client' -Port $clientPort -Url $clientUrl -LogPath $clientLog

Write-Host ""
Write-Host "Frontend: http://localhost:${clientPort}"
Write-Host "Backend:  http://localhost:${serverPort}"
Write-Host "Logs:"
Write-Host "  $clientLog"
Write-Host "  $serverLog"
