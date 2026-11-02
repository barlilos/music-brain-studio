import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { ExplorerNode } from '@shared/model/node'
import { toExplorerProject } from '@shared/model/adapter'
import { summarizeProgress } from '@shared/model/progress'
import {
  bubbleOf,
  constellationOf,
  fitToRect,
  isWorkItem,
  packCircles,
  podOf,
  workUnder,
  type BubbleLayout,
  type SeedSpec
} from '@renderer/components/graph/graphLayout'

const SPEC: SeedSpec = { spacing: 9.5, radius: 3.4, pad: 6, gap: 8 }
const never = (): boolean => false

const task = (id: string, status: ExplorerNode['status'] = 'todo'): ExplorerNode => ({
  id,
  label: id,
  kind: 'task',
  status,
  tags: [],
  children: []
})
const area = (id: string, children: ExplorerNode[]): ExplorerNode => ({
  id,
  label: id,
  kind: 'area',
  status: undefined,
  tags: [],
  children
})

function seedsIn(bubble: BubbleLayout): number {
  return (
    (bubble.pod?.layout.seeds.length ?? 0) +
    bubble.inner.reduce((sum, inner) => sum + seedsIn(inner.bubble), 0)
  )
}

const demo = toExplorerProject(
  JSON.parse(readFileSync('examples/living-progress-graph-demo.json', 'utf8'))
)

describe('seeds', () => {
  it('draws exactly one seed per counted piece of work', () => {
    const progress = summarizeProgress(demo.roots)
    for (const root of demo.roots) {
      const summary = progress.byId.get(root.id)!
      const counted = summary.todo + summary.inProgress + summary.done
      expect(seedsIn(bubbleOf(root, SPEC, 1, never))).toBe(counted)
      expect(workUnder(root).length).toBe(counted)
    }
  })

  it('gathers Done at the centre — the green heart', () => {
    const pod = podOf(
      [task('a'), task('b', 'done'), task('c', 'in_progress'), task('d', 'done'), task('e')],
      SPEC,
      never
    )
    const distance = (id: string): number => {
      const seed = pod.seeds.find((s) => s.id === id)!
      return Math.hypot(seed.x, seed.y)
    }
    expect(pod.seeds.map((s) => s.id)).toEqual(['b', 'd', 'c', 'a', 'e'])
    expect(Math.max(distance('b'), distance('d'))).toBeLessThan(distance('c'))
    expect(pod.done).toBe(2)
  })

  it('never moves Done seeds when new work is discovered', () => {
    const before = podOf([task('a', 'done'), task('b', 'done'), task('c')], SPEC, never)
    const after = podOf(
      [task('a', 'done'), task('b', 'done'), task('c'), task('n1'), task('n2')],
      SPEC,
      (id) => id.startsWith('n')
    )
    for (const id of ['a', 'b']) {
      expect(after.seeds.find((s) => s.id === id)).toMatchObject(
        before.seeds.find((s) => s.id === id)!
      )
    }
    expect(after.r).toBeGreaterThan(before.r)
    // New work lands on the rim, after everything that was already there.
    expect(after.seeds.slice(-2).map((s) => s.id)).toEqual(['n1', 'n2'])
  })

  it('treats an empty project as a branch waiting for work, not as a task', () => {
    const empty = { ...area('p', []), kind: 'project' }
    expect(isWorkItem(empty)).toBe(false)
    const bubble = bubbleOf(empty, SPEC, 1, never)
    expect(bubble.pod).toBeNull()
    expect(bubble.R).toBeGreaterThan(0)
  })
})

describe('packing', () => {
  it('places circles without overlap and inside the reported radius', () => {
    const radii = [30, 22, 22, 15, 9, 9, 40, 5]
    const { positions, R } = packCircles(radii, 6)
    for (let i = 0; i < radii.length; i++) {
      const a = positions[i]!
      expect(Math.hypot(a.x, a.y) + radii[i]!).toBeLessThanOrEqual(R + 1e-6)
      for (let j = i + 1; j < radii.length; j++) {
        const b = positions[j]!
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(
          radii[i]! + radii[j]! + 6 - 1e-6
        )
      }
    }
  })

  it('is deterministic', () => {
    expect(packCircles([12, 30, 8], 4)).toEqual(packCircles([12, 30, 8], 4))
  })
})

describe('constellation', () => {
  const entries = demo.roots
    .filter((root) => !isWorkItem(root))
    .map((root) => ({ key: root.id, bubble: bubbleOf(root, SPEC, 1, never) }))

  it('puts every top-level domain on the ring without overlapping the hub or each other', () => {
    const c = constellationOf(entries, { hubR: 48, ringGap: 46, minSlot: 150 })
    expect(c.items).toHaveLength(entries.length)
    for (const item of c.items) {
      expect(Math.hypot(item.x, item.y) - item.bubble.R).toBeGreaterThanOrEqual(48 + 46 - 1e-6)
    }
    for (let i = 0; i < c.items.length; i++) {
      for (let j = i + 1; j < c.items.length; j++) {
        const a = c.items[i]!
        const b = c.items[j]!
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(a.bubble.R + b.bubble.R)
      }
    }
  })

  it('keeps the user order clockwise from twelve o’clock', () => {
    const c = constellationOf(entries, { hubR: 48, ringGap: 46, minSlot: 150 })
    const angles = c.items.map(
      (item) => (Math.atan2(item.y, item.x) + Math.PI * 2.5) % (Math.PI * 2)
    )
    expect([...angles].sort((a, b) => a - b)).toEqual(angles)
  })

  it('lays siblings on a left-hand arc while one branch is unfolded', () => {
    const c = constellationOf(entries.slice(1), {
      hubR: 48,
      ringGap: 38,
      minSlot: 120,
      arc: { start: 100, end: 260 }
    })
    for (const item of c.items) expect(item.x).toBeLessThan(1e-6)
  })

  it('handles a dense branch — Ableton, 154 tasks — in one bubble', () => {
    const ableton = demo.roots.find((root) => root.label === 'Ableton')!
    const bubble = bubbleOf(ableton, SPEC, 1, never)
    expect(seedsIn(bubble)).toBe(154)
    expect(bubble.inner.length).toBe(ableton.children.filter((c) => !isWorkItem(c)).length)
  })

  it('handles an empty focus', () => {
    const c = constellationOf([], { hubR: 48, ringGap: 46, minSlot: 150 })
    expect(c.items).toEqual([])
    expect(c.bounds).toEqual({ minX: -48, minY: -48, maxX: 48, maxY: 48 })
  })
})

describe('fitToRect', () => {
  it('keeps the whole drawing inside the pane, however large it is', () => {
    const bounds = { minX: -2000, minY: -900, maxX: 1800, maxY: 1300 }
    const rect = { x: 0, y: 0, width: 900, height: 600 }
    const margins = { pad: 20, labelX: 60, labelTop: 8, labelBottom: 40, maxScale: 1.6 }
    const { scale, tx, ty } = fitToRect(bounds, rect, margins)
    const left = bounds.minX * scale + tx
    const right = bounds.maxX * scale + tx
    const top = bounds.minY * scale + ty
    const bottom = bounds.maxY * scale + ty
    expect(left).toBeGreaterThanOrEqual(margins.pad + margins.labelX - 1e-6)
    expect(right).toBeLessThanOrEqual(rect.width - margins.pad - margins.labelX + 1e-6)
    expect(top).toBeGreaterThanOrEqual(margins.pad + margins.labelTop - 1e-6)
    expect(bottom).toBeLessThanOrEqual(rect.height - margins.pad - margins.labelBottom + 1e-6)
  })

  it('does not blow a single small bubble up past the maximum scale', () => {
    const { scale } = fitToRect(
      { minX: -10, minY: -10, maxX: 10, maxY: 10 },
      { x: 0, y: 0, width: 1200, height: 800 },
      { pad: 20, labelX: 60, labelTop: 8, labelBottom: 40, maxScale: 1.6 }
    )
    expect(scale).toBe(1.6)
  })
})
