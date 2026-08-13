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

/** A project the user has opened, and where it came from. */
export interface Project {
  /**
   * Absolute path of the file on disk. Unused by the UI at this milestone; it is
   * carried so that saving does not have to re-derive it or ask the user again.
   */
  filePath: string
  /** Basename of `filePath`, for display. */
  fileName: string
  /** The parsed content. Opaque outside of `TreeView` — see `ProjectDocument`. */
  document: ProjectDocument
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
}
