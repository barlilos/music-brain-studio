/**
 * The menu both editing surfaces open.
 *
 * **One component, rendered once, at application level.** An Explorer row and a
 * Canvas card do not each own a menu — they report where the user right-clicked
 * and which node they meant, and this decides what can be done to it. That is
 * what keeps the two surfaces offering the same actions with the same wording,
 * and it is why neither of them has grown any menu state.
 *
 * Every entry dispatches a workspace command or opens a dialog that does. No
 * item here touches a node directly.
 */

import { useEffect, useLayoutEffect, useRef, useState, type JSX } from 'react'
import { WORK_STATUSES } from '@shared/model/workStatus'
import { useCommands, useWorkspace } from '@renderer/state/workspaceContext'
import { useEditing } from '@renderer/state/editingContext'
import { presentationFor } from '@renderer/components/explorer/nodeKinds'
import { NODE_KIND_OPTIONS } from '@renderer/components/editing/nodeKindOptions'
import { WORK_STATUS_LABELS } from '@renderer/components/editing/workStatusLabels'

/** Keeps the menu on screen when it is opened near an edge. */
const EDGE_MARGIN = 8

function MenuItem({
  label,
  onClick,
  disabled
}: {
  label: string
  onClick: () => void
  disabled?: boolean
}): JSX.Element {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className="block w-full rounded-sm px-2 py-1 text-left text-sm text-neutral-800 hover:bg-neutral-100 disabled:opacity-40 dark:text-neutral-100 dark:hover:bg-neutral-700"
    >
      {label}
    </button>
  )
}

function MenuSeparator(): JSX.Element {
  return <div className="my-1 border-t border-neutral-200 dark:border-neutral-700" />
}

export function NodeContextMenu(): JSX.Element | null {
  const { menu, closeMenu, beginRename, openDialog, inspect } = useEditing()
  const { projection, isEditable } = useWorkspace()
  const commands = useCommands()

  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  /** Which submenu is expanded, if any. */
  const [submenu, setSubmenu] = useState<'type' | 'status' | null>(null)

  const nodeId = menu?.nodeId ?? null
  const node = nodeId === null ? undefined : projection?.index.byId.get(nodeId)

  useEffect(() => {
    setSubmenu(null)
  }, [menu])

  // Dismiss on anything that means "I am doing something else now".
  useEffect(() => {
    if (menu === null) return

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') closeMenu()
    }
    function onPointerDown(event: PointerEvent): void {
      if (!(event.target instanceof Node) || !ref.current?.contains(event.target)) closeMenu()
    }

    window.addEventListener('keydown', onKeyDown)
    // Capture phase, so a click on a card dismisses the menu rather than being
    // swallowed by that card's own handler first.
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('resize', closeMenu)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('resize', closeMenu)
    }
  }, [menu, closeMenu])

  // Measured after layout and before paint, so a menu opened near an edge is
  // never seen in the wrong place first.
  useLayoutEffect(() => {
    if (menu === null || ref.current === null) return

    const { width, height } = ref.current.getBoundingClientRect()
    setPosition({
      x: Math.max(EDGE_MARGIN, Math.min(menu.x, window.innerWidth - width - EDGE_MARGIN)),
      y: Math.max(EDGE_MARGIN, Math.min(menu.y, window.innerHeight - height - EDGE_MARGIN))
    })
  }, [menu, submenu])

  // Nothing is editable on a read-only project, so there is no menu to show.
  if (menu === null || !isEditable) return null

  const name = node?.label ?? (nodeId === null ? 'this project' : 'this entry')
  const carriesStatus = node !== undefined && presentationFor(node.kind).showsStatus

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={`Actions for ${name}`}
      style={{ left: position.x, top: position.y }}
      className="fixed z-50 max-h-[80vh] min-w-52 overflow-auto rounded-md border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
    >
      <MenuItem
        label="Add child…"
        onClick={() => openDialog({ kind: 'addChild', parentId: nodeId })}
      />
      <MenuItem
        label="Add many…"
        onClick={() => openDialog({ kind: 'bulkAdd', parentId: nodeId })}
      />

      {nodeId !== null && node !== undefined && (
        <>
          <MenuSeparator />

          <MenuItem label="Rename" onClick={() => beginRename({ nodeId, surface: menu.surface })} />
          <MenuItem label="Edit details…" onClick={() => inspect(nodeId)} />

          {/*
            Submenus expand in place rather than opening a floating panel. At
            this size a nested panel is more positioning code and more ways to
            end up off-screen, for a list that fits perfectly well in the menu it
            came from.
          */}
          <MenuItem
            label={`Change type ${submenu === 'type' ? '▾' : '▸'}`}
            onClick={() => setSubmenu(submenu === 'type' ? null : 'type')}
          />
          {submenu === 'type' && (
            <div className="pl-2">
              {NODE_KIND_OPTIONS.map((option) => (
                <MenuItem
                  key={option.kind}
                  label={option.kind === node.kind ? `${option.label} ✓` : option.label}
                  onClick={() => {
                    commands.changeType(nodeId, option.kind)
                    closeMenu()
                  }}
                />
              ))}
            </div>
          )}

          {carriesStatus && (
            <>
              <MenuItem
                label={`Status ${submenu === 'status' ? '▾' : '▸'}`}
                onClick={() => setSubmenu(submenu === 'status' ? null : 'status')}
              />
              {submenu === 'status' && (
                <div className="pl-2">
                  {WORK_STATUSES.map((status) => (
                    <MenuItem
                      key={status}
                      label={
                        status === node.status
                          ? `${WORK_STATUS_LABELS[status]} ✓`
                          : WORK_STATUS_LABELS[status]
                      }
                      onClick={() => {
                        commands.setStatus(nodeId, status)
                        closeMenu()
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          <MenuSeparator />
          <MenuItem label="Move to…" onClick={() => openDialog({ kind: 'move', nodeId })} />
        </>
      )}
    </div>
  )
}
