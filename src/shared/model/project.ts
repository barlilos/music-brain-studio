/**
 * The canonical editable model: what a project *is* while the application is
 * running.
 *
 * Milestones 002–004 treated the parsed file as the model and derived everything
 * from it. That works for reading and cannot survive editing: `ExplorerNode` is a
 * projection, so a mutation would have to be applied to the document, the
 * projection and the index separately, and the three would drift the first time
 * one of them was missed.
 *
 * So the direction inverts. `ProjectState` is the only editable truth; JSON
 * becomes a format that `@shared/persistence/projectCodec` adapts on the way in
 * and on the way out. Nothing above this layer knows a file exists.
 *
 * **Normalized, not recursive.** A node lives in exactly one place — `nodesById`
 * — and structure is expressed by `parentId` and `childIds`. A recursive tree
 * would put a node's identity in two places at once (the map and its parent's
 * array) and make "move this subtree" a rewrite of everything above it. Here it
 * is three field writes.
 *
 * Isomorphic: no React, no DOM, no Node.
 */

import type { NodeKind } from '@shared/model/node'
import type { WorkStatus } from '@shared/model/workStatus'

/**
 * A node's identity, and the address every other concept refers to it by.
 *
 * **Opaque.** Nothing outside the codec may parse one, take it apart or derive
 * anything from its text. Existing nodes carry the semantic ids their file was
 * generated with (`quad.base.cab-optimization`); new ones get UUIDs. Both satisfy
 * the only contract that matters — unique within the project, and stable for the
 * node's whole life — and no code may tell them apart.
 *
 * In particular, parentage is never derived from an id. `quad.base.cab` looks
 * like a child of `quad.base`, and relying on that would break the moment a node
 * is moved and its id, correctly, does not change.
 */
export type NodeId = string

/** A node, as the application edits it. */
export interface ProjectNode {
  id: NodeId
  /** The user's name for it. Empty means untitled; never `undefined`. */
  title: string
  /** See `NodeKind` — a bare string, from the user's vocabulary. */
  kind: NodeKind
  /**
   * The work state this node carries, or `undefined` when it carries none.
   *
   * This is the *interpretation*: aliases have already been recognised, so a
   * node whose file says `active` reads as `in_progress` here.
   */
  status: WorkStatus | undefined
  /**
   * The exact text the file holds in `status`, or `undefined` for a node that
   * has no persisted status — a new node, or one whose status the user has
   * explicitly set.
   *
   * This is what makes reading tolerant and writing conservative at the same
   * time. Export prefers this over `status`, so opening a file and renaming
   * something cannot silently canonicalise a word the user chose. Only
   * `setNodeStatus` clears it, which is exactly the moment the user asked for a
   * specific state.
   */
  persistedStatus: string | undefined
  tags: string[]
  notes: string
  /**
   * The same idea as `persistedStatus`, for `nodeType`: a file spelling `Task`
   * keeps its capital until the user actually changes the type. `kind` is
   * lower-cased so the presentation registry has one key per kind.
   */
  persistedKind: string | undefined
  /** `null` for a top-level node. Explicit, never derived from the id. */
  parentId: NodeId | null
  /** Children in order. The order is the user's and is never sorted. */
  childIds: NodeId[]
}

/** A whole project, in memory. */
export interface ProjectState {
  /** The project's own name, from the file's root node. Not editable in M005. */
  name: string | undefined
  /** Top-level nodes, in order. */
  rootIds: NodeId[]
  nodesById: ReadonlyMap<NodeId, ProjectNode>
  /**
   * Increments on every successful mutation, and never otherwise.
   *
   * Two jobs. It is the memoization key for everything derived from this state —
   * one projection per revision rather than one per render — and it is half of
   * the dirty check: a project is dirty when its revision differs from the one
   * last written to disk. Comparing a number is what keeps "is there unsaved
   * work" free of both hashing and IO.
   */
  revision: number
}

/** A node by identity, or `undefined`. O(1). */
export function nodeOf(state: ProjectState, nodeId: NodeId): ProjectNode | undefined {
  return state.nodesById.get(nodeId)
}

/**
 * The children of a node, or the top level when `parentId` is `null`.
 *
 * `null` meaning "the project root" is the same convention `moveNode` and
 * `createNode` take, so the root is an ordinary target everywhere rather than a
 * special case each caller has to remember.
 */
export function childIdsOf(state: ProjectState, parentId: NodeId | null): readonly NodeId[] {
  if (parentId === null) return state.rootIds
  return nodeOf(state, parentId)?.childIds ?? []
}

/** Whether a node has anything inside it. */
export function hasChildren(state: ProjectState, nodeId: NodeId): boolean {
  return (nodeOf(state, nodeId)?.childIds.length ?? 0) > 0
}

/**
 * A node's ancestors, outermost first. Empty for a top-level node or an unknown
 * id.
 *
 * Walks `parentId` links rather than taking an id apart. The visited set makes
 * the function total even if a cycle ever existed: `moveNode` rejects the moves
 * that could create one, but an infinite loop here would freeze the window, and
 * a guard is cheaper than trusting every future caller.
 */
export function nodeAncestorIds(state: ProjectState, nodeId: NodeId): NodeId[] {
  const ancestors: NodeId[] = []
  const visited = new Set<NodeId>([nodeId])

  let current = nodeOf(state, nodeId)?.parentId ?? null
  while (current !== null && !visited.has(current)) {
    ancestors.unshift(current)
    visited.add(current)
    current = nodeOf(state, current)?.parentId ?? null
  }

  return ancestors
}

/**
 * Every id in a subtree, including its own root, in pre-order.
 *
 * The move picker excludes exactly this set, which is what stops a node being
 * filed inside itself.
 */
export function subtreeIds(state: ProjectState, nodeId: NodeId): NodeId[] {
  const ids: NodeId[] = []
  const seen = new Set<NodeId>()

  function visit(id: NodeId): void {
    if (seen.has(id)) return
    seen.add(id)
    ids.push(id)
    for (const childId of nodeOf(state, id)?.childIds ?? []) visit(childId)
  }

  visit(nodeId)
  return ids
}

/**
 * Whether `candidateId` lies inside `ancestorId`'s subtree. A node is not its own
 * descendant.
 *
 * Walks upwards from the candidate rather than downwards from the ancestor: a
 * move is validated against one path to the root, not against a whole subtree,
 * so the check costs depth (at most 5 in the reference file) instead of size.
 */
export function isDescendantOf(
  state: ProjectState,
  candidateId: NodeId,
  ancestorId: NodeId
): boolean {
  const visited = new Set<NodeId>([candidateId])

  let current = nodeOf(state, candidateId)?.parentId ?? null
  while (current !== null && !visited.has(current)) {
    if (current === ancestorId) return true
    visited.add(current)
    current = nodeOf(state, current)?.parentId ?? null
  }

  return false
}
