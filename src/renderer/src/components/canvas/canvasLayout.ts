/**
 * Where the cards go.
 *
 * **The layout is deterministic. The same canvas root always produces the same
 * layout, to the pixel, always.** That is a UX property rather than an
 * implementation detail: a workspace whose contents shift between visits does
 * not feel like a place, and the canvas's promise of spatial continuity is
 * worthless if the destination moves.
 *
 * Six things this function therefore never does:
 *
 * - **No randomness, no time, no counters.** Output is a function of the graph.
 * - **No measurement.** Card dimensions are constants, never read from the DOM.
 *   This is the real reason cards are a fixed height and titles do not wrap — a
 *   measured layout depends on font loading, and font loading is a race.
 * - **No viewport dependency.** Positions are graph-space. Resizing the window
 *   changes what is framed, never where a card is.
 * - **No sorting.** Children keep model order, which is file order, which is the
 *   order the explorer shows. Sorting would reorder cards when data changes and
 *   would put the two views in different orders for the same node.
 * - **No dependence on the previous layout.** Nothing is nudged or carried over,
 *   so navigating away and back reproduces the identical result rather than an
 *   equivalent one.
 * - **No dependence on focus.** The ring is a view-model concern, so every
 *   selection that resolves to one canvas root lays out identically — which is
 *   what makes moving between siblings move nothing at all.
 *
 * Pure, and free of React so it can be reasoned about on its own.
 */

import type { CanvasCard, CanvasGraph, CanvasLink } from '@shared/model/canvas'

/** Card geometry. Constants rather than measurements — see the note above. */
export const CARD_WIDTH = 280
export const CARD_HEIGHT = 72

/** Vertical space between two children, and therefore the column's pitch. */
const CARD_GAP = 12
export const CARD_PITCH = CARD_HEIGHT + CARD_GAP

/** Horizontal space between the root card and the column of children. */
const COLUMN_GAP = 140

export interface CardPlacement {
  card: CanvasCard
  x: number
  y: number
}

export interface CanvasLayout {
  placements: CardPlacement[]
  links: readonly CanvasLink[]
  focusedId: string | null
}

/**
 * Root on the left, vertically centred against a single column of children on
 * the right.
 *
 * Left-to-right because vertical stacking is what fits a landscape pane: a row
 * of fourteen 280px cards is 4,000px wide and unreadable at any zoom, while a
 * column of them is scannable exactly the way the explorer is.
 *
 * The column is not wrapped when it grows tall. Exactly one node in the
 * reference file has enough children to overflow, and routing edges into a
 * second column means crossing the first — trading a legibility problem for an
 * edge-crossing problem. A tall column is a list, and lists are made to be
 * scrolled.
 */
export function layoutCanvas(graph: CanvasGraph): CanvasLayout {
  const { rootCard, children, links, focusedId } = graph

  const columnX = CARD_WIDTH + COLUMN_GAP

  // Centre the root against the column. `(n - 1) * PITCH / 2` is the distance
  // from the first child's top to the column's vertical middle, less half a
  // card — and PITCH is even, so this never lands on a half pixel.
  const rootY = children.length === 0 ? 0 : ((children.length - 1) * CARD_PITCH) / 2

  const placements: CardPlacement[] = [{ card: rootCard, x: 0, y: rootY }]

  children.forEach((card, index) => {
    placements.push({ card, x: columnX, y: index * CARD_PITCH })
  })

  return { placements, links, focusedId }
}
