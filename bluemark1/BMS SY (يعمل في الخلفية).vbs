Set sh = CreateObject("Wscript.Shell")
app = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName) & "\dist\win-unpacked\BMS SY.exe"
sh.Run """" & app & """", 0, False
