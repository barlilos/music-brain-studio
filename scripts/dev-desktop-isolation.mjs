/**
 * Windows development-desktop routing for Music Brain Studio.
 *
 * Two launch paths, distinguished by command and nothing else — no parent
 * process inspection, no guessing who started the app:
 *
 *   pnpm dev            disables routing, then launches. Always opens on the
 *                       desktop you are looking at, even if an earlier
 *                       isolated run left the flag behind.
 *   pnpm dev:isolated   starts the watcher if needed, verifies it can talk to
 *                       VirtualDesktopAccessor, enables routing, then launches.
 *                       Refuses to launch at all if any of that fails, because
 *                       an unrouted window landing on the user's desktop is the
 *                       exact outcome this exists to prevent.
 *
 * This file never loads the DLL or touches virtual desktops itself. The
 * automation is an AutoHotkey v2 watcher living outside this repository, in
 * `C:\Tools\music-brain-dev-desktop\`; the only contract between the two halves
 * is the state directory below. Nothing here is imported by the application,
 * and `electron-builder.yml` ships only `out/**` and `package.json`, so none of
 * it reaches a build.
 *
 * Usage: node scripts/dev-desktop-isolation.mjs <run|off|status>
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Where the watcher and its DLL live. Overridable for a non-default install. */
const TOOLKIT_DIR = process.env.MUSIC_BRAIN_DEV_DESKTOP_HOME ?? 'C:\\Tools\\music-brain-dev-desktop'
const WATCHER_SCRIPT = join(TOOLKIT_DIR, 'music-brain-dev.ahk')

const AHK_CANDIDATES = [
  process.env.AUTOHOTKEY_EXE,
  'C:\\Program Files\\AutoHotkey\\v2\\AutoHotkey64.exe',
  'C:\\Program Files\\AutoHotkey\\AutoHotkey64.exe',
  join(process.env.LOCALAPPDATA ?? '', 'Programs\\AutoHotkey\\v2\\AutoHotkey64.exe')
].filter(Boolean)

const STATE_DIR = process.env.LOCALAPPDATA
  ? join(process.env.LOCALAPPDATA, 'music-brain-dev-desktop')
  : null
const FLAG_FILE = STATE_DIR ? join(STATE_DIR, 'enabled.flag') : null
const STATUS_FILE = STATE_DIR ? join(STATE_DIR, 'watcher.status') : null

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

/** Parses the watcher's `key=value` status file. Returns null if unreadable. */
function readStatus() {
  if (!STATUS_FILE || !existsSync(STATUS_FILE)) return null
  try {
    const raw = readFileSync(STATUS_FILE, 'utf8')
    // Tolerate a byte-order mark, whatever wrote the file: left in place it
    // would glue itself to the first key name and silently break every lookup.
    const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
    const entries = text
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const i = line.indexOf('=')
        return [line.slice(0, i), line.slice(i + 1)]
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
  const status = readStatus()
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

function findAutoHotkey() {
  return AHK_CANDIDATES.find((candidate) => existsSync(candidate))
}

function startWatcher() {
  const ahk = findAutoHotkey()
  if (!ahk) {
    fail('AutoHotkey v2 (64-bit) was not found.', [
      ...AHK_CANDIDATES.map((c) => `looked for: ${c}`),
      'Install AutoHotkey v2 from https://www.autohotkey.com/',
      'or set AUTOHOTKEY_EXE to the full path of AutoHotkey64.exe'
    ])
  }
  if (!existsSync(WATCHER_SCRIPT)) {
    fail(`The watcher script is missing: ${WATCHER_SCRIPT}`, [
      'See C:\\Tools\\music-brain-dev-desktop\\README.md for the expected layout',
      'or set MUSIC_BRAIN_DEV_DESKTOP_HOME to where the toolkit actually lives'
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

// -------------------------------------------------------------------- preflight

async function prepareIsolation() {
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

  const { status } = watcherState()
  if (status.dll !== 'ok') {
    fail(`VirtualDesktopAccessor is not usable: ${status.dll} — ${status.detail || 'no detail'}`, [
      `expected at: ${join(TOOLKIT_DIR, 'VirtualDesktopAccessor.dll')}`,
      'the DLL must be the 64-bit build matching THIS Windows version',
      'Windows 10: use the "2019-windows10" release from github.com/Ciantic/VirtualDesktopAccessor',
      'Windows 11 24H2+: use the "2024-12-16-windows11" release'
    ])
  }

  setRouting(true)
  log('Routing enabled.')

  // The watcher creates the target desktop if Windows does not have one yet,
  // but only once routing is on — so this wait comes after enabling, not before.
  const target = Number(status.target ?? 1)
  const ready = await waitFor((s) => s.routing === 'on' && Number(s.desktops) > target)
  if (!ready?.running || Number(ready.status?.desktops) <= target) {
    setRouting(false)
    fail(
      `Windows Desktop ${target + 1} does not exist and could not be created ` +
        `(the watcher reports ${ready?.status?.desktops ?? '?'} desktop(s)).`,
      ['Create a second desktop in Task View (Win+Tab), then try again']
    )
  }
  log(`Desktop ${target + 1} ready (${ready.status.desktops} virtual desktops).`)
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
      log(`Routing:  ${isRoutingOn() ? 'ENABLED' : 'disabled'}`)
      log(`Watcher:  ${running ? `running (pid ${status.pid})` : 'not running'}`)
      if (status) {
        log(`DLL:      ${status.dll}${status.detail ? ` — ${status.detail}` : ''}`)
        log(`Desktops: ${status.desktops} (target index ${status.target})`)
      }
      log(`Flag:     ${FLAG_FILE}`)
      break
    }

    default: {
      console.error('Usage: node scripts/dev-desktop-isolation.mjs <run|off|status>')
      process.exit(1)
    }
  }
}
