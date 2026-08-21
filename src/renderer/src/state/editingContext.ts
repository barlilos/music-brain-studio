/**
 * Which editing interaction is currently open, and how to open one.
 *
 * This is view state, not project state: a menu position, which row is being
 * renamed, which dialog is up. None of it survives a reload and none of it
 * belongs in the workspace reducer, which is about the model and the file.
 *
 * It exists as one shared context because the *same* interactions are reachable
 * from two surfaces. An Explorer row and a Canvas card open the same menu, which
 * runs the same commands — so the menu is rendered once at application level and
 * told which node it is about, rather than each surface growing its own copy
 * that can drift.
 *
 * `surface` is carried because one interaction genuinely differs between the
 * two: renaming happens inline, in whichever view the user invoked it from.
 */

import { createContext, use } from 'react'
import type { NodeId } from '@shared/model/project'

/** Which view an interaction was invoked from. */
export type EditingSurface = 'explorer' | 'canvas'

/** A menu target. `nodeId` is `null` for the project itself. */
export interface MenuTarget {
  nodeId: NodeId | null
  surface: EditingSurface
  x: number
  y: number
}

export interface RenameTarget {
  nodeId: NodeId
  surface: EditingSurface
}

/** The dialogs, each anchored to the node it acts on. */
export type DialogTarget =
  | { kind: 'addChild'; parentId: NodeId | null }
  | { kind: 'bulkAdd'; parentId: NodeId | null }
  | { kind: 'move'; nodeId: NodeId }

export interface EditingContextValue {
  menu: MenuTarget | null
  rename: RenameTarget | null
  dialog: DialogTarget | null
  /** The node whose details are open in the Inspector, if any. */
  inspecting: NodeId | null

  openMenu: (target: MenuTarget) => void
  closeMenu: () => void
  beginRename: (target: RenameTarget) => void
  endRename: () => void
  openDialog: (target: DialogTarget) => void
  closeDialog: () => void
  inspect: (nodeId: NodeId | null) => void
}

export const EditingContext = createContext<EditingContextValue | null>(null)

export function useEditing(): EditingContextValue {
  const value = use(EditingContext)
  if (value === null) throw new Error('useEditing must be used inside an EditingProvider')
  return value
}

/**
 * Whether this surface should render an inline rename field for this node.
 *
 * Both surfaces can show the same node at the same time, so "am I being
 * renamed" is not enough — the field has to appear where the user asked for it.
 */
export function isRenaming(
  rename: RenameTarget | null,
  nodeId: NodeId,
  surface: EditingSurface
): boolean {
  return rename !== null && rename.nodeId === nodeId && rename.surface === surface
}
