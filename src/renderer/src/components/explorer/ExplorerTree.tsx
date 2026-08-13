/**
 * The explorer tree: the navigable view of a project.
 *
 * Owns the two pieces of state the tree needs and nothing else owns — which
 * nodes are expanded, and which is selected — and renders the flat list that
 * `flattenTree` derives from them.
 *
 * Expansion is a `Set` of node IDs rather than a flag on each node's own
 * component, as in milestone 002. That gives O(1) lookups, keeps the state
 * somewhere a future "expand all" or "reveal this node" can reach, and — since
 * an ID is a plain string — makes it serializable, so persisting expansion per
 * project later is storage work rather than redesign.
 *
 * The IDs are opaque here. Nothing in this file, or below it, parses one or
 * assumes anything about how it was produced.
 */

import { useMemo, useState, type JSX } from 'react'
import type { ExplorerNode } from '@shared/model/node'
import { flattenTree } from '@renderer/components/explorer/flattenTree'
import { ExplorerRow } from '@renderer/components/explorer/ExplorerRow'

interface ExplorerTreeProps {
  roots: readonly ExplorerNode[]
}

export function ExplorerTree({ roots }: ExplorerTreeProps): JSX.Element {
  // Nothing expanded, which shows the root's own children and no deeper. The
  // root is the header rather than a row, so this is the state where it alone is
  // open — the whole world named at the top level, and nothing below it yet.
  //
  // This scales where expanding the top level did not: the initial row count is
  // now the number of top-level nodes rather than that plus all their children,
  // and it stays constant however large the file beneath grows. It is also what
  // keeps deferring virtualization honest — 13 rows on the real 548-node file.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const rows = useMemo(() => flattenTree(roots, expanded), [roots, expanded])

  function toggle(nodeId: string): void {
    setExpanded((current) => {
      const next = new Set(current)
      if (!next.delete(nodeId)) next.add(nodeId)
      return next
    })
  }

  if (rows.length === 0) {
    return (
      <p className="px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400">
        This project has no entries yet.
      </p>
    )
  }

  return (
    <div role="tree" aria-label="Project contents" className="py-1">
      {rows.map((row) => (
        <ExplorerRow
          key={row.node.id}
          row={row}
          isSelected={row.node.id === selectedId}
          onSelect={setSelectedId}
          onToggle={toggle}
        />
      ))}
    </div>
  )
}
