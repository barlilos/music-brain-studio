import type { WindowSize } from '@shared/types'

/**
 * The application name. Used by the main process for the native window title
 * and by the renderer for the on-screen heading, so the two can never drift.
 */
export const APP_NAME = 'Music Brain Studio'

/**
 * Size the main window opens at.
 *
 * 1440×900 is the modal laptop logical resolution and still leaves margin on a
 * 1920-wide display. The extra width over the previous 1200×800 goes to the
 * explorer, whose rows are long titles that should not truncate, and leaves room
 * for the detail pane the application is growing towards.
 */
export const DEFAULT_WINDOW_SIZE: WindowSize = {
  width: 1440,
  height: 900
}

/** Smallest size the main window may be resized to. */
export const MIN_WINDOW_SIZE: WindowSize = {
  width: 900,
  height: 600
}

/**
 * IPC channel for opening a project: prompts for a file, reads it, parses it.
 *
 * Named here rather than written as a literal in both places, because the main
 * process handler and the preload caller must agree exactly and a typo would
 * only surface as a silent no-response at runtime.
 */
export const IPC_OPEN_PROJECT = 'project:open'

/** IPC channel for reading the project the application opens with. */
export const IPC_LOAD_DEFAULT_PROJECT = 'project:loadDefault'

/**
 * IPC channel for writing an open project back to disk.
 *
 * Takes a token rather than a path — see `SaveProjectRequest`. The renderer has
 * never been able to name a file for `readFile`, and this keeps that true for
 * `writeFile`, which matters considerably more.
 */
export const IPC_SAVE_PROJECT = 'project:save'

/** IPC channel for re-reading an open project, after a conflict. */
export const IPC_RELOAD_PROJECT = 'project:reload'

/**
 * IPC channel the renderer uses to tell the main process whether there is
 * unsaved work.
 *
 * One-way and fire-and-forget. The main process needs it because only it can
 * intercept a window close, and it cannot ask the renderer synchronously at the
 * moment the close arrives.
 */
export const IPC_SET_DIRTY = 'project:setDirty'

/**
 * IPC channel the main process uses to ask the renderer to save, having offered
 * the user Save / Don't Save / Cancel while closing a dirty window.
 */
export const IPC_REQUEST_SAVE = 'project:requestSave'

/** IPC channel the renderer answers `IPC_REQUEST_SAVE` on. */
export const IPC_SAVE_REQUEST_RESULT = 'project:requestSaveResult'

/**
 * The workspace opened at startup, relative to the application root.
 *
 * **A development convenience, not intended product behaviour.** The
 * application is currently built around one person opening one knowledge base
 * every day, so it opens straight into this file rather than asking. A later
 * milestone replaces it with real workspace and project management.
 *
 * This constant is the only place a project file is named. Nothing else assumes
 * which workspace is open, or that there is exactly one — which is what keeps
 * that later milestone an addition rather than an unpicking. **Open Project**
 * exists alongside it, so the capability to open anything else is already there
 * and a missing or malformed default is recoverable.
 *
 * Resolved against different roots in development and in a packaged build — see
 * `defaultProjectPath` in `src/main/ipc/project.ts` — so this stays a relative
 * path and never a location.
 */
export const DEFAULT_PROJECT_PATH = 'data/music-brain.json'

/**
 * Environment variable naming a development-only replacement for the default
 * project.
 *
 * Set by `pnpm dev:isolated` to a disposable copy in the system temp directory,
 * so that a development session can add, rename, move and save without any of it
 * reaching the real knowledge base. `pnpm dev` never sets it.
 *
 * **Must match `DEV_PROJECT_FILE_ENV` in `scripts/dev-isolated-workspace.mjs`.**
 * The launcher is plain ESM and cannot import this file.
 *
 * Honoured only when `app.isPackaged` is false, so it cannot be used to redirect
 * a shipped application. It is read in the main process and never travels to the
 * renderer, which has no field to carry a path in the first place.
 */
export const DEV_PROJECT_FILE_ENV = 'MUSIC_BRAIN_DEV_PROJECT_FILE'

/** The `window` property the preload script publishes its project API on. */
export const PROJECT_API_NAMESPACE = 'projectApi'
