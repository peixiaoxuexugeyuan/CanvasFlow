param([string]$Output = '', [ValidateRange(1,32)][int]$Jobs = 6)
$ErrorActionPreference = 'Stop'
$taskRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$releaseVersion = (Get-Content -Raw -LiteralPath (Join-Path $taskRoot 'tools/desktop/app/package.json') | ConvertFrom-Json).version
if ($releaseVersion -notmatch '^\d+\.\d+\.\d+$') { throw 'Native builds require a three-part numeric application version' }
if (-not $Output) { $Output = "build-private/native-v$releaseVersion" }
$nativeVersion = "$releaseVersion.0"
$nativeOutput = [System.IO.Path]::GetFullPath((Join-Path $taskRoot $Output))
if (-not $nativeOutput.StartsWith($taskRoot + [System.IO.Path]::DirectorySeparatorChar)) { throw 'Native output must be inside the workspace' }
$env:PYTHONPATH = $taskRoot
$env:NUITKA_CACHE_DIR = Join-Path $taskRoot 'build-private/nuitka-cache'
New-Item -ItemType Directory -Path $nativeOutput -Force | Out-Null
& (Join-Path $PSScriptRoot '.venv/Scripts/python.exe') -m nuitka --mode=standalone --mingw64 --assume-yes-for-downloads --jobs=$Jobs --lto=no --include-module=server --include-module=desktop_host --output-filename=CanvasFlowBackend.exe --output-dir=$nativeOutput --company-name=CanvasFlow --product-name=CanvasFlow --file-version=$nativeVersion --product-version=$nativeVersion --windows-icon-from-ico=tools/desktop/app/icon.ico --report=$nativeOutput/compilation-report.xml tools/native/backend_entry.py
if ($LASTEXITCODE -ne 0) { throw 'Native backend compilation failed' }
