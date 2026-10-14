$ErrorActionPreference='Stop'
Set-Location -LiteralPath $PSScriptRoot
New-Item -ItemType Directory -Path '.tools/downloads','.tools/android-sdk','.cache/android','.cache/tmp' -Force | Out-Null
$env:TEMP=Join-Path $PSScriptRoot '.cache/tmp'
$env:TMP=$env:TEMP
$env:ANDROID_USER_HOME=Join-Path $PSScriptRoot '.cache/android'
$env:ANDROID_HOME=Join-Path $PSScriptRoot '.tools/android-sdk'
$taskZip=Join-Path $PSScriptRoot '.tools/downloads/sdk-tools.zip'
if (-not (Test-Path -LiteralPath $taskZip)) { Invoke-WebRequest -Uri 'https://dl.google.com/android/repository/commandlinetools-win-15859902_latest.zip' -OutFile $taskZip }
$taskHash=(Get-FileHash -LiteralPath $taskZip -Algorithm SHA256).Hash
if ($taskHash -ne '90AE805D20434428BFFCB699C290860F19BB5F66A67E6B330067E3DE801FB04A') {throw 'SDK archive checksum mismatch.'}
$taskLatest=Join-Path $PSScriptRoot '.tools/android-sdk/cmdline-tools/latest'
if (-not (Test-Path -LiteralPath $taskLatest)) {
    Expand-Archive -LiteralPath $taskZip -DestinationPath '.tools/unpacked-sdk' -Force
    New-Item -ItemType Directory -Path '.tools/android-sdk/cmdline-tools' -Force | Out-Null
    $taskSource=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '.tools/unpacked-sdk/cmdline-tools'))
    $taskTarget=[IO.Path]::GetFullPath($taskLatest)
    $taskPrefix=[IO.Path]::GetFullPath($PSScriptRoot)+[IO.Path]::DirectorySeparatorChar
    if (-not $taskSource.StartsWith($taskPrefix) -or -not $taskTarget.StartsWith($taskPrefix)) {throw 'Move target outside project.'}
    Move-Item -LiteralPath $taskSource -Destination $taskTarget
}
# Running setup accepts the Android SDK license for the requested development tools.
@('y')*100 | & (Join-Path $taskLatest 'bin/sdkmanager.bat') --sdk_root=$env:ANDROID_HOME 'platforms;android-36' 'build-tools;36.0.0' 'platform-tools' *> '.cache/sdk-setup.log'
if ($LASTEXITCODE -ne 0) {throw 'SDK installation failed. See .cache/sdk-setup.log.'}
Write-Output 'Android SDK ready inside this project.'
