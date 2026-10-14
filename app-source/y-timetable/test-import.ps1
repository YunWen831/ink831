$ErrorActionPreference='Stop'
Set-Location -LiteralPath $PSScriptRoot
$taskJar=Join-Path $PSScriptRoot '.tools\downloads\json-tests.jar'
if (-not (Test-Path -LiteralPath $taskJar)) { throw 'Test JSON runtime missing.' }
$taskAndroid=Join-Path $PSScriptRoot '.tools\android-sdk\platforms\android-36\android.jar'
$taskJavaBin=Split-Path -Parent (Get-Command java.exe).Source
$taskClasspath=$taskJar+';'+$taskAndroid
New-Item -ItemType Directory -Path '.cache\import-tests' -Force | Out-Null
& (Join-Path $taskJavaBin 'javac.exe') -encoding UTF-8 --release 17 -classpath $taskClasspath -d .cache/import-tests app/src/main/java/cn/kecheng/assistant/Course.java app/src/main/java/cn/kecheng/assistant/Semester.java app/src/main/java/cn/kecheng/assistant/ScheduleEngine.java app/src/main/java/cn/kecheng/assistant/BackgroundGeometry.java app/src/main/java/cn/kecheng/assistant/QuickBarConfig.java app/src/main/java/cn/kecheng/assistant/Store.java app/src/main/java/cn/kecheng/assistant/ImportCodec.java app/src/main/java/cn/kecheng/assistant/ImportDraft.java app/src/main/java/cn/kecheng/assistant/SketchModel.java app/src/main/java/cn/kecheng/assistant/SafeSave.java app/src/main/java/cn/kecheng/assistant/BackupArchive.java tests/ImportCodecTest.java tests/DraftAndSketchTest.java tests/DetailsDataTest.java
if ($LASTEXITCODE -ne 0) {throw 'Test compilation failed'}
& (Join-Path $taskJavaBin 'java.exe') -classpath ('.cache/import-tests;'+$taskClasspath) cn.kecheng.assistant.ImportCodecTest
if ($LASTEXITCODE -ne 0) {throw 'Import tests failed'}
& (Join-Path $taskJavaBin 'java.exe') -classpath ('.cache/import-tests;'+$taskClasspath) cn.kecheng.assistant.DraftAndSketchTest
if ($LASTEXITCODE -ne 0) {throw 'Draft and sketch tests failed'}

& (Join-Path $taskJavaBin 'java.exe') -classpath ('.cache/import-tests;'+$taskClasspath) cn.kecheng.assistant.DetailsDataTest
if ($LASTEXITCODE -ne 0) {throw 'Details data tests failed'}