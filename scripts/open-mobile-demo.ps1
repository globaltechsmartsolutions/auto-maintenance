param(
  [string]$Route = "empleado",
  [int]$Port = 3000,
  [switch]$DryRun
)

$cleanRoute = $Route.Trim().TrimStart("/")
if ([string]::IsNullOrWhiteSpace($cleanRoute)) {
  $cleanRoute = "empleado"
}

$url = "http://127.0.0.1:$Port/$cleanRoute"
$browserCandidates = @(
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)

$browser = $browserCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

if (-not $browser) {
  Write-Error "No se ha encontrado Microsoft Edge ni Google Chrome."
  exit 1
}

$profileDir = Join-Path $env:TEMP "limpiapro-mobile-demo-profile"
New-Item -ItemType Directory -Path $profileDir -Force | Out-Null

$arguments = @(
  "--app=$url",
  "--window-size=430,900",
  "--user-data-dir=$profileDir",
  "--force-device-scale-factor=1"
)

if ($DryRun) {
  Write-Output "Browser: $browser"
  Write-Output "URL: $url"
  Write-Output "Args: $($arguments -join ' ')"
  exit 0
}

Start-Process -FilePath $browser -ArgumentList $arguments
Write-Output "Demo movil abierta: $url"
