/**
 * The marks of the Living Progress Graph, as SVG.
 *
 * One family of shapes at every scale (handoff 003 §3):
 *
 * - To do — a hollow ring.
 * - In progress — half filled, blue.
 * - Done — filled green, with a tick when there is room for one.
 * - New — a dashed amber ring around any of the three.
 *
 * Branches: an open branch has a neutral rim; one with nothing open right now
 * has a green rim (derived, and it reverts when work is added); a Finished one
 * is sealed — a double green rim and a filled seal — because the user said so.
 */

import type { JSX, MouseEvent as ReactMouseEvent } from 'react'
import type { WorkStatus } from '@shared/model/workStatus'
import type { RegionState } from '@shared/model/progress'
import type { BubbleLayout, PodLayout } from '@renderer/components/graph/graphLayout'
import { GRAPH_COLORS } from '@renderer/components/graph/graphColors'

const C = GRAPH_COLORS

interface GlyphProps {
  x?: number
  y?: number
  r: number
  status: WorkStatus
  isNew?: boolean
  /** The colour behind the mark, used to punch out the tick and the hollow. */
  bg?: string
}

/** One status mark, drawn at `x,y` in the current SVG coordinate system. */
export function Glyph({
  x = 0,
  y = 0,
  r,
  status,
  isNew = false,
  bg = C.bg
}: GlyphProps): JSX.Element {
  const sw = r < 3.2 ? 1 : r < 6 ? 1.4 : 1.7
  return (
    <>
      {isNew && (
        <circle
          cx={x}
          cy={y}
          r={r + Math.max(2.2, r * 0.42)}
          fill="none"
          stroke={C.amber}
          strokeWidth={r < 4 ? 1 : 1.4}
          strokeDasharray={r < 4 ? '1.6 1.4' : '2.6 2.2'}
        />
      )}
      {status === 'done' && (
        <>
          <circle cx={x} cy={y} r={r} fill={C.green} />
          {r >= 5.5 && (
            <path
              d={`M${x - r * 0.42} ${y + r * 0.02} L${x - r * 0.1} ${y + r * 0.34} L${x + r * 0.44} ${y - r * 0.3}`}
              fill="none"
              stroke={bg}
              strokeWidth={Math.max(1.4, r * 0.24)}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </>
      )}
      {status === 'in_progress' && (
        <>
          <circle cx={x} cy={y} r={r - sw / 2} fill={bg} stroke={C.blue} strokeWidth={sw} />
          <path d={`M${x} ${y - r} A${r} ${r} 0 0 0 ${x} ${y + r} Z`} fill={C.blue} />
        </>
      )}
      {status === 'todo' && (
        <circle cx={x} cy={y} r={r - sw / 2} fill={bg} stroke={C.todo} strokeWidth={sw} />
      )}
    </>
  )
}

const STATUS_WORDS: Record<WorkStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done'
}

/** A status mark as a standalone inline image — for rows, the legend, the Inspector. */
export function StatusIcon({
  status,
  isNew = false,
  r = 7,
  bg = C.panel,
  decorative = false
}: {
  status: WorkStatus
  isNew?: boolean
  r?: number
  bg?: string
  decorative?: boolean
}): JSX.Element {
  const pad = isNew ? 4 : 1
  const size = (r + pad) * 2
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={
        decorative ? undefined : `${STATUS_WORDS[status]}${isNew ? ', added this session' : ''}`
      }
      style={{ flex: 'none' }}
    >
      <Glyph x={size / 2} y={size / 2} r={r} status={status} isNew={isNew} bg={bg} />
    </svg>
  )
}

/** The Finished seal: a filled disc with a tick and a ring. */
export function FinishedSeal({ x, y, r }: { x: number; y: number; r: number }): JSX.Element {
  return (
    <g pointerEvents="none">
      <circle cx={x} cy={y} r={r} fill={C.green} />
      <circle cx={x} cy={y} r={r + 4} fill="none" stroke={C.green} strokeWidth={1.5} />
      <path
        d={`M${x - r * 0.38} ${y + r * 0.02} L${x - r * 0.1} ${y + r * 0.3} L${x + r * 0.4} ${y - r * 0.28}`}
        fill="none"
        stroke={C.bg}
        strokeWidth={Math.max(2, r * 0.16)}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  )
}

export interface SeedHandlers {
  onEnter: (taskId: string, event: ReactMouseEvent) => void
  onLeave: () => void
}

interface PodArtProps {
  pod: PodLayout
  x: number
  y: number
  radius: number
  spacing: number
  selectedId?: string | null
  handlers?: SeedHandlers
}

function PodArt({ pod, x, y, radius, spacing, selectedId, handlers }: PodArtProps): JSX.Element {
  return (
    <g transform={`translate(${x} ${y})`}>
      {pod.done >= 2 && <circle r={pod.heartR} fill={C.green} opacity={0.12} />}
      {pod.seeds.map((seed) => (
        <g
          key={seed.id}
          className={handlers ? 'lpg-seed lpg-move' : 'lpg-move'}
          style={{ transform: `translate(${seed.x}px, ${seed.y}px)` }}
          onMouseEnter={handlers ? (event) => handlers.onEnter(seed.id, event) : undefined}
          onMouseLeave={handlers?.onLeave}
        >
          {/* Just the mark, slightly enlarged: the gaps between seeds belong to the bubble. */}
          {handlers && (
            <circle className="lpg-seed-hit" r={Math.min(radius + 1.5, spacing * 0.45)} />
          )}
          <Glyph r={radius} status={seed.status} isNew={seed.isNew} />
          {selectedId === seed.id && (
            <circle r={radius + 4.5} fill="none" stroke="#e8ecf1" strokeWidth={1.8} />
          )}
        </g>
      ))}
    </g>
  )
}

interface BubbleArtProps {
  bubble: BubbleLayout
  regionOf: (nodeId: string) => RegionState
  radius: number
  spacing: number
  depth?: number
  selectedId?: string | null
  handlers?: SeedHandlers
  /** Draw the Finished seal on the outermost rim. Off for tiny icons. */
  seal?: boolean
}

/** A branch, drawn recursively at the origin of the current coordinate system. */
export function BubbleArt({
  bubble,
  regionOf,
  radius,
  spacing,
  depth = 0,
  selectedId,
  handlers,
  seal = true
}: BubbleArtProps): JSX.Element {
  const region: RegionState = bubble.nodeId === null ? 'open' : regionOf(bubble.nodeId)
  const finished = region === 'finished'
  const allDone = region === 'nothingOpen'
  const stroke = finished || allDone ? C.green : C.rim

  return (
    <g>
      <circle
        className="lpg-rim"
        r={bubble.R}
        fill={depth === 0 ? C.bubble : C.bubbleInner}
        stroke={stroke}
        strokeWidth={finished ? 2.4 : allDone ? 1.6 : 1.2}
        vectorEffect="non-scaling-stroke"
      />
      {finished && (
        <circle
          r={bubble.R + 5}
          fill="none"
          stroke={C.green}
          strokeWidth={1.2}
          opacity={0.7}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {bubble.inner.map(({ bubble: inner, x, y }) => (
        <g key={inner.nodeId ?? 'loose'} transform={`translate(${x} ${y})`}>
          <BubbleArt
            bubble={inner}
            regionOf={regionOf}
            radius={radius}
            spacing={spacing}
            depth={depth + 1}
            selectedId={selectedId}
            handlers={handlers}
            seal={seal}
          />
        </g>
      ))}
      {bubble.pod !== null && (
        <PodArt
          pod={bubble.pod.layout}
          x={bubble.pod.x}
          y={bubble.pod.y}
          radius={radius}
          spacing={spacing}
          selectedId={selectedId}
          handlers={handlers}
        />
      )}
      {finished && seal && (
        <FinishedSeal x={bubble.R * 0.71} y={-bubble.R * 0.71} r={Math.max(6, radius * 1.5)} />
      )}
    </g>
  )
}

/** A branch as a small fixed-size icon — the seed pod in panel and section headers. */
export function BubbleIcon({
  bubble,
  regionOf,
  size,
  radius,
  spacing
}: {
  bubble: BubbleLayout
  regionOf: (nodeId: string) => RegionState
  size: number
  radius: number
  spacing: number
}): JSX.Element {
  const scale = Math.min(1.6, (size / 2 - 2) / Math.max(bubble.R + 6, 1))
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      style={{ flex: 'none', overflow: 'visible' }}
    >
      <g transform={`translate(${size / 2} ${size / 2}) scale(${scale})`}>
        <BubbleArt
          bubble={bubble}
          regionOf={regionOf}
          radius={radius}
          spacing={spacing}
          seal={size >= 48}
        />
      </g>
    </svg>
  )
}

const ICONS = {
  map: 'M9 6.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 1 0 0-4.8M3.5 2.4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 1 0 0-3.2M14.5 2.9a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 1 0 0-3.2M4 12.9a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 1 0 0-3.2M14.5 12.4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 1 0 0-3.2M5 5.2l2.2 2M12.9 5.6l-2 1.8M5.4 13.3l1.9-2.4M12.9 12.8l-2-2',
  tree: 'M3 3.5h4M5 3.5v9h4M5 8h4M11.5 6.4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 1 0 0-3.2M11.5 10.9a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 1 0 0-3.2',
  cards: 'M2.5 3.5h5v4h-5zM10.5 3.5h5v4h-5zM6.5 10.5h5v4h-5zM5 7.5v1.5h8V7.5M9 9v1.5',
  plus: 'M9 3.5v11M3.5 9h11',
  more: 'M4 8.1a.9.9 0 1 0 0 1.8.9.9 0 1 0 0-1.8M9 8.1a.9.9 0 1 0 0 1.8.9.9 0 1 0 0-1.8M14 8.1a.9.9 0 1 0 0 1.8.9.9 0 1 0 0-1.8',
  move: 'M3 9h11M10.5 5.5L14 9l-3.5 3.5',
  close: 'M4.5 4.5l9 9M13.5 4.5l-9 9',
  expand: 'M3.5 7V3.5H7M11 3.5h3.5V7M14.5 11v3.5H11M7 14.5H3.5V11',
  check: 'M3.5 9.5l3.5 3.5 7.5-8',
  sub: 'M4 3v6.5a2 2 0 0 0 2 2h8.5M11.5 8.5l3 3-3 3',
  flag: 'M4 15.5V3M4 3.5h8.5l-1.8 3 1.8 3H4',
  chevron: 'M7 4l5 5-5 5',
  back: 'M11 4L6 9l5 5',
  details: 'M4 2.8h7l3 3v9.4H4zM6.5 8.5h5M6.5 11.5h3.5'
} as const

export type IconName = keyof typeof ICONS

export function Icon({
  name,
  className = 'lpg-ic'
}: {
  name: IconName
  className?: string
}): JSX.Element {
  return (
    <svg className={className} viewBox="0 0 18 18" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}
