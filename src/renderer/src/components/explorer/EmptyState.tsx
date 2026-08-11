/**
 * What the application shows before a project is open.
 *
 * This is the first screen of every session, so it does more than report the
 * absence of a project: it says what the application is for and offers the one
 * action available. Milestone 002's version was the line "No project open.",
 * which is accurate and teaches nothing.
 */

import type { JSX } from 'react'
import { APP_NAME } from '@shared/constants'

interface EmptyStateProps {
  onOpenProject: () => void
}

export function EmptyState({ onOpenProject }: EmptyStateProps): JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="space-y-1.5">
        <h2 className="text-base font-medium text-neutral-800 dark:text-neutral-100">{APP_NAME}</h2>
        <p className="max-w-sm text-sm text-neutral-500 dark:text-neutral-400">
          Your areas, projects, tasks and research in one place. Open a project to start browsing.
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
