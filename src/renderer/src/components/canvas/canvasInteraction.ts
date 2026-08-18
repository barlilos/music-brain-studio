/**
 * What a card can do, and how it reaches the rest of the application.
 *
 * A context rather than callbacks on the node's `data`, because `data` carries
 * the view model and the view model has to stay pure data — serializable,
 * comparable, and free of anything that changes identity on every render.
 *
 * Its own module rather than an export from `CanvasView`, which imports the card
 * to register it as a node type: putting the context there would make the two
 * files import each other.
 *
 * Note what is *not* here. The canvas has no idea that a mutation layer, a file
 * or an unsaved-changes flag exist; it is handed two callbacks and calls them.
 * That is what keeps persistence knowledge out of the canvas entirely.
 */

import { createContext, use } from 'react'
import type { WorkStatus } from '@shared/model/workStatus'

export interface CanvasInteraction {
  /** Select a node. Called with an `ExplorerNode.id`, never with a card id. */
  onSelect: (nodeId: string) => void
  /**
   * Set a node's work state. Absent when the project cannot be edited, which is
   * how a read-only file ends up with no status controls at all rather than with
   * controls that quietly do nothing.
   */
  onCycleStatus?: (nodeId: string, status: WorkStatus) => void
}

const NO_INTERACTION: CanvasInteraction = { onSelect: () => {} }

export const CanvasInteractionContext = createContext<CanvasInteraction>(NO_INTERACTION)

export function useCanvasInteraction(): CanvasInteraction {
  return use(CanvasInteractionContext)
}
