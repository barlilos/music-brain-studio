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

/** The `window` property the preload script publishes its project API on. */
export const PROJECT_API_NAMESPACE = 'projectApi'
