/**
 * Geometry for the Living Progress Graph: seeds, bubbles and constellations.
 *
 * Pure arithmetic over an already-adapted tree — no React, no DOM — so every
 * shape on screen is a deterministic function of the model. The same tree
 * always produces the same picture, which is what lets a user remember where a
 * branch lives between sessions. There is no force simulation anywhere.
 *
 * Three shapes, one at each scale:
 *
 * - A **seed** is one piece of work. Seeds sit on a sunflower spiral (Vogel's
 *   model, golden angle), sorted Done first, so completed work gathers at the
 *   centre as a green heart and new work lands on the rim. Discovery makes a
 *   pod bigger; it never moves the heart.
 * - A **bubble** is a branch: its sub-branches packed inside it as smaller
 *   bubbles, plus a pod of the work that sits directly in it.
 * - A **constellation** is one focused node: a hub with its children's bubbles
 *   arranged on a ring around it, in the user's order, starting at twelve
 *   o'clock.
 *
 * World units are arbitrary; `fitToRect` maps them to the pane.
 */

import type { ExplorerNode } from '@shared/model/node'
import type { WorkStatus } from '@shared/model/workStatus'

/** Golden angle in radians — consecutive seeds never line up. */
const GOLDEN_ANGLE = 2.399963

/** How densely seeds and bubbles are drawn at one level. */
export interface SeedSpec {
  /** Distance between neighbouring seeds. */
  spacing: number
  /** Radius of one seed. */
  radius: number
  /** Space between a bubble's rim and what is inside it. */
  pad: number
  /** Space between sibling bubbles packed inside a parent. */
  gap: number
}

/**
 * Whether a node is a piece of work — a seed — rather than a branch.
 *
 * The same rule `summarizeProgress` counts by: a leaf that carries a recognised
 * status. Using one rule for both is what keeps the number of seeds on screen
 * equal to the counts printed beside them. An empty project or area has no
 * status, so it is drawn as an empty bubble waiting for its first task.
 */
export function isWorkItem(node: ExplorerNode): boolean {
  return node.children.length === 0 && node.status !== undefined
}

/** Every piece of work at or below `node`, in tree order. */
export function workUnder(node: ExplorerNode): ExplorerNode[] {
  const out: ExplorerNode[] = []
  const visit = (n: ExplorerNode): void => {
    if (isWorkItem(n)) out.push(n)
    for (const child of n.children) visit(child)
  }
  for (const child of node.children) visit(child)
  return out
}

// ------------------------------------------------------------------- seeds

export interface SeedPlacement {
  id: string
  status: WorkStatus
  isNew: boolean
  /** Relative to the pod's centre. */
  x: number
  y: number
}

export interface PodLayout {
  /** Radius that contains every seed. 0 for an empty pod. */
  r: number
  seeds: SeedPlacement[]
  done: number
  /** Radius of the soft green disc behind the Done seeds. */
  heartR: number
}

/**
 * Done first, then In progress, then To do, then work added this session.
 * Ties keep the user's order, so the spiral is stable between renders.
 */
function rank(status: WorkStatus, isNew: boolean): number {
  if (status === 'done') return 0
  if (status === 'in_progress') return 1
  return isNew ? 3 : 2
}

export function podOf(
  items: readonly ExplorerNode[],
  spec: SeedSpec,
  isNew: (id: string) => boolean
): PodLayout {
  const c = 0.56 * spec.spacing
  const ordered = items
    .map((node, index) => ({
      node,
      index,
      status: node.status ?? 'todo',
      fresh: isNew(node.id)
    }))
    .sort((a, b) => rank(a.status, a.fresh) - rank(b.status, b.fresh) || a.index - b.index)

  const seeds = ordered.map(({ node, status, fresh }, k): SeedPlacement => {
    const rr = c * Math.sqrt(k + 0.5)
    const angle = k * GOLDEN_ANGLE - Math.PI / 2
    return { id: node.id, status, isNew: fresh, x: Math.cos(angle) * rr, y: Math.sin(angle) * rr }
  })

  const done = seeds.filter((seed) => seed.status === 'done').length

  return {
    r: items.length > 0 ? c * Math.sqrt(items.length) + spec.radius : 0,
    seeds,
    done,
    heartR: done > 0 ? c * Math.sqrt(done) + spec.radius * 1.6 : 0
  }
}

// ----------------------------------------------------------------- packing

interface Packed {
  positions: { x: number; y: number }[]
  /** Radius of the smallest circle about the origin containing everything. */
  R: number
}

/**
 * Packs circles around the origin, largest first, each at the nearest free spot
 * on an outward spiral. Deterministic, and a few dozen lines rather than a
 * dependency. Recentred on the bounding box so the parent bubble is snug.
 */
export function packCircles(radii: readonly number[], gap: number): Packed {
  if (radii.length === 0) return { positions: [], R: 0 }

  const order = radii.map((r, i) => ({ r, i })).sort((a, b) => b.r - a.r || a.i - b.i)
  const placed: { i: number; x: number; y: number; r: number }[] = []

  for (const { r, i } of order) {
    if (placed.length === 0) {
      placed.push({ i, x: 0, y: 0, r })
      continue
    }
    let found: { x: number; y: number } | null = null
    for (let d = 1; found === null && d < 20000; d += 1.5) {
      const steps = Math.max(12, Math.round(d / 2))
      for (let k = 0; k < steps; k++) {
        const a = (k / steps) * Math.PI * 2 + d * 0.013
        const x = Math.cos(a) * d
        const y = Math.sin(a) * d
        if (placed.every((p) => Math.hypot(p.x - x, p.y - y) >= p.r + r + gap)) {
          found = { x, y }
          break
        }
      }
    }
    placed.push({ i, r, ...(found ?? { x: 0, y: 0 }) })
  }

  const minX = Math.min(...placed.map((p) => p.x - p.r))
  const maxX = Math.max(...placed.map((p) => p.x + p.r))
  const minY = Math.min(...placed.map((p) => p.y - p.r))
  const maxY = Math.max(...placed.map((p) => p.y + p.r))
  const ox = (minX + maxX) / 2
  const oy = (minY + maxY) / 2

  const positions: { x: number; y: number }[] = []
  for (const p of placed) positions[p.i] = { x: p.x - ox, y: p.y - oy }

  const R = Math.max(...placed.map((p) => Math.hypot(p.x - ox, p.y - oy) + p.r))
  return { positions, R }
}

// ----------------------------------------------------------------- bubbles

export interface BubbleLayout {
  /** The branch this bubble stands for; `null` for a loose pod of tasks. */
  nodeId: string | null
  R: number
  inner: { bubble: BubbleLayout; x: number; y: number }[]
  pod: { layout: PodLayout; x: number; y: number } | null
}

/**
 * A branch as a bubble.
 *
 * `depth` is how many levels of sub-branches are drawn as nested bubbles. Below
 * that, everything underneath is gathered into one pod — so a dense branch
 * reads as one mass of seeds rather than as hundreds of tiny circles.
 */
export function bubbleOf(
  node: ExplorerNode,
  spec: SeedSpec,
  depth: number,
  isNew: (id: string) => boolean
): BubbleLayout {
  const branches = node.children.filter((child) => !isWorkItem(child))
  const direct = node.children.filter(isWorkItem)
  const nest = depth > 0 && branches.length > 0

  if (!nest) {
    const pod = podOf(workUnder(node), spec, isNew)
    const R = Math.max(pod.r + spec.pad, spec.spacing * 1.6)
    return {
      nodeId: node.id,
      R,
      inner: [],
      pod: pod.seeds.length > 0 ? { layout: pod, x: 0, y: 0 } : null
    }
  }

  const inner = branches.map((branch) => bubbleOf(branch, spec, depth - 1, isNew))
  const loose = direct.length > 0 ? podOf(direct, spec, isNew) : null
  const radii = inner.map((b) => b.R)
  if (loose !== null) radii.push(loose.r + 2)

  const packed = packCircles(radii, spec.gap)
  const at = (i: number): { x: number; y: number } => packed.positions[i] ?? { x: 0, y: 0 }

  return {
    nodeId: node.id,
    R: packed.R + spec.pad,
    inner: inner.map((bubble, i) => ({ bubble, ...at(i) })),
    pod: loose === null ? null : { layout: loose, ...at(inner.length) }
  }
}

/** The work sitting directly in a focused node, drawn as one bubble of its own. */
export function looseBubbleOf(
  items: readonly ExplorerNode[],
  spec: SeedSpec,
  isNew: (id: string) => boolean
): BubbleLayout {
  const pod = podOf(items, spec, isNew)
  return {
    nodeId: null,
    R: Math.max(pod.r + spec.pad, spec.spacing * 1.6),
    inner: [],
    pod: { layout: pod, x: 0, y: 0 }
  }
}

// ---------------------------------------------------------- constellation

export interface RingItem {
  key: string
  bubble: BubbleLayout
  x: number
  y: number
  /** Arc length reserved for this item — the room its label may use. */
  slot: number
}

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface Constellation {
  hubR: number
  items: RingItem[]
  bounds: Bounds
}

export interface RingOptions {
  hubR: number
  /** Minimum clear space between the hub and the nearest bubble. */
  ringGap: number
  /** Minimum arc length per item, so neighbouring labels do not collide. */
  minSlot: number
  /**
   * The arc to place items on, in degrees, clockwise from three o'clock (screen
   * coordinates). The full ring starts at twelve o'clock.
   */
  arc?: { start: number; end: number }
}

/**
 * A hub with bubbles on a ring around it.
 *
 * Each item gets an arc slot proportional to its size (never less than
 * `minSlot`), in the order given, so a branch keeps its neighbours and its
 * rough direction as work is added. The ring grows to fit rather than letting
 * bubbles overlap.
 */
export function constellationOf(
  entries: readonly { key: string; bubble: BubbleLayout }[],
  options: RingOptions
): Constellation {
  const { hubR, ringGap, minSlot } = options
  const start = ((options.arc?.start ?? -90) * Math.PI) / 180
  const end = ((options.arc?.end ?? 270) * Math.PI) / 180
  const span = end - start
  const isFullCircle = Math.abs(span - Math.PI * 2) < 1e-6

  const slots = entries.map((entry) => Math.max(entry.bubble.R * 2 + 28, minSlot))
  const total = slots.reduce((sum, slot) => sum + slot, 0)
  const maxR = Math.max(0, ...entries.map((entry) => entry.bubble.R))

  // On a partial arc the first and last items sit on its ends, so the arc holds
  // one slot fewer than the items.
  const usable = isFullCircle ? total : Math.max(total - (slots[slots.length - 1] ?? 0), 1)
  const ringR = Math.max(hubR + ringGap + maxR, (isFullCircle ? total : usable) / span)

  let cumulative = 0
  const items = entries.map((entry, i): RingItem => {
    const slot = slots[i] ?? minSlot
    let angle: number
    if (isFullCircle) {
      angle = start + ((cumulative + slot / 2) / total) * span
    } else if (entries.length === 1) {
      angle = start + span / 2
    } else {
      angle = start + (cumulative / usable) * span
    }
    cumulative += slot
    return {
      key: entry.key,
      bubble: entry.bubble,
      x: Math.cos(angle) * ringR,
      y: Math.sin(angle) * ringR,
      slot: (slot / (isFullCircle ? total : usable)) * span * ringR
    }
  })

  const bounds: Bounds = { minX: -hubR, minY: -hubR, maxX: hubR, maxY: hubR }
  for (const item of items) {
    bounds.minX = Math.min(bounds.minX, item.x - item.bubble.R)
    bounds.maxX = Math.max(bounds.maxX, item.x + item.bubble.R)
    bounds.minY = Math.min(bounds.minY, item.y - item.bubble.R)
    bounds.maxY = Math.max(bounds.maxY, item.y + item.bubble.R)
  }

  return { hubR, items, bounds }
}

// --------------------------------------------------------------------- fit

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface FitTransform {
  scale: number
  tx: number
  ty: number
}

export interface FitMargins {
  /** Screen pixels kept clear on every side. */
  pad: number
  /** Extra screen pixels for labels, which do not scale with the drawing. */
  labelX: number
  labelTop: number
  labelBottom: number
  maxScale: number
}

/**
 * Scales and centres world bounds into a screen rectangle, leaving room for
 * labels drawn at a fixed pixel size around the shapes.
 *
 * There is no minimum scale on purpose: the alternative to shrinking is
 * clipping, and the rule for this view is that nothing is ever unreachable.
 * Progressive disclosure is what keeps the scale comfortable, not a floor.
 */
export function fitToRect(bounds: Bounds, rect: Rect, margins: FitMargins): FitTransform {
  const worldW = Math.max(bounds.maxX - bounds.minX, 1)
  const worldH = Math.max(bounds.maxY - bounds.minY, 1)
  const availW = Math.max(rect.width - margins.pad * 2 - margins.labelX * 2, 40)
  const availH = Math.max(
    rect.height - margins.pad * 2 - margins.labelTop - margins.labelBottom,
    40
  )
  const scale = Math.min(availW / worldW, availH / worldH, margins.maxScale)

  const cx = (bounds.minX + bounds.maxX) / 2
  const cy = (bounds.minY + bounds.maxY) / 2
  const screenCx = rect.x + rect.width / 2
  const screenCy = rect.y + margins.pad + margins.labelTop + availH / 2

  return { scale, tx: screenCx - cx * scale, ty: screenCy - cy * scale }
}
