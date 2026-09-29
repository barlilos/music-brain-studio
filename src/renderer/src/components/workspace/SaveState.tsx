/**
 * Whether there is unsaved work, and the way to deal with it.
 *
 * One control rather than an indicator plus a button: while there is nothing to
 * save it is a quiet label, and the moment there is, it becomes the thing you
 * press. A permanently enabled Save button trains people to press it out of
 * anxiety, and a disabled one is a control that mostly does not work.
 */

import type { JSX } from 'react'
import { useWorkspace } from '@renderer/state/workspaceContext'

export function SaveState(): JSX.Element | null {
  const { isDirty, canSave, isEditable, state, commands } = useWorkspace()

  if (!isEditable) return null

  if (state.isSaving) {
    return <span className="shrink-0 text-xs text-neutral-400 dark:text-neutral-500">Saving…</span>
  }

  if (!isDirty) {
    return <span className="shrink-0 text-xs text-neutral-400 dark:text-neutral-500">Saved</span>
  }

  return (
    <button
      type="button"
      onClick={() => void commands.save()}
      disabled={!canSave}
      title="Save (Ctrl+S)"
      className="shrink-0 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 hover:bg-amber-200 disabled:opacity-60 dark:bg-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-900/60"
    >
      Unsaved — Save
    </button>
  )
}
