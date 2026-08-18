/**
 * Every change the application can make to a project, as pure functions.
 *
 * **One mutation layer, and every editing surface goes through it.** The
 * Explorer's context menu, the Canvas card's status button, the Inspector, the
 * move picker and Bulk Add all call these six functions. No component builds a
 * node, reorders a child list, or touches JSON — which is what keeps "the
 * Explorer and the Canvas agree" a property of the architecture rather than
 * something to re-test after every feature.
 *
 * Each function takes a state and returns a new one; none of them mutates its
 * argument, performs IO, or knows that a file exists. That is what makes them
 * testable without a renderer and what will make undo a bounded stack of
 * references rather than a redesign.
 *
 * **Failure is a value.** A rejected move returns a typed error rather than
 * throwing, because these run inside event handlers where a throw would take the
 * window down, and because "you cannot file a node inside itself" is an ordinary
 * answer rather than an exceptional one.
 *
 * Isomorphic: no React, no DOM, no Node.
 */

import type { NodeKind } from '@shared/model/node'
import type { WorkStatus } from '@shared/model/workStatus'
import {
  isDescendantOf,
  type NodeId,
  type ProjectNode,
  type ProjectState
} from '@shared/model/project'

/**
 * Where a new id comes from.
 *
 * Injected rather than imported because `crypto` resolves differently in the
 * three build targets this folder compiles for, and because a test that cannot
 * predict its own ids has to search for what it just created. The runtime
 * implementation is `crypto.randomUUID()`.
 */
export type NodeIdFactory = () => NodeId

/** What is needed to create a node. Everything else has a sensible zero value. */
export interface NodeInput {
  title: string
  kind: NodeKind
  /**
   * Optional, and deliberately not defaulted to `todo` here.
   *
   * Whether a kind carries work state is vocabulary, and vocabulary lives in the
   * renderer's kind registry — nothing in `src/shared` may enumerate kinds. So
   * the caller, which has the registry, decides: `todo` for a task, nothing for
   * an area. Defaulting here would give every new container a status field its
   * file never had.
   */
  status?: WorkStatus | undefined
  tags?: readonly string[]
  notes?: string
}

/**
 * The fields `updateNode` may change.
 *
 * `kind` and `status` are absent on purpose. Each has its own command, because
 * each has a side effect on what gets persisted — changing the type clears the
 * file's own spelling of `nodeType`, and setting the status clears a preserved
 * alias. Routing them through a general-purpose patch would make it possible to
 * canonicalise a status while editing a title, which is exactly what decision R2
 * forbids. One field, one path.
 */
export interface NodePatch {
  title?: string
  tags?: readonly string[]
  notes?: string
}

export type MutationErrorCode =
  'unknownNode' | 'unknownParent' | 'emptyTitle' | 'selfParent' | 'wouldCycle' | 'idCollision'

export interface MutationError {
  code: MutationErrorCode
  /** Phrased for a person: this reaches the UI unchanged. */
  message: string
}

export type MutationResult =
  { ok: true; state: ProjectState; createdIds: NodeId[] } | { ok: false; error: MutationError }

function fail(code: MutationErrorCode, message: string): MutationResult {
  return { ok: false, error: { code, message } }
}

/** A successful outcome. `revision` advances here and nowhere else. */
function succeed(
  state: ProjectState,
  nodesById: Map<NodeId, ProjectNode>,
  rootIds: NodeId[],
  createdIds: NodeId[] = []
): MutationResult {
  return {
    ok: true,
    state: { ...state, nodesById, rootIds, revision: state.revision + 1 },
    createdIds
  }
}

/**
 * A working copy of the node table.
 *
 * A whole-map copy per command, rather than a persistent data structure. At 548
 * nodes this is microseconds and it makes every command trivially correct;
 * structural sharing can be added behind these exact signatures if a knowledge
 * base ever gets large enough to notice.
 */
function draft(state: ProjectState): Map<NodeId, ProjectNode> {
  return new Map(state.nodesById)
}

/** Replaces one node with a modified copy. Never mutates the original. */
function put(
  nodes: Map<NodeId, ProjectNode>,
  node: ProjectNode,
  patch: Partial<ProjectNode>
): void {
  nodes.set(node.id, { ...node, ...patch })
}

function normalizeTags(tags: readonly string[] | undefined): string[] | undefined {
  if (tags === undefined) return undefined
  return tags.flatMap((tag) => {
    const trimmed = tag.trim()
    return trimmed.length > 0 ? [trimmed] : []
  })
}

// -------------------------------------------------------------------- creating

/** Builds one node. Shared by the single and bulk paths so they cannot diverge. */
function buildNode(input: NodeInput, id: NodeId, parentId: NodeId | null): ProjectNode {
  return {
    id,
    title: input.title.trim(),
    kind: input.kind.trim().toLowerCase(),
    status: input.status,
    // New nodes have no persisted spelling to preserve — nothing on disk said
    // anything about them yet, so export writes the canonical value.
    persistedStatus: undefined,
    tags: normalizeTags(input.tags) ?? [],
    notes: input.notes ?? '',
    persistedKind: undefined,
    parentId,
    childIds: []
  }
}

/**
 * Adds children to a parent, or to the project root when `parentId` is `null`.
 *
 * One command for one and for many, because Bulk Add must be a single
 * transaction: fifty tasks entered together are one revision, one dirty step,
 * one canvas reframe and — when undo arrives — one undo. Running `createNode`
 * fifty times would be fifty of each.
 *
 * Validation happens for every input before anything is applied, so a bad line
 * halfway down a bulk paste leaves the project untouched rather than half added.
 */
export function createNodes(
  state: ProjectState,
  parentId: NodeId | null,
  inputs: readonly NodeInput[],
  idFactory: NodeIdFactory
): MutationResult {
  let parent: ProjectNode | null = null
  if (parentId !== null) {
    const found = state.nodesById.get(parentId)
    if (found === undefined) return fail('unknownParent', 'That parent no longer exists.')
    parent = found
  }

  for (const input of inputs) {
    if (input.title.trim().length === 0) {
      return fail('emptyTitle', 'A title is required.')
    }
  }

  const nodes = draft(state)
  const created: ProjectNode[] = []

  for (const input of inputs) {
    const id = idFactory()
    if (id.trim().length === 0 || nodes.has(id)) {
      return fail('idCollision', 'Could not allocate an identity for the new entry.')
    }
    const node = buildNode(input, id, parentId)
    nodes.set(id, node)
    created.push(node)
  }

  const createdIds = created.map((node) => node.id)

  if (parent === null) {
    return succeed(state, nodes, [...state.rootIds, ...createdIds], createdIds)
  }

  put(nodes, parent, { childIds: [...parent.childIds, ...createdIds] })
  return succeed(state, nodes, state.rootIds, createdIds)
}

/** Adds one child. A thin case of `createNodes`, so both behave identically. */
export function createNode(
  state: ProjectState,
  parentId: NodeId | null,
  input: NodeInput,
  idFactory: NodeIdFactory
): MutationResult {
  return createNodes(state, parentId, [input], idFactory)
}

// -------------------------------------------------------------------- updating

/**
 * Changes a node's title, tags or notes.
 *
 * Identity is untouched, so selection, Explorer expansion and the canvas root all
 * survive a rename with no special handling anywhere.
 */
export function updateNode(state: ProjectState, nodeId: NodeId, patch: NodePatch): MutationResult {
  const node = state.nodesById.get(nodeId)
  if (node === undefined) return fail('unknownNode', 'That entry no longer exists.')

  const title = patch.title?.trim()
  if (title !== undefined && title.length === 0) {
    return fail('emptyTitle', 'A title is required.')
  }

  const nodes = draft(state)
  put(nodes, node, {
    ...(title === undefined ? {} : { title }),
    ...(patch.notes === undefined ? {} : { notes: patch.notes }),
    ...(patch.tags === undefined ? {} : { tags: normalizeTags(patch.tags) })
  })

  return succeed(state, nodes, state.rootIds)
}

/**
 * Changes what kind of thing a node is — the cheap Task → Project evolution that
 * lets a knowledge base grow without being restructured.
 *
 * Clears `persistedKind`, so the canonical lower-cased value is written. That is
 * correct precisely because the user asked for this change; the equivalent
 * clearing for status is why status has its own command too.
 */
export function changeNodeType(
  state: ProjectState,
  nodeId: NodeId,
  kind: NodeKind
): MutationResult {
  const node = state.nodesById.get(nodeId)
  if (node === undefined) return fail('unknownNode', 'That entry no longer exists.')

  const nodes = draft(state)
  put(nodes, node, { kind: kind.trim().toLowerCase(), persistedKind: undefined })

  return succeed(state, nodes, state.rootIds)
}

/**
 * Sets a node's work state.
 *
 * **The one command that may canonicalise what is stored.** Clearing
 * `persistedStatus` is what turns a file's `active` into `in_progress` on disk,
 * and it happens only here — reached from the Canvas status button, the context
 * menu and the Inspector, all of which are the user explicitly choosing a state.
 */
export function setNodeStatus(
  state: ProjectState,
  nodeId: NodeId,
  status: WorkStatus
): MutationResult {
  const node = state.nodesById.get(nodeId)
  if (node === undefined) return fail('unknownNode', 'That entry no longer exists.')

  const nodes = draft(state)
  put(nodes, node, { status, persistedStatus: undefined })

  return succeed(state, nodes, state.rootIds)
}

// ---------------------------------------------------------------------- moving

/**
 * Re-files a node, with its whole subtree, under a new parent.
 *
 * `null` means the project root, so "move this to the top level" is the same
 * operation as any other move rather than a special case.
 *
 * Three moves are refused, and the second is the one that matters: filing a node
 * inside its own descendant would detach that subtree from the tree entirely —
 * every node in it would still exist in `nodesById`, reachable from each other
 * and from nothing else. The projection would silently stop rendering them and
 * the next save would write a file missing a branch. `isDescendantOf` walks up
 * from the target, so the check costs depth rather than subtree size.
 *
 * @param index Where among the new siblings to insert, clamped to the list.
 *   Omitted means the end. Within the same parent, the node is removed before
 *   the index is applied, so an index always refers to the resulting list.
 */
export function moveNode(
  state: ProjectState,
  nodeId: NodeId,
  newParentId: NodeId | null,
  index?: number
): MutationResult {
  const node = state.nodesById.get(nodeId)
  if (node === undefined) return fail('unknownNode', 'That entry no longer exists.')

  if (newParentId === nodeId) {
    return fail('selfParent', 'An entry cannot be filed inside itself.')
  }

  if (newParentId !== null) {
    if (!state.nodesById.has(newParentId)) {
      return fail('unknownParent', 'That destination no longer exists.')
    }
    if (isDescendantOf(state, newParentId, nodeId)) {
      return fail('wouldCycle', 'An entry cannot be filed inside something it contains.')
    }
  }

  const nodes = draft(state)
  const oldParentId = node.parentId

  // Detach. The root list is a plain array on the state; a parent's list lives
  // on the parent, so each needs its own copy.
  let rootIds = state.rootIds
  if (oldParentId === null) {
    rootIds = rootIds.filter((id) => id !== nodeId)
  } else {
    const oldParent = nodes.get(oldParentId)
    if (oldParent !== undefined) {
      put(nodes, oldParent, { childIds: oldParent.childIds.filter((id) => id !== nodeId) })
    }
  }

  // Re-attach.
  const siblings =
    newParentId === null ? [...rootIds] : [...(nodes.get(newParentId)?.childIds ?? [])]
  const at = index === undefined ? siblings.length : Math.max(0, Math.min(index, siblings.length))
  siblings.splice(at, 0, nodeId)

  if (newParentId === null) {
    rootIds = siblings
  } else {
    const newParent = nodes.get(newParentId)
    if (newParent !== undefined) put(nodes, newParent, { childIds: siblings })
  }

  put(nodes, node, { parentId: newParentId })

  return succeed(state, nodes, rootIds)
}
