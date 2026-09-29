/**
 * Why this file cannot be edited.
 *
 * Decision R3. A file without stable unique ids, or without the Music Brain node
 * hierarchy, is still worth opening and reading — but editing it would mean
 * inventing structure the user never wrote, and saving it would mean writing
 * that invention back over their file.
 *
 * The wording explains rather than apologises, and says what is still true,
 * because arriving here is a legitimate thing to do rather than a failure.
 */

import type { JSX } from 'react'

export function ReadOnlyBanner({ reason }: { reason: string }): JSX.Element {
  return (
    <p className="shrink-0 border-b border-sky-200 bg-sky-50 px-4 py-2.5 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-100">
      <strong className="font-medium">Read-only.</strong> {reason} Everything here is still
      browsable; editing is available for files with a stable id on every entry.
    </p>
  )
}
