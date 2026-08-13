/**
 * What the application shows when no project is on screen.
 *
 * Two situations reach it, and they need different words. At launch the default
 * project is still being read, and saying "open a project" would be both wrong
 * and briefly alarming. Afterwards, the only way to be here is that the default
 * failed — the error itself is shown in the banner above, so this offers the way
 * out rather than repeating it.
 */

import type { JSX } from 'react'
import { APP_NAME } from '@shared/constants'

interface EmptyStateProps {
  /** Whether the default project is still being read. */
  isLoading: boolean
  onOpenProject: () => void
}

export function EmptyState({ isLoading, onOpenProject }: EmptyStateProps): JSX.Element {
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-neutral-400 dark:text-neutral-500">Opening…</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="space-y-1.5">
        <h2 className="text-base font-medium text-neutral-800 dark:text-neutral-100">{APP_NAME}</h2>
        <p className="max-w-sm text-sm text-neutral-500 dark:text-neutral-400">
          Your areas, projects, tasks and research in one place. Open a project file to start
          browsing.
        </p>
      </div>

      <button
        type="button"
        onClick={onOpenProject}
        className="rounded-md bg-neutral-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
      >
        Open Project
      </button>
    </div>
  )
}
