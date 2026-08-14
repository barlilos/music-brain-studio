/**
 * The only module that constructs React Flow types.
 *
 * Deliberately mechanical: it maps fields and does nothing else — no registry
 * lookup, no fallback, no conditional, no decision of any kind. Everything it
 * needs was resolved in the view model.
 *
 * That is the point. Replacing React Flow means writing a new consumer of
 * `CanvasViewModel` and re-skinning one component; nothing above this file
 * changes, because nothing above this file has heard of the library.
 *
 * It is also where `draggable` and `connectable` are pinned to `false`. When
 * editing arrives they become per-card values from the view model, and this
 * stays the single place they are set.
 */

import type { Edge, Node } from '@xyflow/react'
import type { CanvasCardView, CanvasViewModel } from '@renderer/components/canvas/canvasViewModel'

/** The one node type this canvas registers. */
export const CANVAS_CARD_NODE_TYPE = 'canvasCard'

export type CanvasFlowNode = Node<{ card: CanvasCardView }, typeof CANVAS_CARD_NODE_TYPE>

export interface CanvasFlowGraph {
  nodes: CanvasFlowNode[]
  edges: Edge[]
}

/**
 * What the canvas occupies in graph space: every card's identity and position,
 * in order.
 *
 * This is what framing is keyed on. A canvas root is not a promise about what is
 * underneath it — the same root can hold a different set of cards after the file
 * changes on disk, and will after editing exists — so treating "same root, same
 * pane" as "already framed" skips a `fitView` that the new bounds needed.
 *
 * It deliberately carries positions and not content: a renamed card, or a
 * different card wearing the focus ring, changes neither the bounds nor the
 * framing, and moving between sibling leaves must leave the viewport exactly
 * where it is. Positions come from the layout, which is deterministic, so this
 * is stable without consulting the DOM.
 */
export function geometrySignatureOf(nodes: readonly CanvasFlowNode[]): string {
  return nodes.map((node) => `${node.id}@${node.position.x},${node.position.y}`).join('|')
}

export function toReactFlow(viewModel: CanvasViewModel): CanvasFlowGraph {
  const nodes = viewModel.cards.map((card): CanvasFlowNode => ({
    id: card.id,
    type: CANVAS_CARD_NODE_TYPE,
    position: { x: card.x, y: card.y },
    // Dimensions are deliberately **not** set here, even though the view model
    // knows them. Giving React Flow `width`/`height` marks a node as externally
    // sized and puts it on a different path through the library's measurement;
    // in this configuration that path did not complete, leaving nodes without
    // the handle bounds edges are routed between. Leaving the dimensions off
    // keeps React Flow measuring the cards itself, which is the path that works.
    //
    // The card carries the same numbers as an inline style, so what gets
    // measured is exactly what the layout assumed.
    data: { card },
    draggable: false,
    connectable: false,
    selectable: false,
    /*
     * Without this the cards are not clickable at all, and the reason is worth
     * spelling out because nothing about it is visible in the markup.
     *
     * React Flow decides whether a node should receive the pointer with
     * `isSelectable || isDraggable || onNodeClick || onNodeMouseEnter || …`, and
     * writes the answer as an **inline** `pointer-events` on the node wrapper.
     * Every one of those is off here by design — the canvas is read-only and
     * selection is ours — so it concludes the node is decoration and sets
     * `pointer-events: none`. The card inherits it, `.react-flow__pane` wins the
     * hit test underneath, and the whole card reads as empty canvas: grab
     * cursor, drags pan straight through it, clicks never land.
     *
     * `node.style` is spread after that inline value, so setting it here is the
     * supported way to say "these nodes are interactive even though none of your
     * built-in interactions are on". Constant rather than per-card, so this file
     * keeps its property of containing no conditionals: which cards *do*
     * something on click is the card's business, not the hit target's.
     */
    style: { pointerEvents: 'all' },
    /*
     * And `nopan` so that a drag which starts on a card never becomes a canvas
     * pan. React Flow only adds this class itself for draggable nodes, which
     * ours are not. Belt and braces — the node now swallows the pointer anyway —
     * but it states the intent where the pan handler actually looks for it.
     */
    className: 'nopan'
  }))

  const edges = viewModel.connections.map((connection): Edge => ({
    id: connection.id,
    source: connection.fromId,
    target: connection.toId,
    focusable: false,
    selectable: false
  }))

  return { nodes, edges }
}
