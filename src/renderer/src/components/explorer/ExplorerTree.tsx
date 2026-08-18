/**
 * The explorer tree: the navigation aid beside the canvas.
 *
 * The canvas is the primary workspace; this is where you *find* something. That
 * is why selection no longer lives here — two views need it, so it is owned by
 * the application and arrives as a prop. Expansion stays, because it is
 * genuinely tree-local: nothing outside this component renders from it.
 *
 * Expansion is a `Set` of node IDs rather than a flag on each node's own
 * component, as in milestone 002. That gives O(1) lookups, keeps the state
 * somewhere "reveal this node" can reach — which is now a real feature rather
 * than a future one — and, since an ID is a plain string, makes it serializable.
 *
 * The IDs are opaque here. Nothing in this file, or below it, parses one or
 * assumes anything about how it was produced. Since milestone 005 they are also
 * *stable*: renaming, retyping or moving a node keeps its id, so expansion and
 * selection survive every structural change without this component being told
 * that one happened.
 */

import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import type { ExplorerNode } from '@shared/model/node'
import { ancestorIdsOf, type NodeIndex } from '@shared/model/nodeIndex'
import { flattenTree } from '@renderer/components/explorer/flattenTree'
import { ExplorerRow } from '@renderer/components/explorer/ExplorerRow'
import '@renderer/components/explorer/explorer.css'

interface ExplorerTreeProps {
  roots: readonly ExplorerNode[]
  index: NodeIndex
  selectedId: string | null
  onSelect: (nodeId: string) => void
  /** Opens the shared context menu. Absent on a read-only project. */
  onContextMenu?: (nodeId: string, x: number, y: number) => void
  /** The node being renamed in this surface, if any. */
  renamingId?: string | null
  onCommitRename?: (nodeId: string, title: string) => void
  onCancelRename?: () => void
}

export function ExplorerTree({
  roots,
  index,
  selectedId,
  onSelect,
  onContextMenu,
  renamingId = null,
  onCommitRename,
  onCancelRename
}: ExplorerTreeProps): JSX.Element {
  // Nothing expanded, which shows the top level and no deeper. The project is
  // the header rather than a row, so this is the state where it alone is open.
  //
  // This scales where expanding the top level did not: the initial row count is
  // the number of top-level nodes, and it stays constant however large the file
  // beneath grows.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const containerRef = useRef<HTMLDivElement>(null)
  // The tree owns its own scrolling, so reveal has one container to move and
  // never has to reach out into the layout around it.
  const scrollRef = useRef<HTMLDivElement>(null)

  const rows = useMemo(() => flattenTree(roots, expanded), [roots, expanded])

  /*
   * Expansion is keyed by node id, and identity is stable across rename, retype
   * and move — so expansion survives every structural change this milestone can
   * make, with no handling of its own.
   *
   * The one thing it must do is forget ids that have stopped existing, or the
   * set would grow without bound as projects are reloaded. Deletion is out of
   * scope, so today this is a guard rather than a fix.
   */
  useEffect(() => {
    setExpanded((current) => {
      const surviving = [...current].filter((id) => index.byId.has(id))
      return surviving.length === current.size ? current : new Set(surviving)
    })
  }, [index])

  function toggle(nodeId: string): void {
    setExpanded((current) => {
      const next = new Set(current)
      if (!next.delete(nodeId)) next.add(nodeId)
      return next
    })
  }

  // Reveal — the pattern VS Code calls `explorer.autoReveal`. Selection can now
  // change from the canvas, and a highlight on a row hidden inside a collapsed
  // ancestor is no highlight at all.
  //
  // Returning `current` unchanged when every ancestor is already open matters:
  // it makes this a no-op for selections made in the tree itself, which is most
  // of them, rather than a state write on every click.
  useEffect(() => {
    if (selectedId === null) return

    setExpanded((current) => {
      const ancestors = ancestorIdsOf(index, selectedId)
      if (ancestors.every((id) => current.has(id))) return current

      const next = new Set(current)
      for (const id of ancestors) next.add(id)
      return next
    })
  }, [selectedId, index])

  /*
   * Then bring it into view — but only if it is not already in view, and
   * without `scrollIntoView`.
   *
   * `scrollIntoView` would do the job in one line. It is avoided because it does
   * more than asked: it walks every scrollable ancestor and forces a synchronous
   * layout, for a movement that is usually zero. Computing whether the row is
   * outside the visible band and, when it is, moving this one container's
   * `scrollTop` touches nothing else and does nothing at all in the common case
   * where the selected row is already on screen.
   *
   * The frame of delay is for the canvas, which is rebuilding in the same tick:
   * there is no reason for the explorer to force layout while it does.
   *
   * Historical note, because an earlier revision of the milestone document said
   * otherwise: this was once believed to be the cause of a bug that left the
   * canvas with no edges and a frozen viewport. It was not. That turned out to
   * be Chromium suspending the rendering lifecycle for an occluded window, and
   * it is fixed in the main process with `backgroundThrottling: false`. This
   * code is kept because it is better on its own merits, not as a fix.
   */
  useEffect(() => {
    if (selectedId === null) return

    const frame = requestAnimationFrame(() => {
      const scroller = scrollRef.current
      const row = Array.from(containerRef.current?.querySelectorAll('[data-node-id]') ?? []).find(
        // Matched in JavaScript rather than interpolated into a selector, so this
        // never has to know what characters an opaque ID might contain.
        (element) => element instanceof HTMLElement && element.dataset.nodeId === selectedId
      )
      if (scroller === null || !(row instanceof HTMLElement)) return

      const top = row.offsetTop
      const bottom = top + row.offsetHeight

      // `block: 'nearest'` by hand: move as little as possible, and only when the
      // row is actually outside the visible band.
      if (top < scroller.scrollTop) scroller.scrollTop = top
      else if (bottom > scroller.scrollTop + scroller.clientHeight) {
        scroller.scrollTop = bottom - scroller.clientHeight
      }
    })

    return () => cancelAnimationFrame(frame)
  }, [selectedId, rows])

  if (rows.length === 0) {
    return (
      <p className="px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400">
        This project has no entries yet.
      </p>
    )
  }

  return (
    <div ref={scrollRef} className="mbs-explorer-scroll h-full overflow-auto">
      <div ref={containerRef} role="tree" aria-label="Project contents" className="py-1">
        {rows.map((row) => (
          <ExplorerRow
            key={row.node.id}
            row={row}
            isSelected={row.node.id === selectedId}
            onSelect={onSelect}
            onToggle={toggle}
            onContextMenu={onContextMenu}
            isRenaming={row.node.id === renamingId}
            onCommitRename={onCommitRename}
            onCancelRename={onCancelRename}
          />
        ))}
      </div>
    </div>
  )
}
