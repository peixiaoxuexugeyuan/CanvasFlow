param(
  [Parameter(Mandatory=$true)][ValidateSet('Prepare','Restore','PrepareRemoval')][string]$Mode,
  [Parameter(Mandatory=$true)][string]$StateFile,
  [string]$PackageManifest,
  [string]$RegistryKey,
  [string]$UninstallRegistryKey,
  [string]$InstallDirectory,
  # Explicit roots are used by isolated installer regression fixtures.
  [string[]]$PreviousDirectories
)
$ErrorActionPreference = 'Stop'
$manifestName = '.canvasflow-install-files.json'

function FullPath([string]$Value) {
  $full = [IO.Path]::GetFullPath($Value)
  if ($full -eq [IO.Path]::GetPathRoot($full)) { return $full }
  return $full.TrimEnd('\','/')
}
function Inside([string]$Root, [string]$Target) {
  $Target.Equals($Root,[StringComparison]::OrdinalIgnoreCase) -or $Target.StartsWith($Root + '\',[StringComparison]::OrdinalIgnoreCase)
}
function SafeRelative([string]$Value) {
  if (-not $Value -or $Value -match '[\x00-\x1f:*?"<>|]' -or [IO.Path]::IsPathRooted($Value)) { return $false }
  foreach ($part in ($Value -split '[/\\]')) { if (-not $part -or $part -eq '.' -or $part -eq '..') { return $false } }
  return $true
}
function CheckedFile([string]$Root,[string]$Relative) {
  if (-not (SafeRelative $Relative)) { throw 'Unsafe relative path in installation state' }
  $target = FullPath (Join-Path $Root $Relative)
  if (-not (Inside $Root $target)) { throw 'Installation state escapes its root' }
  $current = $target
  while (Inside $Root $current) {
    if (Test-Path -LiteralPath $current) {
      if ((Get-Item -LiteralPath $current -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Filesystem links are not supported during upgrade: $current" }
    }
    if ($current.Equals($Root,[StringComparison]::OrdinalIgnoreCase)) { break }
    $current = Split-Path -Parent $current
  }
  return $target
}
function ReadManifest([string]$File) {
  $value = Get-Content -Raw -Encoding UTF8 -LiteralPath $File | ConvertFrom-Json
  if ($value.version -ne 1 -or $null -eq $value.files) { throw 'Invalid installation file manifest' }
  $set = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  foreach ($name in $value.files) {
    if (-not (SafeRelative $name)) { throw 'Unsafe path in installation file manifest' }
    [void]$set.Add(($name -replace '/','\'))
  }
  return ,$set
}
function FileHash([string]$File) {
  $stream = [IO.File]::OpenRead($File)
  $sha = [Security.Cryptography.SHA256]::Create()
  try { return [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-','') }
  finally { $stream.Dispose(); $sha.Dispose() }
}
function WriteJson([string]$File,$Value) {
  [IO.File]::WriteAllText($File,($Value | ConvertTo-Json -Depth 12),[Text.UTF8Encoding]::new($false))
}
function InstalledRoots {
  $roots = @($PreviousDirectories)
  # NSIS is a 32-bit process but electron-builder uses the 64-bit registry view.
  # Read both explicitly, including the uninstaller fallback used by old packages.
  foreach ($hive in @([Microsoft.Win32.RegistryHive]::CurrentUser,[Microsoft.Win32.RegistryHive]::LocalMachine)) {
    foreach ($view in @([Microsoft.Win32.RegistryView]::Registry64,[Microsoft.Win32.RegistryView]::Registry32)) {
      $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey($hive,$view)
      try {
        foreach ($name in @($RegistryKey,$UninstallRegistryKey)) {
          if (-not $name) { continue }
          $key = $base.OpenSubKey($name)
          if (-not $key) { continue }
          try {
            $root = $key.GetValue('InstallLocation')
            $uninstall = $key.GetValue('UninstallString')
            if (-not $root -and $uninstall -match '^"([^"]+)"') { $root = Split-Path -Parent $Matches[1] }
            if ($root) { $roots += $root }
          } finally { $key.Dispose() }
        }
      } finally { $base.Dispose() }
    }
  }
  return @($roots | Where-Object { $_ } | ForEach-Object { FullPath $_ } | Select-Object -Unique)
}
function ProtectedPaths([string]$Root) {
  $configPath = Join-Path $Root 'desktop-config.json'
  $protected = @($configPath)
  if (Test-Path -LiteralPath $configPath) {
    [void](CheckedFile $Root 'desktop-config.json')
    $config = Get-Content -Raw -Encoding UTF8 -LiteralPath $configPath | ConvertFrom-Json
    foreach ($field in @('dataDirectory','backendDirectory')) {
      if (-not $config.$field) { continue }
      if ($config.$field -isnot [string]) { throw "Invalid configured path: $field" }
      $candidate = if ([IO.Path]::IsPathRooted($config.$field)) { FullPath $config.$field } else { FullPath (Join-Path $Root $config.$field) }
      if (Inside $Root $candidate) { $protected += $candidate }
    }
  }
  return $protected
}

if ($Mode -eq 'PrepareRemoval') {
  $root = FullPath $InstallDirectory
  $protected = @(ProtectedPaths $root)
  $lines = @('[Paths]','all=0',('count=' + $protected.Count))
  $index = 0
  foreach ($protectedPath in $protected) {
    $index++
    if ($protectedPath.Equals($root,[StringComparison]::OrdinalIgnoreCase)) { $lines[1] = 'all=1'; continue }
    $relative = $protectedPath.Substring($root.Length+1)
    if (-not (SafeRelative $relative)) { throw 'Unsafe protected data path' }
    $lines += 'path' + $index + '=' + $relative
  }
  # The Unicode NSIS ReadINIStr API expects a UTF-16 INI file.
  [IO.File]::WriteAllLines($StateFile,$lines,[Text.Encoding]::Unicode)
  exit 0
}

if ($Mode -eq 'Prepare') {
  if (Test-Path -LiteralPath $StateFile) { throw 'Upgrade preservation was already prepared; do not overwrite its recovery state' }
  $packageFiles = ReadManifest $PackageManifest
  $records = @()
  foreach ($root in (InstalledRoots)) {
    if (-not (Test-Path -LiteralPath (Join-Path $root 'CanvasFlow.exe'))) { continue }
    if ($root -eq [IO.Path]::GetPathRoot($root) -or -not (Test-Path -LiteralPath (Join-Path $root 'resources\app.asar'))) { throw 'Previous installation directory is not a CanvasFlow application' }
    [void](CheckedFile $root 'CanvasFlow.exe')
    # The legacy uninstaller recursively traverses its directory. Fail before invoking
    # it if a junction could lead to data outside the application directory.
    $files = @()
    $pending = [Collections.Generic.Stack[string]]::new(); $pending.Push($root)
    while ($pending.Count) {
      foreach ($item in Get-ChildItem -LiteralPath ($pending.Pop()) -Force) {
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Remove the filesystem link before upgrading: $($item.FullName)" }
        if ($item.PSIsContainer) { $pending.Push($item.FullName) } else { $files += $item }
      }
    }
    $owned = $packageFiles
    $oldManifest = Join-Path $root $manifestName
    if (Test-Path -LiteralPath $oldManifest) { $owned = ReadManifest $oldManifest }
    $protected = @(ProtectedPaths $root)
    $custom = @($files | Where-Object {
      $file = $_
      -not $owned.Contains($file.FullName.Substring($root.Length+1)) -or @($protected | Where-Object { Inside $_ $file.FullName }).Count -gt 0
    })
    # Configurations may place local data under any installation subdirectory.
    # Keep every non-package file, including config, without interpreting secrets.
    if (-not $custom.Count) { continue }
    $active = @(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and (Inside $root $_.ExecutablePath) })
    if ($active.Count) { throw 'Close CanvasFlow and its local services before upgrading' }
    $backup = $root + '.CanvasFlow-upgrade-backup-' + [Guid]::NewGuid().ToString('N')
    if (Inside $root (FullPath $backup)) { throw 'Upgrade backup must be outside the installation' }
    New-Item -ItemType Directory -Path $backup -ErrorAction Stop | Out-Null
    $backupFiles = Join-Path $backup 'files'
    New-Item -ItemType Directory -Path $backupFiles -ErrorAction Stop | Out-Null
    $saved = @()
    foreach ($file in $custom) {
      $relative = $file.FullName.Substring($root.Length+1)
      $source = CheckedFile $root $relative
      $destination = CheckedFile $backupFiles $relative
      New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
      $before = FileHash $source
      Copy-Item -LiteralPath $source -Destination $destination -ErrorAction Stop
      if ((FileHash $destination) -ne $before -or (FileHash $source) -ne $before) { throw 'Data changed or copy verification failed; upgrade stopped' }
      $saved += @{path=$relative;sha256=$before}
    }
    $record = @{source=$root;backup=$backup;files=$saved}
    WriteJson (Join-Path $backup 'CanvasFlow-recovery.json') $record
    $records += $record
  }
  WriteJson $StateFile @{version=1;installations=$records}
  Write-Output ('Verified preserved installation data: ' + $records.Count)
  exit 0
}

$state = Get-Content -Raw -Encoding UTF8 -LiteralPath $StateFile | ConvertFrom-Json
if ($state.version -ne 1) { throw 'Invalid upgrade state' }
$destinationRoot = FullPath $InstallDirectory
if (-not (Test-Path -LiteralPath (Join-Path $destinationRoot 'CanvasFlow.exe'))) { throw 'The new application has not been installed' }
foreach ($record in $state.installations) {
  $backup = FullPath $record.backup
  $sourceRoot = FullPath $record.source
  foreach ($file in $record.files) {
    $source = CheckedFile (Join-Path $backup 'files') $file.path
    $destination = CheckedFile $destinationRoot $file.path
    if ((FileHash $source) -ne $file.sha256) { throw 'Upgrade recovery data failed verification' }
    if (Test-Path -LiteralPath $destination) {
      if ((FileHash $destination) -eq $file.sha256) { continue }
      throw "Refusing to overwrite a different file; recovery copy retained in $backup"
    }
    New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination $destination -ErrorAction Stop
    if ((FileHash $destination) -ne $file.sha256) { throw 'Restored installation data failed verification' }
  }
  # Preserve relative settings. Absolute internal paths must follow a changed install location.
  $configFile = Join-Path $destinationRoot 'desktop-config.json'
  if (-not $sourceRoot.Equals($destinationRoot,[StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $configFile)) {
    $config = Get-Content -Raw -Encoding UTF8 -LiteralPath $configFile | ConvertFrom-Json
    foreach ($field in @('dataDirectory','backendDirectory')) {
      if ($config.$field -and [IO.Path]::IsPathRooted($config.$field)) {
        $original = FullPath $config.$field
        if (Inside $sourceRoot $original) {
          $config.$field = if ($original.Equals($sourceRoot,[StringComparison]::OrdinalIgnoreCase)) { $destinationRoot } else { Join-Path $destinationRoot $original.Substring($sourceRoot.Length+1) }
        }
      }
    }
    WriteJson $configFile $config
  }
}
Write-Output 'Preserved data restored; verified recovery copies retained beside the previous installation.'
