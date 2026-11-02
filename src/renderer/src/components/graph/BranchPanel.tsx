/**
 * A branch unfolded in place — R1's working surface.
 *
 * Clicking a bubble opens it into this panel beside the hub, with its siblings
 * still on screen as bubbles. Inside: one section per sub-branch, each with its
 * own seed pod and rows, then the work that sits directly in the branch. Rows
 * keep the user's order; only the seeds re-sort, so completing a task never
 * moves the row under the pointer.
 *
 * Every change goes through the workspace commands — the same mutations the
 * Inspector, the context menu and the dialogs use — so saving, the dirty guard
 * and conflict protection are exactly M005's.
 */

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type MouseEvent as ReactMouseEvent
} from 'react'
import type { ExplorerNode } from '@shared/model/node'
import type { NodeIndex } from '@shared/model/nodeIndex'
import { nextWorkStatus } from '@shared/model/workStatus'
import { parseBulkLines } from '@shared/model/bulkCapture'
import { regionStateOf, type ProgressIndex, type RegionState } from '@shared/model/progress'
import { useCommands } from '@renderer/state/workspaceContext'
import { isRenaming, useEditing } from '@renderer/state/editingContext'
import { InlineRename } from '@renderer/components/editing/InlineRename'
import { presentationFor } from '@renderer/components/explorer/nodeKinds'
import { DEFAULT_NEW_KIND, initialStatusFor } from '@renderer/components/editing/nodeKindOptions'
import {
  bubbleOf,
  isWorkItem,
  looseBubbleOf,
  workUnder,
  type SeedSpec
} from '@renderer/components/graph/graphLayout'
import { BubbleIcon, Icon, StatusIcon } from '@renderer/components/graph/GraphArt'
import { detailedCountWords, formatDay } from '@renderer/components/graph/graphText'

/** Seed density inside panel icons — tight, so a whole branch fits in 72px. */
const ICON_SPEC: SeedSpec = { spacing: 8.5, radius: 3, pad: 3, gap: 4 }

export interface BranchPanelProps {
  /** The branch to show, or `null` for the tasks directly in `hostId`. */
  branchId: string | null
  /** The focused node the panel hangs off — the parent for a loose pod. */
  hostId: string | null
  hostName: string
  index: NodeIndex
  progress: ProgressIndex
  selectedId: string | null
  isEditable: boolean
  isNew: (id: string) => boolean
  style: CSSProperties
  onSelect: (nodeId: string | null) => void
  onReveal: (nodeId: string) => void
  onOpenAsMap: (nodeId: string) => void
  onFold: () => void
  onContextMenu: (nodeId: string | null, x: number, y: number) => void
}

export function BranchPanel({
  branchId,
  hostId,
  hostName,
  index,
  progress,
  selectedId,
  isEditable,
  isNew,
  style,
  onSelect,
  onReveal,
  onOpenAsMap,
  onFold,
  onContextMenu
}: BranchPanelProps): JSX.Element | null {
  const { openDialog } = useEditing()
  const branch = branchId === null ? undefined : index.byId.get(branchId)
  const host = hostId === null ? undefined : index.byId.get(hostId)

  const regionOf = (nodeId: string): RegionState =>
    regionStateOf(progress.byId.get(nodeId), index.byId.get(nodeId)?.finishedAt)

  // The loose pod: the work sitting directly in the focused node.
  if (branchId === null) {
    const items = (host?.children ?? index.roots).filter(isWorkItem)
    const icon = looseBubbleOf(items, ICON_SPEC, isNew)
    return (
      <section className="lpg-panel" style={style} aria-label={`Tasks directly in ${hostName}`}>
        <header className="lpg-panel-head">
          <BubbleIcon bubble={icon} regionOf={regionOf} size={60} radius={3} spacing={8.5} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="lpg-panel-title">Directly in {hostName}</span>
            <span className="lpg-small lpg-sec">
              {items.length} {items.length === 1 ? 'task' : 'tasks'} not filed in a branch
            </span>
          </div>
          <span className="lpg-grow" />
          <PanelClose onFold={onFold} />
        </header>
        <div className="lpg-panel-body">
          <Rows
            items={items}
            selectedId={selectedId}
            isEditable={isEditable}
            isNew={isNew}
            indent={10}
            onSelect={onSelect}
            onContextMenu={onContextMenu}
          />
          {isEditable && <AddTasks parentId={hostId} parentName={hostName} />}
        </div>
      </section>
    )
  }

  if (branch === undefined) return null

  const presentation = presentationFor(branch.kind)
  const summary = progress.byId.get(branch.id)
  const region = regionOf(branch.id)
  const icon = bubbleOf(branch, ICON_SPEC, 1, isNew)
  const subBranches = branch.children.filter((child) => !isWorkItem(child))
  const direct = branch.children.filter(isWorkItem)
  const freshCount = workUnder(branch).filter((node) => isNew(node.id)).length
  const title = branch.label ?? `Untitled ${presentation.name.toLowerCase()}`

  return (
    <section className="lpg-panel" style={style} aria-label={`${title}, unfolded`}>
      <header className="lpg-panel-head">
        <BubbleIcon bubble={icon} regionOf={regionOf} size={72} radius={3} spacing={8.5} />
        <div className="flex min-w-0 flex-col gap-1">
          <EditableTitle node={branch} className="lpg-panel-title" fallback={title} />
          <span className="lpg-small lpg-sec">
            {presentation.name} in {hostName} · {detailedCountWords(summary)}
            {freshCount > 0 && (
              <span className="lpg-new-text"> · {freshCount} added this session</span>
            )}
          </span>
          <RegionChip
            region={region}
            finishedAt={branch.finishedAt}
            openCount={(summary?.todo ?? 0) + (summary?.inProgress ?? 0)}
          />
        </div>
        <span className="lpg-grow" />
        <div className="flex shrink-0 items-center gap-1 self-start">
          {isEditable && (
            <button
              type="button"
              className="lpg-btn"
              onClick={() => openDialog({ kind: 'addChild', parentId: branch.id })}
              title="Add a task or a branch inside this"
            >
              <Icon name="plus" />
              Add
            </button>
          )}
          <button
            type="button"
            className="lpg-btn lpg-btn-ghost"
            onClick={() => onSelect(branch.id)}
            aria-label={`Details of ${title}`}
            title="Details"
          >
            <Icon name="details" />
          </button>
          <button
            type="button"
            className="lpg-btn lpg-btn-ghost"
            onClick={() => onOpenAsMap(branch.id)}
            aria-label={`Open ${title} as the centre of the map`}
            title="Open as map (double-click a bubble)"
          >
            <Icon name="expand" />
          </button>
          {isEditable && (
            <button
              type="button"
              className="lpg-btn lpg-btn-ghost"
              onClick={(event) => openMenuAt(event, branch.id, onContextMenu)}
              aria-label={`More actions for ${title}`}
            >
              <Icon name="more" />
            </button>
          )}
          <PanelClose onFold={onFold} />
        </div>
      </header>

      <div className="lpg-panel-body">
        {branch.children.length === 0 && (
          <div className="lpg-empty-panel">
            <span>
              Nothing in <b className="text-neutral-100">{title}</b> yet. Write down the first task
              — each one becomes a seed in this bubble.
            </span>
          </div>
        )}

        {subBranches.map((sub) => (
          <Section
            key={sub.id}
            node={sub}
            index={index}
            progress={progress}
            selectedId={selectedId}
            isEditable={isEditable}
            isNew={isNew}
            regionOf={regionOf}
            onSelect={onSelect}
            onReveal={onReveal}
            onContextMenu={onContextMenu}
          />
        ))}

        {(direct.length > 0 || subBranches.length === 0) && (
          <>
            {subBranches.length > 0 && (
              <div className="lpg-lbl" style={{ padding: '12px 10px 4px' }}>
                Directly in {title}
              </div>
            )}
            <Rows
              items={direct}
              selectedId={selectedId}
              isEditable={isEditable}
              isNew={isNew}
              indent={10}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
            />
            {isEditable && (
              <AddTasks
                parentId={branch.id}
                parentName={title}
                startOpen={branch.children.length === 0}
              />
            )}
          </>
        )}
      </div>
    </section>
  )
}

function openMenuAt(
  event: ReactMouseEvent,
  nodeId: string | null,
  onContextMenu: (nodeId: string | null, x: number, y: number) => void
): void {
  event.preventDefault()
  event.stopPropagation()
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  onContextMenu(
    nodeId,
    event.type === 'contextmenu' ? event.clientX : rect.left,
    event.type === 'contextmenu' ? event.clientY : rect.bottom + 4
  )
}

function PanelClose({ onFold }: { onFold: () => void }): JSX.Element {
  return (
    <button
      type="button"
      className="lpg-btn lpg-btn-ghost"
      onClick={onFold}
      aria-label="Fold back into a bubble"
      title="Fold back (Esc)"
    >
      <Icon name="close" />
    </button>
  )
}

export function RegionChip({
  region,
  finishedAt,
  openCount
}: {
  region: RegionState
  finishedAt: string | undefined
  openCount: number
}): JSX.Element | null {
  if (region === 'finished') {
    return (
      <span className="flex flex-wrap items-center gap-2">
        <span className="lpg-finished-chip">
          <Icon name="check" />
          Finished {formatDay(finishedAt ?? '')}
        </span>
        {openCount > 0 && <span className="lpg-small lpg-sec">{openCount} still open inside</span>}
      </span>
    )
  }
  if (region === 'nothingOpen') {
    return (
      <span className="flex">
        <span
          className="lpg-nothing-open"
          title="Every known task is done. It is not marked Finished."
        >
          Nothing open right now
        </span>
      </span>
    )
  }
  return null
}

/** A title that becomes an inline rename field when the menu asks for one. */
function EditableTitle({
  node,
  className,
  fallback
}: {
  node: ExplorerNode
  className: string
  fallback: string
}): JSX.Element {
  const { rename, endRename } = useEditing()
  const commands = useCommands()
  if (isRenaming(rename, node.id, 'graph')) {
    return (
      <InlineRename
        initialValue={node.label ?? ''}
        onCommit={(title) => {
          commands.rename(node.id, title)
          endRename()
        }}
        onCancel={endRename}
        className="lpg-input"
      />
    )
  }
  return <span className={className}>{fallback}</span>
}

interface SectionProps {
  node: ExplorerNode
  index: NodeIndex
  progress: ProgressIndex
  selectedId: string | null
  isEditable: boolean
  isNew: (id: string) => boolean
  regionOf: (nodeId: string) => RegionState
  onSelect: (nodeId: string | null) => void
  onReveal: (nodeId: string) => void
  onContextMenu: (nodeId: string | null, x: number, y: number) => void
}

/** One sub-branch inside the panel: its pod, its rows, and its own sub-branches as links. */
function Section({
  node,
  progress,
  selectedId,
  isEditable,
  isNew,
  regionOf,
  onSelect,
  onReveal,
  onContextMenu
}: SectionProps): JSX.Element {
  const presentation = presentationFor(node.kind)
  const title = node.label ?? `Untitled ${presentation.name.toLowerCase()}`
  const summary = progress.byId.get(node.id)
  const region = regionOf(node.id)
  const direct = node.children.filter(isWorkItem)
  const deeper = node.children.filter((child) => !isWorkItem(child))
  const icon = bubbleOf(node, ICON_SPEC, 0, isNew)

  return (
    <div className="flex flex-col" style={{ marginTop: 4 }}>
      <div
        className={`lpg-section-head${selectedId === node.id ? ' lpg-row is-selected' : ''}`}
        onContextMenu={
          isEditable ? (event) => openMenuAt(event, node.id, onContextMenu) : undefined
        }
      >
        <BubbleIcon bubble={icon} regionOf={regionOf} size={30} radius={2.5} spacing={7} />
        <EditableTitle node={node} className="lpg-section-title" fallback={title} />
        <span className="lpg-small lpg-muted shrink-0">{presentation.name}</span>
        <span className="lpg-grow" />
        {region === 'finished' || region === 'nothingOpen' ? (
          <RegionChip
            region={region}
            finishedAt={node.finishedAt}
            openCount={(summary?.todo ?? 0) + (summary?.inProgress ?? 0)}
          />
        ) : (
          <span className="lpg-state">{detailedCountWords(summary)}</span>
        )}
        <button
          type="button"
          className="lpg-btn lpg-btn-ghost lpg-btn-sm"
          onClick={() => onSelect(node.id)}
          aria-label={`Details of ${title}`}
          title="Details"
        >
          <Icon name="details" />
        </button>
        <button
          type="button"
          className="lpg-btn lpg-btn-ghost lpg-btn-sm"
          onClick={() => onReveal(node.id)}
          aria-label={`Open ${title}`}
          title="Open this branch"
        >
          <Icon name="chevron" />
        </button>
      </div>

      <Rows
        items={direct}
        selectedId={selectedId}
        isEditable={isEditable}
        isNew={isNew}
        indent={48}
        onSelect={onSelect}
        onContextMenu={onContextMenu}
      />

      {deeper.map((child) => {
        const childTitle =
          child.label ?? `Untitled ${presentationFor(child.kind).name.toLowerCase()}`
        return (
          <button
            key={child.id}
            type="button"
            className="lpg-subbranch"
            style={{ paddingLeft: 44 }}
            onClick={() => onReveal(child.id)}
            onContextMenu={
              isEditable ? (event) => openMenuAt(event, child.id, onContextMenu) : undefined
            }
            title={`Open ${childTitle}`}
          >
            <BubbleIcon
              bubble={bubbleOf(child, ICON_SPEC, 0, isNew)}
              regionOf={regionOf}
              size={22}
              radius={2.2}
              spacing={6}
            />
            <span className="lpg-row-title">{childTitle}</span>
            <span className="lpg-state">{detailedCountWords(progress.byId.get(child.id))}</span>
            <Icon name="chevron" />
          </button>
        )
      })}

      {isEditable && <AddTasks parentId={node.id} parentName={title} indent={44} />}
    </div>
  )
}

interface RowsProps {
  items: readonly ExplorerNode[]
  selectedId: string | null
  isEditable: boolean
  isNew: (id: string) => boolean
  indent: number
  onSelect: (nodeId: string | null) => void
  onContextMenu: (nodeId: string | null, x: number, y: number) => void
}

function Rows({ items, ...rest }: RowsProps): JSX.Element {
  return (
    <>
      {items.map((item) => (
        <TaskRow key={item.id} node={item} {...rest} />
      ))}
    </>
  )
}

function TaskRow({
  node,
  selectedId,
  isEditable,
  isNew,
  indent,
  onSelect,
  onContextMenu
}: Omit<RowsProps, 'items'> & { node: ExplorerNode }): JSX.Element {
  const commands = useCommands()
  const { rename, beginRename, endRename, openDialog } = useEditing()
  const ref = useRef<HTMLDivElement>(null)
  const status = node.status ?? 'todo'
  const fresh = isNew(node.id)
  const isSelected = selectedId === node.id
  const title = node.label ?? 'Untitled task'
  const renaming = isRenaming(rename, node.id, 'graph')

  useEffect(() => {
    if (isSelected) ref.current?.scrollIntoView({ block: 'nearest' })
  }, [isSelected])

  const toggle = (): void => {
    if (isEditable) commands.setStatus(node.id, nextWorkStatus(node.status))
  }

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={`${title}, ${status === 'done' ? 'done' : status === 'in_progress' ? 'in progress' : 'to do'}${fresh ? ', added this session' : ''}`}
      className={`lpg-row${isSelected ? ' is-selected' : ''}`}
      style={{ paddingLeft: indent }}
      onClick={() => onSelect(node.id)}
      onDoubleClick={() => isEditable && beginRename({ nodeId: node.id, surface: 'graph' })}
      onContextMenu={isEditable ? (event) => openMenuAt(event, node.id, onContextMenu) : undefined}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return
        if (event.key === 'Enter') {
          event.preventDefault()
          onSelect(node.id)
        } else if (event.key === ' ') {
          event.preventDefault()
          toggle()
        } else if (event.key === 'F2' && isEditable) {
          event.preventDefault()
          beginRename({ nodeId: node.id, surface: 'graph' })
        }
      }}
    >
      <button
        type="button"
        className="lpg-glyph-btn"
        disabled={!isEditable}
        tabIndex={-1}
        onClick={(event) => {
          event.stopPropagation()
          toggle()
        }}
        aria-label={status === 'done' ? `Mark ${title} to do` : `Mark ${title} done`}
        title={status === 'done' ? 'Mark to do' : 'Mark done (Space)'}
      >
        <StatusIcon
          status={status}
          isNew={fresh}
          bg={isSelected ? '#1a2740' : '#141922'}
          decorative
        />
      </button>

      {renaming ? (
        <InlineRename
          initialValue={node.label ?? ''}
          onCommit={(next) => {
            commands.rename(node.id, next)
            endRename()
          }}
          onCancel={endRename}
          className="lpg-input flex-1"
        />
      ) : (
        <span className={`lpg-row-title${status === 'done' ? ' is-done' : ''}`} title={title}>
          {title}
        </span>
      )}

      {fresh && <span className="lpg-newtag">New</span>}
      {!fresh && status === 'in_progress' && <span className="lpg-iptag">In progress</span>}
      {node.children.length === 0 && node.tags.length > 0 && (
        <span className="lpg-small lpg-muted hidden max-w-32 truncate xl:inline">
          {node.tags.map((tag) => `#${tag}`).join(' ')}
        </span>
      )}

      {isEditable && !renaming && (
        <span className="lpg-row-actions">
          <button
            type="button"
            className="lpg-btn lpg-btn-ghost lpg-btn-sm"
            onClick={(event) => {
              event.stopPropagation()
              openDialog({ kind: 'move', nodeId: node.id })
            }}
            title="Move to another branch"
          >
            <Icon name="move" />
            Move
          </button>
          <button
            type="button"
            className="lpg-btn lpg-btn-ghost lpg-btn-sm"
            onClick={(event) => openMenuAt(event, node.id, onContextMenu)}
            aria-label={`More actions for ${title}`}
          >
            <Icon name="more" />
          </button>
        </span>
      )}
    </div>
  )
}

/**
 * Quick capture: type a task and press Enter; the field stays open for the
 * next one. Pasting several lines adds them all in one step — one revision, one
 * undo once undo exists — exactly like M005's Add many.
 */
export function AddTasks({
  parentId,
  parentName,
  indent = 6,
  startOpen = false
}: {
  parentId: string | null
  parentName: string
  indent?: number
  startOpen?: boolean
}): JSX.Element {
  const commands = useCommands()
  const [open, setOpen] = useState(startOpen)
  const [value, setValue] = useState('')
  const [justAdded, setJustAdded] = useState(0)

  const add = (titles: string[]): void => {
    if (titles.length === 0) return
    const kind = DEFAULT_NEW_KIND
    const ids = commands.addChildren(
      parentId,
      titles.map((title) => ({ title, kind, status: initialStatusFor(kind) }))
    )
    setJustAdded(ids.length)
    setValue('')
  }

  if (!open) {
    return (
      <button
        type="button"
        className="lpg-add-row"
        style={{ paddingLeft: indent + 4 }}
        onClick={() => setOpen(true)}
      >
        <Icon name="plus" />
        Add task
      </button>
    )
  }

  return (
    <div style={{ paddingLeft: indent }}>
      <div className="lpg-capture">
        <input
          autoFocus
          className="lpg-input"
          value={value}
          placeholder={`New task in ${parentName}`}
          aria-label={`New task in ${parentName}`}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            event.stopPropagation()
            if (event.key === 'Enter') {
              event.preventDefault()
              add(parseBulkLines(value))
            } else if (event.key === 'Escape') {
              setValue('')
              setOpen(false)
            }
          }}
          onPaste={(event) => {
            const text = event.clipboardData.getData('text')
            if (!/\r?\n/.test(text)) return
            event.preventDefault()
            add(parseBulkLines(`${value}${text}`))
          }}
          onBlur={() => {
            if (value.trim().length === 0) setOpen(false)
          }}
        />
        <button
          type="button"
          className="lpg-btn"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => add(parseBulkLines(value))}
          disabled={value.trim().length === 0}
        >
          Add
        </button>
      </div>
      <div className="lpg-capture-hint">
        {justAdded > 0
          ? `Added ${justAdded}. Keep typing, or Esc to finish.`
          : 'Enter adds one · paste several lines to add them all · Esc to finish'}
      </div>
    </div>
  )
}
