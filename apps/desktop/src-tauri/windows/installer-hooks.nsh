!macro NSIS_HOOK_PREINSTALL
  DetailPrint "Stopping running Obscur processes before install..."
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /F /T /IM obscur_desktop_app.exe'
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /F /T /IM tor.exe'
  Sleep 600
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  DetailPrint "Stopping running Obscur processes before uninstall..."
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /F /T /IM obscur_desktop_app.exe'
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /F /T /IM tor.exe'
  Sleep 600
!macroend
