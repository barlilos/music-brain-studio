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
