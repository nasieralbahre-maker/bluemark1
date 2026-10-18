' BMS SY — مُشغّل يعمل في الخلفية دون ظهور أي نافذة أو سطر أوامر
' يشغّل النسخة المفكّكة مباشرة (تفتح فوراً بدون فترة فك ضغط).
Set sh = CreateObject("Wscript.Shell")
app = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName) & "\dist\win-unpacked\BMS SY.exe"
' 0 = مخفي (دون ظهور نافذة) ، False = يعمل في الخلفية دون انتظار
sh.Run """" & app & """", 0, False
