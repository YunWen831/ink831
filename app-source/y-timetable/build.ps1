param([switch]$TestOnly)
$ErrorActionPreference = 'Stop'
$taskRoot = $PSScriptRoot
Set-Location -LiteralPath $taskRoot
$taskSdk = Join-Path $taskRoot '.tools\android-sdk'
$taskBuildTools = Join-Path $taskSdk 'build-tools\36.0.0'
$taskPlatform = Join-Path $taskSdk 'platforms\android-36\android.jar'
$taskJava = (Get-Command java.exe).Source
$taskJavaBin = Split-Path -Parent $taskJava
$env:ANDROID_USER_HOME = Join-Path $taskRoot '.cache\android'
$env:ANDROID_HOME = $taskSdk
$env:TEMP = Join-Path $taskRoot '.cache\tmp'
$env:TMP = $env:TEMP
New-Item -ItemType Directory -Path '.cache\build\classes','.cache\build\dex','.cache\tmp','output' -Force | Out-Null
function Invoke-Checked($taskExe, $taskArgs) {
    & $taskExe @taskArgs
    if ($LASTEXITCODE -ne 0) { throw "Build step failed: $taskExe" }
}
if ($TestOnly) {
    New-Item -ItemType Directory -Path '.cache\tests' -Force | Out-Null
    Invoke-Checked (Join-Path $taskJavaBin 'javac.exe') @('-encoding','UTF-8','--release','17','-d','.cache/tests','app/src/main/java/cn/kecheng/assistant/Course.java','app/src/main/java/cn/kecheng/assistant/Semester.java','app/src/main/java/cn/kecheng/assistant/WeekLayout.java','app/src/main/java/cn/kecheng/assistant/TableAxis.java','app/src/main/java/cn/kecheng/assistant/ScheduleEngine.java','app/src/main/java/cn/kecheng/assistant/BackgroundGeometry.java','tests/ScheduleEngineTest.java','tests/CalendarTest.java','tests/TableAxisTest.java','tests/BackgroundGeometryTest.java','app/src/main/java/cn/kecheng/assistant/HomeState.java','app/src/main/java/cn/kecheng/assistant/BackgroundContrast.java','app/src/main/java/cn/kecheng/assistant/SafeSave.java','app/src/main/java/cn/kecheng/assistant/ReminderPlan.java','app/src/main/java/cn/kecheng/assistant/RestoreTransaction.java','app/src/main/java/cn/kecheng/assistant/FileSwap.java','tests/DetailsLogicTest.java')
    Invoke-Checked $taskJava @('-cp','.cache/tests','cn.kecheng.assistant.ScheduleEngineTest')
    Invoke-Checked $taskJava @('-cp','.cache/tests','cn.kecheng.assistant.CalendarTest')
    Invoke-Checked $taskJava @('-cp','.cache/tests','cn.kecheng.assistant.TableAxisTest')
    Invoke-Checked $taskJava @('-cp','.cache/tests','cn.kecheng.assistant.BackgroundGeometryTest')
    Invoke-Checked $taskJava @('-cp','.cache/tests','cn.kecheng.assistant.DetailsLogicTest')
    exit
}
if (-not (Test-Path -LiteralPath $taskPlatform)) { throw 'Android SDK is not ready.' }
# Remove only generated class/dex files so renamed inner classes cannot survive a rebuild.
foreach ($taskGenerated in @(@{ Path='.cache\build\classes'; Filter='*.class' },@{ Path='.cache\build\dex'; Filter='*.dex' })) {
    $taskGeneratedRoot=[IO.Path]::GetFullPath((Join-Path $taskRoot $taskGenerated.Path))
    $taskExpectedCache=[IO.Path]::GetFullPath((Join-Path $taskRoot '.cache\build'))+[IO.Path]::DirectorySeparatorChar
    if (-not $taskGeneratedRoot.StartsWith($taskExpectedCache,[StringComparison]::OrdinalIgnoreCase)) { throw 'Generated output outside build cache.' }
    Get-ChildItem -LiteralPath $taskGeneratedRoot -Filter $taskGenerated.Filter -File -Recurse | ForEach-Object {
        $taskGeneratedFile=[IO.Path]::GetFullPath($_.FullName)
        if (-not $taskGeneratedFile.StartsWith($taskGeneratedRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected generated file path.' }
        Remove-Item -LiteralPath $taskGeneratedFile
    }
}
Invoke-Checked (Join-Path $taskBuildTools 'aapt2.exe') @('compile','--dir','app/src/main/res','-o','.cache/build/resources.zip')
Invoke-Checked (Join-Path $taskBuildTools 'aapt2.exe') @('link','-o','.cache/build/base.apk','--manifest','app/src/main/AndroidManifest.xml','-I',$taskPlatform,'.cache/build/resources.zip','--java','.cache/build/generated','--auto-add-overlay')
$taskSources = @(Get-ChildItem -LiteralPath 'app/src/main/java' -Filter '*.java' -Recurse | Select-Object -ExpandProperty FullName)
$taskJavacArgs = @('-encoding','UTF-8','--release','17','-classpath',$taskPlatform,'-d','.cache/build/classes') + $taskSources
Invoke-Checked (Join-Path $taskJavaBin 'javac.exe') $taskJavacArgs
Invoke-Checked (Join-Path $taskJavaBin 'jar.exe') @('--create','--file','.cache/build/classes.jar','-C','.cache/build/classes','.')
Invoke-Checked (Join-Path $taskBuildTools 'd8.bat') @('--lib',$taskPlatform,'--min-api','26','--output','.cache/build/dex','.cache/build/classes.jar')
Copy-Item -LiteralPath '.cache/build/base.apk' -Destination '.cache/build/unsigned.apk' -Force
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskZip = [IO.Compression.ZipFile]::Open((Join-Path $taskRoot '.cache/build/unsigned.apk'),[IO.Compression.ZipArchiveMode]::Update)
try { Get-ChildItem -LiteralPath '.cache/build/dex' -Filter '*.dex' | ForEach-Object { [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($taskZip,$_.FullName,$_.Name,[IO.Compression.CompressionLevel]::Optimal) | Out-Null } } finally { $taskZip.Dispose() }
Invoke-Checked (Join-Path $taskBuildTools 'zipalign.exe') @('-f','-p','4','.cache/build/unsigned.apk','.cache/build/aligned.apk')
New-Item -ItemType Directory -Path '.tools\signing' -Force | Out-Null
$taskKey = '.tools/signing/local-test.jks'
if (-not (Test-Path -LiteralPath $taskKey)) {
    Invoke-Checked (Join-Path $taskJavaBin 'keytool.exe') @('-genkeypair','-keystore',$taskKey,'-alias','course-local','-storepass','android','-keypass','android','-keyalg','RSA','-keysize','2048','-validity','10000','-dname','CN=Course Assistant Local Test')
}
Invoke-Checked (Join-Path $taskBuildTools 'apksigner.bat') @('sign','--ks',$taskKey,'--ks-key-alias','course-local','--ks-pass','pass:android','--key-pass','pass:android','--out','output/course-assistant.apk','.cache/build/aligned.apk')
Invoke-Checked (Join-Path $taskBuildTools 'apksigner.bat') @('verify','--verbose','output/course-assistant.apk')
Get-Item -LiteralPath 'output/course-assistant.apk' | Select-Object Name,Length
