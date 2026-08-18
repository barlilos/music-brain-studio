import { basename, join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { app, dialog, ipcMain } from 'electron'
import {
  DEFAULT_PROJECT_PATH,
  DEV_PROJECT_FILE_ENV,
  IPC_LOAD_DEFAULT_PROJECT,
  IPC_OPEN_PROJECT
} from '@shared/constants'
import type { LoadProjectResult, OpenProjectResult, ProjectDocument } from '@shared/types'

/**
 * Project-related IPC.
 *
 * The renderer cannot open a native dialog or touch the filesystem, so both
 * happen here. Note that neither channel takes a path — the renderer cannot ask
 * this process to read a file of its choosing. The only two files reachable are
 * the one the user picks in the dialog and the fixed default below, which leaves
 * no room for a renderer-supplied path to reach `readFile`.
 */

/** Turns an unknown thrown value into something displayable. */
function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Absolute location of the default project.
 *
 * The two builds keep their files in different places, and neither is knowable
 * from the renderer:
 *
 * - **Development** — `app.getAppPath()` is the repository root, so the path
 *   resolves to the working copy and edits to the file show up on restart.
 * - **Packaged** — the app is inside an asar archive that `data/` is not part
 *   of, so it ships alongside via electron-builder's `extraResources` and is
 *   found under `process.resourcesPath`.
 *
 * In development one override is honoured: `DEV_PROJECT_FILE_ENV`, set by
 * `pnpm dev:isolated` to a disposable copy. It is deliberately gated on
 * `!app.isPackaged`, so no environment variable can redirect a shipped
 * application, and it comes from the launcher rather than from anything the
 * renderer can reach.
 */
function defaultProjectPath(): string {
  if (!app.isPackaged) {
    const override = process.env[DEV_PROJECT_FILE_ENV]
    if (override !== undefined && override.length > 0) {
      // Logged so a development session always says which file it is about to
      // edit. The path stays in this process; the renderer is never told it.
      console.log(`[project] Default project: ISOLATED COPY — ${override}`)
      return override
    }
  }

  const root = app.isPackaged ? process.resourcesPath : app.getAppPath()
  const real = join(root, DEFAULT_PROJECT_PATH)
  if (!app.isPackaged) console.log(`[project] Default project: REAL — ${real}`)
  return real
}

/**
 * Reads and parses one file. Shared by both channels so that a project loads
 * identically however it was chosen, and so failure is described the same way.
 */
async function readProject(filePath: string): Promise<LoadProjectResult> {
  const fileName = basename(filePath)

  let contents: string
  try {
    contents = await readFile(filePath, 'utf-8')
  } catch (error) {
    return { status: 'failed', message: `Could not read ${fileName}: ${describeError(error)}` }
  }

  let document: ProjectDocument
  try {
    document = JSON.parse(contents) as ProjectDocument
  } catch (error) {
    return { status: 'invalid', fileName, message: describeError(error) }
  }

  return { status: 'opened', project: { filePath, fileName, document } }
}

function loadDefaultProject(): Promise<LoadProjectResult> {
  return readProject(defaultProjectPath())
}

async function openProject(): Promise<OpenProjectResult> {
  const selection = await dialog.showOpenDialog({
    title: 'Open Project',
    properties: ['openFile'],
    filters: [
      { name: 'Project files', extensions: ['json'] },
      { name: 'All files', extensions: ['*'] }
    ]
  })

  const filePath = selection.filePaths[0]

  // `canceled` and an empty selection mean the same thing, but both are checked:
  // the first is the documented signal, the second is what actually narrows
  // `filePath` from `string | undefined` for the code below.
  if (selection.canceled || filePath === undefined) {
    return { status: 'canceled' }
  }

  return readProject(filePath)
}

/** Registers the project handlers. Call once, before the first window opens. */
export function registerProjectIpc(): void {
  ipcMain.handle(IPC_LOAD_DEFAULT_PROJECT, loadDefaultProject)
  ipcMain.handle(IPC_OPEN_PROJECT, openProject)
}
