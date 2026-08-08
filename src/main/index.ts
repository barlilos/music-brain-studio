import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'
import { APP_NAME, DEFAULT_WINDOW_SIZE, MIN_WINDOW_SIZE } from '@shared/constants'

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
      sandbox: true
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
