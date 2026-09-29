/**
 * A disposable copy of the knowledge base, for `pnpm dev:isolated`.
 *
 * Milestone 005 makes the application able to write. That turns a routine
 * development launch into something that can damage the user's real 548-node
 * knowledge base — not through a bug, but by working correctly on the wrong
 * file. A UI test that adds a node, renames it and presses Ctrl+S is exactly the
 * test worth running, and exactly the one that must never touch `data/`.
 *
 * So `dev:isolated` gets its own copy, in the system temp directory, and hands
 * the child process an absolute path to it. `pnpm dev` passes nothing and keeps
 * opening the real file, which is what makes the two commands genuinely
 * different rather than differing by a flag someone can forget.
 *
 * The copy is a plain file copy rather than a symlink or a junction: the point
 * is that writes land somewhere else, and a link would defeat that silently.
 *
 * Nothing here is imported by the application, and `electron-builder.yml` ships
 * only `out/**` and `package.json`, so none of it reaches a build.
 */

import { copyFileSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'

/**
 * The variable the launcher uses to tell the Electron child which file to open.
 *
 * **Must match `DEV_PROJECT_FILE_ENV` in `src/shared/constants.ts`.** The two
 * cannot share a definition — this is plain ESM run by Node, that is TypeScript
 * compiled for three targets — so they are kept in step by hand, exactly as the
 * path aliases in `electron.vite.config.ts` and the `tsconfig` files are.
 */
export const DEV_PROJECT_FILE_ENV = 'MUSIC_BRAIN_DEV_PROJECT_FILE'

/** Where the real knowledge base lives, relative to the repository root. */
const DEFAULT_PROJECT_PATH = 'data/music-brain.json'

/**
 * Copies the knowledge base somewhere disposable.
 *
 * Returns `null` when the source is missing rather than refusing to launch: a
 * developer without a `data/` directory should still get a dev server, and the
 * main process already handles a project that cannot be read.
 *
 * @param {string} [sourcePath] Absolute path to copy. Defaults to the real file.
 * @returns {{ directory: string, projectPath: string, sourcePath: string } | null}
 */
export function createIsolatedWorkspace(sourcePath) {
  const source = sourcePath ?? resolve(process.cwd(), DEFAULT_PROJECT_PATH)

  let directory
  try {
    // In the OS temp directory, never inside the repository — so a stray copy
    // can never be mistaken for the real file, committed, or opened by accident.
    directory = mkdtempSync(join(tmpdir(), 'music-brain-dev-'))
    copyFileSync(source, join(directory, basename(source)))
  } catch (error) {
    if (directory) rmSync(directory, { recursive: true, force: true })
    console.error(`[dev-data] Could not prepare an isolated copy of ${source}: ${error.message}`)
    return null
  }

  return { directory, projectPath: join(directory, basename(source)), sourcePath: source }
}

/**
 * The real knowledge base, and the directory it lives in.
 *
 * Both are resolved against the repository root, which is the launcher's working
 * directory, so a relative `--project-file` cannot sneak past the checks below by
 * spelling the same file differently.
 */
function realProjectLocations() {
  const file = resolve(process.cwd(), DEFAULT_PROJECT_PATH)
  return { file, directory: dirname(file) }
}

/** Whether `candidate` is the given directory or sits anywhere beneath it. */
function isInside(candidate, directory) {
  const rel = relative(directory, candidate)
  return (
    rel === '' ||
    (!rel.startsWith('..') && !rel.startsWith(`..${sep}`) && !resolve(rel).startsWith('..'))
  )
}

/**
 * Reuses a disposable file the caller already prepared, instead of copying a
 * fresh one.
 *
 * **Why this exists.** Every ordinary `dev:isolated` run starts from a pristine
 * copy, which is exactly right for day-to-day work and makes one thing
 * impossible to verify: that edits saved by one Electron process are still there
 * when a *different* Electron process opens the same file. Proving that needs
 * one file and two launches.
 *
 * It is deliberately narrow. This module is a development script that
 * `electron-builder.yml` never ships, the main process honours the resulting
 * variable only when `!app.isPackaged`, and the three refusals below mean the
 * one file it must never reach — the user's real knowledge base — cannot be
 * named however the path is spelled.
 *
 * @param {string} rawPath Absolute or repository-relative path to reuse.
 * @returns {{ directory: string, projectPath: string, sourcePath: string, reused: true } | null}
 */
export function reuseIsolatedWorkspace(rawPath) {
  const target = resolve(process.cwd(), rawPath)
  const real = realProjectLocations()

  const refuse = (why) => {
    console.error(`[dev-data] Refusing to reuse ${target}: ${why}`)
    return null
  }

  // 1. Never the real knowledge base, however it was spelled.
  if (target === real.file) {
    return refuse('that is the real Music Brain file.')
  }

  // 2. Never anything inside the repository's data directory, so a copy left
  //    beside the real file cannot be edited by a development run either.
  if (isInside(target, real.directory)) {
    return refuse(`it is inside ${real.directory}, which holds real data.`)
  }

  // 3. It must already exist. Creating it here would mean this flag could
  //    quietly invent a project rather than reuse a prepared one.
  let stats
  try {
    stats = statSync(target)
  } catch {
    return refuse('no such file. Prepare the disposable copy first.')
  }
  if (!stats.isFile()) return refuse('that is not a file.')

  return { directory: dirname(target), projectPath: target, sourcePath: target, reused: true }
}

/**
 * Removes the copy. Best-effort by design: a leftover temp directory after a
 * hard kill is harmless, and failing the shutdown over it would not be.
 *
 * @param {{ directory: string } | null} workspace
 */
export function disposeIsolatedWorkspace(workspace) {
  if (!workspace) return
  // A reused file belongs to whoever prepared it; this launcher only cleans up
  // the directories it made itself.
  if (workspace.reused) return
  try {
    rmSync(workspace.directory, { recursive: true, force: true })
  } catch {
    // Ignored on purpose — see above.
  }
}
