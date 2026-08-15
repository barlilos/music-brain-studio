#Requires AutoHotkey v2.0
#SingleInstance Off

; ---------------------------------------------------------------------------
; Verifies a VirtualDesktopAccessor.dll by actually using it.
;
; File existence proves nothing: a DLL built for a different Windows version
; loads happily and resolves every export, then returns -1 from every call.
; The only reliable test is to make a real call and look at the answer.
;
;   arg 1: path to VirtualDesktopAccessor.dll
;   arg 2: path to write the result to
;
; Writes `key=value` lines; `ok=1` only when the DLL genuinely works here.
; ---------------------------------------------------------------------------

dllPath := A_Args[1]
outPath := A_Args[2]

result(ok, state, detail, desktops := -1, current := -1) {
    global outPath
    body := "ok=" . (ok ? "1" : "0") . "`n"
          . "state=" . state . "`n"
          . "detail=" . detail . "`n"
          . "desktops=" . desktops . "`n"
          . "current=" . current . "`n"
          . "os=" . A_OSVersion . "`n"
    try FileAppend(body, outPath, "UTF-8-RAW")
    ExitApp(ok ? 0 : 1)
}

if (!FileExist(dllPath))
    result(false, "missing", "not found at " . dllPath)

hModule := DllCall("LoadLibraryW", "Str", dllPath, "Ptr")
if (!hModule)
    result(false, "incompatible", "LoadLibrary failed (err " . A_LastError . ") — 64-bit DLL required")

pCount   := DllCall("GetProcAddress", "Ptr", hModule, "AStr", "GetDesktopCount", "Ptr")
pCurrent := DllCall("GetProcAddress", "Ptr", hModule, "AStr", "GetCurrentDesktopNumber", "Ptr")
pWhere   := DllCall("GetProcAddress", "Ptr", hModule, "AStr", "GetWindowDesktopNumber", "Ptr")
pMove    := DllCall("GetProcAddress", "Ptr", hModule, "AStr", "MoveWindowToDesktopNumber", "Ptr")

if (!pCount || !pCurrent || !pWhere || !pMove)
    result(false, "incompatible", "DLL does not export the expected VirtualDesktopAccessor API")

count := -1
current := -1
try {
    count := DllCall(pCount, "Int")
    current := DllCall(pCurrent, "Int")
} catch as e {
    result(false, "incompatible", "call threw: " . e.Message)
}

; The signature of a DLL built for another Windows build: everything resolves,
; every call returns -1.
if (count <= 0 || current < 0)
    result(false, "incompatible", "loaded, but GetDesktopCount()=" . count
        . " GetCurrentDesktopNumber()=" . current . " — build does not match Windows " . A_OSVersion)

result(true, "ok", "", count, current)
