; src-tauri/bundle/nsis/installer.nsi
!include "MUI2.nsh"

Name "Supermarket POS"
OutFile "supermarket-pos_installer.exe"
InstallDir "$PROGRAMFILES\Supermarket POS"
ShowInstDetails show

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "LICENSE.txt"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_LANGUAGE "English"

; Page to ask Store ID (custom)
Page custom AskStoreIdPage CreateStoreIdLeave

Var STORE_ID

Function AskStoreIdPage
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0u 10u 100% 12u "Enter default Store ID (can be changed later in app):"
  Pop $R0
  ${NSD_CreateText} 0u 26u 100% 12u ""
  Pop $R1
  ; set default
  ${NSD_SetText} $R1 "store-001"

  nsDialogs::Show
  ; store controls in variables
  StrCpy $STORE_ID ""
  ${NSD_GetText} $R1 $STORE_ID
FunctionEnd

Function CreateStoreIdLeave
  ; write config.json into install dir
  ; build JSON content
  StrCpy $R0 '{ "store_id": "'
  StrCpy $R1 '" }'
  ; concatenate: $R0 + $STORE_ID + $R1 -> $R2
  StrCpy $R2 "$R0$STORE_ID$R1"
  ; Write the file
  SetOutPath "$INSTDIR"
  FileOpen $1 "$INSTDIR\\config.json" w
  FileWrite $1 "$R2"
  FileClose $1
FunctionEnd

Section "Install"
  SetOutPath "$INSTDIR"
  File /r "..\dist\*.*"
SectionEnd
