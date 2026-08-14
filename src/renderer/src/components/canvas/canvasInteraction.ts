/**
 * How a card reaches the selection.
 *
 * A context rather than a callback on the node's `data`, because `data` carries
 * the view model and the view model has to stay pure data — serializable,
 * comparable, and free of anything that changes identity on every render.
 *
 * Its own module rather than an export from `CanvasView`, which imports the card
 * to register it as a node type: putting the context there would make the two
 * files import each other.
 */

import { createContext, use } from 'react'

export interface CanvasInteraction {
  /** Select a node. Called with an `ExplorerNode.id`, never with a card id. */
  onSelect: (nodeId: string) => void
}

const NO_INTERACTION: CanvasInteraction = { onSelect: () => {} }

export const CanvasInteractionContext = createContext<CanvasInteraction>(NO_INTERACTION)

export function useCanvasInteraction(): CanvasInteraction {
  return use(CanvasInteractionContext)
}
