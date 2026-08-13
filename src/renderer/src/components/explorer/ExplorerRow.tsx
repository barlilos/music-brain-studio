/**
 * One line in the explorer.
 *
 * Purely presentational: it receives a row model and two callbacks, and touches
 * neither the document, the adapter, nor the expansion set. Later features
 * extend the *row model* — a match range for search highlighting, a drag handle,
 * a context-menu target — rather than reaching into the tree's internals.
 *
 * It also contains no knowledge of any specific node kind. Appearance comes from
 * a single `presentationFor` lookup, so a new kind never touches this file.
 */

import type { JSX } from 'react'
import { presentationFor } from '@renderer/components/explorer/nodeKinds'
import { ChevronIcon } from '@renderer/components/explorer/icons'
import type { ExplorerRowModel } from '@renderer/components/explorer/flattenTree'

/** Indentation per level, in pixels. Also the width of one indent guide. */
const INDENT_STEP = 16

interface ExplorerRowProps {
  row: ExplorerRowModel
  isSelected: boolean
  onSelect: (nodeId: string) => void
  onToggle: (nodeId: string) => void
}

export function ExplorerRow({
  row,
  isSelected,
  onSelect,
  onToggle
}: ExplorerRowProps): JSX.Element {
  const { node, depth, hasChildren, isExpanded } = row
  const kind = presentationFor(node.kind)

  const isComplete = kind.showsCompletion && node.isComplete === true
  // An untitled node still needs something clickable and identifiable. The kind
  // supplies it, so the row never falls back to an array index — which would be
  // the file's structure leaking back into a UI built to hide it.
  const label = node.label ?? `Untitled ${kind.name.toLowerCase()}`

  function handleClick(): void {
    onSelect(node.id)
    if (hasChildren) onToggle(node.id)
  }

  return (
    <button
      type="button"
      role="treeitem"
      aria-level={depth + 1}
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-selected={isSelected}
      data-node-id={node.id}
      onClick={handleClick}
      title={label}
      className={`flex h-7 w-full items-center gap-1.5 pr-3 text-left text-sm select-none ${
        isSelected
          ? 'bg-neutral-200/70 dark:bg-neutral-700/60'
          : 'hover:bg-neutral-100 dark:hover:bg-neutral-800/70'
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
        Reserved on leaves too, so labels align into a single scannable column
        instead of stepping in and out with the presence of children.
      */}
      <span className="flex w-4 shrink-0 justify-center text-neutral-400 dark:text-neutral-500">
        {hasChildren && (
          <ChevronIcon className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        )}
      </span>

      <span className={`shrink-0 ${kind.iconClassName}`}>
        <kind.Icon isComplete={node.isComplete} />
      </span>

      <span
        className={`truncate ${kind.labelClassName} ${
          isComplete ? 'text-neutral-400 line-through dark:text-neutral-600' : ''
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
        Pushed right, and only while collapsed: it answers "is there anything in
        here" before you spend a click, and once expanded the answer is on screen.
      */}
      {hasChildren && !isExpanded && (
        <span className="ml-auto shrink-0 text-xs tabular-nums text-neutral-400 dark:text-neutral-600">
          {node.children.length}
        </span>
      )}
    </button>
  )
}
