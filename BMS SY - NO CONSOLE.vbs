Set sh = CreateObject("Wscript.Shell")
Dim fso: Set fso = CreateObject("Scripting.FileSystemObject")
appPath = fso.GetParentFolderName(WScript.ScriptFullName) & "\dist\win-unpacked\BMS SY.exe"
sh.Run """" & appPath & """", 0, False
