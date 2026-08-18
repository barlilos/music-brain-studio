import { useCallback, useEffect, useState, type JSX } from 'react'
import { ExplorerTree } from '@renderer/components/explorer/ExplorerTree'
import { EmptyState } from '@renderer/components/explorer/EmptyState'
import { CanvasView } from '@renderer/components/canvas/CanvasView'
import { CanvasLocation } from '@renderer/components/canvas/CanvasLocation'
import { WorkspaceProvider } from '@renderer/state/WorkspaceProvider'
import { useWorkspace } from '@renderer/state/workspaceContext'
import { ConfirmDiscard } from '@renderer/components/workspace/ConfirmDiscard'
import { SaveState } from '@renderer/components/workspace/SaveState'
import { ReadOnlyBanner } from '@renderer/components/workspace/ReadOnlyBanner'
import { ConflictBanner } from '@renderer/components/workspace/ConflictBanner'

/**
 * The whole application: open into a project, find things in the explorer, work
 * on them in the canvas.
 *
 * The canvas is the primary workspace and the explorer is a navigation aid,
 * which is why the split is 25 / 75 and why selection is owned here rather than
 * by the tree — two views read it, and both may set it.
 *
 * Since milestone 005 the *project* is owned by `WorkspaceProvider` rather than
 * by this component, and no component below sees a document, a token or a file
 * at all. What stays here is what is genuinely view state and shared by both
 * panes: which node is selected. Explorer expansion stays in the tree, and the
 * canvas root is derived rather than stored — three separate concepts, three
 * separate owners, exactly as before.
 */
function Workspace(): JSX.Element {
  const { state, projection, isDirty, isEditable, commands } = useWorkspace()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // A node id addresses a node in one project. Carrying a selection into a
  // different file would point it at something unrelated.
  const token = state.source?.token
  useEffect(() => {
    setSelectedId(null)
  }, [token])

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

  // Ctrl+S / Cmd+S. The same action the header button runs, so there is one
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

  // Bound to locals so TypeScript narrows them for the whole tree below; a
  // boolean derived from them would not carry that narrowing.
  const source = state.source
  const content = state.content
  const hasProject = projection !== null && source !== null

  return (
    <div className="flex h-screen flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <header className="flex shrink-0 items-center gap-3 border-b border-neutral-200 px-4 py-2.5 dark:border-neutral-800">
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          {hasProject && (
            <>
              {/*
                The project is named by its contents. The filename is where it
                happens to be stored, so it is demoted rather than titled — a
                project is a thing the user made, not a path.

                The name is also the way back to the project-level canvas, which
                is otherwise reachable only at startup.
              */}
              <h1 className="min-w-0">
                <CanvasLocation
                  projectName={projection.name ?? source.fileName}
                  isAtRoot={selectedId === null}
                  onGoToRoot={() => setSelectedId(null)}
                />
              </h1>
              <span className="truncate text-xs text-neutral-400 dark:text-neutral-500">
                {source.fileName}
              </span>
              <SaveState />
            </>
          )}
        </div>

        <button
          type="button"
          onClick={openProject}
          className="shrink-0 rounded-md border border-neutral-300 px-2.5 py-1 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
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
        // The split only appears once there is a project. Splitting the window
        // before there is anything to put in either half would advertise two
        // empty things instead of one.
        //
        // Keyed by token so opening a different project mounts a fresh tree and
        // a fresh canvas. Without it, expansion would carry over to a document
        // where the same node ids mean something else.
        <main key={token} className="flex min-h-0 flex-1">
          {/* The tree owns its own scrolling — see the reveal effect for why. */}
          <div className="w-1/4 max-w-105 min-w-65 shrink-0 border-r border-neutral-200 dark:border-neutral-800">
            <ExplorerTree
              roots={projection.roots}
              index={projection.index}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>

          <div className="min-w-0 flex-1 bg-neutral-50 dark:bg-neutral-900">
            <CanvasView
              index={projection.index}
              projectName={projection.name}
              selectedId={selectedId}
              onSelect={setSelectedId}
              // Undefined on a read-only project, so the cards render no status
              // controls at all rather than controls that quietly do nothing.
              onCycleStatus={isEditable ? commands.setStatus : undefined}
            />
          </div>
        </main>
      ) : (
        <main className="min-h-0 flex-1 overflow-auto">
          <EmptyState isLoading={state.isLoading} onOpenProject={openProject} />
        </main>
      )}

      {pendingDiscard !== null && (
        <ConfirmDiscard
          action={pendingDiscard}
          onCancel={() => setPendingDiscard(null)}
          onSave={async () => {
            await commands.save()
            setPendingDiscard(null)
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
      <Workspace />
    </WorkspaceProvider>
  )
}
