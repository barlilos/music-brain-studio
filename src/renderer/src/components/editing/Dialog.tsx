/**
 * The shell every editing dialog shares: a backdrop, a titled panel, Escape to
 * dismiss, and focus moved inside on open.
 *
 * One shell rather than three, so Add Child, Bulk Add and Move cannot end up
 * with three subtly different ideas of how a dialog behaves.
 */

import { useEffect, useRef, type JSX, type ReactNode } from 'react'

interface DialogProps {
  title: string
  onClose: () => void
  children: ReactNode
  /** Rendered on the right of the footer. Usually Cancel plus a confirm action. */
  footer: ReactNode
  /** Widen for content that needs it, such as a searchable tree. */
  wide?: boolean
}

export function Dialog({ title, onClose, children, footer, wide }: DialogProps): JSX.Element {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // The first focusable thing inside, which is the field the user came to fill.
    panelRef.current?.querySelector<HTMLElement>('input, textarea, select, button')?.focus()

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-6"
      // Clicking the backdrop dismisses; clicking the panel must not.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex max-h-full w-full flex-col rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-800 ${
          wide ? 'max-w-lg' : 'max-w-sm'
        }`}
      >
        <h2 className="shrink-0 px-4 pt-4 text-sm font-medium text-neutral-900 dark:text-neutral-50">
          {title}
        </h2>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">{children}</div>

        <div className="flex shrink-0 justify-end gap-2 px-4 pb-4">{footer}</div>
      </div>
    </div>
  )
}

/** The two button shapes the dialogs use, so they are styled in one place. */
export function DialogButton({
  children,
  onClick,
  primary,
  disabled,
  type = 'button'
}: {
  children: ReactNode
  onClick?: () => void
  primary?: boolean
  disabled?: boolean
  type?: 'button' | 'submit'
}): JSX.Element {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={
        primary
          ? 'rounded-md bg-neutral-900 px-2.5 py-1 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300'
          : 'rounded-md border border-neutral-300 px-2.5 py-1 text-sm hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-600 dark:hover:bg-neutral-700'
      }
    >
      {children}
    </button>
  )
}
