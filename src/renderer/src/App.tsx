import { useCallback, useEffect, useMemo, useState, type JSX } from 'react'
import type { LoadProjectResult, Project } from '@shared/types'
import { toExplorerProject } from '@shared/model/adapter'
import { ExplorerTree } from '@renderer/components/explorer/ExplorerTree'
import { EmptyState } from '@renderer/components/explorer/EmptyState'

/**
 * The whole application: open into a project, then browse it.
 *
 * `project.document` is still opaque here — stored, handed to the adapter, never
 * indexed or type-tested. Milestone 002 kept that discipline by letting only
 * `TreeView` look inside; the rule is unchanged, but the one module allowed to
 * look is now `@shared/model/adapter`, which is a pure function rather than a
 * component.
 */
export function App(): JSX.Element {
  const [project, setProject] = useState<Project | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Starts true because the first load begins before the first paint. Without
  // it the empty state would flash for one frame on every launch.
  const [isLoading, setIsLoading] = useState(true)

  // One pass over the file, at open time rather than on every render.
  const explorer = useMemo(
    () => (project === null ? null : toExplorerProject(project.document)),
    [project]
  )

  /**
   * Applies any outcome that involved actually reading a file.
   *
   * Memoized with no dependencies — every value it closes over is a `useState`
   * setter, and those are stable for the component's lifetime. That is what lets
   * the effect below depend on it honestly and still run exactly once, instead
   * of silencing the dependency rule.
   */
  const applyResult = useCallback((result: LoadProjectResult): void => {
    switch (result.status) {
      case 'opened':
        setProject(result.project)
        setError(null)
        return
      case 'invalid':
        setProject(null)
        setError(`${result.fileName} is not valid JSON. ${result.message}`)
        return
      case 'failed':
        setProject(null)
        setError(result.message)
        return
    }
  }, [])

  // Open straight into the default project rather than onto a picker: the
  // application is single-project for now and is meant to be opened daily.
  useEffect(() => {
    let cancelled = false

    void window.projectApi.loadDefault().then((result) => {
      // The window can be closed mid-read. Setting state on a gone component is
      // harmless in React 19, but skipping it keeps the intent explicit.
      if (cancelled) return
      applyResult(result)
      setIsLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [applyResult])

  async function openProject(): Promise<void> {
    const result = await window.projectApi.open()

    // The user dismissed the picker. Leave whatever is on screen alone.
    if (result.status === 'canceled') return

    applyResult(result)
  }

  return (
    <div className="flex h-screen flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <header className="flex shrink-0 items-center gap-3 border-b border-neutral-200 px-4 py-2.5 dark:border-neutral-800">
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          {project && explorer && (
            <>
              {/*
                The project is named by its contents. The filename is where it
                happens to be stored, so it is demoted rather than titled — a
                project is a thing the user made, not a path.
              */}
              <h1 className="truncate text-sm font-semibold tracking-tight">
                {explorer.name ?? project.fileName}
              </h1>
              <span className="truncate text-xs text-neutral-400 dark:text-neutral-500">
                {project.fileName}
              </span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => void openProject()}
          className="shrink-0 rounded-md border border-neutral-300 px-2.5 py-1 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          Open Project
        </button>
      </header>

      {error && (
        <p
          role="alert"
          className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          {error}
        </p>
      )}

      <main className="min-h-0 flex-1 overflow-auto">
        {explorer ? (
          // Keyed by path so opening a different project mounts a fresh tree.
          // Without this, expansion and selection would carry over to a document
          // where the same node IDs mean something else.
          <ExplorerTree key={project?.filePath} roots={explorer.roots} />
        ) : (
          <EmptyState isLoading={isLoading} onOpenProject={() => void openProject()} />
        )}
      </main>
    </div>
  )
}
