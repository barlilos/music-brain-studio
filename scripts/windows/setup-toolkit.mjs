/**
 * Prepares the local Windows desktop-routing toolkit.
 *
 * A fresh clone has the watcher source but not the machine-local pieces it
 * needs: a place to run from, and a VirtualDesktopAccessor.dll matching this
 * exact Windows build. This makes both reproducible without committing a
 * binary, and without asking a new developer to know which release to pick.
 *
 * Idempotent by design — running it twice does nothing the second time.
 * `pnpm dev:isolated` calls into it, so the normal first run is simply:
 *
 *     pnpm install && pnpm dev:isolated
 *
 * Deliberately not a package manager: it installs one known DLL from one known
 * repository, never elevates, and never installs AutoHotkey for you.
 *
 * Usage: node scripts/windows/setup-toolkit.mjs
 */

import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const HERE = dirname(fileURLToPath(import.meta.url))

export const TOOLKIT_DIR =
  process.env.MUSIC_BRAIN_DEV_DESKTOP_HOME ?? 'C:\\Tools\\music-brain-dev-desktop'
export const WATCHER_SOURCE = join(HERE, 'music-brain-dev.ahk')
export const WATCHER_INSTALLED = join(TOOLKIT_DIR, 'music-brain-dev.ahk')
export const DLL_PATH = join(TOOLKIT_DIR, 'VirtualDesktopAccessor.dll')
const VERIFY_SCRIPT = join(HERE, 'verify-vda.ahk')

const AHK_CANDIDATES = [
  process.env.AUTOHOTKEY_EXE,
  'C:\\Program Files\\AutoHotkey\\v2\\AutoHotkey64.exe',
  'C:\\Program Files\\AutoHotkey\\AutoHotkey64.exe',
  join(process.env.LOCALAPPDATA ?? '', 'Programs\\AutoHotkey\\v2\\AutoHotkey64.exe')
].filter(Boolean)

const RELEASES_API = 'https://api.github.com/repos/Ciantic/VirtualDesktopAccessor/releases/tags/'
const ASSET_NAME = 'VirtualDesktopAccessor.dll'

/** How many superseded DLLs to keep before deleting the oldest. */
const MAX_BACKUPS = 3

export class SetupError extends Error {
  constructor(message, hints = []) {
    super(message)
    this.hints = hints
  }
}

const log = (message) => console.log(`[dev-desktop] ${message}`)

// ------------------------------------------------------------ AutoHotkey

export function findAutoHotkey() {
  return AHK_CANDIDATES.find((candidate) => existsSync(candidate))
}

function requireAutoHotkey() {
  const ahk = findAutoHotkey()
  if (!ahk) {
    // Installing a whole runtime unattended is beyond what this should do.
    throw new SetupError('AutoHotkey v2 (64-bit) is required and was not found.', [
      ...AHK_CANDIDATES.map((c) => `looked for: ${c}`),
      'Install AutoHotkey v2 from https://www.autohotkey.com/ and run this again',
      'or set AUTOHOTKEY_EXE to the full path of AutoHotkey64.exe'
    ])
  }
  return ahk
}

// ------------------------------------------------------- Windows detection

/**
 * Reads the real build and update-revision numbers. `os.release()` is not
 * enough: the DLL choice below turns on the UBR, which it does not report.
 */
export function detectWindows() {
  const raw = execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      "$k = Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion'; " +
        "'{0}|{1}|{2}' -f $k.CurrentBuildNumber, $k.UBR, $k.DisplayVersion"
    ],
    { encoding: 'utf8', timeout: 20000, windowsHide: true }
  ).trim()

  const [build, ubr, displayVersion] = raw.split('|')
  return {
    build: Number(build),
    ubr: Number(ubr) || 0,
    displayVersion: (displayVersion || '').trim()
  }
}

/**
 * Maps a Windows build to the VirtualDesktopAccessor release that states
 * support for it.
 *
 * The DLL wraps undocumented COM interfaces whose vtables Microsoft reorders
 * between builds, so this is not a "newest wins" choice — a newer DLL is
 * actively wrong on an older build. Every entry below is taken from the
 * release notes of the release it names; where the notes do not cover a build,
 * this returns an error rather than guessing, because a mismatched DLL fails
 * silently at run time rather than refusing to load.
 *
 * Sources (github.com/Ciantic/VirtualDesktopAccessor/releases):
 *   2019-windows10        "Windows 10 binary, final"
 *   2023-08-31-windows11  "at least 22621.2215 ... not backward compatible"
 *   2023-11-10-windows11  "23H2 22631.2506 and with older 22621.2215"
 *   2024-01-25-windows11  "now works with 23H2 22631.3085"
 *   2024-12-16-windows11  "Windows 11 24H2 had a backward-incompatible change"
 *                         README: "requires at least 24H2 26100.2605"
 */
export function pickRelease({ build, ubr }) {
  if (!Number.isFinite(build)) {
    return { error: 'Could not determine the Windows build number.' }
  }

  // Windows 11 begins at build 22000; anything below is Windows 10 or older.
  if (build < 22000) {
    return {
      tag: '2019-windows10',
      why: `Windows 10 build ${build} — the "2019-windows10" release is the final Windows 10 binary`
    }
  }

  if (build >= 26100) {
    if (build === 26100 && ubr < 2605) {
      return {
        error:
          `Windows 11 24H2 build 26100.${ubr} is older than 26100.2605, which the ` +
          `"2024-12-16-windows11" release requires, and no other release covers it.`
      }
    }
    return {
      tag: '2024-12-16-windows11',
      why: `Windows 11 build ${build}.${ubr} (24H2 or newer) — vtable layout from the 24H2 change`
    }
  }

  if (build === 22631) {
    if (ubr >= 3085) {
      return { tag: '2024-01-25-windows11', why: `Windows 11 23H2 build 22631.${ubr}` }
    }
    if (ubr >= 2506) {
      return { tag: '2023-11-10-windows11', why: `Windows 11 23H2 build 22631.${ubr}` }
    }
    return {
      error: `Windows 11 23H2 build 22631.${ubr} predates 22631.2506, the oldest 23H2 revision any release states support for.`
    }
  }

  if (build === 22621) {
    if (ubr >= 2215) {
      return { tag: '2023-11-10-windows11', why: `Windows 11 22H2 build 22621.${ubr}` }
    }
    return {
      error: `Windows 11 22H2 build 22621.${ubr} predates 22621.2215; the matching release states it is not backward compatible below that.`
    }
  }

  return {
    error:
      `Windows build ${build}.${ubr} is not covered by any VirtualDesktopAccessor release note. ` +
      `Rather than install a DLL that would load and then silently misbehave, this stops here.`
  }
}

// ------------------------------------------------------------- verification

/**
 * Runs the DLL through a real VirtualDesktopAccessor call. Returns
 * `{ ok, state, detail, desktops }`.
 */
export function verifyDll(dllPath = DLL_PATH) {
  if (!existsSync(dllPath))
    return { ok: false, state: 'missing', detail: `not found at ${dllPath}` }

  const ahk = requireAutoHotkey()
  const outFile = join(tmpdir(), `mbs-vda-verify-${process.pid}-${Date.now()}.txt`)
  rmSync(outFile, { force: true })

  try {
    execFileSync(ahk, [VERIFY_SCRIPT, dllPath, outFile], { timeout: 30000, windowsHide: true })
  } catch {
    // A non-zero exit is how the probe reports "not usable"; the file still
    // holds the detail. Only a missing file is a real failure to verify.
  }

  if (!existsSync(outFile)) {
    return { ok: false, state: 'unverified', detail: 'the AutoHotkey probe produced no result' }
  }

  const text = readFileSync(outFile, 'utf8')
  rmSync(outFile, { force: true })

  const fields = Object.fromEntries(
    text
      .replace(/^\uFEFF/, '')
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const i = line.indexOf('=')
        return [line.slice(0, i), line.slice(i + 1).replace(/\r$/, '')]
      })
  )

  return {
    ok: fields.ok === '1',
    state: fields.state ?? 'unknown',
    detail: fields.detail ?? '',
    desktops: Number(fields.desktops ?? -1)
  }
}

// ---------------------------------------------------------------- watcher

/** Copies the canonical watcher into the toolkit directory when it differs. */
export function syncWatcher() {
  if (!existsSync(WATCHER_SOURCE)) {
    throw new SetupError(`The canonical watcher is missing from the repository: ${WATCHER_SOURCE}`)
  }
  mkdirSync(TOOLKIT_DIR, { recursive: true })

  const source = readFileSync(WATCHER_SOURCE)
  if (existsSync(WATCHER_INSTALLED) && readFileSync(WATCHER_INSTALLED).equals(source)) {
    return { changed: false }
  }
  copyFileSync(WATCHER_SOURCE, WATCHER_INSTALLED)
  return { changed: true }
}

/** True when the installed watcher is identical to the one in git. */
export function watcherInSync() {
  try {
    return (
      existsSync(WATCHER_INSTALLED) &&
      readFileSync(WATCHER_INSTALLED).equals(readFileSync(WATCHER_SOURCE))
    )
  } catch {
    return false
  }
}

/** Stops a running watcher so the DLL it has loaded can be replaced. */
function stopWatcher() {
  try {
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Get-CimInstance Win32_Process -Filter "Name like \'AutoHotkey%\'" | ' +
          "Where-Object { $_.CommandLine -like '*music-brain-dev.ahk*' } | " +
          'ForEach-Object { Stop-Process -Id $_.ProcessId -Force }'
      ],
      { timeout: 20000, windowsHide: true, stdio: 'ignore' }
    )
  } catch {
    // Nothing running, or not ours to stop. Either way the copy below decides.
  }
}

// ------------------------------------------------------------------- DLL

/** Timestamped, so the DLL that was replaced can always be identified later. */
function backupDll() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('Z', '')
  const backup = join(TOOLKIT_DIR, `VirtualDesktopAccessor.incompatible-${stamp}.dll`)

  try {
    renameSync(DLL_PATH, backup)
  } catch {
    // A DLL still mapped by a process cannot be deleted, but it can usually be
    // renamed out of the way — which is all that is needed here.
    try {
      copyFileSync(DLL_PATH, backup)
      unlinkSync(DLL_PATH)
    } catch {
      return { backup: null, note: 'the old DLL could not be moved aside' }
    }
  }
  pruneBackups()
  return { backup }
}

function pruneBackups() {
  try {
    const backups = readdirSync(TOOLKIT_DIR)
      .filter((name) => /^VirtualDesktopAccessor\.incompatible-.*\.dll$/.test(name))
      .map((name) => join(TOOLKIT_DIR, name))
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)

    for (const stale of backups.slice(MAX_BACKUPS)) rmSync(stale, { force: true })
  } catch {
    // Housekeeping only.
  }
}

/**
 * Downloads the DLL for a release tag, straight from that release's own asset
 * metadata rather than a hand-built URL.
 *
 * The project publishes no checksums for these assets — the releases API
 * reports no digest — so there is no signature to verify against. What is
 * checked instead: the asset comes from the official repository's release
 * metadata, the transfer matches the size GitHub recorded, the file is a
 * 64-bit PE, and the result passes a real VirtualDesktopAccessor call. Nothing
 * downloaded is ever executed as a script.
 */
async function downloadDll(tag) {
  const response = await fetch(`${RELEASES_API}${encodeURIComponent(tag)}`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'music-brain-studio-setup' }
  })
  if (!response.ok) {
    throw new SetupError(`Could not read release "${tag}" (HTTP ${response.status}).`, [
      'check your network connection',
      `https://github.com/Ciantic/VirtualDesktopAccessor/releases/tag/${tag}`
    ])
  }

  const release = await response.json()
  const asset = (release.assets ?? []).find((a) => a.name === ASSET_NAME)
  if (!asset) {
    throw new SetupError(`Release "${tag}" has no ${ASSET_NAME} asset.`)
  }

  const download = await fetch(asset.browser_download_url, {
    headers: { 'User-Agent': 'music-brain-studio-setup' },
    redirect: 'follow'
  })
  if (!download.ok) {
    throw new SetupError(`Downloading ${ASSET_NAME} failed (HTTP ${download.status}).`)
  }

  const bytes = Buffer.from(await download.arrayBuffer())

  if (bytes.length === 0) throw new SetupError('The downloaded DLL was empty.')
  if (asset.size && bytes.length !== asset.size) {
    throw new SetupError(
      `The downloaded DLL is ${bytes.length} bytes but the release records ${asset.size}.`,
      ['the download was truncated or altered in transit; nothing was installed']
    )
  }
  if (peMachine(bytes) !== 0x8664) {
    throw new SetupError('The downloaded DLL is not a 64-bit (x64) binary.', [
      'AutoHotkey64.exe can only load a 64-bit DLL'
    ])
  }

  return { bytes, url: asset.browser_download_url, size: bytes.length }
}

/** Reads the PE header machine field. 0x8664 is x64. */
function peMachine(bytes) {
  try {
    if (bytes.length < 0x40 || bytes.readUInt16LE(0) !== 0x5a4d) return 0
    const peOffset = bytes.readUInt32LE(0x3c)
    if (bytes.readUInt32LE(peOffset) !== 0x00004550) return 0
    return bytes.readUInt16LE(peOffset + 4)
  } catch {
    return 0
  }
}

// ----------------------------------------------------------------- driver

/**
 * Brings the toolkit to a healthy state. Returns a summary; throws SetupError
 * with actionable hints when it cannot.
 */
export async function ensureToolkit({ quiet = false } = {}) {
  const say = quiet ? () => {} : log

  if (process.platform !== 'win32') {
    throw new SetupError('Desktop routing is Windows-only.')
  }

  const ahk = requireAutoHotkey()
  say(`AutoHotkey: ${ahk}`)

  mkdirSync(TOOLKIT_DIR, { recursive: true })
  const watcher = syncWatcher()
  say(
    `Watcher:    ${watcher.changed ? 'installed/updated' : 'already up to date'} → ${WATCHER_INSTALLED}`
  )

  // An existing DLL that genuinely works is never replaced, whatever release
  // it came from — working is the only property that matters.
  let check = verifyDll()
  if (check.ok) {
    say(`DLL:        already working (${check.desktops} virtual desktop(s))`)
    return { ahk, watcherChanged: watcher.changed, dll: 'already-ok', check }
  }

  say(`DLL:        ${check.state} — ${check.detail}`)

  const windows = detectWindows()
  say(
    `Windows:    build ${windows.build}.${windows.ubr}${windows.displayVersion ? ` (${windows.displayVersion})` : ''}`
  )

  const choice = pickRelease(windows)
  if (choice.error) {
    throw new SetupError(choice.error, [
      'no DLL was downloaded — installing a mismatched one fails silently at run time',
      'see https://github.com/Ciantic/VirtualDesktopAccessor/releases',
      'once you have a working DLL, drop it in as ' + DLL_PATH
    ])
  }
  say(`Release:    ${choice.tag} — ${choice.why}`)

  let backedUp = null
  if (existsSync(DLL_PATH)) {
    stopWatcher() // it holds the DLL mapped, which blocks replacing it
    const result = backupDll()
    backedUp = result.backup
    say(backedUp ? `Backup:     ${backedUp}` : `Backup:     ${result.note}`)
  }

  const downloaded = await downloadDll(choice.tag)
  writeFileSync(DLL_PATH, downloaded.bytes)
  say(`Downloaded: ${downloaded.size} bytes from ${choice.tag}`)

  check = verifyDll()
  if (!check.ok) {
    throw new SetupError(
      `The freshly installed DLL still does not work: ${check.state} — ${check.detail}`,
      [
        `release used: ${choice.tag}`,
        'this build of Windows may need a release this mapping does not know about',
        'see https://github.com/Ciantic/VirtualDesktopAccessor/releases'
      ]
    )
  }

  say(`Verified:   ${check.desktops} virtual desktop(s) visible`)
  return {
    ahk,
    watcherChanged: watcher.changed,
    dll: 'installed',
    release: choice.tag,
    backedUp,
    check
  }
}

// -------------------------------------------------------------------- CLI

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]

if (invokedDirectly) {
  try {
    const summary = await ensureToolkit()
    log(
      summary.dll === 'already-ok'
        ? 'Setup complete — nothing needed changing.'
        : `Setup complete — ${ASSET_NAME} installed from ${summary.release}.`
    )
  } catch (error) {
    if (error instanceof SetupError) {
      console.error(`\n[dev-desktop] SETUP FAILED\n`)
      console.error(`  ${error.message}\n`)
      for (const hint of error.hints ?? []) console.error(`  - ${hint}`)
      console.error('')
      process.exit(1)
    }
    throw error
  }
}
