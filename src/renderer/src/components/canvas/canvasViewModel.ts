/**
 * How the canvas looks — everything resolved, nothing left to decide.
 *
 * This is the presentation model the rendering library consumes. It sits between
 * the domain (`CanvasGraph`), the geometry (`CanvasLayout`) and React Flow, and
 * it exists so that neither of the two layers below it has anything to work out:
 *
 * - `toReactFlow` becomes a mechanical field mapping with no lookups and no
 *   conditionals, which is what makes replacing the rendering library a job in
 *   one file rather than a rewrite.
 * - `CanvasCard` becomes a pure function of one object. It performs no registry
 *   lookup and applies no fallback, so it cannot drift from the explorer's
 *   rendering of the same node.
 *
 * The kind registry is consulted here, once per card per canvas, and nowhere
 * below. That keeps the guarantee that no `switch` on kind exists outside
 * `nodeKinds.ts`.
 *
 * Renderer rather than `shared/` because it holds registry entries, which carry
 * React component references — `tsconfig.node.json` has no DOM lib and would
 * reject them. It holds component *references*, never JSX, so it stays a data
 * structure. Pure, and free of both React and React Flow.
 */

import type { WorkStatus } from '@shared/model/workStatus'
import { presentationFor, type NodeKindPresentation } from '@renderer/components/explorer/nodeKinds'
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  type CanvasLayout
} from '@renderer/components/canvas/canvasLayout'

export interface CanvasCardView {
  id: string
  /** `null` when the card is not a knowledge-base node — the project card. */
  nodeId: string | null
  x: number
  y: number
  width: number
  height: number
  /** Already resolved: the placeholder has been applied, so never `undefined`. */
  title: string
  /** The registry entry, looked up once. No consumer resolves a kind again. */
  presentation: NodeKindPresentation
  /** Whether to draw work state at all, and what to draw. Both pre-decided. */
  showsStatus: boolean
  status: WorkStatus | undefined
  isFocused: boolean
  /** False for the project card, which stands for nothing selectable. */
  isNavigable: boolean
}

export interface CanvasConnectionView {
  id: string
  fromId: string
  toId: string
}

export interface CanvasViewModel {
  cards: CanvasCardView[]
  connections: CanvasConnectionView[]
}

export function toCanvasViewModel(layout: CanvasLayout): CanvasViewModel {
  const cards = layout.placements.map(({ card, x, y }): CanvasCardView => {
    const presentation = presentationFor(card.kind)

    return {
      id: card.id,
      nodeId: card.nodeId,
      x,
      y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      // An untitled node still needs something identifiable, and the kind
      // supplies it — the same placeholder the explorer row uses, because the
      // two views must never call one node by two names.
      title: card.label ?? `Untitled ${presentation.name.toLowerCase()}`,
      presentation,
      // The registry decides whether a kind carries work state; the node decides
      // whether it said anything. A stray `active` on a domain sprouts no
      // checkbox.
      showsStatus: presentation.showsStatus && card.status !== undefined,
      status: card.status,
      isFocused: card.id === layout.focusedId,
      isNavigable: card.nodeId !== null
    }
  })

  const connections = layout.links.map((link): CanvasConnectionView => ({
    id: link.id,
    fromId: link.fromId,
    toId: link.toId
  }))

  return { cards, connections }
}
