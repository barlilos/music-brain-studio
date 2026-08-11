/**
 * The explorer's icon set: one small inline SVG per node kind.
 *
 * Hand-rolled rather than emoji. Emoji render at different sizes and weights on
 * every platform, cannot inherit `currentColor` — so they ignore hover and dark
 * mode — and read as toy-like in a productivity surface. Each of these is a few
 * lines and inherits colour from its row.
 *
 * Nothing here decides which icon a node gets. That mapping lives in
 * `./nodeKinds`, which is the single place the kind vocabulary is written down.
 */

import type { JSX } from 'react'

export interface NodeIconProps {
  className?: string
  /**
   * Completion state of the node being drawn. Only `CheckboxIcon` varies on it;
   * every other icon accepts and ignores it, so the registry can treat all icons
   * as interchangeable.
   */
  isComplete?: boolean | undefined
}

/** Shared frame: 16px, centred, stroked in the row's own colour. */
function Svg({ className, children }: { className?: string; children: JSX.Element }): JSX.Element {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  )
}

export function FolderIcon({ className }: NodeIconProps): JSX.Element {
  return (
    <Svg className={className}>
      <path d="M1.75 4.25v8.5h12.5v-7H8L6.25 3.25h-4.5Z" />
    </Svg>
  )
}

export function LayersIcon({ className }: NodeIconProps): JSX.Element {
  return (
    <Svg className={className}>
      <g>
        <path d="M8 1.75 1.75 5 8 8.25 14.25 5 8 1.75Z" />
        <path d="M1.75 11 8 14.25 14.25 11" />
      </g>
    </Svg>
  )
}

export function CheckboxIcon({ className, isComplete }: NodeIconProps): JSX.Element {
  return (
    <Svg className={className}>
      <g>
        <rect x="2.25" y="2.25" width="11.5" height="11.5" rx="2.5" />
        {isComplete === true && <path d="m5 8.25 2.25 2.25L11 5.75" />}
      </g>
    </Svg>
  )
}

export function DocumentIcon({ className }: NodeIconProps): JSX.Element {
  return (
    <Svg className={className}>
      <g>
        <path d="M3.25 1.75h6l3.5 3.5v9h-9.5v-12.5Z" />
        <path d="M9.25 1.75v3.5h3.5" />
      </g>
    </Svg>
  )
}

export function TargetIcon({ className }: NodeIconProps): JSX.Element {
  return (
    <Svg className={className}>
      <g>
        <circle cx="8" cy="8" r="6.25" />
        <circle cx="8" cy="8" r="2.5" />
      </g>
    </Svg>
  )
}

export function IdeaIcon({ className }: NodeIconProps): JSX.Element {
  return (
    <Svg className={className}>
      <g>
        <path d="M6 12.25a4.25 4.25 0 1 1 4 0" />
        <path d="M6.25 14.25h3.5" />
      </g>
    </Svg>
  )
}

export function LinkIcon({ className }: NodeIconProps): JSX.Element {
  return (
    <Svg className={className}>
      <g>
        <path d="M6.5 9.5a2.5 2.5 0 0 0 3.5 0l2.5-2.5a2.5 2.5 0 0 0-3.5-3.5l-.75.75" />
        <path d="M9.5 6.5a2.5 2.5 0 0 0-3.5 0L3.5 9a2.5 2.5 0 0 0 3.5 3.5l.75-.75" />
      </g>
    </Svg>
  )
}

export function SparkleIcon({ className }: NodeIconProps): JSX.Element {
  return (
    <Svg className={className}>
      <path d="M8 1.75 9.75 6.25 14.25 8 9.75 9.75 8 14.25 6.25 9.75 1.75 8 6.25 6.25 8 1.75Z" />
    </Svg>
  )
}

export function BoxIcon({ className }: NodeIconProps): JSX.Element {
  return (
    <Svg className={className}>
      <g>
        <path d="M2.25 4.75 8 1.75l5.75 3v6.5L8 14.25l-5.75-3v-6.5Z" />
        <path d="M2.25 4.75 8 7.75l5.75-3M8 7.75v6.5" />
      </g>
    </Svg>
  )
}

/**
 * The fallback glyph, for a node whose kind has no registry entry.
 *
 * Deliberately neutral rather than a warning symbol: an unrecognised kind is an
 * ordinary occurrence — the file is the user's, and its vocabulary may grow past
 * ours at any time — not something they need to act on.
 */
export function DotIcon({ className }: NodeIconProps): JSX.Element {
  return (
    <Svg className={className}>
      <circle cx="8" cy="8" r="2.75" />
    </Svg>
  )
}

/** Expand/collapse chevron. Rotated by the row, so it is drawn pointing right. */
export function ChevronIcon({ className }: { className?: string }): JSX.Element {
  return (
    <Svg className={className}>
      <path d="m6.25 3.75 4.5 4.25-4.5 4.25" />
    </Svg>
  )
}
