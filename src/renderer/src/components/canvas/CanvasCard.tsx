/**
 * One card on the canvas.
 *
 * A pure function of one `CanvasCardView`: it looks nothing up, resolves no
 * fallback, and contains no conditional that depends on where the card came
 * from. Everything was decided in the view model, which is what stops this
 * component from drifting away from how the explorer draws the same node.
 *
 * It contains no knowledge of any specific node kind, exactly as `ExplorerRow`
 * does not — appearance arrives as data.
 *
 * A real `<button>`, not a div with a click handler: it is the thing you
 * activate, so it should be focusable, keyboard-operable and announced as a
 * control. React Flow's own node focus is switched off in `CanvasView` so that
 * this is the only tab stop per card.
 */

import type { JSX } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useCanvasInteraction } from '@renderer/components/canvas/canvasInteraction'
import type { CanvasFlowNode } from '@renderer/components/canvas/toReactFlow'

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

export function CanvasCard({ data }: NodeProps<CanvasFlowNode>): JSX.Element {
  const { card } = data
  const { onSelect } = useCanvasInteraction()
  const { presentation } = card

  const isDone = card.showsStatus && card.status === 'done'

  return (
    <>
      <EdgeAnchor type="target" position={Position.Left} />

      <button
        type="button"
        // The project card stands for nothing selectable, and the card that is
        // already selected has nowhere to go.
        disabled={!card.isNavigable || card.isFocused}
        onClick={() => {
          if (card.nodeId !== null) onSelect(card.nodeId)
        }}
        title={card.title}
        aria-current={card.isFocused ? 'true' : undefined}
        style={{ width: card.width, height: card.height }}
        /*
         * The cursor is the whole affordance on this surface. A navigable card
         * says "pointer"; the project card and the card you are already on say
         * "default"; and empty canvas keeps React Flow's own grab, because the
         * pane still owns everything that is not a card.
         */
        className={`mbs-canvas-card flex items-center gap-3 rounded-xl border px-4 text-left select-none ${
          card.isNavigable && !card.isFocused ? 'cursor-pointer' : 'cursor-default'
        } ${
          card.isFocused
            ? 'border-indigo-400 bg-white ring-2 ring-indigo-400/40 dark:border-indigo-500 dark:bg-neutral-800 dark:ring-indigo-500/30'
            : 'border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800'
        } ${card.isNavigable && !card.isFocused ? 'hover:border-neutral-300 dark:hover:border-neutral-600' : ''}`}
      >
        {/*
          The icon carries completion, exactly as it does in the explorer row: a
          task's glyph *is* its checkbox. A second completion indicator beside it
          drew the same checkbox twice on every task card, which is the kind of
          duplication only a screenshot shows you. Kinds whose glyph does not
          vary express completion through the struck-through title below.
        */}
        <span className={`shrink-0 [&>svg]:h-5 [&>svg]:w-5 ${presentation.iconClassName}`}>
          <presentation.Icon status={card.showsStatus ? card.status : undefined} />
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
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
            {presentation.name}
          </span>
        </span>
      </button>

      <EdgeAnchor type="source" position={Position.Right} />
    </>
  )
}
