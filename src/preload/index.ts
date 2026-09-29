/**
 * Preload script — the sole channel between the renderer and the main process.
 *
 * It runs before the renderer's page loads, in a context isolated from both the
 * page and from Node. Because the window is created with `contextIsolation: true`
 * and `sandbox: true`, this file is the only place a renderer-facing API can be
 * created, and it can only be created explicitly.
 *
 * Each exposed API is a plain function that forwards to `ipcRenderer`.
 * `ipcRenderer` itself is never handed to the page: exposing it would give any
 * script running in the renderer the ability to reach every channel, which is
 * exactly the isolation this file exists to preserve.
 *
 * Note what `save` does *not* take. Milestone 005 added writing, and the bridge
 * is where a careless design would have grown a `filePath` parameter. It takes an
 * opaque token the main process issued instead, so the surface reachable from a
 * compromised renderer is "files this application already opened" rather than
 * "the filesystem".
 */

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  IPC_LOAD_DEFAULT_PROJECT,
  IPC_OPEN_PROJECT,
  IPC_RELOAD_PROJECT,
  IPC_REQUEST_SAVE,
  IPC_SAVE_PROJECT,
  IPC_SAVE_REQUEST_RESULT,
  IPC_SET_DIRTY,
  PROJECT_API_NAMESPACE
} from '@shared/constants'
import type {
  LoadProjectResult,
  OpenProjectResult,
  ProjectApi,
  RequestedSaveOutcome,
  SaveProjectRequest,
  SaveProjectResult
} from '@shared/types'

// Typed as `ProjectApi` so this bridge and the renderer that consumes it are
// checked against the one definition in `@shared/types`.
const projectApi: ProjectApi = {
  loadDefault: () => ipcRenderer.invoke(IPC_LOAD_DEFAULT_PROJECT) as Promise<LoadProjectResult>,

  open: () => ipcRenderer.invoke(IPC_OPEN_PROJECT) as Promise<OpenProjectResult>,

  save: (request: SaveProjectRequest) =>
    ipcRenderer.invoke(IPC_SAVE_PROJECT, request) as Promise<SaveProjectResult>,

  reload: (projectToken: string) =>
    ipcRenderer.invoke(IPC_RELOAD_PROJECT, projectToken) as Promise<LoadProjectResult>,

  setDirty: (isDirty: boolean) => {
    ipcRenderer.send(IPC_SET_DIRTY, isDirty)
  },

  onSaveRequested: (handler: () => Promise<RequestedSaveOutcome>) => {
    // The listener is wrapped rather than passed through, so the renderer never
    // receives an `IpcRendererEvent` — handing it one would leak `sender`, and
    // through it the whole IPC surface this file exists to narrow.
    const listener = (_event: IpcRendererEvent, requestId: string): void => {
      void handler().then((outcome) => {
        ipcRenderer.send(IPC_SAVE_REQUEST_RESULT, requestId, outcome)
      })
    }

    ipcRenderer.on(IPC_REQUEST_SAVE, listener)
    return () => {
      ipcRenderer.removeListener(IPC_REQUEST_SAVE, listener)
    }
  }
}

contextBridge.exposeInMainWorld(PROJECT_API_NAMESPACE, projectApi)
