import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { ProjectDocument } from '@shared/types'
import { importProject } from '@shared/persistence/projectCodec'
import {
  childIdsOf,
  isDescendantOf,
  nodeAncestorIds,
  subtreeIds,
  type ProjectState
} from '@shared/model/project'
import { projectProjection } from '@shared/model/projectProjection'
import { summarizeProgress } from '@shared/model/progress'
import { recognizeWorkStatus, nextWorkStatus } from '@shared/model/workStatus'
import type { ExplorerNode } from '@shared/model/node'

/** A small hand-built tree, so the shapes under test are visible in one screen. */
function fixture(): ProjectState {
  const result = importProject({
    brain: {
      title: 'Fixture',
      children: [
        {
          id: 'area',
          title: 'Area',
          nodeType: 'area',
          children: [
            { id: 'a', title: 'A', nodeType: 'task', status: 'todo' },
            { id: 'b', title: 'B', nodeType: 'task', status: 'done' },
            { id: 'c', title: 'C', nodeType: 'task', status: 'active' },
            { id: 'd', title: 'D', nodeType: 'knowledge' }
          ]
        },
        { id: 'loose', title: 'Loose', nodeType: 'task', status: 'todo' }
      ]
    }
  })
  if (result.status !== 'editable') throw new Error(result.reason)
  return result.state
}

describe('recognizeWorkStatus', () => {
  it('recognises the canonical values', () => {
    expect(recognizeWorkStatus('todo')).toBe('todo')
    expect(recognizeWorkStatus('in_progress')).toBe('in_progress')
    expect(recognizeWorkStatus('done')).toBe('done')
  })

  it('recognises the aliases other tools write', () => {
    expect(recognizeWorkStatus('active')).toBe('in_progress')
    expect(recognizeWorkStatus('complete')).toBe('done')
    expect(recognizeWorkStatus('completed')).toBe('done')
  })

  it('is tolerant of casing and surrounding space', () => {
    expect(recognizeWorkStatus('  Done ')).toBe('done')
    expect(recognizeWorkStatus('ACTIVE')).toBe('in_progress')
  })

  it('returns undefined for anything it does not understand', () => {
    // Absent, wrong type, and an unknown word all mean "no work state I can act
    // on", and all three must leave the stored value alone.
    expect(recognizeWorkStatus(undefined)).toBeUndefined()
    expect(recognizeWorkStatus(null)).toBeUndefined()
    expect(recognizeWorkStatus(3)).toBeUndefined()
    expect(recognizeWorkStatus('')).toBeUndefined()
    expect(recognizeWorkStatus('blocked')).toBeUndefined()
  })
})

describe('nextWorkStatus', () => {
  it('completes from anything unfinished, and reopens from done', () => {
    expect(nextWorkStatus('todo')).toBe('done')
    expect(nextWorkStatus('in_progress')).toBe('done')
    expect(nextWorkStatus(undefined)).toBe('done')
    expect(nextWorkStatus('done')).toBe('todo')
  })
})

describe('project selectors', () => {
  it('treats null as the project root', () => {
    const state = fixture()
    expect(childIdsOf(state, null)).toEqual(['area', 'loose'])
    expect(childIdsOf(state, 'area')).toEqual(['a', 'b', 'c', 'd'])
    expect(childIdsOf(state, 'a')).toEqual([])
  })

  it('walks ancestors outermost first', () => {
    const state = fixture()
    expect(nodeAncestorIds(state, 'a')).toEqual(['area'])
    expect(nodeAncestorIds(state, 'area')).toEqual([])
    expect(nodeAncestorIds(state, 'nope')).toEqual([])
  })

  it('reports descendants without treating a node as its own', () => {
    const state = fixture()
    expect(isDescendantOf(state, 'a', 'area')).toBe(true)
    expect(isDescendantOf(state, 'area', 'area')).toBe(false)
    expect(isDescendantOf(state, 'area', 'a')).toBe(false)
    expect(isDescendantOf(state, 'loose', 'area')).toBe(false)
  })

  it('collects a subtree including its own root', () => {
    const state = fixture()
    expect(subtreeIds(state, 'area')).toEqual(['area', 'a', 'b', 'c', 'd'])
    expect(subtreeIds(state, 'a')).toEqual(['a'])
  })
})

describe('projectProjection', () => {
  it('rebuilds the Explorer tree, the index and progress together', () => {
    const projection = projectProjection(fixture())

    expect(projection.name).toBe('Fixture')
    expect(projection.roots.map((n) => n.id)).toEqual(['area', 'loose'])
    expect(projection.index.byId.size).toBe(6)
    expect(projection.index.parentIdOf.get('a')).toBe('area')
    expect(projection.index.parentIdOf.get('area')).toBeNull()
  })

  it('carries the interpreted status onto the Explorer node', () => {
    const projection = projectProjection(fixture())
    const area = projection.roots[0]

    expect(area?.children.map((c) => c.status)).toEqual(['todo', 'done', 'in_progress', undefined])
  })

  it('presents an empty title as undefined so the row can substitute one', () => {
    const result = importProject({
      brain: { title: 'F', children: [{ id: 'x', title: '   ', nodeType: 'task' }] }
    })
    if (result.status !== 'editable') throw new Error(result.reason)

    expect(projectProjection(result.state).roots[0]?.label).toBeUndefined()
  })

  it('projects the real knowledge base', () => {
    const raw = readFileSync('data/music-brain.json', 'utf8')
    const result = importProject(JSON.parse(raw) as ProjectDocument)
    if (result.status !== 'editable') throw new Error(result.reason)

    const projection = projectProjection(result.state)
    expect(projection.index.byId.size).toBe(548)
    expect(projection.progress.total.todo).toBe(397)
    expect(projection.progress.total.done).toBe(0)
    // The three `active` domains are containers, so none of them is counted as
    // work — which is why R2's decision changes no number on screen.
    expect(projection.progress.total.inProgress).toBe(0)
  })
})

describe('summarizeProgress', () => {
  it('counts leaves with a recognised status, and nothing else', () => {
    const projection = projectProjection(fixture())

    // `d` is a leaf with no status and is not counted; `area` is a container and
    // is summarised rather than counted.
    expect(projection.progress.byId.get('area')).toEqual({ todo: 1, inProgress: 1, done: 1 })
    expect(projection.progress.total).toEqual({ todo: 2, inProgress: 1, done: 1 })
  })

  it('excludes a node from its own summary', () => {
    const projection = projectProjection(fixture())

    expect(projection.progress.byId.get('a')).toEqual({ todo: 0, inProgress: 0, done: 0 })
  })

  it('counts a leaf that becomes a parent as its own leaves instead', () => {
    const leaf: ExplorerNode[] = [
      { id: 'p', label: 'P', kind: 'task', status: 'todo', tags: [], children: [] }
    ]
    expect(summarizeProgress(leaf).total).toEqual({ todo: 1, inProgress: 0, done: 0 })

    const grown: ExplorerNode[] = [
      {
        id: 'p',
        label: 'P',
        kind: 'task',
        status: 'todo',
        tags: [],
        children: [
          { id: 'p1', label: '1', kind: 'task', status: 'todo', tags: [], children: [] },
          { id: 'p2', label: '2', kind: 'task', status: 'todo', tags: [], children: [] },
          { id: 'p3', label: '3', kind: 'task', status: 'done', tags: [], children: [] }
        ]
      }
    ]

    // Discovery raises the known total from 1 to 3 rather than reporting the
    // original task as lost.
    expect(summarizeProgress(grown).total).toEqual({ todo: 2, inProgress: 0, done: 1 })
  })

  it('handles an empty project', () => {
    expect(summarizeProgress([]).total).toEqual({ todo: 0, inProgress: 0, done: 0 })
  })
})
