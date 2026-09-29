/**
 * Stops a window with unsaved work from closing silently.
 *
 * This lives in the main process because it has to. A renderer cannot hold a
 * window open while it asks a question: `beforeunload` can cancel a close, but
 * it cannot await an answer, and Electron gives it no way to show its own dialog
 * in that moment. So the main process owns the prompt, and the renderer — which
 * is the only side that knows how to serialize the model — owns the save.
 *
 * The two exchange exactly two things: a dirty flag pushed up whenever it
 * changes, and a save request sent down when the user chooses Save.
 */

import { BrowserWindow, dialog, ipcMain } from 'electron'
import { IPC_REQUEST_SAVE, IPC_SAVE_REQUEST_RESULT, IPC_SET_DIRTY } from '@shared/constants'
import type { RequestedSaveOutcome } from '@shared/types'

/** How long to wait for the renderer to finish a save before giving up on it. */
const SAVE_TIMEOUT_MS = 15_000

/**
 * What to do when the renderer refuses to unload because it holds unsaved work.
 *
 * Pulled out as a pure function because Electron's `will-prevent-unload`
 * contract is inverted and invites exactly the wrong reflex: there,
 * `preventDefault()` means *discard the renderer's objection and unload
 * anyway*, so the safe branch is the one that does nothing. A future reader
 * tidying up "a handler that ignores its event" would reintroduce silent data
 * loss on Ctrl+R, which is the defect this exists to close.
 *
 * @param isForcedClose Whether the application is already closing the window
 *   after asking the user — in which case the objection has been answered.
 */
export function decideUnload(isForcedClose: boolean): {
  /** True maps to `event.preventDefault()`. */
  allowUnload: boolean
  /** Whether to tell the user why nothing happened. */
  explain: boolean
} {
  return isForcedClose
    ? { allowUnload: true, explain: false }
    : { allowUnload: false, explain: true }
}

/** Whether each window has unsaved work, by `webContents` id. */
const dirtyWindows = new Set<number>()

ipcMain.on(IPC_SET_DIRTY, (event, isDirty: boolean) => {
  const id = event.sender.id
  if (isDirty) dirtyWindows.add(id)
  else dirtyWindows.delete(id)
})

/**
 * Asks the renderer to save, and waits for it to say how it went.
 *
 * Timed out rather than awaited forever: a renderer that has crashed or wedged
 * would otherwise leave the window permanently unclosable, which is a worse
 * failure than the one this function exists to prevent.
 */
function requestSave(window: BrowserWindow): Promise<RequestedSaveOutcome> {
  return new Promise((resolve) => {
    const requestId = `${Date.now()}-${Math.random()}`

    const finish = (outcome: RequestedSaveOutcome): void => {
      clearTimeout(timer)
      ipcMain.removeListener(IPC_SAVE_REQUEST_RESULT, onResult)
      resolve(outcome)
    }

    const onResult = (_event: unknown, id: string, outcome: RequestedSaveOutcome): void => {
      if (id === requestId) finish(outcome)
    }

    const timer = setTimeout(() => finish('failed'), SAVE_TIMEOUT_MS)

    ipcMain.on(IPC_SAVE_REQUEST_RESULT, onResult)
    window.webContents.send(IPC_REQUEST_SAVE, requestId)
  })
}

/**
 * Intercepts `close` and offers Save / Don't Save / Cancel when there is
 * unsaved work.
 *
 * `forcing` is what breaks the recursion: the second `close()` has to reach the
 * real handler rather than this one, and Electron gives no other way to say
 * "I have already asked".
 */
export function installCloseGuard(window: BrowserWindow): void {
  let forcing = false

  /*
   * Captured now, while the window is alive.
   *
   * `window.webContents` throws `Object has been destroyed` once the window has
   * gone, and `closed` fires precisely then — so reading it inside that handler
   * turns every ordinary window close into an uncaught main-process exception
   * and Electron's "Error" dialog. Holding the number instead costs nothing and
   * cannot be destroyed.
   */
  const webContentsId = window.webContents.id

  /*
   * The renderer-teardown paths: View → Reload (Ctrl+R) and a script calling
   * `window.close()`. Neither emits `close` on the window, so the handler below
   * never sees them; both do run `beforeunload`, which the renderer cancels
   * while there is unsaved work.
   *
   * Electron's contract here reads backwards: calling `preventDefault()` means
   * *ignore the renderer's objection and unload anyway*. Doing nothing is what
   * honours it. So this handler deliberately does not call `preventDefault()`
   * except while a guarded close is already in flight — at which point the
   * renderer's objection is one we have already asked the user about.
   */
  window.webContents.on('will-prevent-unload', (event) => {
    const { allowUnload, explain } = decideUnload(forcing)

    if (allowUnload) {
      event.preventDefault()
      return
    }
    if (!explain) return

    void dialog.showMessageBox(window, {
      type: 'warning',
      buttons: ['OK'],
      defaultId: 0,
      title: 'Unsaved changes',
      message: 'This project has unsaved changes.',
      detail:
        'Reloading would discard them, so nothing was reloaded. Save with Ctrl+S first, or close the window if you want to be asked what to do.',
      noLink: true
    })
  })

  window.on('close', (event) => {
    if (forcing || !dirtyWindows.has(webContentsId)) return

    event.preventDefault()

    void (async () => {
      const { response } = await dialog.showMessageBox(window, {
        type: 'warning',
        buttons: ['Save', "Don't Save", 'Cancel'],
        defaultId: 0,
        cancelId: 2,
        title: 'Unsaved changes',
        message: 'Save your changes before closing?',
        detail: 'Your changes will be lost if you close without saving.',
        noLink: true
      })

      // Cancel, or the dialog dismissed some other way: stay exactly as we are.
      if (response === 2) return

      if (response === 1) {
        forcing = true
        window.close()
        return
      }

      const outcome = await requestSave(window)

      // A failed or conflicted save must not close the window — that is the
      // moment the user's work would be lost, and the renderer is already
      // showing them why it did not go through.
      if (outcome === 'failed') return

      forcing = true
      window.close()
    })()
  })

  window.on('closed', () => {
    dirtyWindows.delete(webContentsId)
  })
}
