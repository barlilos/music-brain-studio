/**
 * One line in the explorer.
 *
 * **Two hit targets, two meanings.** The chevron expands and collapses the
 * hierarchy; the rest of the row selects the node and opens its canvas. They are
 * separate `<button>`s, not one button that does both.
 *
 * That separation is the point rather than a detail. The explorer is a
 * navigator, and browsing a large hierarchy means opening a lot of things to see
 * what is in them — if every disclosure also re-rooted the workspace, the user
 * could not look around without losing the thing they were looking at. Expansion
 * is explorer-only state; selection is shared with the canvas.
 *
 * Purely presentational otherwise: it receives a row model and callbacks, and
 * touches neither the document, the model, nor the expansion set. Milestone 005
 * added editing without changing that — the row reports that a menu was asked
 * for and renders a field when told to, and every actual change happens through
 * the workspace commands somewhere above it.
 *
 * It also contains no knowledge of any specific node kind. Appearance comes from
 * a single `presentationFor` lookup, so a new kind never touches this file.
 */

import type { JSX } from 'react'
import { presentationFor } from '@renderer/components/explorer/nodeKinds'
import { ChevronIcon } from '@renderer/components/explorer/icons'
import type { ExplorerRowModel } from '@renderer/components/explorer/flattenTree'
import { InlineRename } from '@renderer/components/editing/InlineRename'
import { rowBadgeFor } from '@renderer/components/explorer/rowProgress'
import type { ProgressSummary } from '@shared/model/progress'

/** Indentation per level, in pixels. Also the width of one indent guide. */
const INDENT_STEP = 16

interface ExplorerRowProps {
  row: ExplorerRowModel
  isSelected: boolean
  onSelect: (nodeId: string) => void
  onToggle: (nodeId: string) => void
  /** Opens the shared context menu. Absent on a read-only project. */
  onContextMenu?: (nodeId: string, x: number, y: number) => void
  /** Whether this row is being renamed in place, in this surface. */
  isRenaming?: boolean
  onCommitRename?: (nodeId: string, title: string) => void
  onCancelRename?: () => void
  /** Work below this node, for the badge. */
  progress?: ProgressSummary
}

export function ExplorerRow({
  row,
  isSelected,
  onSelect,
  onToggle,
  onContextMenu,
  isRenaming = false,
  onCommitRename,
  onCancelRename,
  progress
}: ExplorerRowProps): JSX.Element {
  const { node, depth, hasChildren, isExpanded } = row
  const kind = presentationFor(node.kind)

  const isDone = kind.showsStatus && node.status === 'done'
  // An untitled node still needs something clickable and identifiable. The kind
  // supplies it, so the row never falls back to an array index — which would be
  // the file's structure leaking back into a UI built to hide it.
  const label = node.label ?? `Untitled ${kind.name.toLowerCase()}`
  const badge = rowBadgeFor(progress, node.children.length)

  return (
    <div
      role="treeitem"
      aria-level={depth + 1}
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-selected={isSelected}
      data-node-id={node.id}
      onContextMenu={
        onContextMenu === undefined
          ? undefined
          : (event) => {
              event.preventDefault()
              onContextMenu(node.id, event.clientX, event.clientY)
            }
      }
      /*
       * `pl-2` on the row itself, not on the indent guides — so it is a margin
       * for the whole tree rather than an extra level of indentation. Every row
       * shifts by the same 8px, depth stays entirely a function of the guides,
       * and children cannot end up double-indented. The selection background
       * still spans the full width, because it is on this element rather than on
       * the padded content.
       */
      className={`flex h-7 w-full items-center gap-1.5 pl-2 text-sm select-none ${
        isSelected ? 'bg-neutral-200/70 dark:bg-neutral-700/60' : ''
      }`}
    >
      {/*
        One guide per ancestor level. Drawn as fixed-width spacers with a left
        border rather than as plain padding, because past about three levels an
        unguided indent stops being attributable to a parent.
      */}
      {Array.from({ length: depth }, (_, level) => (
        <span
          key={level}
          aria-hidden="true"
          className="h-full shrink-0 border-l border-neutral-200 dark:border-neutral-800"
          style={{ width: INDENT_STEP }}
        />
      ))}

      {/*
        The disclosure control. Its own button so that expanding never touches
        selection, and its own hover so the two targets are visibly different
        rather than merely behaving differently.

        Out of the tab order on purpose: the row's label is the one tab stop, and
        a second stop per row would double the length of the tree for keyboard
        users while real tree keyboard navigation (arrow keys) does not exist yet.
        The column is reserved on leaves too, so labels align down one column.
      */}
      {hasChildren ? (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => onToggle(node.id)}
          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${label}`}
          className="flex h-full w-4 shrink-0 items-center justify-center rounded-sm text-neutral-400 hover:bg-neutral-300/70 dark:text-neutral-500 dark:hover:bg-neutral-600/60"
        >
          <ChevronIcon className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        </button>
      ) : (
        <span aria-hidden="true" className="h-full w-4 shrink-0" />
      )}

      {isRenaming ? (
        /*
          Renaming replaces the label in place, in this surface, because this is
          where the user asked for it — the same node may also be on screen in
          the canvas, and only one of the two should sprout a field.
        */
        <>
          <span className={`shrink-0 ${kind.iconClassName}`}>
            <kind.Icon status={kind.showsStatus ? node.status : undefined} />
          </span>
          <InlineRename
            initialValue={node.label ?? ''}
            onCommit={(title) => onCommitRename?.(node.id, title)}
            onCancel={() => onCancelRename?.()}
            className="mr-3 h-5 min-w-0 flex-1"
          />
        </>
      ) : (
        /* Selecting is the row's other job, and the only one that reaches the canvas. */
        <button
          type="button"
          onClick={() => onSelect(node.id)}
          title={label}
          className={`flex h-full min-w-0 flex-1 items-center gap-1.5 pr-3 text-left ${
            isSelected ? '' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800/70'
          }`}
        >
          <span className={`shrink-0 ${kind.iconClassName}`}>
            <kind.Icon status={kind.showsStatus ? node.status : undefined} />
          </span>

          <span
            className={`truncate ${kind.labelClassName} ${
              isDone ? 'text-neutral-400 line-through dark:text-neutral-600' : ''
            }`}
          >
            {label}
          </span>

          {node.tags.length > 0 && (
            <span className="shrink-0 truncate text-xs text-neutral-400 dark:text-neutral-600">
              {node.tags.join(' · ')}
            </span>
          )}

          {/*
            Pushed right, and only while collapsed: it answers "how much is left
            in here" before you spend a click, and once expanded the answer is on
            screen. Falls back to the child count when there is no work below.
          */}
          {hasChildren && !isExpanded && badge !== null && (
            <span
              title={badge.title}
              className="ml-auto shrink-0 text-xs tabular-nums text-neutral-400 dark:text-neutral-600"
            >
              {badge.text}
            </span>
          )}
        </button>
      )}
    </div>
  )
}
