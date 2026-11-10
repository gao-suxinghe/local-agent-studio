param([string]$SourceClient=(Join-Path $PSScriptRoot 'payload\本机工作室-win32-x64'))
$ErrorActionPreference='Stop'
$studioPrograms=[IO.Path]::GetFullPath((Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Programs'))
$studioTarget=[IO.Path]::GetFullPath((Join-Path $studioPrograms 'AgentOfficeStudio'))
if([IO.Path]::GetDirectoryName($studioTarget) -ne $studioPrograms){throw 'The client must be installed under the current user Programs folder.'}
$studioSource=[IO.Path]::GetFullPath($SourceClient)
$studioMarker=Get-Content -LiteralPath (Join-Path $studioSource 'studio-build.json') -Raw|ConvertFrom-Json
if($studioMarker.id -ne 'local.agentoffice.studio' -or $studioMarker.platform -ne 'win32'){throw 'This payload is not the Windows local studio client.'}
if(Test-Path -LiteralPath $studioTarget){
 $studioPreviousMarker=Join-Path $studioTarget 'studio-build.json'
 if(-not(Test-Path -LiteralPath $studioPreviousMarker) -or (Get-Content -LiteralPath $studioPreviousMarker -Raw|ConvertFrom-Json).id -ne 'local.agentoffice.studio'){throw 'The destination belongs to another program.'}
 $studioRunning=@(Get-CimInstance Win32_Process|Where-Object {$_.ExecutablePath -and $_.ExecutablePath.StartsWith($studioTarget+'\',[StringComparison]::OrdinalIgnoreCase)})
 if($studioRunning.Count){throw 'Local Studio is still running. End its background service from Settings and close its window before updating.'}
 $studioBackup=Join-Path ([Environment]::GetFolderPath('MyDocuments')) ('Codex\studio-client-backups\'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
 New-Item -ItemType Directory -Path $studioBackup -Force|Out-Null
 Copy-Item -LiteralPath $studioTarget -Destination (Join-Path $studioBackup 'previous-client') -Recurse
}
New-Item -ItemType Directory -Path $studioTarget -Force|Out-Null
Get-ChildItem -LiteralPath $studioSource -Force|ForEach-Object {Copy-Item -LiteralPath $_.FullName -Destination $studioTarget -Recurse -Force}
$studioExe=Join-Path $studioTarget 'AgentOfficeStudio.exe'
$studioShortcut=Join-Path ([Environment]::GetFolderPath('DesktopDirectory')) '本机工作室.lnk'
$studioShell=New-Object -ComObject WScript.Shell
if(Test-Path -LiteralPath $studioShortcut){$studioOldLink=$studioShell.CreateShortcut($studioShortcut);if($studioOldLink.TargetPath -ne $studioExe){$studioShortcut=Join-Path ([Environment]::GetFolderPath('DesktopDirectory')) '本机工作室 0.1.lnk'}}
$studioLink=$studioShell.CreateShortcut($studioShortcut);$studioLink.TargetPath=$studioExe;$studioLink.WorkingDirectory=$studioTarget;$studioLink.IconLocation=$studioExe;$studioLink.Description='个人多 Agent 本机项目团队';$studioLink.Save()
@{version=$studioMarker.version;executable=$studioExe;shortcut=$studioShortcut;dataDirectory=(Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'AgentOfficeStudio')}|ConvertTo-Json
