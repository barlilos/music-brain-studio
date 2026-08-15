/**
 * Windows development-desktop routing for Music Brain Studio.
 *
 * Two launch paths, distinguished by command and nothing else — no parent
 * process inspection to decide *who* is launching, no heuristics:
 *
 *   pnpm dev            disables routing, then launches. Always opens on the
 *                       desktop you are looking at, even if an earlier
 *                       isolated run left the flag behind.
 *   pnpm dev:isolated   picks a desktop that is never the active one, enables
 *                       routing, then launches. Refuses to launch if it cannot,
 *                       because an unrouted window landing on the user's
 *                       desktop is the exact outcome this exists to prevent.
 *
 * Target selection is dynamic. The preferred target is the desktop holding this
 * project's own VS Code window, so the app follows the workspace when it moves;
 * but that preference is always subordinate to never using the active desktop.
 *
 * This file never loads the DLL or touches virtual desktops. It resolves *who*
 * to look for — the workspace name and the VS Code instance that owns this
 * process — and hands that to an AutoHotkey v2 watcher living outside this
 * repository, in `C:\Tools\music-brain-dev-desktop\`, which owns every call
 * into VirtualDesktopAccessor. The contract is two files in the state
 * directory: a request this writes, and a status the watcher publishes.
 *
 * Nothing here is imported by the application, and `electron-builder.yml` ships
 * only `out/**` and `package.json`, so none of it reaches a build.
 *
 * Usage: node scripts/dev-desktop-isolation.mjs <run|off|status>
 */

import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import {
  DLL_PATH,
  SetupError,
  WATCHER_INSTALLED,
  ensureToolkit,
  findAutoHotkey,
  watcherInSync
} from './windows/setup-toolkit.mjs'

/** The installed copy the watcher actually runs from; the source lives in git. */
const WATCHER_SCRIPT = WATCHER_INSTALLED

/** Diagnostic escape hatch: force a desktop index and skip discovery entirely. */
const TARGET_OVERRIDE = process.env.MUSIC_BRAIN_DEV_DESKTOP_TARGET ?? ''

const STATE_DIR = process.env.LOCALAPPDATA
  ? join(process.env.LOCALAPPDATA, 'music-brain-dev-desktop')
  : null
const FLAG_FILE = STATE_DIR ? join(STATE_DIR, 'enabled.flag') : null
const STATUS_FILE = STATE_DIR ? join(STATE_DIR, 'watcher.status') : null
const REQUEST_FILE = STATE_DIR ? join(STATE_DIR, 'target.request') : null

const ELECTRON_VITE = join('node_modules', 'electron-vite', 'bin', 'electron-vite.js')

/** A status file older than this means the watcher is gone, not merely quiet. */
const STALE_AFTER_SECONDS = 10
const READY_TIMEOUT_MS = 15000

const log = (message) => console.log(`[dev-desktop] ${message}`)

function fail(message, hints = []) {
  console.error(`\n[dev-desktop] ISOLATED LAUNCH ABORTED\n`)
  console.error(`  ${message}\n`)
  for (const hint of hints) console.error(`  - ${hint}`)
  console.error(
    `\n  Electron was NOT started, deliberately: without routing it would have` +
      `\n  opened on your current desktop. Use \`pnpm dev\` if that is what you want.\n`
  )
  process.exit(1)
}

// ---------------------------------------------------------------- flag state

function setRouting(on) {
  if (!FLAG_FILE) return
  if (on) {
    mkdirSync(STATE_DIR, { recursive: true })
    writeFileSync(FLAG_FILE, `enabled ${new Date().toISOString()}\n`)
  } else {
    rmSync(FLAG_FILE, { force: true })
  }
}

const isRoutingOn = () => Boolean(FLAG_FILE && existsSync(FLAG_FILE))

// -------------------------------------------------------------- watcher state

/** Parses a `key=value` file. Returns null if unreadable. */
function readKeyValues(path) {
  if (!path || !existsSync(path)) return null
  try {
    const raw = readFileSync(path, 'utf8')
    // Tolerate a byte-order mark, whatever wrote the file: left in place it
    // would glue itself to the first key name and silently break every lookup.
    const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
    const entries = text
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const i = line.indexOf('=')
        return [line.slice(0, i), line.slice(i + 1).replace(/\r$/, '')]
      })
    return Object.fromEntries(entries)
  } catch {
    return null
  }
}

/**
 * The watcher rewrites its status file every two seconds, so a fresh file plus
 * a live pid is proof it is actually ticking — not a stale pid left by a hard
 * kill, and not a pid that has since been reused by something else.
 */
function watcherState() {
  const status = readKeyValues(STATUS_FILE)
  if (!status?.pid || !status?.ts) return { running: false, status: null }

  const age = Math.floor(Date.now() / 1000) - Number(status.ts)
  if (!Number.isFinite(age) || age > STALE_AFTER_SECONDS) return { running: false, status }

  try {
    process.kill(Number(status.pid), 0)
  } catch {
    return { running: false, status }
  }
  return { running: true, status }
}

function startWatcher() {
  const ahk = findAutoHotkey()
  if (!ahk) {
    fail('AutoHotkey v2 (64-bit) was not found.', [
      'Install AutoHotkey v2 from https://www.autohotkey.com/',
      'or set AUTOHOTKEY_EXE to the full path of AutoHotkey64.exe'
    ])
  }
  if (!existsSync(WATCHER_SCRIPT)) {
    fail(`The watcher script is missing: ${WATCHER_SCRIPT}`, [
      'run `pnpm dev:isolation:setup` to install it from the repository'
    ])
  }

  log(`Starting watcher: ${WATCHER_SCRIPT}`)
  // Detached and unref'd so it outlives this launcher and stays available for
  // the next run. The watcher itself is `#SingleInstance Force`, so even a race
  // here cannot leave two of them behind.
  spawn(ahk, [WATCHER_SCRIPT], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Waits for the watcher to report itself alive, and for `predicate` to hold. */
async function waitFor(predicate, timeoutMs = READY_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs
  let last = null
  while (Date.now() < deadline) {
    const state = watcherState()
    last = state
    if (state.running && predicate(state.status)) return state
    await sleep(250)
  }
  return last
}

// ------------------------------------------------------- workspace discovery

/**
 * Finds the VS Code instance that owns this process by walking the parent
 * chain, and returns its main process id.
 *
 * Verified shape of the chain when an agent runs this from the extension host:
 *   node -> claude.exe -> Code.exe (extension host, --type=utility)
 *                      -> Code.exe (main, no --type) -> explorer.exe
 *
 * The *last* Code.exe in the chain is the main process, which is what owns
 * every window of that instance — so it is the right filter for "windows
 * belonging to my VS Code". Child Code.exe processes carry a `--type=` switch;
 * the main one does not. Returns 0 when not launched under VS Code at all,
 * which simply widens the later search rather than breaking it.
 */
function findVSCodeMainPid() {
  let processes
  try {
    const csv = execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CommandLine | ConvertTo-Csv -NoTypeInformation'
      ],
      { encoding: 'utf8', timeout: 20000, windowsHide: true, maxBuffer: 32 * 1024 * 1024 }
    )
    processes = parseProcessCsv(csv)
  } catch {
    return 0
  }

  let pid = process.pid
  let mainPid = 0
  for (let hop = 0; hop < 20; hop++) {
    const entry = processes.get(pid)
    if (!entry) break
    if (entry.name.toLowerCase() === 'code.exe' && !/--type=/.test(entry.commandLine)) {
      mainPid = pid
      break
    }
    if (!entry.parent || entry.parent === pid) break
    pid = entry.parent
  }
  return mainPid
}

/** Minimal CSV reader for the fixed four-column shape produced above. */
function parseProcessCsv(csv) {
  const map = new Map()
  const lines = csv.split(/\r?\n/)
  for (const line of lines) {
    if (!line || line.startsWith('"ProcessId"')) continue
    const fields = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (ch === ',' && !inQuotes) {
        fields.push(current)
        current = ''
      } else {
        current += ch
      }
    }
    fields.push(current)
    if (fields.length < 3) continue
    const id = Number(fields[0])
    if (!Number.isFinite(id)) continue
    map.set(id, {
      parent: Number(fields[1]) || 0,
      name: fields[2] ?? '',
      commandLine: fields[3] ?? ''
    })
  }
  return map
}

/** Publishes what to look for. Written atomically so the watcher never reads half of it. */
function writeRequest(fields) {
  mkdirSync(STATE_DIR, { recursive: true })
  const body = Object.entries(fields)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
  const tmp = `${REQUEST_FILE}.tmp`
  writeFileSync(tmp, `${body}\n`)
  renameSync(tmp, REQUEST_FILE)
}

const REASON_TEXT = {
  workspace: 'following this project\u2019s VS Code window',
  'workspace-active-fallback':
    'this project\u2019s VS Code window is on your ACTIVE desktop, so an inactive one was used instead',
  'workspace-not-found-fallback':
    'no VS Code window for this workspace was found, so an inactive desktop was used',
  'workspace-desktop-unknown-fallback':
    'the VS Code window\u2019s desktop could not be determined, so an inactive desktop was used',
  'ambiguous-fallback':
    'several VS Code windows matched this workspace, so none was chosen and an inactive desktop was used',
  override: 'explicit MUSIC_BRAIN_DEV_DESKTOP_TARGET override'
}

// -------------------------------------------------------------------- preflight

/**
 * Brings the local toolkit up to scratch before launching.
 *
 * Cheap when everything is already in place: comparing two files and one
 * existence check, no network and no AutoHotkey probe. The DLL is not verified
 * here — the watcher makes a real VirtualDesktopAccessor call at startup and
 * reports the result, so a broken DLL is caught below and repaired then,
 * without paying for a probe on every healthy launch.
 */
async function bootstrapToolkit() {
  const needsSetup = !watcherInSync() || !existsSync(DLL_PATH)
  if (!needsSetup) return

  log('Local routing toolkit is missing or out of date — setting it up.')
  await runSetup()
}

async function runSetup() {
  try {
    await ensureToolkit()
  } catch (error) {
    if (error instanceof SetupError) fail(error.message, error.hints ?? [])
    throw error
  }
}

async function prepareIsolation() {
  await bootstrapToolkit()

  if (!watcherState().running) {
    startWatcher()
    const state = await waitFor(() => true)
    if (!state?.running) {
      fail('The watcher did not come up within 15 seconds.', [
        `script: ${WATCHER_SCRIPT}`,
        'Run it by hand to see the error: C:\\Tools\\music-brain-dev-desktop\\start-watcher.cmd',
        `check the log: ${STATE_DIR ? join(STATE_DIR, 'watcher.log') : 'watcher.log'}`
      ])
    }
    log(`Watcher started (pid ${state.status.pid}).`)
  } else {
    log('Watcher already running.')
  }

  // The watcher made a real VirtualDesktopAccessor call at startup. If that
  // failed, the DLL is wrong for this Windows build — repair it and retry once
  // rather than making the developer work out which release they need.
  if (watcherState().status.dll !== 'ok') {
    const before = watcherState().status
    log(`VirtualDesktopAccessor reported "${before.dll}" — repairing the toolkit.`)
    await runSetup()

    startWatcher()
    const restarted = await waitFor((s) => s.dll === 'ok')
    if (!restarted?.running || restarted.status?.dll !== 'ok') {
      const now = restarted?.status
      fail(
        `VirtualDesktopAccessor is still not usable: ${now?.dll ?? 'unknown'} — ${now?.detail || 'no detail'}`,
        [
          `expected at: ${DLL_PATH}`,
          'run `pnpm dev:isolation:setup` to see the full diagnosis',
          'see https://github.com/Ciantic/VirtualDesktopAccessor/releases'
        ]
      )
    }
    log('Toolkit repaired.')
  }

  const workspaceName = basename(process.cwd())
  const vscodePid = TARGET_OVERRIDE ? 0 : findVSCodeMainPid()
  const requestId = `${Date.now()}-${process.pid}`

  if (TARGET_OVERRIDE) {
    log(`Target override requested: desktop index ${TARGET_OVERRIDE}`)
  } else {
    log(
      `Looking for the VS Code window for "${workspaceName}"` +
        (vscodePid ? ` in VS Code instance ${vscodePid}.` : ' (no VS Code parent detected).')
    )
  }

  writeRequest({
    request_id: requestId,
    workspace_name: workspaceName,
    vscode_pid: vscodePid,
    override: TARGET_OVERRIDE
  })

  // The watcher answers this exact request; an older answer must never be
  // mistaken for this one.
  const answered = await waitFor((s) => s.request_id === requestId)
  if (!answered?.running || answered.status?.request_id !== requestId) {
    fail('The watcher did not answer the target request within 15 seconds.', [
      `request id: ${requestId}`,
      `check the log: ${STATE_DIR ? join(STATE_DIR, 'watcher.log') : 'watcher.log'}`
    ])
  }

  const status2 = answered.status
  if (status2.resolved_target === 'unknown' || status2.resolve_error) {
    fail(`No safe desktop could be chosen: ${status2.resolve_error || 'no target resolved'}`, [
      `active desktop index: ${status2.current_desktop}`,
      `virtual desktops: ${status2.desktops}`,
      'Windows 10 loses virtual desktops on reboot, and this DLL cannot create them',
      'Create a second desktop with Win+Ctrl+D, then try again',
      'or force one with MUSIC_BRAIN_DEV_DESKTOP_TARGET=<index>'
    ])
  }

  const target = Number(status2.resolved_target)
  const active = Number(status2.current_desktop)

  // Belt and braces: the whole point is that this can never be the active one.
  if (!TARGET_OVERRIDE && Number.isFinite(active) && target === active) {
    fail(`Refusing to launch: the chosen desktop ${target} is the active desktop.`, [
      `target_reason was ${status2.target_reason}`,
      'this is a bug in target selection — please report it'
    ])
  }

  setRouting(true)

  const reason = REASON_TEXT[status2.target_reason] ?? status2.target_reason
  log(`Target: desktop index ${target} (Windows Desktop ${target + 1}) — ${reason}.`)
  if (status2.workspace_candidates && status2.workspace_candidates !== '1') {
    log(
      `Workspace candidates: ${status2.workspace_candidates}${
        status2.candidate_titles ? ` — ${status2.candidate_titles}` : ''
      }`
    )
  }
  log(`Your active desktop (${active}) will not change.`)
}

// ------------------------------------------------------------------- launching

/**
 * Runs the dev server as a child so routing can be switched off again when it
 * stops. Cleanup is best-effort by design: `pnpm dev` disables routing itself,
 * so a missed cleanup here — a hard kill, a closed terminal, a power cut — can
 * never affect a later manual launch.
 */
function launchDevServer({ disableRoutingOnExit }) {
  // VS Code's extension host exports ELECTRON_RUN_AS_NODE=1 to its children,
  // which makes any Electron binary boot as plain Node and die on
  // `app.whenReady()`. This command is the one an agent runs from inside that
  // environment, so it has to clear the variable or it could never work there.
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE

  const child = spawn(process.execPath, [ELECTRON_VITE, 'dev'], { stdio: 'inherit', env })

  let cleanedUp = false
  const cleanUp = () => {
    if (cleanedUp) return
    cleanedUp = true
    if (disableRoutingOnExit) {
      setRouting(false)
      log('Routing disabled.')
    }
  }

  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
    process.on(signal, () => {
      cleanUp()
      if (!child.killed) child.kill(signal)
      process.exit(0)
    })
  }
  process.on('exit', cleanUp)
  process.on('uncaughtException', (error) => {
    cleanUp()
    throw error
  })

  child.on('exit', (code, signal) => {
    cleanUp()
    process.exit(signal ? 1 : (code ?? 0))
  })
}

// --------------------------------------------------------------------- commands

const command = process.argv[2]

if (process.platform !== 'win32' || !FLAG_FILE) {
  // Nothing to protect: there are no Windows virtual desktops here.
  if (command === 'run') {
    log('Not Windows — launching without desktop routing.')
    launchDevServer({ disableRoutingOnExit: false })
  } else {
    log('Windows-only; nothing to do.')
  }
} else {
  switch (command) {
    case 'run': {
      await prepareIsolation()
      launchDevServer({ disableRoutingOnExit: true })
      break
    }

    case 'off': {
      setRouting(false)
      log('Routing disabled — this launch opens on your current desktop.')
      break
    }

    case 'status': {
      const { running, status } = watcherState()
      log(`Routing:   ${isRoutingOn() ? 'ENABLED' : 'disabled'}`)
      log(`Watcher:   ${running ? `running (pid ${status.pid})` : 'not running'}`)
      if (status) {
        log(`DLL:       ${status.dll}${status.detail ? ` — ${status.detail}` : ''}`)
        log(`Desktops:  ${status.desktops}, active index ${status.current_desktop}`)
        log(
          `Workspace: desktop ${status.workspace_desktop} from ${status.workspace_candidates} candidate(s)`
        )
        log(`Target:    ${status.resolved_target} (${status.target_reason})`)
        if (status.resolve_error) log(`Error:     ${status.resolve_error}`)
      }
      log(`Flag:      ${FLAG_FILE}`)
      break
    }

    default: {
      console.error('Usage: node scripts/dev-desktop-isolation.mjs <run|off|status>')
      process.exit(1)
    }
  }
}
