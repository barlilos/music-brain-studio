import { useState, type JSX } from 'react'
import { APP_NAME } from '@shared/constants'
import type { Project } from '@shared/types'
import { TreeView } from '@renderer/components/TreeView'

/**
 * The whole application: open a project file, show its hierarchy.
 *
 * Note that `project.document` is only ever stored and handed to `TreeView`.
 * Nothing here inspects it — that keeps the document model swappable without
 * touching this file.
 */
export function App(): JSX.Element {
  const [project, setProject] = useState<Project | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function openProject(): Promise<void> {
    const result = await window.projectApi.open()

    switch (result.status) {
      case 'canceled':
        // The user dismissed the picker. Leave whatever is on screen alone.
        return
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
  }

  return (
    <div className="flex h-screen flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <header className="flex items-center gap-4 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <h1 className="text-sm font-semibold tracking-tight">{APP_NAME}</h1>
        <button
          type="button"
          onClick={() => void openProject()}
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          Open Project
        </button>
        {project && (
          <span className="truncate text-sm text-neutral-500 dark:text-neutral-400">
            {project.fileName}
          </span>
        )}
      </header>

      {error && (
        <p
          role="alert"
          className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          {error}
        </p>
      )}

      <div className="flex min-h-0 flex-1">
        <section className="flex-1 overflow-auto p-3">
          {project ? (
            // Keyed by path so opening a different project mounts a fresh tree.
            // Without this, nodes at the same position keep the previous
            // document's expansion state, which belongs to a different file.
            <TreeView
              key={project.filePath}
              document={project.document}
              rootLabel={project.fileName}
            />
          ) : (
            <p className="p-2 text-sm text-neutral-500 dark:text-neutral-400">No project open.</p>
          )}
        </section>

        <aside className="flex w-80 items-center justify-center border-l border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Select a node</p>
        </aside>
      </div>
    </div>
  )
}
