import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { ExplorerTree } from '@renderer/components/explorer/ExplorerTree'
import { EmptyState } from '@renderer/components/explorer/EmptyState'
import { CanvasView } from '@renderer/components/canvas/CanvasView'
import { CanvasLocation } from '@renderer/components/canvas/CanvasLocation'
import { WorkspaceProvider } from '@renderer/state/WorkspaceProvider'
import { useWorkspace } from '@renderer/state/workspaceContext'
import { EditingProvider } from '@renderer/state/EditingProvider'
import { useEditing } from '@renderer/state/editingContext'
import { ConfirmDiscard } from '@renderer/components/workspace/ConfirmDiscard'
import { SaveState } from '@renderer/components/workspace/SaveState'
import { ReadOnlyBanner } from '@renderer/components/workspace/ReadOnlyBanner'
import { ConflictBanner } from '@renderer/components/workspace/ConflictBanner'
import { NodeContextMenu } from '@renderer/components/editing/NodeContextMenu'
import { AddChildDialog } from '@renderer/components/editing/AddChildDialog'
import { BulkAddDialog } from '@renderer/components/editing/BulkAddDialog'
import { MoveDialog } from '@renderer/components/editing/MoveDialog'
import { Inspector } from '@renderer/components/editing/Inspector'
import { GraphView } from '@renderer/components/graph/GraphView'
import { GraphCrumbs } from '@renderer/components/graph/GraphCrumbs'
import { Icon } from '@renderer/components/graph/GraphArt'
import {
  START_PLACE,
  nodeIdOfKey,
  reconcilePlace,
  revealPlace,
  type GraphPlace
} from '@renderer/components/graph/graphNavigation'

/**
 * Which surface fills the window. The map is the product (R1); the classic
 * Explorer + Canvas split from M005 stays one click away on the rail while R1
 * is being evaluated, so nothing M005 could do becomes unreachable.
 */
type ViewMode = 'map' | 'classic'

/**
 * The whole application: open into a project, see it as a living map, work on
 * it in place.
 *
 * Since milestone 006 the primary surface is the Living Progress Graph. The
 * project is still owned by `WorkspaceProvider` and the open interaction by
 * `EditingProvider`; what lives here is view state that two or more surfaces
 * share — where the map is focused, which surface is showing, and the classic
 * canvas's selection. The Inspector's node (`editing.inspecting`) is the
 * selection on the map, so the context menu, the Explorer drawer and the graph
 * all open the same thing through one value.
 */
function Workspace(): JSX.Element {
  const { state, projection, isDirty, isEditable, commands, createdThisSession } = useWorkspace()
  const editing = useEditing()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<ViewMode>('map')
  const [place, setPlace] = useState<GraphPlace>(START_PLACE)
  const [drawerOpen, setDrawerOpen] = useState(false)
  /** A node created through a dialog, to be revealed once the projection has it. */
  const [pendingReveal, setPendingReveal] = useState<string | null>(null)

  const { endRename, openMenu, openDialog, closeDialog, inspect } = editing

  // A node id addresses a node in one project. Carrying a selection or a place
  // into a different file would point it at something unrelated.
  //
  // Keyed on the token alone. `inspect` changes identity whenever the editing
  // state does, so listing it would reset the map every time a task was
  // selected; the ref reads the current one without subscribing to it.
  const token = state.source?.token
  const inspectRef = useRef(inspect)
  inspectRef.current = inspect
  useEffect(() => {
    setSelectedId(null)
    setPlace(START_PLACE)
    inspectRef.current(null)
  }, [token])

  const index = projection?.index

  // The place as remembered, repaired against the current model — derived during
  // render rather than corrected in an effect, so it is never wrong for a frame.
  const effectivePlace = useMemo(
    () => (index === undefined ? place : reconcilePlace(place, index)),
    [place, index]
  )

  const reveal = useCallback(
    (nodeId: string) => {
      if (index === undefined) return
      const target = revealPlace(index, nodeId)
      setPlace(target.place)
      inspect(target.select)
    },
    [index, inspect]
  )

  /*
   * Follow the selected node when it moves. Moving a task to another branch is
   * an edit the user just made; leaving them looking at the place it left would
   * make it look as though it vanished. A node that no longer exists closes the
   * Inspector instead.
   */
  const inspecting = editing.inspecting
  const lastParent = useRef<{ id: string; parent: string | null } | null>(null)
  useEffect(() => {
    if (index === undefined || inspecting === null) {
      lastParent.current = null
      return
    }
    if (!index.parentIdOf.has(inspecting)) {
      inspect(null)
      return
    }
    const parent = index.parentIdOf.get(inspecting) ?? null
    const previous = lastParent.current
    lastParent.current = { id: inspecting, parent }
    if (
      view === 'map' &&
      previous !== null &&
      previous.id === inspecting &&
      previous.parent !== parent
    ) {
      setPlace(revealPlace(index, inspecting).place)
    }
  }, [index, inspecting, inspect, view])

  useEffect(() => {
    if (pendingReveal === null || index === undefined || !index.byId.has(pendingReveal)) return
    setPendingReveal(null)
    reveal(pendingReveal)
  }, [pendingReveal, index, reveal])

  const isNew = useCallback((id: string) => createdThisSession.has(id), [createdThisSession])

  const switchView = useCallback(
    (next: ViewMode) => {
      if (next === view) return
      if (next === 'classic') {
        setSelectedId(
          inspecting ?? nodeIdOfKey(effectivePlace.unfoldedKey) ?? effectivePlace.focusId
        )
      } else if (selectedId !== null) {
        reveal(selectedId)
      }
      setDrawerOpen(false)
      setView(next)
    },
    [view, inspecting, effectivePlace, selectedId, reveal]
  )

  /** Guards an action that would discard unsaved work. `null` when idle. */
  const [pendingDiscard, setPendingDiscard] = useState<null | 'open' | 'reload'>(null)

  const openProject = useCallback((): void => {
    if (isDirty) setPendingDiscard('open')
    else void commands.openAnotherProject()
  }, [isDirty, commands])

  const reloadProject = useCallback((): void => {
    if (isDirty) setPendingDiscard('reload')
    else void commands.reload()
  }, [isDirty, commands])

  // Ctrl+S / Cmd+S. The same action the header control runs, so there is one
  // save path rather than two that can drift.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== 's' || !(event.ctrlKey || event.metaKey) || event.altKey) return
      event.preventDefault()
      void commands.save()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [commands])

  const commitRename = useCallback(
    (nodeId: string, title: string) => {
      commands.rename(nodeId, title)
      endRename()
    },
    [commands, endRename]
  )

  // Only offered when the project can actually be edited: a read-only file gets
  // no menu and no rename fields rather than controls that quietly do nothing.
  const openExplorerMenu = useCallback(
    (nodeId: string, x: number, y: number) => openMenu({ nodeId, surface: 'explorer', x, y }),
    [openMenu]
  )
  const openCanvasMenu = useCallback(
    (nodeId: string, x: number, y: number) => openMenu({ nodeId, surface: 'canvas', x, y }),
    [openMenu]
  )
  const openGraphMenu = useCallback(
    (nodeId: string | null, x: number, y: number) => {
      if (isEditable) openMenu({ nodeId, surface: 'graph', x, y })
    },
    [openMenu, isEditable]
  )

  // Esc closes the Explorer drawer before it reaches the graph.
  useEffect(() => {
    if (!drawerOpen) return
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape' && editing.menu === null && editing.dialog === null) {
        setDrawerOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [drawerOpen, editing.menu, editing.dialog])

  // Bound to locals so TypeScript narrows them for the whole tree below; a
  // boolean derived from them would not carry that narrowing.
  const source = state.source
  const content = state.content
  const hasProject = projection !== null && source !== null

  const dialog = editing.dialog
  const parentNameOf = (parentId: string | null): string =>
    parentId === null
      ? (projection?.name ?? 'this project')
      : (projection?.index.byId.get(parentId)?.label ?? 'this entry')

  const projectName = projection?.name ?? source?.fileName ?? 'Music Brain'
  const addTarget =
    view === 'map'
      ? (nodeIdOfKey(effectivePlace.unfoldedKey) ?? effectivePlace.focusId)
      : selectedId
  const keyboardBlocked =
    editing.menu !== null ||
    editing.dialog !== null ||
    editing.rename !== null ||
    pendingDiscard !== null ||
    drawerOpen

  return (
    <div className="flex h-screen flex-col bg-white text-neutral-900 dark:bg-[#0d1015] dark:text-neutral-50">
      <header className="flex h-13 shrink-0 items-center gap-3 border-b border-neutral-200 px-4 dark:border-[#1f2630]">
        <span className="flex shrink-0 items-center gap-2 text-[13.5px] font-semibold">
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
            <circle cx="11" cy="11" r="9.2" fill="none" stroke="#56657a" strokeWidth="1.4" />
            <circle cx="11" cy="11" r="3.4" fill="#3ecf8e" />
            <circle cx="17.2" cy="6.6" r="1.8" fill="#aab3c0" />
            <circle cx="5.6" cy="15.4" r="1.8" fill="#aab3c0" />
          </svg>
          <span className="sr-only">Music Brain Studio</span>
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {hasProject && (
            <>
              {view === 'map' ? (
                <h1 className="min-w-0">
                  <GraphCrumbs
                    projectName={projectName}
                    index={projection.index}
                    place={effectivePlace}
                    onPlaceChange={setPlace}
                  />
                </h1>
              ) : (
                <h1 className="min-w-0">
                  <CanvasLocation
                    projectName={projectName}
                    isAtRoot={selectedId === null}
                    onGoToRoot={() => setSelectedId(null)}
                  />
                </h1>
              )}
              <span className="hidden shrink truncate text-xs text-neutral-400 lg:inline dark:text-neutral-500">
                {source.fileName}
              </span>
              <SaveState />
            </>
          )}
        </div>

        {hasProject && isEditable && (
          <button
            type="button"
            // Adds inside whatever is open: the unfolded branch, else the focus.
            onClick={() => openDialog({ kind: 'addChild', parentId: addTarget })}
            className="lpg-btn shrink-0"
          >
            <Icon name="plus" />
            Add
          </button>
        )}

        <button type="button" onClick={openProject} className="lpg-btn lpg-btn-ghost shrink-0">
          Open Project
        </button>
      </header>

      {state.error && (
        <p
          role="alert"
          className="flex shrink-0 items-start gap-3 border-b border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          <span className="min-w-0 flex-1">{state.error}</span>
          <button
            type="button"
            onClick={commands.dismissError}
            className="shrink-0 font-medium underline underline-offset-2"
          >
            Dismiss
          </button>
        </p>
      )}

      {state.hasConflict && <ConflictBanner onReload={reloadProject} />}

      {content?.mode === 'readOnly' && <ReadOnlyBanner reason={content.reason} />}

      {hasProject ? (
        // Keyed by token so opening a different project mounts a fresh surface.
        <main key={token} className="flex min-h-0 flex-1">
          <nav className="lpg-rail" aria-label="Views">
            <button
              type="button"
              aria-pressed={view === 'map' && !drawerOpen}
              aria-label="Map"
              title="Map"
              onClick={() => {
                setDrawerOpen(false)
                switchView('map')
              }}
            >
              <Icon name="map" />
            </button>
            {view === 'map' && (
              <button
                type="button"
                aria-pressed={drawerOpen}
                aria-label="Explorer"
                title="Explorer — the whole tree as a list"
                onClick={() => setDrawerOpen((open) => !open)}
              >
                <Icon name="tree" />
              </button>
            )}
            <span className="flex-1" />
            <button
              type="button"
              aria-pressed={view === 'classic'}
              aria-label="Classic canvas (M005)"
              title="Classic Explorer and Canvas (M005)"
              onClick={() => switchView(view === 'classic' ? 'map' : 'classic')}
              style={{ marginBottom: 10 }}
            >
              <Icon name="cards" />
            </button>
          </nav>

          {view === 'map' ? (
            <div className="relative min-w-0 flex-1">
              <GraphView
                projectName={projectName}
                index={projection.index}
                progress={projection.progress}
                place={effectivePlace}
                onPlaceChange={setPlace}
                selectedId={inspecting}
                onSelect={inspect}
                isEditable={isEditable}
                isNew={isNew}
                isKeyboardBlocked={keyboardBlocked}
                onContextMenu={openGraphMenu}
              />
              {drawerOpen && (
                <div className="lpg-drawer" role="dialog" aria-label="Explorer">
                  <div className="flex shrink-0 items-center justify-between border-b border-[#262e3a] px-3 py-2">
                    <span className="lpg-lbl">Explorer</span>
                    <button
                      type="button"
                      className="lpg-btn lpg-btn-ghost"
                      onClick={() => setDrawerOpen(false)}
                      aria-label="Close Explorer"
                    >
                      <Icon name="close" />
                    </button>
                  </div>
                  <div className="min-h-0 flex-1">
                    <ExplorerTree
                      roots={projection.roots}
                      index={projection.index}
                      selectedId={
                        inspecting ??
                        nodeIdOfKey(effectivePlace.unfoldedKey) ??
                        effectivePlace.focusId
                      }
                      onSelect={reveal}
                      onContextMenu={isEditable ? openExplorerMenu : undefined}
                      renamingId={
                        editing.rename?.surface === 'explorer' ? editing.rename.nodeId : null
                      }
                      onCommitRename={commitRename}
                      onCancelRename={endRename}
                      progress={projection.progress}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* The tree owns its own scrolling — see the reveal effect for why. */}
              <div className="w-1/4 max-w-105 min-w-65 shrink-0 border-r border-neutral-200 dark:border-neutral-800">
                <ExplorerTree
                  roots={projection.roots}
                  index={projection.index}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onContextMenu={isEditable ? openExplorerMenu : undefined}
                  renamingId={editing.rename?.surface === 'explorer' ? editing.rename.nodeId : null}
                  onCommitRename={commitRename}
                  onCancelRename={endRename}
                  progress={projection.progress}
                />
              </div>

              <div className="min-w-0 flex-1 bg-neutral-50 dark:bg-neutral-900">
                <CanvasView
                  index={projection.index}
                  projectName={projection.name}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  progress={projection.progress}
                  // Undefined on a read-only project, so the cards render no status
                  // controls and no menu rather than ones that quietly do nothing.
                  onCycleStatus={isEditable ? commands.setStatus : undefined}
                  onContextMenu={isEditable ? openCanvasMenu : undefined}
                  renamingNodeId={
                    editing.rename?.surface === 'canvas' ? editing.rename.nodeId : null
                  }
                  onCommitRename={commitRename}
                  onCancelRename={endRename}
                />
              </div>
            </>
          )}

          {inspecting !== null && (
            <Inspector
              key={inspecting}
              nodeId={inspecting}
              onClose={() => inspect(null)}
              onReveal={view === 'map' ? reveal : undefined}
            />
          )}
        </main>
      ) : (
        <main className="min-h-0 flex-1 overflow-auto">
          <EmptyState isLoading={state.isLoading} onOpenProject={openProject} />
        </main>
      )}

      <NodeContextMenu />

      {dialog?.kind === 'addChild' && (
        <AddChildDialog
          parentId={dialog.parentId}
          parentName={parentNameOf(dialog.parentId)}
          onClose={closeDialog}
          // Selecting what was just created is what makes capture feel like one
          // action rather than two — and it works because identity is stable.
          // On the map that means revealing it once the projection has it.
          onCreated={(id) => (view === 'map' ? setPendingReveal(id) : setSelectedId(id))}
        />
      )}

      {dialog?.kind === 'bulkAdd' && (
        <BulkAddDialog
          parentId={dialog.parentId}
          parentName={parentNameOf(dialog.parentId)}
          onClose={closeDialog}
          onCreated={(ids) => {
            // On the map the new seeds appear where the user is looking; the
            // place does not move.
            const first = ids[0]
            if (first !== undefined && view === 'classic') setSelectedId(first)
          }}
        />
      )}

      {dialog?.kind === 'move' && <MoveDialog nodeId={dialog.nodeId} onClose={closeDialog} />}

      {pendingDiscard !== null && (
        <ConfirmDiscard
          action={pendingDiscard}
          onCancel={() => setPendingDiscard(null)}
          onSave={async () => {
            const action = pendingDiscard
            const persisted = await commands.save()

            // Closed either way, so that a conflict or write failure is visible
            // in the banner rather than hidden behind this dialog.
            setPendingDiscard(null)

            // The user asked to open or reload and chose to save first, so
            // saving has to be followed by the thing they actually asked for.
            // Only once it is genuinely on disk: a refused save must discard
            // nothing.
            if (persisted) {
              void (action === 'open' ? commands.openAnotherProject() : commands.reload())
            }
          }}
          onDiscard={() => {
            const action = pendingDiscard
            setPendingDiscard(null)
            void (action === 'open' ? commands.openAnotherProject() : commands.reload())
          }}
        />
      )}
    </div>
  )
}

export function App(): JSX.Element {
  return (
    <WorkspaceProvider>
      <EditingProvider>
        <Workspace />
      </EditingProvider>
    </WorkspaceProvider>
  )
}
