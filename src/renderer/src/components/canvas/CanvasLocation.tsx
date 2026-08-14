/**
 * Where you are in the workspace, and the way back to the top of it.
 *
 * Today it holds exactly one entry — the project — and clicking it clears the
 * selection, which roots the canvas at the project again. That is the whole
 * feature: without it, the project-level canvas is only reachable by restarting,
 * because every other route into the canvas roots it at a node.
 *
 * It is a `<nav>` around an ordered list rather than a bare heading because the
 * intended end state is a breadcrumb — `Music Brain › Album › Production` — and
 * that is a list with more entries in it, not a different component. Ancestors
 * come from `ancestorIdsOf`, which already exists for reveal. Nothing here needs
 * to change shape to get there, which is why the single crumb is built as a
 * crumb rather than as a title that will later be replaced.
 *
 * The project is a real `CanvasRoot` (`{ type: 'project' }`), not a special case
 * bolted on beside node roots — so "go to the top" is the same operation as any
 * other navigation, expressed as a selection change.
 */

import type { JSX } from 'react'

interface CanvasLocationProps {
  /** The project's own name, or the filename when the file does not name itself. */
  projectName: string
  /** Whether the canvas is currently rooted at the project. */
  isAtRoot: boolean
  onGoToRoot: () => void
}

export function CanvasLocation({
  projectName,
  isAtRoot,
  onGoToRoot
}: CanvasLocationProps): JSX.Element {
  return (
    <nav aria-label="Canvas location" className="min-w-0">
      <ol className="flex min-w-0 items-baseline">
        <li className="min-w-0">
          <button
            type="button"
            onClick={onGoToRoot}
            // Marks the crumb as the place you already are. When there are
            // several, this is the one that moves to the end of the list.
            aria-current={isAtRoot ? 'page' : undefined}
            title={isAtRoot ? projectName : `Show all of ${projectName}`}
            /*
             * Reads as a title, behaves as a link: no border, no fill, no
             * padding that would make it look like a control sitting in the
             * header. The underline appears on hover, which is enough of a
             * signal without turning the project's name into a button.
             */
            className="max-w-full cursor-pointer truncate rounded-sm text-sm font-semibold tracking-tight underline-offset-4 hover:underline focus-visible:underline"
          >
            {projectName}
          </button>
        </li>
      </ol>
    </nav>
  )
}
