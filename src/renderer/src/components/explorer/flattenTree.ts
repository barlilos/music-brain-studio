/**
 * Turns a node tree into the flat list of rows currently visible on screen.
 *
 * This replaces milestone 002's recursive rendering, and it is the most
 * consequential change in this milestone. Recursion with per-node `useState`
 * worked, but it could not be virtualized, could not be filtered, could not
 * support "expand all" or "reveal this node", and scattered expansion state
 * across the component tree where nothing could read it.
 *
 * With the walk pulled out into a pure function, each of those becomes a
 * contained change:
 *
 * - **Search and filtering** enter here, as an extra argument that decides which
 *   nodes are emitted. Nothing downstream has to know.
 * - **Virtualization** consumes the array this returns. Rows are a uniform
 *   height, so it is fixed-size windowing rather than the variable-size kind.
 * - **Reveal a node** is expanding every ancestor prefix of its JSON Pointer.
 *
 * Deliberately free of React, so it can be reasoned about and tested on its own.
 */

import type { ExplorerNode } from '@shared/model/node'

/** One rendered line: a node plus everything the row needs that is positional. */
export interface ExplorerRowModel {
  node: ExplorerNode
  /** Nesting depth, zero at the top level. Becomes indentation. */
  depth: number
  /** Whether this node has anything inside it, so it gets a twisty. */
  hasChildren: boolean
  /** Whether its children are currently shown. Always false for leaves. */
  isExpanded: boolean
}

/**
 * Walks the tree, emitting a row for every node whose ancestors are all
 * expanded — and skipping the subtree beneath anything collapsed.
 *
 * The cost is proportional to the number of **visible** rows, not to the size of
 * the document: a collapsed node costs one row no matter how much is under it.
 * That is what lets a large file open cheaply, and it is the reason
 * virtualization is not needed yet.
 *
 * @param roots Top-level nodes.
 * @param expanded IDs of expanded nodes, as JSON Pointers.
 */
export function flattenTree(
  roots: readonly ExplorerNode[],
  expanded: ReadonlySet<string>
): ExplorerRowModel[] {
  const rows: ExplorerRowModel[] = []

  function visit(node: ExplorerNode, depth: number): void {
    const hasChildren = node.children.length > 0
    const isExpanded = hasChildren && expanded.has(node.id)

    rows.push({ node, depth, hasChildren, isExpanded })

    if (isExpanded) {
      for (const child of node.children) visit(child, depth + 1)
    }
  }

  for (const root of roots) visit(root, 0)

  return rows
}
