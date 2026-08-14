/**
 * A lookup over an adapted project: node by identity, and parent by identity.
 *
 * Three features need to ask questions about a node that the tree shape alone
 * cannot answer cheaply — which canvas a selection opens, which ancestors to
 * expand when revealing a node, and where a node's siblings are. All three would
 * otherwise walk the whole model, and all three would be written separately.
 *
 * Built once per project and memoized on the adapted roots. Building is O(total
 * nodes) and is the **only** whole-project pass in the canvas pipeline; every
 * query after it is O(1), which is what lets rendering stay proportional to one
 * node's fan-out rather than to the size of the knowledge base.
 *
 * Isomorphic on purpose — no React, no DOM, no Node. The main process will want
 * the same index when search indexing arrives.
 */

import type { ExplorerNode } from '@shared/model/node'

export interface NodeIndex {
  /** Every node in the project, by `ExplorerNode.id`. */
  byId: ReadonlyMap<string, ExplorerNode>
  /**
   * Each node's parent, by identity. `null` for a top-level node — it has no
   * parent node, though the project itself stands in that position on a canvas.
   */
  parentIdOf: ReadonlyMap<string, string | null>
  /** The top-level nodes, in model order. */
  roots: readonly ExplorerNode[]
}

/**
 * Walks the model once and records identity and parentage.
 *
 * Note that parentage is derived by walking rather than by taking an id apart.
 * `ExplorerNode.id` happens to be a JSON Pointer today, so truncating one would
 * work and would be shorter — and it would silently stop working the moment
 * identity stops being positional. The contract says IDs are opaque; this module
 * keeps to it.
 */
export function indexNodes(roots: readonly ExplorerNode[]): NodeIndex {
  const byId = new Map<string, ExplorerNode>()
  const parentIdOf = new Map<string, string | null>()

  function visit(node: ExplorerNode, parentId: string | null): void {
    byId.set(node.id, node)
    parentIdOf.set(node.id, parentId)
    for (const child of node.children) visit(child, node.id)
  }

  for (const root of roots) visit(root, null)

  return { byId, parentIdOf, roots }
}

/**
 * A node's ancestors, outermost first. Empty for a top-level node, and empty for
 * an id the index does not know.
 *
 * Outermost first because the caller is usually expanding a path, and expanding
 * from the top reads the way the tree does.
 *
 * The visited set guards against a cycle. The adapter builds a tree so there can
 * be none today, but this function is total by construction rather than by
 * assumption — an infinite loop here would freeze the window.
 */
export function ancestorIdsOf(index: NodeIndex, nodeId: string): string[] {
  const ancestors: string[] = []
  const visited = new Set<string>([nodeId])

  let current = index.parentIdOf.get(nodeId) ?? null
  while (current !== null && !visited.has(current)) {
    ancestors.unshift(current)
    visited.add(current)
    current = index.parentIdOf.get(current) ?? null
  }

  return ancestors
}
