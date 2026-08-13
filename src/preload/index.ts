/**
 * Preload script — the sole channel between the renderer and the main process.
 *
 * It runs before the renderer's page loads, in a context isolated from both the
 * page and from Node. Because the window is created with `contextIsolation: true`
 * and `sandbox: true`, this file is the only place a renderer-facing API can be
 * created, and it can only be created explicitly.
 *
 * Each exposed API is a plain function that forwards to `ipcRenderer.invoke`.
 * `ipcRenderer` itself is never handed to the page: exposing it would give any
 * script running in the renderer the ability to reach every channel, which is
 * exactly the isolation this file exists to preserve.
 */

import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC_LOAD_DEFAULT_PROJECT,
  IPC_OPEN_PROJECT,
  PROJECT_API_NAMESPACE
} from '@shared/constants'
import type { LoadProjectResult, OpenProjectResult, ProjectApi } from '@shared/types'

// Typed as `ProjectApi` so this bridge and the renderer that consumes it are
// checked against the one definition in `@shared/types`.
const projectApi: ProjectApi = {
  loadDefault: () => ipcRenderer.invoke(IPC_LOAD_DEFAULT_PROJECT) as Promise<LoadProjectResult>,
  open: () => ipcRenderer.invoke(IPC_OPEN_PROJECT) as Promise<OpenProjectResult>
}

contextBridge.exposeInMainWorld(PROJECT_API_NAMESPACE, projectApi)
