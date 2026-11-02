/**
 * How a component reaches the workspace.
 *
 * Its own module rather than an export from `WorkspaceProvider`, for the same
 * reason `canvasInteraction` is separate from `CanvasView`: a file that exports
 * both a component and other values falls outside React Refresh's remit, and
 * every edit to it would reload the whole tree instead of hot-swapping the
 * component. Keeping the context and its hooks here leaves the provider a file
 * that exports exactly one component.
 */

import { createContext, use } from 'react'
import type { NodeKind } from '@shared/model/node'
import type { WorkStatus } from '@shared/model/workStatus'
import type { NodeId } from '@shared/model/project'
import type { NodeInput, NodePatch } from '@shared/model/projectMutations'
import type { ProjectProjection } from '@shared/model/projectProjection'
import type { WorkspaceState } from '@renderer/state/workspace'

/** What every editing surface calls. One name per user-visible action. */
export interface WorkspaceCommands {
  /** Adds a child and returns its id, so the caller can select it. */
  addChild: (parentId: NodeId | null, input: NodeInput) => NodeId | null
  /** Adds many in one transaction, returning their ids in order. */
  addChildren: (parentId: NodeId | null, inputs: readonly NodeInput[]) => NodeId[]
  rename: (nodeId: NodeId, title: string) => void
  updateDetails: (nodeId: NodeId, patch: NodePatch) => void
  changeType: (nodeId: NodeId, kind: NodeKind) => void
  setStatus: (nodeId: NodeId, status: WorkStatus) => void
  move: (nodeId: NodeId, newParentId: NodeId | null, index?: number) => void
  /** Declares a branch finished on `finishedAt` (`YYYY-MM-DD`), or reopens it with `null`. */
  setFinished: (nodeId: NodeId, finishedAt: string | null) => void

  /**
   * Writes the project. Resolves to `true` when the work is safely on disk —
   * saved, or nothing needed saving — and `false` when it was refused or failed.
   *
   * The boolean exists because callers act on it: the unsaved-changes guard must
   * only go on to discard the project once the save actually landed.
   */
  save: () => Promise<boolean>
  /** Re-reads the file, discarding everything in memory. For conflict recovery. */
  reload: () => Promise<void>
  openAnotherProject: () => Promise<void>
  dismissError: () => void
  dismissConflict: () => void
}

export interface WorkspaceContextValue {
  state: WorkspaceState
  /**
   * The Explorer tree, the index and the progress counts, rebuilt once per
   * revision. Present for a read-only project too, so components below cannot
   * tell the two apart.
   */
  projection: ProjectProjection | null
  isDirty: boolean
  canSave: boolean
  isEditable: boolean
  /**
   * Nodes created since this project was opened — the graph's "new" marks.
   *
   * Session-scoped on purpose. The knowledge base records no creation dates,
   * and "new since you last looked" needs somewhere to remember when that was
   * (handoff 003, decision 4). Until that is decided, the honest claim the
   * application can make is "added this session", and it makes it without
   * writing anything to the file.
   */
  createdThisSession: ReadonlySet<NodeId>
  commands: WorkspaceCommands
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function useWorkspace(): WorkspaceContextValue {
  const value = use(WorkspaceContext)
  if (value === null) throw new Error('useWorkspace must be used inside a WorkspaceProvider')
  return value
}

/** Convenience for the many components that only need to issue commands. */
export function useCommands(): WorkspaceCommands {
  return useWorkspace().commands
}
