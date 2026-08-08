import { basename } from 'node:path'
import { readFile } from 'node:fs/promises'
import { dialog, ipcMain } from 'electron'
import { IPC_OPEN_PROJECT } from '@shared/constants'
import type { OpenProjectResult, ProjectDocument } from '@shared/types'

/**
 * Project-related IPC.
 *
 * The renderer cannot open a native dialog or touch the filesystem, so both
 * happen here. Note that the renderer does not pass a path — it cannot ask this
 * process to read a file of its choosing. The only input is what the user picks
 * in the dialog, which leaves no room for a renderer-supplied path to reach
 * `readFile`.
 */

/** Turns an unknown thrown value into something displayable. */
function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
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

/** Registers the project handlers. Call once, before the first window opens. */
export function registerProjectIpc(): void {
  ipcMain.handle(IPC_OPEN_PROJECT, openProject)
}
