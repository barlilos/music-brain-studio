/**
 * The explorer tree: the navigable view of a project.
 *
 * Owns the two pieces of state the tree needs and nothing else owns — which
 * nodes are expanded, and which is selected — and renders the flat list that
 * `flattenTree` derives from them.
 *
 * Expansion is a `Set` of node IDs rather than a flag on each node's own
 * component, as in milestone 002. That gives O(1) lookups, keeps the state
 * somewhere a future "expand all" or "reveal this node" can reach, and — because
 * the IDs are JSON Pointers — makes it serializable, so persisting expansion per
 * project later is storage work rather than redesign.
 */

import { useMemo, useState, type JSX } from 'react'
import type { ExplorerNode } from '@shared/model/node'
import { flattenTree } from '@renderer/components/explorer/flattenTree'
import { ExplorerRow } from '@renderer/components/explorer/ExplorerRow'

interface ExplorerTreeProps {
  roots: readonly ExplorerNode[]
}

export function ExplorerTree({ roots }: ExplorerTreeProps): JSX.Element {
  // Top level open, everything else closed: enough to show the shape of the
  // whole world without opening a project onto a wall of text. It also keeps the
  // initial row count small, which is what makes deferring virtualization honest.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(roots.map((node) => node.id))
  )
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
