/**
 * Everything the application knows about the open project, as one reducer.
 *
 * Two things live here that used to be scattered or absent: the editable model,
 * and whether it matches what is on disk. Keeping them in one reducer is what
 * makes "is there unsaved work" a comparison of two numbers rather than a
 * question anybody has to ask the filesystem.
 *
 * **Pure.** No IPC, no effects, no React. Every command is applied by calling the
 * shared mutation layer, so this file adds no rules of its own about what an edit
 * may do — it only decides what to do with the result. That is deliberate: the
 * rules are tested without a renderer, and this is tested without a filesystem.
 *
 * Ids for new nodes arrive **in the action**, minted by the provider. A reducer
 * must be pure, so it cannot call `crypto.randomUUID()`; and the caller needs to
 * know what was created in order to select it. Both are solved by generating the
 * ids one layer up and passing them down.
 */

import type { ExplorerProject, NodeKind } from '@shared/model/node'
import { toExplorerProject } from '@shared/model/adapter'
import type { WorkStatus } from '@shared/model/workStatus'
import type { NodeId, ProjectState } from '@shared/model/project'
import {
  changeNodeType,
  createNodes,
  moveNode,
  setNodeStatus,
  updateNode,
  type MutationResult,
  type NodeInput,
  type NodePatch
} from '@shared/model/projectMutations'
import { importProject, type PreservationRecord } from '@shared/persistence/projectCodec'
import type { Project } from '@shared/types'

/** The file behind the project. A token and a hash — never a path. */
export interface ProjectSource {
  token: string
  fileName: string
  /** SHA-256 of the bytes on disk as of the last successful read or write. */
  diskRevision: string
}

/** A project that can be edited and saved. */
export interface EditableContent {
  mode: 'editable'
  state: ProjectState
  preservation: PreservationRecord
  /**
   * The model revision last written to disk successfully.
   *
   * Dirty is `state.revision !== savedRevision`. Set to the revision that was
   * *serialized* rather than the current one, so edits made while a save was in
   * flight correctly leave the project dirty.
   */
  savedRevision: number
}

/**
 * A project that can be looked at but not changed.
 *
 * Reached by a file without stable unique ids or without the Music Brain node
 * hierarchy — `examples/sample-project.json` is the real case. Decision R3: it
 * stays viewable and every editing affordance is hidden, rather than being
 * silently converted into a shape it was never written in.
 */
export interface ReadOnlyContent {
  mode: 'readOnly'
  /** Explains, in the user's terms, why this file cannot be edited. */
  reason: string
  project: ExplorerProject
}

export type WorkspaceContent = EditableContent | ReadOnlyContent

export interface WorkspaceState {
  /** True until the first load settles, so the empty state does not flash. */
  isLoading: boolean
  source: ProjectSource | null
  content: WorkspaceContent | null
  /** A problem to show the user. Dismissible; never blocks editing. */
  error: string | null
  /**
   * The file changed on disk, so the last save was refused. Blocks further
   * saving until the user reloads or dismisses it — this milestone does not
   * merge, so there is nothing else to offer.
   */
  hasConflict: boolean
  isSaving: boolean
}

export const initialWorkspace: WorkspaceState = {
  isLoading: true,
  source: null,
  content: null,
  error: null,
  hasConflict: false,
  isSaving: false
}

export type WorkspaceAction =
  | { type: 'opened'; project: Project }
  | { type: 'openFailed'; message: string }
  | { type: 'createNodes'; parentId: NodeId | null; inputs: readonly NodeInput[]; ids: NodeId[] }
  | { type: 'updateNode'; nodeId: NodeId; patch: NodePatch }
  | { type: 'changeNodeType'; nodeId: NodeId; kind: NodeKind }
  | { type: 'setNodeStatus'; nodeId: NodeId; status: WorkStatus }
  | { type: 'moveNode'; nodeId: NodeId; newParentId: NodeId | null; index?: number }
  | { type: 'saveStarted' }
  | { type: 'saved'; diskRevision: string; modelRevision: number }
  | { type: 'saveConflicted' }
  | { type: 'saveFailed'; message: string }
  | { type: 'dismissError' }
  | { type: 'dismissConflict' }

/** Whether the project holds edits that are not on disk. */
export function isDirty(state: WorkspaceState): boolean {
  const content = state.content
  return content?.mode === 'editable' && content.state.revision !== content.savedRevision
}

/** The editable model, or `null` when the open file is read-only or absent. */
export function editableContentOf(state: WorkspaceState): EditableContent | null {
  return state.content?.mode === 'editable' ? state.content : null
}

/** Whether saving is currently possible, and therefore whether to offer it. */
export function canSave(state: WorkspaceState): boolean {
  return isDirty(state) && !state.isSaving && !state.hasConflict
}

/**
 * Applies the outcome of a mutation.
 *
 * A rejected command surfaces its message and changes nothing else — the model
 * is untouched, so the UI simply carries on showing what it already showed.
 */
function applyMutation(
  state: WorkspaceState,
  run: (content: EditableContent) => MutationResult
): WorkspaceState {
  const content = editableContentOf(state)
  // Commands are not offered on a read-only project; reaching here would be a
  // bug, and ignoring it is better than corrupting something.
  if (content === null) return state

  const result = run(content)
  if (!result.ok) return { ...state, error: result.error.message }

  return { ...state, error: null, content: { ...content, state: result.state } }
}

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'opened': {
      const { token, fileName, document, diskRevision } = action.project
      const imported = importProject(document)

      const content: WorkspaceContent =
        imported.status === 'editable'
          ? {
              mode: 'editable',
              state: imported.state,
              preservation: imported.preservation,
              // A freshly loaded project is by definition saved.
              savedRevision: imported.state.revision
            }
          : {
              mode: 'readOnly',
              reason: imported.reason,
              // The tolerant adapter, which accepts any JSON at all — this is
              // the path for files that are not the Music Brain shape.
              project: toExplorerProject(document)
            }

      return {
        isLoading: false,
        source: { token, fileName, diskRevision },
        content,
        error: null,
        hasConflict: false,
        isSaving: false
      }
    }

    case 'openFailed':
      return { ...initialWorkspace, isLoading: false, error: action.message }

    case 'createNodes':
      return applyMutation(state, (content) => {
        const queue = [...action.ids]
        return createNodes(content.state, action.parentId, action.inputs, () => queue.shift() ?? '')
      })

    case 'updateNode':
      return applyMutation(state, (c) => updateNode(c.state, action.nodeId, action.patch))

    case 'changeNodeType':
      return applyMutation(state, (c) => changeNodeType(c.state, action.nodeId, action.kind))

    case 'setNodeStatus':
      return applyMutation(state, (c) => setNodeStatus(c.state, action.nodeId, action.status))

    case 'moveNode':
      return applyMutation(state, (c) =>
        moveNode(c.state, action.nodeId, action.newParentId, action.index)
      )

    case 'saveStarted':
      return { ...state, isSaving: true, error: null }

    case 'saved': {
      const content = editableContentOf(state)
      if (content === null || state.source === null) return { ...state, isSaving: false }

      return {
        ...state,
        isSaving: false,
        hasConflict: false,
        error: null,
        source: { ...state.source, diskRevision: action.diskRevision },
        // The revision that was written, not the current one: anything edited
        // while the write was in flight must stay dirty.
        content: { ...content, savedRevision: action.modelRevision }
      }
    }

    case 'saveConflicted':
      return { ...state, isSaving: false, hasConflict: true }

    case 'saveFailed':
      // Neither revision moves, so the project stays dirty and nothing is lost.
      return { ...state, isSaving: false, error: action.message }

    case 'dismissError':
      return { ...state, error: null }

    case 'dismissConflict':
      return { ...state, hasConflict: false }
  }
}
