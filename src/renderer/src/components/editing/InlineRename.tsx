/**
 * Renaming, in place, in whichever surface asked for it.
 *
 * Enter commits, Escape cancels, and blurring commits — the last because
 * clicking away from a field you have just typed into means "keep it" far more
 * often than it means "throw it away", and Escape is right there for the other
 * case.
 *
 * An empty or unchanged title is treated as a cancel rather than an error. The
 * mutation layer would reject an empty one anyway; catching it here means the
 * user gets no error banner for what was obviously a change of mind.
 */

import { useEffect, useRef, useState, type JSX } from 'react'

interface InlineRenameProps {
  initialValue: string
  onCommit: (title: string) => void
  onCancel: () => void
  className?: string
}

export function InlineRename({
  initialValue,
  onCommit,
  onCancel,
  className
}: InlineRenameProps): JSX.Element {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)
  // Guards against `onBlur` firing after Enter or Escape has already settled it.
  const settled = useRef(false)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  function commit(): void {
    if (settled.current) return
    settled.current = true

    const title = value.trim()
    if (title.length === 0 || title === initialValue) onCancel()
    else onCommit(title)
  }

  function cancel(): void {
    if (settled.current) return
    settled.current = true
    onCancel()
  }

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        // Stopped here so a rename in a Canvas card does not also reach the
        // application's Ctrl+S handler or React Flow's own key handling.
        event.stopPropagation()
        if (event.key === 'Enter') commit()
        else if (event.key === 'Escape') cancel()
      }}
      // The surrounding row or card is a click target; typing in the field must
      // not select or navigate.
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      aria-label="Rename"
      className={`min-w-0 rounded-sm border border-indigo-400 bg-white px-1 text-sm text-neutral-900 outline-none dark:border-indigo-500 dark:bg-neutral-900 dark:text-neutral-50 ${className ?? ''}`}
    />
  )
}
