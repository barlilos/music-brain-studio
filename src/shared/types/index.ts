/**
 * Type definitions shared by the main, preload and renderer contexts.
 *
 * Everything here must be isomorphic — no Node types, no DOM types. This is the
 * one folder all three build targets are allowed to import from, so anything
 * context-specific placed here would break one of them.
 */

/** Pixel dimensions of an application window. */
export interface WindowSize {
  width: number
  height: number
}

/** Any value `JSON.parse` can produce. */
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

/**
 * The content of an opened project.
 *
 * Today a project file is arbitrary JSON, so this is `JsonValue`. It will become
 * a strongly typed Music Brain node tree, and this alias is the single place that
 * change happens: the IPC contract below, the preload bridge and the main process
 * handler are all written in terms of `ProjectDocument` and never mention
 * `JsonValue`, so none of them has to change.
 *
 * The same discipline applies in the renderer — only `TreeView` may narrow a
 * `ProjectDocument` to a concrete shape. Everything else treats it as opaque.
 *
 * When the model does become typed, `JSON.parse` will no longer be enough to
 * prove a file matches it, and the main process will need real schema
 * validation. That has a place to report through already: the `invalid` arm of
 * `OpenProjectResult`. So that addition does not change the contract's shape
 * either.
 */
export type ProjectDocument = JsonValue

/** A project the user has opened. */
export interface Project {
  /**
   * An opaque handle to the file, minted by the main process when it opened it.
   *
   * This replaced an absolute `filePath` in milestone 005, and the change is the
   * reason the renderer cannot cause an arbitrary write. Saving names a token,
   * the main process looks up the path it recorded, and there is no channel that
   * accepts a path at all. A token the main process does not know is rejected.
   *
   * It is also the identity the UI keys on when a different project is opened.
   */
  token: string
  /** Basename of the file, for display. The rest of the path never leaves main. */
  fileName: string
  /** The parsed content. Opaque outside the codec — see `ProjectDocument`. */
  document: ProjectDocument
  /**
   * SHA-256 of the bytes that were read. The renderer holds it, hands it back
   * with a save, and never interprets it — it is the token's companion for
   * answering "is what I loaded still what is on disk".
   */
  diskRevision: string
}

/**
 * The outcome of reading one particular file. No user interaction is involved,
 * so there is no way for this to be dismissed.
 *
 * Every outcome, including failure, is a return value rather than a rejected
 * promise. A file that is missing or malformed is an expected result of reading
 * from disk, not an exception — and a thrown error would reach the renderer
 * wrapped in Electron's own `Error invoking remote method` text, losing the
 * real message.
 */
export type LoadProjectResult =
  | { status: 'opened'; project: Project }
  /** The file was read, but its content is not valid JSON. */
  | { status: 'invalid'; fileName: string; message: string }
  /** The file could not be read at all — missing, locked, no permission. */
  | { status: 'failed'; message: string }

/**
 * The outcome of an open request: everything reading a file can produce, plus
 * the one outcome only a prompt can — the user closing it.
 */
export type OpenProjectResult =
  | LoadProjectResult
  /** The user dismissed the file picker. Not an error; nothing should change. */
  | { status: 'canceled' }

/**
 * What the renderer sends to save.
 *
 * There is deliberately no path here, and no way to supply one.
 *
 * `expectedRevision` is the whole of the stale-overwrite protection: it is the
 * hash of the bytes this renderer loaded, and the main process refuses to write
 * unless the file on disk still hashes to it. A file changed by another program
 * — or by a second window — is never silently replaced.
 */
export interface SaveProjectRequest {
  projectToken: string
  expectedRevision: string
  /**
   * The model revision this document was serialized from. Returned unchanged in
   * the result so the renderer can mark *that* revision saved rather than
   * whatever it has reached since — edits made while the write was in flight
   * must correctly leave the project dirty.
   */
  modelRevision: number
  document: ProjectDocument
}

export type SaveProjectResult =
  | { status: 'saved'; diskRevision: string; modelRevision: number }
  /**
   * The file changed on disk after it was loaded. Nothing was written. The user
   * is offered Reload or Cancel; this milestone does not merge.
   */
  | { status: 'conflict' }
  /** The token is not one this process opened. Should be unreachable. */
  | { status: 'unknownProject' }
  /** The write itself failed, after exhausting any worthwhile retries. */
  | { status: 'failed'; message: string }

/** The outcome of the renderer saving on the main process's behalf, while closing. */
export type RequestedSaveOutcome = 'saved' | 'failed' | 'nothingToSave'

/**
 * The API the preload script exposes to the renderer. Declared here so that the
 * bridge and its consumer are checked against one definition rather than two.
 */
export interface ProjectApi {
  /**
   * Reads the project the application opens with. Takes no path: which file
   * that is, and where it lives in a packaged build, is the main process's
   * business, and keeping it there means the renderer still cannot name a file
   * for `readFile` to open.
   */
  loadDefault: () => Promise<LoadProjectResult>
  /** Prompts for a project file, then reads and parses it. */
  open: () => Promise<OpenProjectResult>
  /** Writes an open project back over the file it came from. */
  save: (request: SaveProjectRequest) => Promise<SaveProjectResult>
  /** Re-reads an open project from disk, discarding whatever was in memory. */
  reload: (projectToken: string) => Promise<LoadProjectResult>
  /**
   * Tells the main process whether there is unsaved work, so that closing the
   * window can offer to save it. Fire-and-forget.
   */
  setDirty: (isDirty: boolean) => void
  /**
   * Registers the handler the main process calls when the user chooses "Save"
   * in the close prompt. Returns an unsubscribe function.
   */
  onSaveRequested: (handler: () => Promise<RequestedSaveOutcome>) => () => void
}
