; package-release.cjs generates an immutable per-package customRemoveFiles macro.
; Never fall back to electron-builder's recursive deletion of $INSTDIR.
; electron-builder includes custom hooks before FileFunc in its uninstaller pass.
; Declare our own dependency instead of relying on the parent template's order.
!include "FileFunc.nsh"
!ifmacrondef customRemoveFiles
  !error "CanvasFlow installers must be built with package-release.cjs (missing safe removal manifest)"
!endif

!ifdef BUILD_UNINSTALLER
!macro CANVASFLOW_PREPARE_REMOVAL
  InitPluginsDir
  SetOutPath "$PLUGINSDIR"
  File /oname=canvasflow-upgrade.ps1 "${CANVASFLOW_UPGRADE_HELPER}"
  nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\canvasflow-upgrade.ps1" -Mode PrepareRemoval -InstallDirectory "$INSTDIR" -StateFile "$PLUGINSDIR\canvasflow-protected.ini"'
  Pop $R0
  ${If} $R0 != 0
    MessageBox MB_OK|MB_ICONSTOP "CanvasFlow could not verify the configured data paths. Uninstallation stopped without removing application files or local data." /SD IDOK
    SetErrorLevel 2
    Quit
  ${EndIf}
!macroend

Function un.CanvasFlowRemoveOwnedFile
  Push $R9
  StrCpy $R9 "file"
  Exch
  Call un.CanvasFlowRemoveOwnedPath
  Pop $R9
FunctionEnd

Function un.CanvasFlowRemoveEmptyDirectory
  Push $R9
  StrCpy $R9 "directory"
  Exch
  Call un.CanvasFlowRemoveOwnedPath
  Pop $R9
FunctionEnd

Function un.CanvasFlowRemoveOwnedPath
  Exch $R0
  Push $R1
  Push $R2
  Push $R3
  Push $R4
  Push $R5
  Push $R6
  Push $R7
  Push $R8
  ReadINIStr $R4 "$PLUGINSDIR\canvasflow-protected.ini" Paths all
  StrCmp $R4 1 done
  ReadINIStr $R4 "$PLUGINSDIR\canvasflow-protected.ini" Paths count
  StrCpy $R5 1
  protected_loop:
    IntCmp $R5 $R4 protected_check protected_check check_file
  protected_check:
    ReadINIStr $R6 "$PLUGINSDIR\canvasflow-protected.ini" Paths "path$R5"
    StrCmp $R0 $R6 done
    StrCpy $R6 "$R6\"
    StrLen $R7 $R6
    StrCpy $R8 $R0 $R7
    StrCmp $R8 $R6 done
    IntOp $R5 $R5 + 1
    Goto protected_loop
  check_file:
  StrCpy $R1 "$INSTDIR\$R0"
  StrCpy $R2 $R1
  StrLen $R4 $INSTDIR
  ; A link substituted after installation must never redirect deletion outside it.
  loop:
    ; System register r12/r13 refer to NSIS $R2/$R3.
    System::Call 'kernel32::GetFileAttributesW(w r12) i.r13'
    IntCmp $R3 -1 missing
    IntOp $R3 $R3 & 0x400
    IntCmp $R3 0 +2
      Goto done
    StrCmp $R2 $INSTDIR remove
    ${GetParent} "$R2" $R5
    StrLen $R6 $R5
    IntCmp $R6 $R4 +2 done
    StrCmp $R2 $R5 done
    StrCpy $R2 $R5
    Goto loop
  missing:
    IfFileExists "$R1" 0 done
    Goto done
  remove:
    StrCmp $R9 "directory" remove_directory
    Delete "$R1"
    Goto done
  remove_directory:
    RMDir "$R1"
  done:
    Pop $R8
    Pop $R7
    Pop $R6
    Pop $R5
    Pop $R4
    Pop $R3
    Pop $R2
    Pop $R1
    Pop $R0
FunctionEnd
!else
  !include "getProcessInfo.nsh"
  Var pid

  ; electron-builder skips CHECK_APP_RUNNING in a UAC inner instance. Refuse
  ; that path before installSection can invoke any legacy uninstaller. A user
  ; can run the installer directly as administrator for a machine-wide upgrade;
  ; that normal (non-inner) process still executes the preservation hook below.
  !macro customInit
    ${If} ${UAC_IsInnerInstance}
      MessageBox MB_OK|MB_ICONSTOP "To protect existing CanvasFlow data, close this installer and start it directly with Run as administrator. No previous installation has been removed." /SD IDOK
      SetErrorLevel 2
      Quit
    ${EndIf}
  !macroend

  ; This runs immediately before uninstallOldVersion, after the old app is closed.
  ; It also protects upgrades FROM old installers whose uninstaller was unsafe.
  !macro customCheckAppRunning
    !insertmacro IS_POWERSHELL_AVAILABLE
    !insertmacro _CHECK_APP_RUNNING
    InitPluginsDir
    Push $OUTDIR
    SetOutPath "$PLUGINSDIR"
    File /oname=canvasflow-upgrade.ps1 "${CANVASFLOW_UPGRADE_HELPER}"
    File /oname=canvasflow-install-files.json "${CANVASFLOW_PACKAGE_MANIFEST}"
    Pop $R0
    SetOutPath "$R0"
    nsExec::ExecToLog '"$PowerShellPath" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\canvasflow-upgrade.ps1" -Mode Prepare -RegistryKey "${INSTALL_REGISTRY_KEY}" -UninstallRegistryKey "${UNINSTALL_REGISTRY_KEY}" -PackageManifest "$PLUGINSDIR\canvasflow-install-files.json" -StateFile "$PLUGINSDIR\canvasflow-upgrade-state.json"'
    Pop $R0
    ${If} $R0 != 0
      MessageBox MB_OK|MB_ICONSTOP "CanvasFlow could not verify a safe backup of existing data. Installation stopped before removing the old version. Close CanvasFlow and check disk space/permissions; any recovery copy remains beside the previous installation." /SD IDOK
      SetErrorLevel 2
      Quit
    ${EndIf}
  !macroend

  !macro customInstall
    nsExec::ExecToLog '"$PowerShellPath" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\canvasflow-upgrade.ps1" -Mode Restore -InstallDirectory "$INSTDIR" -StateFile "$PLUGINSDIR\canvasflow-upgrade-state.json"'
    Pop $R0
    ${If} $R0 != 0
      MessageBox MB_OK|MB_ICONSTOP "CanvasFlow data could not be restored automatically. Do not delete the CanvasFlow-upgrade-backup folder beside the previous installation; it contains the verified recovery files." /SD IDOK
      SetErrorLevel 2
      Quit
    ${EndIf}
  !macroend
!endif
