import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'
import { APP_NAME, DEFAULT_WINDOW_SIZE, MIN_WINDOW_SIZE } from '@shared/constants'
import { registerProjectIpc } from '@main/ipc/project'

/**
 * Injected by electron-vite while the dev server is running. Absent in a
 * packaged build, which is what distinguishes dev from production here.
 */
const RENDERER_DEV_URL = process.env['ELECTRON_RENDERER_URL']

function createMainWindow(): void {
  const window = new BrowserWindow({
    title: APP_NAME,
    width: DEFAULT_WINDOW_SIZE.width,
    height: DEFAULT_WINDOW_SIZE.height,
    minWidth: MIN_WINDOW_SIZE.width,
    minHeight: MIN_WINDOW_SIZE.height,
    // Stay hidden until the renderer has painted, to avoid a white flash.
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // The renderer gets no direct access to Node or Electron internals.
      // All three of these are required together; relaxing any one of them
      // undoes the isolation the preload bridge exists to provide.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      /*
       * Chromium suspends the rendering lifecycle for a window it considers
       * occluded or backgrounded, and `ResizeObserver` callbacks are delivered
       * as part of that lifecycle. The canvas measures its cards through one, so
       * a window that is behind another when a canvas is rebuilt can end up with
       * cards that are laid out and painted but never measured — which leaves
       * React Flow with no handle bounds and therefore no edges, and no bounds
       * for `fitView`, so the viewport freezes. It does not recover, because
       * nothing will ever deliver the observation that was skipped.
       *
       * This is a knowledge base its owner leaves open beside a DAW and a
       * browser, so "the window was not on top for a moment" is the normal case
       * rather than an edge case.
       */
      backgroundThrottling: false
    }
  })

  window.once('ready-to-show', () => {
    window.show()
  })

  if (RENDERER_DEV_URL) {
    void window.loadURL(RENDERER_DEV_URL)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

void app.whenReady().then(() => {
  // Registered before the first window exists, so no renderer can invoke a
  // channel that has not been handled yet.
  registerProjectIpc()

  createMainWindow()

  // macOS keeps the app alive with no windows; re-create one when re-activated.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

// On Windows and Linux, closing every window quits the app. macOS does not.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
