$ErrorActionPreference = 'Stop'

$rootDir = 'c:\Users\saavi\Desktop\180 Project\180 core'
$pluginSrc = Join-Path $rootDir 'packages\plugins\wordpress-180-core'
$downloadsDir = Join-Path $rootDir 'apps\180developers-frontend\public\downloads'
$stagingDir = Join-Path $rootDir 'packages\plugins\wordpress-180-core\build_staging\180-core'

if (Test-Path (Join-Path $PSScriptRoot 'build_staging')) {
    Remove-Item -Recurse -Force (Join-Path $PSScriptRoot 'build_staging')
}

New-Item -ItemType Directory -Force -Path $stagingDir | Out-Null

Copy-Item (Join-Path $pluginSrc '180-core.php') $stagingDir -Force
Copy-Item (Join-Path $pluginSrc 'readme.txt') $stagingDir -Force
Copy-Item (Join-Path $pluginSrc 'assets') $stagingDir -Recurse -Force
Copy-Item (Join-Path $pluginSrc 'includes') $stagingDir -Recurse -Force

if (-not (Test-Path $downloadsDir)) {
    New-Item -ItemType Directory -Force -Path $downloadsDir | Out-Null
}

$zipTarget = Join-Path $downloadsDir '180-core.zip'
if (Test-Path $zipTarget) {
    Remove-Item -Force $zipTarget
}

Compress-Archive -Path $stagingDir -DestinationPath $zipTarget -Force
Remove-Item -Recurse -Force (Join-Path $PSScriptRoot 'build_staging')

Write-Host "Successfully packaged WordPress-compliant 180-core.zip (Size: $((Get-Item $zipTarget).Length) bytes)"
