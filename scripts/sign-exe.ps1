# scripts/sign-exe.ps1
param(
  [Parameter(Mandatory=$true)][string]$PfxPath,
  [Parameter(Mandatory=$true)][string]$PfxPassword,
  [string]$ExePath = "$PSScriptRoot\..\src-tauri\target\release\supermarket-pos.exe"
)

# locate signtool (part of Windows 10/11 SDK)
# update path if needed
$signtool = "C:\Program Files (x86)\Windows Kits\10\bin\x64\signtool.exe"
if (-not (Test-Path $signtool)) {
  Write-Host "signtool not found at $signtool. Please install Windows SDK and update path in this script."
  exit 1
}

if (-not (Test-Path $ExePath)) {
  Write-Host "Executable not found at $ExePath"
  exit 1
}

Write-Host "Signing $ExePath with $PfxPath ..."
& $signtool sign /f $PfxPath /p $PfxPassword /tr http://timestamp.digicert.com /td sha256 /fd sha256 $ExePath

if ($LASTEXITCODE -eq 0) {
  Write-Host "Signing succeeded. Verifying..."
  & $signtool verify /pa /v $ExePath
} else {
  Write-Host "Signing failed. exitcode: $LASTEXITCODE"
}
