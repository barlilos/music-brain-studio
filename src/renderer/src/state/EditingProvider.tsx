/**
 * Holds the open editing interaction. See `./editingContext` for why it is
 * shared rather than per-surface.
 *
 * Deliberately thin: it stores four pieces of view state and nothing else. Every
 * actual change to the project goes through the workspace commands, so nothing
 * here can alter a node.
 */

import { useMemo, useState, type JSX, type ReactNode } from 'react'
import type { NodeId } from '@shared/model/project'
import {
  EditingContext,
  type DialogTarget,
  type EditingContextValue,
  type MenuTarget,
  type RenameTarget
} from '@renderer/state/editingContext'

export function EditingProvider({ children }: { children: ReactNode }): JSX.Element {
  const [menu, setMenu] = useState<MenuTarget | null>(null)
  const [rename, setRename] = useState<RenameTarget | null>(null)
  const [dialog, setDialog] = useState<DialogTarget | null>(null)
  const [inspecting, setInspecting] = useState<NodeId | null>(null)

  const value = useMemo<EditingContextValue>(
    () => ({
      menu,
      rename,
      dialog,
      inspecting,

      // Opening any one of these closes the menu that launched it, so a menu is
      // never left hanging over the dialog it opened.
      openMenu: setMenu,
      closeMenu: () => setMenu(null),
      beginRename: (target) => {
        setMenu(null)
        setRename(target)
      },
      endRename: () => setRename(null),
      openDialog: (target) => {
        setMenu(null)
        setDialog(target)
      },
      closeDialog: () => setDialog(null),
      inspect: (nodeId) => {
        setMenu(null)
        setInspecting(nodeId)
      }
    }),
    [menu, rename, dialog, inspecting]
  )

  return <EditingContext value={value}>{children}</EditingContext>
}
