/**
 * The file changed on disk after it was loaded, so the save was refused.
 *
 * Two choices, because this milestone does not merge: take what is on disk and
 * lose this window's edits, or keep editing and deal with it later. Offering a
 * third would imply a reconciliation that does not exist.
 *
 * Reload is routed through the caller rather than called directly, so it goes
 * through the same "you have unsaved work" confirmation as everything else that
 * discards.
 */

import type { JSX } from 'react'
import { useWorkspace } from '@renderer/state/workspaceContext'

export function ConflictBanner({ onReload }: { onReload: () => void }): JSX.Element {
  const { commands } = useWorkspace()

  return (
    <div
      role="alert"
      className="flex shrink-0 items-start gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
    >
      <span className="min-w-0 flex-1">
        <strong className="font-medium">This file changed on disk.</strong> Nothing was written, so
        the other version is intact. Reload to take it and lose the changes made here, or keep
        working and save elsewhere later.
      </span>
      <button
        type="button"
        onClick={onReload}
        className="shrink-0 rounded-md border border-amber-400 px-2 py-0.5 text-xs font-medium hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900"
      >
        Reload
      </button>
      <button
        type="button"
        onClick={commands.dismissConflict}
        className="shrink-0 font-medium underline underline-offset-2"
      >
        Dismiss
      </button>
    </div>
  )
}
