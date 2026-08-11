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

/** The `window` property the preload script publishes its project API on. */
export const PROJECT_API_NAMESPACE = 'projectApi'
