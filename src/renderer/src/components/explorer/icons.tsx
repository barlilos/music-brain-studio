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
import type { WorkStatus } from '@shared/model/workStatus'

export interface NodeIconProps {
  className?: string
  /**
   * Work state of the node being drawn. Only `CheckboxIcon` varies on it; every
   * other icon accepts and ignores it, so the registry can treat all icons as
   * interchangeable.
   */
  status?: WorkStatus | undefined
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

/**
 * The task glyph, which is also the status control.
 *
 * Three states, drawn so they are distinguishable at 16px and without colour:
 * an empty box, a box with a horizontal bar, a box with a tick. In Progress is a
 * bar rather than a half-fill because a partial fill reads as a rendering
 * artefact at this size, and rather than a dot because a dot is what an
 * indeterminate checkbox means in most toolkits — which this is not.
 */
export function CheckboxIcon({ className, status }: NodeIconProps): JSX.Element {
  return (
    <Svg className={className}>
      <g>
        <rect x="2.25" y="2.25" width="11.5" height="11.5" rx="2.5" />
        {status === 'done' && <path d="m5 8.25 2.25 2.25L11 5.75" />}
        {status === 'in_progress' && <path d="M5 8h6" />}
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

export function GlobeIcon({ className }: NodeIconProps): JSX.Element {
  return (
    <Svg className={className}>
      <g>
        <circle cx="8" cy="8" r="6.25" />
        <path d="M1.75 8h12.5M8 1.75a10 10 0 0 1 0 12.5a10 10 0 0 1 0-12.5" />
      </g>
    </Svg>
  )
}

export function BookIcon({ className }: NodeIconProps): JSX.Element {
  return (
    <Svg className={className}>
      <g>
        <path d="M2.25 2.75h4a2 2 0 0 1 2 2v8a1.5 1.5 0 0 0-1.5-1.5h-4.5v-8.5Z" />
        <path d="M13.75 2.75h-4a2 2 0 0 0-2 2v8a1.5 1.5 0 0 1 1.5-1.5h4.5v-8.5Z" />
      </g>
    </Svg>
  )
}

export function TemplateIcon({ className }: NodeIconProps): JSX.Element {
  return (
    <Svg className={className}>
      <g>
        <rect x="5.25" y="5.25" width="8.5" height="8.5" rx="1.5" />
        <path d="M10.75 5.25v-2a1 1 0 0 0-1-1h-6.5a1 1 0 0 0-1 1v6.5a1 1 0 0 0 1 1h2" />
      </g>
    </Svg>
  )
}

export function FlaskIcon({ className }: NodeIconProps): JSX.Element {
  return (
    <Svg className={className}>
      <g>
        <path d="M6.25 1.75v4.5l-3.5 6a1 1 0 0 0 .85 1.5h8.8a1 1 0 0 0 .85-1.5l-3.5-6v-4.5" />
        <path d="M5.25 1.75h5.5M4.75 10.25h6.5" />
      </g>
    </Svg>
  )
}

export function DecisionIcon({ className }: NodeIconProps): JSX.Element {
  return (
    <Svg className={className}>
      <g>
        <path d="M8 14.25v-5.5" />
        <path d="M8 8.75 3.25 4.5v-2.75M8 8.75l4.75-4.25v-2.75" />
        <circle cx="3.25" cy="1.75" r="0.1" />
      </g>
    </Svg>
  )
}

export function AssetIcon({ className }: NodeIconProps): JSX.Element {
  return (
    <Svg className={className}>
      <g>
        <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="1.5" />
        <path d="m1.75 10.75 3.5-3 3 2.5 2.5-2 3.5 3" />
        <circle cx="5.75" cy="6" r="1" />
      </g>
    </Svg>
  )
}

export function QuestionIcon({ className }: NodeIconProps): JSX.Element {
  return (
    <Svg className={className}>
      <g>
        <circle cx="8" cy="8" r="6.25" />
        <path d="M6.25 6.25a1.75 1.75 0 1 1 1.75 2v1.25" />
        <path d="M8 11.75v.01" />
      </g>
    </Svg>
  )
}

export function ChecklistIcon({ className }: NodeIconProps): JSX.Element {
  return (
    <Svg className={className}>
      <g>
        <path d="m1.75 4.25 1.5 1.5 2.5-2.5M1.75 11.25l1.5 1.5 2.5-2.5" />
        <path d="M8.25 4.25h6M8.25 11.25h6" />
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
