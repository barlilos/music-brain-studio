/**
 * Builds examples/living-progress-graph-demo.json — test material for the Living
 * Progress Graph (milestone 006). Not a product taxonomy.
 *
 *   node scripts/make-living-progress-demo.mjs
 *
 * Reads data/music-brain.json and never writes to it. The output keeps the real
 * structure (13 domains, 548 nodes) and adds what the graph needs to be judged:
 *
 * - Insaint, the illustrative project from design exploration 02, built around
 *   the eight real tasks from the 31 Oct walkthrough: substantial completion, a
 *   branch with nothing open (Drums), and a branch declared Finished (Vocal).
 * - Quad Cortex with most of its tasks done; Practice with about a third done.
 * - Ableton, the densest domain (154 tasks), with very little done.
 * - An empty new project under Live Performance.
 *
 * Every status outside Insaint's real tasks is illustrative. Deterministic: the
 * same input always produces the same file.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SOURCE = resolve('data/music-brain.json')
const TARGET = resolve('examples/living-progress-graph-demo.json')

const document = JSON.parse(readFileSync(SOURCE, 'utf8'))
const brain = document.brain

function walk(node, visit) {
  visit(node)
  for (const child of node.children ?? []) walk(child, visit)
}

const isTask = (node) => node.nodeType === 'task' && (node.children ?? []).length === 0

/** Marks tasks under a domain: `pick(i)` returns a status for the i-th task, or null to leave it. */
function mark(domainId, pick) {
  const domain = brain.children.find((node) => node.id === domainId)
  if (domain === undefined) throw new Error(`No domain ${domainId}`)
  let i = 0
  walk(domain, (node) => {
    if (!isTask(node)) return
    const status = pick(i++)
    if (status !== null) node.status = status
  })
}

mark('quadcortex', (i) => (i % 4 === 3 ? (i % 8 === 7 ? 'in_progress' : null) : 'done'))
mark('practice', (i) => (i % 3 === 0 ? 'done' : i % 11 === 5 ? 'in_progress' : null))
mark('ableton', (i) => (i % 13 === 0 ? 'done' : i % 41 === 7 ? 'in_progress' : null))
mark('riffpicker', (i) => (i < 4 ? 'done' : null))

// ---------------------------------------------------------------- Insaint

const slug = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const task = (title, status) => ({ title, nodeType: 'task', status })
const branch = (nodeType, title, children, extra = {}) => ({ title, nodeType, ...extra, children })

function withIds(node, prefix) {
  const id = `${prefix}.${slug(node.title)}`
  return {
    id,
    ...node,
    ...(node.children ? { children: node.children.map((child) => withIds(child, id)) } : {})
  }
}

const insaint = withIds(
  branch(
    'project',
    'Insaint — Recording and April Show Preparation',
    [
      branch('area', 'Song preparation', [
        task('Single 1 — final arrangement', 'done'),
        task('Single 1 — lyric sheet', 'done'),
        task('Single 1 — guide vocal demo', 'done'),
        task('Single 2 — lock tempo and click map', 'done'),
        task('Single 2 — rewrite bridge', 'in_progress'),
        task('Single 2 — lyric sheet', 'todo'),
        task('Single 3 — choose a chorus', 'todo'),
        task('Single 3 — demo structure', 'todo')
      ]),
      branch('area', 'Recording', [
        branch('project', 'Rhythm guitar recording', [
          task('Prepare recording session', 'done'),
          task('Record first takes', 'done'),
          task('Review takes', 'in_progress'),
          task('Decide stage outfits', 'todo'),
          task('Check guitar noise before recording', 'todo'),
          task('Comp best takes', 'todo')
        ]),
        branch(
          'project',
          'Vocal tracking — Single 1',
          [
            task('Book vocal session', 'done'),
            task('Warm-up routine', 'done'),
            task('Track lead vocal', 'done'),
            task('Track harmonies', 'done')
          ],
          { finishedAt: '2026-10-14' }
        ),
        branch('project', 'Drums — Single 1', [
          task('Program verse and chorus', 'done'),
          task('Humanize fills', 'done')
        ]),
        task('Bounce rough mix for review', 'todo')
      ]),
      branch('area', 'Practice', [
        task('Click-track run-throughs', 'done'),
        task('Single 1 vocals and guitar together', 'done'),
        task('Practice setlist end to end', 'in_progress'),
        task('Single 2 solo at full tempo', 'todo'),
        task('Memorise Single 3 lyrics', 'todo'),
        task('Song-to-song transitions', 'todo')
      ]),
      branch('area', 'Performance', [
        task('Decide setlist order', 'done'),
        task('Book rehearsal room', 'done'),
        task('Set transitions and count-ins', 'done'),
        task('Rehearse stage movement', 'todo'),
        task('Lighting cues reference', 'todo')
      ]),
      branch('area', 'Equipment', [
        task('Backup cables and batteries', 'done'),
        task('Pedalboard power check', 'done'),
        task('Quad Cortex show presets', 'in_progress'),
        task('Service and restring guitars', 'todo'),
        task('In-ear monitor mix', 'todo')
      ]),
      branch('area', 'Styling', [
        task('Cover photo direction', 'todo'),
        task('Hair and make-up booking', 'todo')
      ])
    ],
    { status: 'active' }
  ),
  'demo'
)
brain.children.unshift(insaint)

// ------------------------------------------------------- empty new project

const live = brain.children.find((node) => node.id === 'live')
live.children.push({
  id: 'demo.live.summer-festival-set',
  title: 'Summer festival set',
  nodeType: 'project',
  children: []
})

// ------------------------------------------------------------------ write

const out = {
  fixture:
    'Living Progress Graph demo (milestone 006). Derived from data/music-brain.json on ' +
    '2026-11-02 by scripts/make-living-progress-demo.mjs. Statuses and the Insaint project ' +
    'are illustrative test material, not real progress.',
  ...document
}

const ids = new Set()
walk(brain, (node) => {
  if (node !== brain && ids.has(node.id)) throw new Error(`Duplicate id ${node.id}`)
  ids.add(node.id)
})

writeFileSync(TARGET, `${JSON.stringify(out, null, 2)}\n`)
console.log(`Wrote ${TARGET} — ${ids.size - 1} nodes`)
