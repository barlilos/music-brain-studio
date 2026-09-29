/**
 * One card on the canvas.
 *
 * A pure function of one `CanvasCardView`: it looks nothing up, resolves no
 * fallback, and contains no conditional that depends on where the card came
 * from. Everything was decided in the view model, which is what stops this
 * component from drifting away from how the explorer draws the same node.
 *
 * It contains no knowledge of any specific node kind — appearance arrives as
 * data — and it has never heard of a file, a token or a mutation. Toggling a
 * status calls a callback from context, exactly as selecting does.
 *
 * **Two buttons, side by side, inside a wrapper that is not a control.**
 * Milestone 005 gave the card a second action, and the shape it takes is
 * decision R5. The obvious approach — keep the card a `<button>` and nest the
 * status control in it — is invalid HTML with undefined focus behaviour. The
 * alternative that was considered and rejected was making the card body a
 * `role="button"` div with hand-written `tabIndex` and Enter/Space handling,
 * which trades a real accessibility guarantee for a cosmetic one.
 *
 * So the wrapper is presentational — no role, no `tabIndex`, no handler — and
 * holds two sibling `<button>` elements. Native focus, Enter and Space,
 * `disabled` and assistive-technology roles all come for free, and because the
 * status button is a *sibling* rather than a descendant, pressing it cannot
 * reach the navigation handler at all. That is a structural guarantee rather
 * than a `stopPropagation` call a later refactor could quietly drop.
 */

import type { JSX } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useCanvasInteraction } from '@renderer/components/canvas/canvasInteraction'
import type { CanvasFlowNode } from '@renderer/components/canvas/toReactFlow'
import { nextWorkStatus } from '@shared/model/workStatus'
import { InlineRename } from '@renderer/components/editing/InlineRename'

/**
 * Anchor points for the edge paths.
 *
 * Present because React Flow routes edges between handles, and invisible and
 * inert because nothing on this canvas can be connected. A visible handle would
 * advertise an affordance that does not work, which is worse than showing none.
 */
function EdgeAnchor({
  type,
  position
}: {
  type: 'source' | 'target'
  position: Position
}): JSX.Element {
  return (
    <Handle
      type={type}
      position={position}
      isConnectable={false}
      className="h-px! w-px! min-w-0! border-0! bg-transparent!"
      style={{ opacity: 0, pointerEvents: 'none' }}
    />
  )
}

/** What the status button says it will do, for the tooltip and for screen readers. */
const NEXT_STATUS_LABEL: Record<string, string> = {
  todo: 'Mark as done',
  in_progress: 'Mark as done',
  done: 'Mark as to do'
}

export function CanvasCard({ data }: NodeProps<CanvasFlowNode>): JSX.Element {
  const { card } = data
  const { onSelect, onCycleStatus, onContextMenu, renamingNodeId, onCommitRename, onCancelRename } =
    useCanvasInteraction()
  const { presentation } = card

  const isRenaming = card.nodeId !== null && card.nodeId === renamingNodeId

  const isDone = card.showsStatus && card.status === 'done'

  // The status control appears only for kinds that carry work state, and only
  // when the project can actually be edited. A read-only file shows the glyph
  // as it always was: information, not an affordance.
  const canToggle = card.showsStatus && card.nodeId !== null && onCycleStatus !== undefined

  const glyph = (
    <span className={`shrink-0 [&>svg]:h-5 [&>svg]:w-5 ${presentation.iconClassName}`}>
      <presentation.Icon status={card.showsStatus ? card.status : undefined} />
    </span>
  )

  return (
    <>
      <EdgeAnchor type="target" position={Position.Left} />

      {/*
        Presentational only. Everything interactive is one of the two buttons
        below, so this element has no role, no tab stop and no handler.
      */}
      <div
        style={{ width: card.width, height: card.height }}
        onContextMenu={
          onContextMenu === undefined || card.nodeId === null
            ? undefined
            : (event) => {
                event.preventDefault()
                event.stopPropagation()
                onContextMenu(card.nodeId ?? '', event.clientX, event.clientY)
              }
        }
        className={`mbs-canvas-card flex items-center gap-3 rounded-xl border px-4 select-none ${
          card.isFocused
            ? 'border-indigo-400 bg-white ring-2 ring-indigo-400/40 dark:border-indigo-500 dark:bg-neutral-800 dark:ring-indigo-500/30'
            : 'border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800'
        } ${card.isNavigable && !card.isFocused ? 'hover:border-neutral-300 dark:hover:border-neutral-600' : ''}`}
      >
        {/*
          1. The status button.

          It never selects and never navigates, so completing a task cannot
          re-root the canvas out from under the user. The glyph *is* the
          checkbox, exactly as it is in the explorer row — a second indicator
          beside it would draw the same checkbox twice on every task.
        */}
        {canToggle ? (
          <button
            type="button"
            onClick={() => onCycleStatus(card.nodeId ?? '', nextWorkStatus(card.status))}
            title={NEXT_STATUS_LABEL[card.status ?? 'todo'] ?? 'Mark as done'}
            aria-label={`${NEXT_STATUS_LABEL[card.status ?? 'todo'] ?? 'Mark as done'}: ${card.title}`}
            className="-m-1 flex shrink-0 cursor-pointer items-center rounded-md p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700"
          >
            {glyph}
          </button>
        ) : (
          glyph
        )}

        {/*
          2. The navigation button — or, while this card is being renamed, the
          field that replaces it. The rename appears only in the surface the user
          invoked it from, so the same node showing in the explorer keeps its row.
        */}
        {isRenaming ? (
          <InlineRename
            initialValue={card.label ?? ''}
            onCommit={(title) => onCommitRename?.(card.nodeId ?? '', title)}
            onCancel={() => onCancelRename?.()}
            className="h-7 flex-1"
          />
        ) : (
          <button
            type="button"
            disabled={!card.isNavigable || card.isFocused}
            onClick={() => {
              if (card.nodeId !== null) onSelect(card.nodeId)
            }}
            title={card.title}
            aria-current={card.isFocused ? 'true' : undefined}
            /*
             * The cursor is the whole affordance on this surface. A navigable card
             * says "pointer"; the project card and the card you are already on say
             * "default"; and empty canvas keeps React Flow's own grab, because the
             * pane still owns everything that is not a card.
             */
            className={`flex h-full min-w-0 flex-1 flex-col justify-center gap-0.5 text-left ${
              card.isNavigable && !card.isFocused ? 'cursor-pointer' : 'cursor-default'
            }`}
          >
            <span
              className={`truncate text-sm font-medium ${
                isDone
                  ? 'text-neutral-400 line-through dark:text-neutral-500'
                  : 'text-neutral-800 dark:text-neutral-100'
              }`}
            >
              {card.title}
            </span>
            <span className="truncate text-[11px] text-neutral-400 dark:text-neutral-500">
              {card.subtitle}
            </span>
          </button>
        )}
      </div>

      <EdgeAnchor type="source" position={Position.Right} />
    </>
  )
}
