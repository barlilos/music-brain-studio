import { useState, type JSX } from 'react'
import type { ProjectDocument } from '@shared/types'
import { ROOT_NODE_ID, childNodeId } from '@shared/utils/nodeId'

/**
 * Renders a project document as a collapsible tree.
 *
 * This is the only module that inspects a `ProjectDocument`'s runtime shape.
 * Everywhere else in the renderer a document is opaque — carried and passed on,
 * never indexed or type-tested — so replacing today's arbitrary JSON with a
 * typed Music Brain model means changing this file and the alias, and nothing
 * else.
 *
 * Every node carries a `nodeId`: its stable identity, derived from its position
 * by `@shared/utils/nodeId`. Nothing consumes it yet. It is generated now so
 * that selection, editing, search and favorites have an address to attach to
 * later, and so that IDs are already stable by the time something depends on it.
 */

/** The two container shapes a document node can take. */
type BranchValue = ProjectDocument[] | { [key: string]: ProjectDocument }

function isBranch(value: ProjectDocument): value is BranchValue {
  return typeof value === 'object' && value !== null
}

/** A branch's children as `[key, value]` pairs — array indices become keys. */
function childEntries(value: BranchValue): [string, ProjectDocument][] {
  return Array.isArray(value)
    ? value.map((child, index): [string, ProjectDocument] => [String(index), child])
    : Object.entries(value)
}

/** Renders a leaf value, coloured by type so the shape is scannable. */
function LeafValue({ value }: { value: string | number | boolean | null }): JSX.Element {
  if (value === null) {
    return <span className="text-neutral-400 italic dark:text-neutral-500">null</span>
  }
  if (typeof value === 'string') {
    return <span className="text-emerald-700 dark:text-emerald-400">&quot;{value}&quot;</span>
  }
  if (typeof value === 'number') {
    return <span className="text-sky-700 dark:text-sky-400">{value}</span>
  }
  return <span className="text-purple-700 dark:text-purple-400">{String(value)}</span>
}

interface TreeNodeProps {
  /**
   * Stable identity of this node within the document. A domain value, not a
   * rendering one: the caller also passes it to React as `key`, but that is
   * incidental — `key` is consumed by the reconciler and cannot be read back,
   * whereas this prop is what future selection and editing will address.
   */
  nodeId: string
  /** The node's key within its parent — a property name or an array index. */
  label: string
  value: ProjectDocument
  /** Whether the node starts expanded. Only the root does. */
  defaultExpanded?: boolean
}

function TreeNode({ nodeId, label, value, defaultExpanded = false }: TreeNodeProps): JSX.Element {
  // Expansion is per node and lives with the node. A shared map would need an
  // owner, and nothing outside the tree has any reason to know what is open.
  const [expanded, setExpanded] = useState(defaultExpanded)

  if (!isBranch(value)) {
    return (
      <li data-node-id={nodeId} className="flex gap-2 py-0.5 pl-5 font-mono text-sm">
        <span className="text-neutral-600 dark:text-neutral-400">{label}:</span>
        <LeafValue value={value} />
      </li>
    )
  }

  const entries = childEntries(value)
  const summary = Array.isArray(value) ? `[${entries.length}]` : `{${entries.length}}`

  return (
    <li data-node-id={nodeId} className="font-mono text-sm">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-1 rounded py-0.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800"
      >
        <span className="w-4 shrink-0 text-neutral-400">{expanded ? '▾' : '▸'}</span>
        <span className="text-neutral-800 dark:text-neutral-200">{label}</span>
        <span className="text-neutral-400 dark:text-neutral-500">{summary}</span>
      </button>

      {expanded && entries.length > 0 && (
        <ul className="ml-2 border-l border-neutral-200 pl-2 dark:border-neutral-800">
          {entries.map(([childLabel, childValue]) => {
            const childId = childNodeId(nodeId, childLabel)
            return <TreeNode key={childId} nodeId={childId} label={childLabel} value={childValue} />
          })}
        </ul>
      )}
    </li>
  )
}

interface TreeViewProps {
  document: ProjectDocument
  /** Shown as the root node's label. */
  rootLabel: string
}

export function TreeView({ document, rootLabel }: TreeViewProps): JSX.Element {
  return (
    <ul>
      <TreeNode nodeId={ROOT_NODE_ID} label={rootLabel} value={document} defaultExpanded />
    </ul>
  )
}
