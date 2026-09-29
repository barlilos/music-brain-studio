import { describe, expect, it, vi } from 'vitest'

/*
 * `closeGuard` registers its `IPC_SET_DIRTY` listener at module scope, so
 * importing it outside Electron would dereference an `ipcMain` that does not
 * exist. Only the pure decision below is under test, so Electron is stubbed
 * down to the two members the module touches while loading.
 */
vi.mock('electron', () => ({
  ipcMain: { on: vi.fn(), removeListener: vi.fn() },
  dialog: { showMessageBox: vi.fn() },
  BrowserWindow: class {}
}))

const { decideUnload } = await import('@main/closeGuard')

/**
 * `BrowserWindow`'s `close` event covers the title-bar button, Alt+F4,
 * Window → Close and File → Exit. It does not fire for the paths that tear down
 * the renderer instead of the window — View → Reload (Ctrl+R, live even with
 * the menu bar hidden) and a script calling `window.close()`. Measured against
 * a running build: main sees `destroyed`, then `closed`, and never a `close` it
 * could cancel, so Ctrl+R on a dirty project discarded every unsaved edit in
 * silence.
 *
 * The renderer now cancels `beforeunload` while dirty, which surfaces in main
 * as `will-prevent-unload`. That event's contract is inverted — `preventDefault()`
 * there means "unload anyway" — so the branch that protects the user is the one
 * that does nothing, and a tidy-up that made the handler "consistent" with every
 * other Electron event would put the data loss straight back.
 *
 * These assertions are written in terms of the user-visible consequence rather
 * than the flag, so they still read correctly if the implementation moves.
 */
describe('decideUnload', () => {
  it('refuses an unload the user has not been asked about', () => {
    const outcome = decideUnload(false)

    // Ctrl+R, or a scripted window.close(), on a project with unsaved work.
    expect(outcome.allowUnload).toBe(false)
    expect(outcome.explain).toBe(true)
  })

  it('allows the unload that a guarded close already asked about', () => {
    const outcome = decideUnload(true)

    // The window is closing after Save or Don't Save; asking again would trap
    // the user in a window that cannot be closed.
    expect(outcome.allowUnload).toBe(true)
    expect(outcome.explain).toBe(false)
  })

  it('never both allows the unload and claims to have explained it', () => {
    for (const forced of [true, false]) {
      const outcome = decideUnload(forced)
      expect(outcome.allowUnload && outcome.explain).toBe(false)
    }
  })
})
