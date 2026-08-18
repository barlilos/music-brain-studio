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

import { copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'

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
 * Removes the copy. Best-effort by design: a leftover temp directory after a
 * hard kill is harmless, and failing the shutdown over it would not be.
 *
 * @param {{ directory: string } | null} workspace
 */
export function disposeIsolatedWorkspace(workspace) {
  if (!workspace) return
  try {
    rmSync(workspace.directory, { recursive: true, force: true })
  } catch {
    // Ignored on purpose — see above.
  }
}
