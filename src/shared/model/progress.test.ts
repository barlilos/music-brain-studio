import { describe, expect, it } from 'vitest'
import type { ExplorerNode } from '@shared/model/node'
import { regionStateOf, summarizeProgress, openCount } from '@shared/model/progress'
import { importProject } from '@shared/persistence/projectCodec'
import { createNodes, setNodeFinished, setNodeStatus } from '@shared/model/projectMutations'
import { projectProjection } from '@shared/model/projectProjection'
import type { ProjectState } from '@shared/model/project'

const leaf = (id: string, status: ExplorerNode['status']): ExplorerNode => ({
  id,
  label: id,
  kind: 'task',
  status,
  tags: [],
  children: []
})
const branch = (id: string, children: ExplorerNode[], finishedAt?: string): ExplorerNode => ({
  id,
  label: id,
  kind: 'area',
  status: undefined,
  tags: [],
  finishedAt,
  children
})

/**
 *   project
 *     recording
 *       guitar   (done, done, todo)
 *       drums    (done, done)          ← nothing open, not finished
 *       vocal    (done) finishedAt     ← declared finished
 *     styling    (empty)
 */
function tree(): ExplorerNode[] {
  return [
    branch('project', [
      branch('recording', [
        branch('guitar', [leaf('g1', 'done'), leaf('g2', 'done'), leaf('g3', 'todo')]),
        branch('drums', [leaf('d1', 'done'), leaf('d2', 'done')]),
        branch('vocal', [leaf('v1', 'done')], '2026-10-14')
      ]),
      branch('styling', [])
    ])
  ]
}

describe('completion aggregation', () => {
  it('sums every descendant task into each ancestor, across levels', () => {
    const { byId, total } = summarizeProgress(tree())
    expect(byId.get('guitar')).toEqual({ todo: 1, inProgress: 0, done: 2 })
    expect(byId.get('recording')).toEqual({ todo: 1, inProgress: 0, done: 5 })
    expect(byId.get('project')).toEqual({ todo: 1, inProgress: 0, done: 5 })
    expect(total).toEqual({ todo: 1, inProgress: 0, done: 5 })
  })

  it('never counts a branch itself as a piece of work', () => {
    const { total } = summarizeProgress(tree())
    // 6 leaves with a status; 6 branches contribute nothing of their own.
    expect(total.todo + total.inProgress + total.done).toBe(6)
  })
})

describe('region state', () => {
  it('distinguishes nothing-open-right-now from Finished', () => {
    const roots = tree()
    const { byId } = summarizeProgress(roots)
    expect(regionStateOf(byId.get('drums'), undefined)).toBe('nothingOpen')
    expect(regionStateOf(byId.get('vocal'), '2026-10-14')).toBe('finished')
    expect(regionStateOf(byId.get('guitar'), undefined)).toBe('open')
    expect(regionStateOf(byId.get('styling'), undefined)).toBe('empty')
  })

  it('never promotes a parent to Finished because every child is done', () => {
    const roots = [branch('p', [branch('a', [leaf('a1', 'done')], '2026-01-01')])]
    const { byId } = summarizeProgress(roots)
    // `a` is finished and fully done; `p` is merely nothing open.
    expect(regionStateOf(byId.get('p'), undefined)).toBe('nothingOpen')
  })

  it('keeps Finished when work is discovered inside it, and says so', () => {
    const roots = [branch('v', [leaf('v1', 'done'), leaf('v2', 'todo')], '2026-10-14')]
    const summary = summarizeProgress(roots).byId.get('v')
    expect(regionStateOf(summary, '2026-10-14')).toBe('finished')
    expect(openCount(summary!)).toBe(1)
  })
})

function state(): ProjectState {
  const result = importProject({
    brain: {
      title: 'P',
      children: [
        {
          id: 'drums',
          title: 'Drums',
          nodeType: 'project',
          children: [
            { id: 'd1', title: 'Program', nodeType: 'task', status: 'done' },
            { id: 'd2', title: 'Humanize', nodeType: 'task', status: 'done' }
          ]
        }
      ]
    }
  })
  if (result.status !== 'editable') throw new Error(result.reason)
  return result.state
}

function ok(result: ReturnType<typeof setNodeStatus>): ProjectState {
  if (!result.ok) throw new Error(result.error.message)
  return result.state
}

describe('discovery is progress', () => {
  it('adds open work without reducing the absolute count of done work', () => {
    const before = projectProjection(state()).progress.byId.get('drums')!
    expect(before).toEqual({ todo: 0, inProgress: 0, done: 2 })

    let n = 0
    const grown = ok(
      createNodes(
        state(),
        'drums',
        [
          { title: 'Fill A', kind: 'task', status: 'todo' },
          { title: 'Fill B', kind: 'task', status: 'todo' }
        ],
        () => `new-${++n}`
      )
    )
    const after = projectProjection(grown).progress.byId.get('drums')!
    expect(after.done).toBe(2)
    expect(openCount(after)).toBe(2)
    // Nothing open reverts to open the moment work is discovered — never "unfinished".
    expect(regionStateOf(before, undefined)).toBe('nothingOpen')
    expect(regionStateOf(after, undefined)).toBe('open')
  })

  it('marking a task done raises its ancestors immediately', () => {
    let n = 0
    const grown = ok(
      createNodes(
        state(),
        'drums',
        [{ title: 'Fill', kind: 'task', status: 'todo' }],
        () => `t-${++n}`
      )
    )
    const done = ok(setNodeStatus(grown, 't-1', 'done'))
    expect(projectProjection(done).progress.byId.get('drums')).toEqual({
      todo: 0,
      inProgress: 0,
      done: 3
    })
  })
})

describe('setNodeFinished', () => {
  it('declares and reopens without touching any status inside', () => {
    const finished = ok(setNodeFinished(state(), 'drums', '2026-11-02'))
    expect(finished.nodesById.get('drums')?.finishedAt).toBe('2026-11-02')
    expect(finished.nodesById.get('d1')?.status).toBe('done')
    expect(finished.nodesById.get('d1')?.finishedAt).toBeUndefined()
    expect(finished.revision).toBe(1)

    const reopened = ok(setNodeFinished(finished, 'drums', null))
    expect(reopened.nodesById.get('drums')?.finishedAt).toBeUndefined()
  })

  it('is never set as a side effect of completing the last task', () => {
    let n = 0
    const grown = ok(
      createNodes(
        state(),
        'drums',
        [{ title: 'Fill', kind: 'task', status: 'todo' }],
        () => `x-${++n}`
      )
    )
    const done = ok(setNodeStatus(grown, 'x-1', 'done'))
    expect(done.nodesById.get('drums')?.finishedAt).toBeUndefined()
  })

  it('refuses an unknown node', () => {
    expect(setNodeFinished(state(), 'nope', '2026-11-02').ok).toBe(false)
  })
})
