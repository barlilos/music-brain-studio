#Requires AutoHotkey v2.0
#SingleInstance Force

; ---------------------------------------------------------------------------
; CANONICAL SOURCE. Edit this file, not the installed copy.
;
;   source:    scripts/windows/music-brain-dev.ahk   (this file, in git)
;   installed: C:\Tools\music-brain-dev-desktop\music-brain-dev.ahk
;
; `pnpm dev:isolation:setup` copies this into the toolkit directory, and
; `pnpm dev:isolated` re-syncs it whenever the two differ. Changes made to the
; installed copy are overwritten without warning.
; ---------------------------------------------------------------------------

; ---------------------------------------------------------------------------
; Music Brain Studio — development desktop routing
;
; Routes the Music Brain Studio *development* window to a virtual desktop that
; is never the one the user is looking at. Preferred target is the desktop the
; project's own VS Code window lives on; if that happens to be the active
; desktop, or the window cannot be identified, any other desktop is used
; instead. The active desktop is never switched.
;
; Priorities, in order:
;   1. never target the active desktop (mandatory)
;   2. follow the project's VS Code window when it is safely elsewhere
;   3. otherwise any inactive desktop
;
; This lives entirely outside the Music Brain Studio repository and outside the
; product runtime. The application knows nothing about it.
; ---------------------------------------------------------------------------

; ------------------------------- configuration ------------------------------

; Window identity of the thing we move. `electron.exe` alone is not enough —
; any Electron app would match — and the title alone is not enough either.
;
; The title comes from two places deliberately kept in step:
;   src/shared/constants.ts   APP_NAME = 'Music Brain Studio'  (BrowserWindow)
;   src/renderer/index.html   <title>Music Brain Studio</title> (renderer)
;
; The executable is what makes this development-only. `pnpm dev` runs
; node_modules/electron/dist/electron.exe; a packaged build runs
; "Music Brain Studio.exe" (productName in electron-builder.yml). Production
; installs therefore cannot match this rule and are never moved.
WIN_TITLE  := "Music Brain Studio"
WIN_EXE    := "electron.exe"
VSCODE_EXE := "Code.exe"

STATE_DIR    := EnvGet("LOCALAPPDATA") . "\music-brain-dev-desktop"
FLAG_FILE    := STATE_DIR . "\enabled.flag"
LOG_FILE     := STATE_DIR . "\watcher.log"
; The launcher writes what it wants; the watcher publishes what it decided.
; These two files are the entire contract with the repository.
REQUEST_FILE := STATE_DIR . "\target.request"
STATUS_FILE  := STATE_DIR . "\watcher.status"
DLL_PATH     := A_ScriptDir . "\VirtualDesktopAccessor.dll"

POLL_MS   := 400
STATUS_MS := 2000

; A window that refuses to move is retried, because the first attempts happen
; while it is still hidden and the shell may not accept it yet.
MAX_ATTEMPTS := 30

; Sanity bound for an explicitly requested desktop index.
MAX_DESKTOP_INDEX := 63

; ------------------------------- global state -------------------------------

; hwnd -> "done" | attempt count. Each window is moved at most once, so
; dragging it back to another desktop by hand is not fought.
seen := Map()

vda := ""              ; resolved DLL entry points, or "" when unavailable
dllState := "unknown"  ; ok | missing | incompatible
dllDetail := ""
lastFlagState := -1

; The current routing decision. Rebuilt whenever the launcher posts a new
; request; windows are only moved while this holds a usable target.
res := NoResolution()

NoResolution() {
    return Map(
        "request_id", "",
        "target", -1,
        "reason", "none",
        "workspace_desktop", -1,
        "candidates", 0,
        "candidate_titles", "",
        "error", ""
    )
}

; ---------------------------------- startup ---------------------------------

DirCreate(STATE_DIR)
SetTitleMatchMode(2)
; Windows on other virtual desktops are DWM-cloaked, not hidden. Without this
; they are invisible to WinGetList and no VS Code window elsewhere could ever
; be found — and the Electron window could not be caught before it is shown.
DetectHiddenWindows(true)

vda := LoadVirtualDesktopAccessor(DLL_PATH)

if (vda = "") {
    ; Fail safely: stay resident and inert rather than dying, so the failure is
    ; visible in the status file and the launcher can report it precisely.
    Log("ERROR  VirtualDesktopAccessor unavailable (" . dllState . "): " . dllDetail)
    A_IconTip := "Music Brain Studio dev desktop — DLL " . dllState
} else {
    dllState := "ok"
    Log("START  watcher up. desktops=" . vda["count"]() . " current=" . vda["current"]())
    A_IconTip := "Music Brain Studio dev desktop — idle"
}

BuildTrayMenu()
WriteStatus()
SetTimer(Tick, POLL_MS)
SetTimer(WriteStatus, STATUS_MS)
OnExit(CleanUp)

CleanUp(*) {
    global STATUS_FILE
    try FileDelete(STATUS_FILE)   ; leave no stale "I am running" marker
    return 0
}

; ----------------------------------- loop -----------------------------------

Tick(*) {
    global vda, seen, lastFlagState, FLAG_FILE, WIN_TITLE, WIN_EXE, res

    request := ReadRequest()
    if (request.Has("request_id") && request["request_id"] != res["request_id"])
        Resolve(request)

    enabled := FileExist(FLAG_FILE) ? 1 : 0
    if (enabled != lastFlagState) {
        lastFlagState := enabled
        Log(enabled ? "ON     routing enabled" : "OFF    routing disabled")
        A_IconTip := "Music Brain Studio dev desktop — "
            . (enabled ? "routing to desktop index " . res["target"] : "idle")
        if (enabled)
            seen := Map()
        WriteStatus()
    }

    if (!enabled || vda = "")
        return

    ; No usable decision means no movement. Never guess a desktop.
    if (res["target"] < 0)
        return

    for hwnd in WinGetList(WIN_TITLE . " ahk_exe " . WIN_EXE) {
        if (seen.Has(hwnd) && seen[hwnd] = "done")
            continue

        ; Exclude DevTools and any other secondary window: only the main window
        ; carries the bare application name.
        if (WinGetTitle("ahk_id " . hwnd) != WIN_TITLE)
            continue

        if (vda["where"](hwnd) = res["target"]) {
            seen[hwnd] := "done"
            continue
        }

        MoveWindow(hwnd, res["target"])
    }

    PruneClosedWindows()
}

; ------------------------------ target selection ----------------------------

/**
 * Decides which desktop the next Music Brain Studio window belongs on.
 *
 * The invariant that outranks everything else: without an explicit override,
 * the chosen desktop is never the active one. Following the project's VS Code
 * window is preferred but always subordinate to that.
 */
Resolve(request) {
    global vda, res, MAX_DESKTOP_INDEX

    res := NoResolution()
    res["request_id"] := request["request_id"]

    if (vda = "") {
        res["error"] := "VirtualDesktopAccessor unavailable"
        Log("TARGET failed: " . res["error"])
        WriteStatus()
        return
    }

    current := vda["current"]()
    if (current < 0) {
        res["error"] := "current desktop unknown (GetCurrentDesktopNumber returned -1)"
        Log("TARGET failed: " . res["error"])
        WriteStatus()
        return
    }

    ; --- explicit override -------------------------------------------------
    ; The caller asked for a specific desktop, so the active-desktop rule does
    ; not apply — but the value still has to be real.
    override := request.Has("override") ? Trim(request["override"]) : ""
    if (override != "") {
        if (!RegExMatch(override, "^\d+$")) {
            res["error"] := "override '" . override . "' is not a desktop index"
        } else if (Integer(override) > MAX_DESKTOP_INDEX) {
            res["error"] := "override " . override . " is out of range (0-" . MAX_DESKTOP_INDEX . ")"
        } else if (Integer(override) >= vda["count"]()) {
            res["error"] := "override " . override . " does not exist (only "
                . vda["count"]() . " virtual desktop(s)) and this DLL cannot create desktops"
        } else {
            res["target"] := Integer(override)
            res["reason"] := "override"
            Log("TARGET override -> desktop index " . res["target"])
        }
        WriteStatus()
        return
    }

    ; --- preferred: the project's own VS Code window -----------------------
    name := request.Has("workspace_name") ? request["workspace_name"] : ""
    mainPid := request.Has("vscode_pid") ? Integer(request["vscode_pid"]) : 0

    candidates := FindWorkspaceWindows(name, mainPid)
    res["candidates"] := candidates.Length

    titles := ""
    for hwnd in candidates
        titles .= (titles = "" ? "" : " | ") . WinGetTitle("ahk_id " . hwnd)
    res["candidate_titles"] := SubStr(titles, 1, 300)

    if (candidates.Length = 1) {
        d := vda["where"](candidates[1])
        ; -1 means the shell would not say; it is not a desktop index.
        if (d >= 0)
            res["workspace_desktop"] := d
    }

    if (res["workspace_desktop"] >= 0 && res["workspace_desktop"] != current) {
        res["target"] := res["workspace_desktop"]
        res["reason"] := "workspace"
        Log("TARGET workspace VS Code window is on desktop index " . res["target"]
            . " (active " . current . ") -> following it")
        WriteStatus()
        return
    }

    ; --- mandatory: some desktop that is not the active one ----------------
    safe := PickInactiveDesktop(current)

    if (candidates.Length = 0)
        res["reason"] := "workspace-not-found-fallback"
    else if (candidates.Length > 1)
        res["reason"] := "ambiguous-fallback"
    else if (res["workspace_desktop"] < 0)
        res["reason"] := "workspace-desktop-unknown-fallback"
    else
        res["reason"] := "workspace-active-fallback"

    if (safe < 0) {
        res["error"] := "only one virtual desktop exists, and this VirtualDesktopAccessor "
            . "build exports no CreateDesktop — cannot isolate without targeting the active desktop"
        res["reason"] := "none"
        Log("TARGET failed (" . res["reason"] . "): " . res["error"])
        WriteStatus()
        return
    }

    res["target"] := safe
    Log("TARGET " . res["reason"] . ": candidates=" . candidates.Length
        . " workspace_desktop=" . res["workspace_desktop"]
        . " active=" . current . " -> desktop index " . safe
        . (res["candidate_titles"] = "" ? "" : "  [" . res["candidate_titles"] . "]"))
    WriteStatus()
}

/**
 * Picks an existing desktop that is not the active one, or -1 if the machine
 * has only a single desktop. Deliberately never creates: the Windows 10 build
 * of VirtualDesktopAccessor exports no CreateDesktop, and the alternatives
 * (Ctrl+Win+D) switch the active desktop, which is exactly what must not
 * happen. Prefers the highest index, which is the most recently added and so
 * the least likely to hold something the user cares about.
 */
PickInactiveDesktop(current) {
    global vda

    count := vda["count"]()
    if (count <= 1)
        return -1

    candidate := count - 1
    if (candidate = current)
        candidate -= 1
    return candidate
}

/**
 * Finds VS Code windows whose root folder name matches the workspace, within
 * the VS Code instance that owns the launcher when that is known.
 *
 * There is no OS-level association between a folder path and a window: the
 * extension host carries no window id, and a VS Code window and its render
 * widget child both report the *main* process pid. The window title is the
 * only signal that names the workspace, so it is what this matches on.
 */
FindWorkspaceWindows(name, mainPid) {
    global VSCODE_EXE

    found := []
    if (name = "")
        return found

    for hwnd in WinGetList() {
        title := WinGetTitle("ahk_id " . hwnd)
        if (title = "")
            continue
        if (RootNameOf(title) != name)
            continue

        ; Reading the owning process can fail when VS Code runs elevated and
        ; this script does not. Skipping is correct: fewer candidates degrades
        ; to safe isolation, never to a wrong desktop.
        exe := ""
        try
            exe := WinGetProcessName("ahk_id " . hwnd)
        catch
            continue
        if (exe != VSCODE_EXE)
            continue

        if (mainPid > 0) {
            pid := 0
            try
                pid := WinGetPID("ahk_id " . hwnd)
            catch
                continue
            if (pid != mainPid)
                continue
        }

        found.Push(hwnd)
    }
    return found
}

/**
 * Extracts VS Code's ${rootName} from a window title.
 *
 * Base shape is "${activeEditorShort} - ${rootName} - Visual Studio Code",
 * with a number of real-world variations that all had to be handled:
 * " [Administrator]" when elevated, " - Insiders" on the Insiders build,
 * " (Workspace)" for a .code-workspace, " [SSH: host]" and friends for remote
 * windows, and no editor prefix at all when nothing is open. Returns "" when
 * the title is not a VS Code title.
 */
RootNameOf(title) {
    t := RegExReplace(title, "\s\[Administrator\]$")

    if (!RegExMatch(t, "^(.*) - Visual Studio Code(?: - Insiders)?$", &m))
        return ""

    parts := StrSplit(m[1], " - ")
    root := parts[parts.Length]          ; a folder-only title has just this

    root := RegExReplace(root, "\s\(Workspace\)$")
    root := RegExReplace(root, "\s\[[^\]]*\]$")   ; [SSH: host], [WSL: distro], ...
    return Trim(root)
}

; -------------------------------- moving ------------------------------------

MoveWindow(hwnd, target) {
    global vda, seen, MAX_ATTEMPTS

    attempts := seen.Has(hwnd) ? seen[hwnd] : 0

    previous := 0
    try previous := WinGetID("A")

    vda["move"](hwnd, target)

    if (vda["where"](hwnd) = target) {
        seen[hwnd] := "done"
        Log("MOVED  hwnd=" . Format("0x{:X}", hwnd) . " -> desktop index " . target
            . " after " . (attempts + 1) . " attempt(s)")

        ; Never call GoToDesktopNumber — the active desktop must not change.
        RestoreFocus(hwnd, previous)
        return
    }

    attempts += 1
    seen[hwnd] := attempts

    if (attempts >= MAX_ATTEMPTS) {
        seen[hwnd] := "done"
        Log("GIVEUP hwnd=" . Format("0x{:X}", hwnd) . " could not be moved after " . attempts . " attempts")
    }
}

/**
 * Hands the keyboard back after a window is moved off the visible desktop.
 *
 * Windows will happily leave a window on another virtual desktop as the
 * foreground window: the user cannot see it, but their keystrokes go to it.
 * Electron shows and focuses its window itself, a moment before the move, so
 * `previous` is very often the moved window and cannot be restored to — hence
 * the fallback to the topmost window that is actually on the visible desktop.
 */
RestoreFocus(moved, previous) {
    global vda

    if (previous && previous != moved && WinExist("ahk_id " . previous)) {
        if (vda["current"] = "" || vda["where"](previous) = vda["current"]()) {
            try WinActivate("ahk_id " . previous)
            return
        }
    }

    try {
        if (WinGetID("A") != moved)
            return
    } catch {
        return
    }

    if (vda["current"] = "")
        return
    here := vda["current"]()

    DetectHiddenWindows(false)
    for candidate in WinGetList() {
        if (candidate = moved)
            continue
        if (WinGetTitle("ahk_id " . candidate) = "")
            continue
        if (WinGetMinMax("ahk_id " . candidate) = -1)
            continue
        if (vda["where"](candidate) != here)
            continue

        try WinActivate("ahk_id " . candidate)
        Log("FOCUS  handed back to hwnd=" . Format("0x{:X}", candidate) . " on desktop index " . here)
        break
    }
    DetectHiddenWindows(true)
}

PruneClosedWindows() {
    global seen
    for hwnd in seen.Clone() {
        if (!WinExist("ahk_id " . hwnd))
            seen.Delete(hwnd)
    }
}

; ------------------------------ VirtualDesktopAccessor ----------------------

/**
 * Loads the DLL and resolves the entry points this script needs. Returns ""
 * if the DLL is missing, the wrong architecture, or built for a different
 * Windows version — every failure mode is non-fatal by design, and the reason
 * is recorded in `dllState` / `dllDetail`.
 */
LoadVirtualDesktopAccessor(path) {
    global dllState, dllDetail

    if (!FileExist(path)) {
        dllState := "missing"
        dllDetail := "not found at " . path
        return ""
    }

    hModule := DllCall("LoadLibraryW", "Str", path, "Ptr")
    if (!hModule) {
        dllState := "incompatible"
        dllDetail := "LoadLibrary failed (err " . A_LastError . ") — wrong architecture? 64-bit DLL required"
        return ""
    }

    pMove    := DllCall("GetProcAddress", "Ptr", hModule, "AStr", "MoveWindowToDesktopNumber", "Ptr")
    pWhere   := DllCall("GetProcAddress", "Ptr", hModule, "AStr", "GetWindowDesktopNumber", "Ptr")
    pCount   := DllCall("GetProcAddress", "Ptr", hModule, "AStr", "GetDesktopCount", "Ptr")
    pCurrent := DllCall("GetProcAddress", "Ptr", hModule, "AStr", "GetCurrentDesktopNumber", "Ptr")

    if (!pMove || !pWhere || !pCount || !pCurrent) {
        dllState := "incompatible"
        dllDetail := "DLL does not export the expected VirtualDesktopAccessor API"
        return ""
    }

    api := Map(
        "move",    (hwnd, index) => SafeCall(() => DllCall(pMove, "Ptr", hwnd, "Int", index, "Int"), -1),
        "where",   (hwnd)        => SafeCall(() => DllCall(pWhere, "Ptr", hwnd, "Int"), -1),
        "count",   ()            => SafeCall(() => DllCall(pCount, "Int"), -1),
        "current", ()            => SafeCall(() => DllCall(pCurrent, "Int"), -1)
    )

    ; A DLL built for a different Windows version loads and resolves fine, but
    ; the undocumented COM interfaces it wraps fail at run time and every call
    ; returns -1. One sane call is the only way to tell the difference.
    if (api["count"]() <= 0) {
        dllState := "incompatible"
        dllDetail := "loaded, but GetDesktopCount() returned " . api["count"]()
            . " — this build does not match Windows " . A_OSVersion
        return ""
    }

    return api
}

SafeCall(fn, fallback) {
    try
        return fn()
    catch
        return fallback
}

; ------------------------------ request / status ----------------------------

ReadRequest() {
    global REQUEST_FILE

    out := Map()
    if (!FileExist(REQUEST_FILE))
        return out
    try {
        for line in StrSplit(FileRead(REQUEST_FILE, "UTF-8"), "`n", "`r") {
            if (line = "")
                continue
            i := InStr(line, "=")
            if (i)
                out[SubStr(line, 1, i - 1)] := SubStr(line, i + 1)
        }
    }
    return out
}

/**
 * Machine-readable state for the repository-side launcher, written to a temp
 * file and moved into place so a reader never sees a half-written file.
 */
WriteStatus(*) {
    global STATUS_FILE, FLAG_FILE, vda, dllState, dllDetail, res

    body := "pid=" . DllCall("GetCurrentProcessId", "UInt") . "`n"
          . "ts=" . DateDiff(A_NowUTC, "19700101000000", "Seconds") . "`n"
          . "dll=" . dllState . "`n"
          . "detail=" . dllDetail . "`n"
          . "desktops=" . ((vda != "") ? vda["count"]() : -1) . "`n"
          . "current_desktop=" . ((vda != "") ? vda["current"]() : -1) . "`n"
          . "routing=" . (FileExist(FLAG_FILE) ? "on" : "off") . "`n"
          . "request_id=" . res["request_id"] . "`n"
          . "workspace_desktop=" . (res["workspace_desktop"] < 0 ? "unknown" : res["workspace_desktop"]) . "`n"
          . "workspace_candidates=" . res["candidates"] . "`n"
          . "candidate_titles=" . StrReplace(res["candidate_titles"], "`n", " ") . "`n"
          . "resolved_target=" . (res["target"] < 0 ? "unknown" : res["target"]) . "`n"
          . "target_reason=" . res["reason"] . "`n"
          . "resolve_error=" . res["error"] . "`n"

    tmp := STATUS_FILE . ".tmp"
    try {
        if (FileExist(tmp))
            FileDelete(tmp)
        ; UTF-8-RAW, not UTF-8: the latter writes a byte-order mark, which would
        ; end up glued to the first key name when the launcher parses this.
        FileAppend(body, tmp, "UTF-8-RAW")
        FileMove(tmp, STATUS_FILE, 1)
    }
}

; ----------------------------------- tray -----------------------------------

BuildTrayMenu() {
    global LOG_FILE

    tray := A_TrayMenu
    tray.Delete()
    tray.Add("Music Brain Studio dev desktop", (*) => 0)
    tray.Disable("Music Brain Studio dev desktop")
    tray.Add()
    tray.Add("Status", ShowStatus)
    tray.Add("Open log", (*) => Run('notepad.exe "' . LOG_FILE . '"'))
    tray.Add("Open folder", (*) => Run(A_ScriptDir))
    tray.Add()
    tray.Add("Reload", (*) => Reload())
    tray.Add("Exit", (*) => ExitApp())
    tray.Default := "Status"
}

ShowStatus(*) {
    global vda, FLAG_FILE, DLL_PATH, dllState, dllDetail, res

    lines := "VirtualDesktopAccessor: " . dllState
    if (dllDetail != "")
        lines .= "`n  " . dllDetail
    lines .= "`nDLL path: " . DLL_PATH
    if (vda != "") {
        lines .= "`nVirtual desktops: " . vda["count"]()
        lines .= "`nActive desktop index: " . vda["current"]()
    }
    lines .= "`n`nResolved target: " . (res["target"] < 0 ? "none" : res["target"])
    lines .= "`nReason: " . res["reason"]
    lines .= "`nWorkspace desktop: " . (res["workspace_desktop"] < 0 ? "unknown" : res["workspace_desktop"])
    lines .= "`nWorkspace candidates: " . res["candidates"]
    if (res["error"] != "")
        lines .= "`nError: " . res["error"]
    lines .= "`n`nRouting: " . (FileExist(FLAG_FILE) ? "ENABLED" : "disabled")

    MsgBox(lines, "Music Brain Studio dev desktop", 0x40)
}

; ----------------------------------- log ------------------------------------

Log(message) {
    global LOG_FILE
    try FileAppend(FormatTime(, "yyyy-MM-dd HH:mm:ss") . "  " . message . "`n", LOG_FILE, "UTF-8-RAW")
}
