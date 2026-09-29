/**
 * Asked before anything that would throw unsaved work away.
 *
 * In-app rather than a native dialog, because nothing is being torn down: the
 * window stays, and an in-app dialog can name precisely which action is waiting.
 * Closing the *window* is the one case that cannot work this way, and the main
 * process handles it instead — see `src/main/closeGuard.ts`. The three choices
 * are deliberately the same three, in the same order, as that native prompt.
 */

import { useEffect, useRef, type JSX } from 'react'

interface ConfirmDiscardProps {
  action: 'open' | 'reload'
  onSave: () => Promise<void>
  onDiscard: () => void
  onCancel: () => void
}

const DESCRIPTION: Record<ConfirmDiscardProps['action'], string> = {
  open: 'Opening another project will discard the changes you have made here.',
  reload: 'Reloading will replace everything here with what is on disk.'
}

export function ConfirmDiscard({
  action,
  onSave,
  onDiscard,
  onCancel
}: ConfirmDiscardProps): JSX.Element {
  const saveRef = useRef<HTMLButtonElement>(null)

  // Focus the safe option, and make Escape mean Cancel — two things a keyboard
  // user expects from a dialog and neither of which a bare div provides.
  useEffect(() => {
    saveRef.current?.focus()

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-discard-title"
        className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-4 shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
      >
        <h2
          id="confirm-discard-title"
          className="text-sm font-medium text-neutral-900 dark:text-neutral-50"
        >
          Save your changes?
        </h2>
        <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-300">
          {DESCRIPTION[action]}
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-neutral-300 px-2.5 py-1 text-sm hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="rounded-md border border-neutral-300 px-2.5 py-1 text-sm hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-700"
          >
            Do not Save
          </button>
          <button
            ref={saveRef}
            type="button"
            onClick={() => void onSave()}
            className="rounded-md bg-neutral-900 px-2.5 py-1 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
