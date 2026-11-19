; SPDX-License-Identifier: MIT
; Copyright (c) 2026 Capybara_sea

; Installer hooks (tauri.conf.json, bundle.windows.nsis.installerHooks).
;
; Auto sync's capture mode is this same exe, running elevated. The installer
; can neither replace the exe under it nor end it, so it waits a moment (an
; update stops auto sync first, and the capture mode takes a moment to exit),
; then stops and says why. The capture mode holds the mutex named below
; while it runs (src/capture/helper.rs). Saved as UTF-8 with a BOM, so NSIS
; reads the Chinese text right.

!macro MOONGAZER_CHECK_SYNC
  !define MoongazerId ${__LINE__}
  StrCpy $R8 0
  moongazer_sync_${MoongazerId}:
    ; SYNCHRONIZE. Denied access means it exists all the same.
    System::Call 'kernel32::OpenMutexW(i 0x00100000, i 0, w "Local\io.github.capybara-sea.moongazer.capture") p .R9 ?e'
    Pop $R7
    ${If} $R9 P<> 0
      System::Call 'kernel32::CloseHandle(p R9)'
      StrCpy $R7 5
    ${EndIf}
    ${If} $R7 = 5
      ${If} $R8 < 10
        IntOp $R8 $R8 + 1
        Sleep 500
        Goto moongazer_sync_${MoongazerId}
      ${EndIf}
      MessageBox MB_OK|MB_ICONSTOP "望月的同步助手还在运行，不能继续。$\n$\n请先在望月里停止自动同步，或者右键托盘图标选“退出望月”，然后再运行一次。" /SD IDOK
      Abort
    ${EndIf}
  !undef MoongazerId
!macroend

!macro NSIS_HOOK_PREINSTALL
  !insertmacro MOONGAZER_CHECK_SYNC
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro MOONGAZER_CHECK_SYNC
!macroend
