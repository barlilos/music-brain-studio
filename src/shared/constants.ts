import type { WindowSize } from '@shared/types'

/**
 * The application name. Used by the main process for the native window title
 * and by the renderer for the on-screen heading, so the two can never drift.
 */
export const APP_NAME = 'Music Brain Studio'

/** Size the main window opens at. */
export const DEFAULT_WINDOW_SIZE: WindowSize = {
  width: 1200,
  height: 800
}

/** Smallest size the main window may be resized to. */
export const MIN_WINDOW_SIZE: WindowSize = {
  width: 800,
  height: 600
}
