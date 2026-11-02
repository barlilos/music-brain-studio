/**
 * Where the user is in the Living Progress Graph, and how they move.
 *
 * R1's interaction is **explicit levels**, never continuous zoom. A place is
 * two things:
 *
 * - `focusId` — the node at the hub, with its children on a ring around it.
 *   `null` is the brain map: the project itself, with its top-level domains.
 * - `unfoldedKey` — one of those children, opened in place into a working
 *   panel beside the hub. Its siblings stay on screen as bubbles, so focusing
 *   never destroys the surrounding context.
 *
 * Selection (which task the Inspector shows) is deliberately not part of this:
 * it is the editing context's `inspecting`, so the context menu, the Explorer
 * drawer and the graph all open the same Inspector through one value.
 *
 * Pure and total — every function accepts ids that no longer exist, because a
 * place is remembered across edits that can move or remove the nodes it names.
 */

import type { NodeIndex } from '@shared/model/nodeIndex'
import { isWorkItem } from '@renderer/components/graph/graphLayout'

export interface GraphPlace {
  focusId: string | null
  /** A child node id of the focus, or `looseKey(focusId)` for its direct tasks. */
  unfoldedKey: string | null
  /**
   * The node the user just came from, so it can be marked on the way back up.
   * Purely a cue; nothing depends on it.
   */
  recentId: string | null
}

export const START_PLACE: GraphPlace = { focusId: null, unfoldedKey: null, recentId: null }

const LOOSE_PREFIX = 'loose:'

/**
 * The ring key for the tasks that sit directly in a focused node. Not a node id
 * — it cannot collide with one, because no node id starts with this prefix and
 * nothing ever parses it back except `isLooseKey`.
 */
export function looseKey(focusId: string | null): string {
  return `${LOOSE_PREFIX}${focusId ?? ''}`
}

export function isLooseKey(key: string): boolean {
  return key.startsWith(LOOSE_PREFIX)
}

/** The node an unfolded key stands for, or `null` for a loose pod. */
export function nodeIdOfKey(key: string | null): string | null {
  return key === null || isLooseKey(key) ? null : key
}

/** Re-roots on a node — Open as map. The previous focus becomes the recent cue. */
export function focusOn(place: GraphPlace, nodeId: string | null): GraphPlace {
  return { focusId: nodeId, unfoldedKey: null, recentId: place.focusId }
}

export function unfold(place: GraphPlace, key: string): GraphPlace {
  return { ...place, unfoldedKey: key }
}

export function fold(place: GraphPlace): GraphPlace {
  return { ...place, unfoldedKey: null, recentId: nodeIdOfKey(place.unfoldedKey) ?? place.recentId }
}

/**
 * One step out: fold the open panel if there is one, otherwise go up a level
 * and mark the branch we left, so the user can see where they were.
 */
export function up(place: GraphPlace, index: NodeIndex): GraphPlace {
  if (place.unfoldedKey !== null) return fold(place)
  if (place.focusId === null) return place
  return {
    focusId: index.parentIdOf.get(place.focusId) ?? null,
    unfoldedKey: null,
    recentId: place.focusId
  }
}

/**
 * The place that shows a node, and what to select once there.
 *
 * - A piece of work opens its parent's panel, one level up, and is selected —
 *   the Inspector opens on it and its row is highlighted.
 * - A branch opens its own panel, beside its parent at the hub.
 */
export function revealPlace(
  index: NodeIndex,
  nodeId: string
): { place: GraphPlace; select: string | null } {
  const node = index.byId.get(nodeId)
  if (node === undefined) return { place: START_PLACE, select: null }

  const parentId = index.parentIdOf.get(nodeId) ?? null

  if (isWorkItem(node)) {
    if (parentId === null) {
      return {
        place: { focusId: null, unfoldedKey: looseKey(null), recentId: null },
        select: nodeId
      }
    }
    const grandparentId = index.parentIdOf.get(parentId) ?? null
    return {
      place: { focusId: grandparentId, unfoldedKey: parentId, recentId: null },
      select: nodeId
    }
  }

  return { place: { focusId: parentId, unfoldedKey: nodeId, recentId: null }, select: null }
}

/**
 * Repairs a place after the model changed underneath it — a node was moved, or
 * a task lost its subtasks and stopped being a branch.
 *
 * Never jumps anywhere surprising: an invalid focus climbs to the nearest
 * surviving ancestor it can find, and an invalid panel simply folds.
 */
export function reconcilePlace(place: GraphPlace, index: NodeIndex): GraphPlace {
  let focusId = place.focusId
  if (focusId !== null) {
    const focus = index.byId.get(focusId)
    if (focus === undefined) focusId = null
    else if (isWorkItem(focus)) focusId = index.parentIdOf.get(focusId) ?? null
  }

  let unfoldedKey = place.unfoldedKey
  if (unfoldedKey !== null) {
    if (isLooseKey(unfoldedKey)) {
      const children = focusId === null ? index.roots : (index.byId.get(focusId)?.children ?? [])
      const valid = unfoldedKey === looseKey(focusId) && children.some(isWorkItem)
      if (!valid) unfoldedKey = null
    } else {
      const node = index.byId.get(unfoldedKey)
      const valid =
        node !== undefined &&
        !isWorkItem(node) &&
        (index.parentIdOf.get(unfoldedKey) ?? null) === focusId
      if (!valid) unfoldedKey = null
    }
  }

  if (focusId === place.focusId && unfoldedKey === place.unfoldedKey) return place
  return { ...place, focusId, unfoldedKey }
}
