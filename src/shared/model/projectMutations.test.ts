import { describe, expect, it } from 'vitest'
import { importProject } from '@shared/persistence/projectCodec'
import { childIdsOf, type NodeId, type ProjectState } from '@shared/model/project'
import { projectProjection } from '@shared/model/projectProjection'
import {
  changeNodeType,
  createNode,
  createNodes,
  moveNode,
  setNodeStatus,
  updateNode,
  type MutationResult,
  type NodeIdFactory
} from '@shared/model/projectMutations'

/**
 * A tree with the shapes the commands actually have to handle: a container with
 * children, a nested container, and a top-level leaf.
 *
 *   area
 *     a  (task, todo)
 *     inner
 *       deep (task, done)
 *   loose (task, active — an alias, for the R2 tests)
 */
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
            {
              id: 'inner',
              title: 'Inner',
              nodeType: 'area',
              children: [{ id: 'deep', title: 'Deep', nodeType: 'task', status: 'done' }]
            }
          ]
        },
        { id: 'loose', title: 'Loose', nodeType: 'task', status: 'active', priority: 3 }
      ]
    }
  })
  if (result.status !== 'editable') throw new Error(result.reason)
  return result.state
}

/** Predictable ids, so a test can name what it just created. */
function counter(prefix = 'new'): NodeIdFactory {
  let n = 0
  return () => `${prefix}-${++n}`
}

/** Unwraps a success, or reports the domain error rather than a null-pointer. */
function ok(result: MutationResult): { state: ProjectState; createdIds: NodeId[] } {
  if (!result.ok)
    throw new Error(`expected success, got ${result.error.code}: ${result.error.message}`)
  return { state: result.state, createdIds: result.createdIds }
}

function errorOf(result: MutationResult): string {
  if (result.ok) throw new Error('expected a failure')
  return result.error.code
}

/** Every id reachable by walking the tree, which is what the UI can actually see. */
function reachableIds(state: ProjectState): Set<NodeId> {
  const ids = new Set<NodeId>()
  const walk = (list: readonly NodeId[]): void => {
    for (const id of list) {
      ids.add(id)
      walk(state.nodesById.get(id)?.childIds ?? [])
    }
  }
  walk(state.rootIds)
  return ids
}

describe('immutability and revisions', () => {
  it('never mutates the state it was given', () => {
    const before = fixture()
    const snapshot = JSON.stringify([...before.nodesById.entries()])

    updateNode(before, 'a', { title: 'Changed' })
    moveNode(before, 'a', null)
    setNodeStatus(before, 'a', 'done')
    createNode(before, 'area', { title: 'X', kind: 'task' }, counter())

    expect(JSON.stringify([...before.nodesById.entries()])).toBe(snapshot)
    expect(before.revision).toBe(0)
  })

  it('advances the revision on success and not on failure', () => {
    const state = fixture()

    expect(ok(updateNode(state, 'a', { title: 'Changed' })).state.revision).toBe(1)

    const failure = updateNode(state, 'nope', { title: 'Changed' })
    expect(failure.ok).toBe(false)
  })
})

describe('createNodes', () => {
  it('appends a child and reports its id', () => {
    const state = fixture()
    const { state: next, createdIds } = ok(
      createNode(state, 'area', { title: 'New task', kind: 'task', status: 'todo' }, counter())
    )

    expect(createdIds).toEqual(['new-1'])
    expect(childIdsOf(next, 'area')).toEqual(['a', 'inner', 'new-1'])
    expect(next.nodesById.get('new-1')?.parentId).toBe('area')
    expect(next.nodesById.get('new-1')?.title).toBe('New task')
    expect(next.nodesById.get('new-1')?.status).toBe('todo')
  })

  it('adds to the project root when the parent is null', () => {
    const state = fixture()
    const { state: next, createdIds } = ok(
      createNode(state, null, { title: 'Top', kind: 'domain' }, counter())
    )

    expect(next.rootIds).toEqual(['area', 'loose', 'new-1'])
    expect(next.nodesById.get(createdIds[0] ?? '')?.parentId).toBeNull()
  })

  it('creates many in one transaction, preserving order', () => {
    const state = fixture()
    const { state: next, createdIds } = ok(
      createNodes(
        state,
        'area',
        [
          { title: 'One', kind: 'task', status: 'todo' },
          { title: 'Two', kind: 'task', status: 'todo' },
          { title: 'Three', kind: 'task', status: 'todo' }
        ],
        counter()
      )
    )

    expect(createdIds).toEqual(['new-1', 'new-2', 'new-3'])
    expect(childIdsOf(next, 'area')).toEqual(['a', 'inner', 'new-1', 'new-2', 'new-3'])
    // One transaction, so one revision — not three.
    expect(next.revision).toBe(1)
  })

  it('applies nothing at all when one input is invalid', () => {
    const state = fixture()
    const result = createNodes(
      state,
      'area',
      [
        { title: 'Fine', kind: 'task' },
        { title: '   ', kind: 'task' },
        { title: 'Also fine', kind: 'task' }
      ],
      counter()
    )

    expect(errorOf(result)).toBe('emptyTitle')
  })

  it('trims titles and drops empty tags', () => {
    const state = fixture()
    const { state: next } = ok(
      createNode(
        state,
        'area',
        { title: '  Spaced  ', kind: 'TASK', tags: ['  keep ', '', '   '] },
        counter()
      )
    )

    const node = next.nodesById.get('new-1')
    expect(node?.title).toBe('Spaced')
    expect(node?.kind).toBe('task')
    expect(node?.tags).toEqual(['keep'])
  })

  it('leaves status unset when the caller does not ask for one', () => {
    const state = fixture()
    const { state: next } = ok(
      createNode(state, 'area', { title: 'An area', kind: 'area' }, counter())
    )

    // Containers do not carry work state, and the model does not invent one.
    expect(next.nodesById.get('new-1')?.status).toBeUndefined()
  })

  it('rejects an unknown parent', () => {
    expect(errorOf(createNode(fixture(), 'nope', { title: 'X', kind: 'task' }, counter()))).toBe(
      'unknownParent'
    )
  })

  it('rejects an id the project already uses', () => {
    const state = fixture()
    expect(errorOf(createNode(state, 'area', { title: 'X', kind: 'task' }, () => 'a'))).toBe(
      'idCollision'
    )
  })
})

describe('updateNode', () => {
  it('changes title, tags and notes', () => {
    const state = fixture()
    const { state: next } = ok(
      updateNode(state, 'a', { title: 'Renamed', tags: ['one', 'two'], notes: 'A note' })
    )

    const node = next.nodesById.get('a')
    expect(node?.title).toBe('Renamed')
    expect(node?.tags).toEqual(['one', 'two'])
    expect(node?.notes).toBe('A note')
  })

  it('keeps identity, parentage and children through a rename', () => {
    const state = fixture()
    const { state: next } = ok(updateNode(state, 'area', { title: 'Renamed' }))

    expect(next.nodesById.get('area')?.id).toBe('area')
    expect(next.nodesById.get('area')?.childIds).toEqual(['a', 'inner'])
    expect(next.rootIds).toEqual(['area', 'loose'])
  })

  it('leaves a preserved status alias alone', () => {
    const state = fixture()
    const { state: next } = ok(updateNode(state, 'loose', { title: 'Renamed' }))

    // R2: editing another field must not canonicalise what is on disk.
    expect(next.nodesById.get('loose')?.persistedStatus).toBe('active')
    expect(next.nodesById.get('loose')?.status).toBe('in_progress')
  })

  it('rejects an empty title but allows empty tags and notes', () => {
    const state = fixture()
    expect(errorOf(updateNode(state, 'a', { title: '   ' }))).toBe('emptyTitle')
    expect(ok(updateNode(state, 'a', { notes: '' })).state.nodesById.get('a')?.notes).toBe('')
  })

  it('rejects an unknown node', () => {
    expect(errorOf(updateNode(fixture(), 'nope', { title: 'X' }))).toBe('unknownNode')
  })
})

describe('changeNodeType', () => {
  it('changes the kind and keeps everything else', () => {
    const state = fixture()
    const { state: next } = ok(changeNodeType(state, 'a', 'Project'))

    const node = next.nodesById.get('a')
    expect(node?.kind).toBe('project')
    expect(node?.id).toBe('a')
    expect(node?.parentId).toBe('area')
    expect(node?.status).toBe('todo')
  })

  it('clears the file spelling so the canonical kind is written', () => {
    const state = fixture()
    expect(state.nodesById.get('a')?.persistedKind).toBe('task')

    const { state: next } = ok(changeNodeType(state, 'a', 'project'))
    expect(next.nodesById.get('a')?.persistedKind).toBeUndefined()
  })

  it('does not disturb a preserved status alias', () => {
    const state = fixture()
    const { state: next } = ok(changeNodeType(state, 'loose', 'area'))

    expect(next.nodesById.get('loose')?.persistedStatus).toBe('active')
  })
})

describe('setNodeStatus', () => {
  it('sets the state and clears the preserved alias', () => {
    const state = fixture()
    const { state: next } = ok(setNodeStatus(state, 'loose', 'done'))

    const node = next.nodesById.get('loose')
    expect(node?.status).toBe('done')
    // The one command allowed to canonicalise, because the user chose a state.
    expect(node?.persistedStatus).toBeUndefined()
  })

  it('can give a status to a node that never had one', () => {
    const result = importProject({
      brain: { title: 'F', children: [{ id: 'x', title: 'X', nodeType: 'task' }] }
    })
    if (result.status !== 'editable') throw new Error(result.reason)

    const { state } = ok(setNodeStatus(result.state, 'x', 'in_progress'))
    expect(state.nodesById.get('x')?.status).toBe('in_progress')
  })
})

describe('moveNode', () => {
  it('re-parents a leaf, updating both child lists', () => {
    const state = fixture()
    const { state: next } = ok(moveNode(state, 'a', 'inner'))

    expect(childIdsOf(next, 'area')).toEqual(['inner'])
    expect(childIdsOf(next, 'inner')).toEqual(['deep', 'a'])
    expect(next.nodesById.get('a')?.parentId).toBe('inner')
  })

  it('moves a whole subtree, keeping its contents intact', () => {
    const state = fixture()
    const { state: next } = ok(moveNode(state, 'inner', null))

    expect(next.rootIds).toEqual(['area', 'loose', 'inner'])
    expect(next.nodesById.get('inner')?.parentId).toBeNull()
    expect(childIdsOf(next, 'inner')).toEqual(['deep'])
    expect(next.nodesById.get('deep')?.parentId).toBe('inner')
    expect(childIdsOf(next, 'area')).toEqual(['a'])
  })

  it('inserts at an index, clamping out-of-range values', () => {
    const state = fixture()

    expect(childIdsOf(ok(moveNode(state, 'loose', 'area', 0)).state, 'area')).toEqual([
      'loose',
      'a',
      'inner'
    ])
    expect(childIdsOf(ok(moveNode(state, 'loose', 'area', 99)).state, 'area')).toEqual([
      'a',
      'inner',
      'loose'
    ])
    expect(childIdsOf(ok(moveNode(state, 'loose', 'area', -5)).state, 'area')).toEqual([
      'loose',
      'a',
      'inner'
    ])
  })

  it('reorders within one parent against the resulting list', () => {
    const state = fixture()
    const { state: next } = ok(moveNode(state, 'a', 'area', 1))

    expect(childIdsOf(next, 'area')).toEqual(['inner', 'a'])
  })

  it('refuses to file a node inside itself', () => {
    expect(errorOf(moveNode(fixture(), 'area', 'area'))).toBe('selfParent')
  })

  it('refuses to file a node inside its own descendant', () => {
    const state = fixture()

    // The move that would detach a whole branch: `inner` is inside `area`, so
    // filing `area` under it would leave both reachable only from each other.
    expect(errorOf(moveNode(state, 'area', 'inner'))).toBe('wouldCycle')
    expect(errorOf(moveNode(state, 'area', 'deep'))).toBe('wouldCycle')
  })

  it('allows the inverse of a rejected move', () => {
    const state = fixture()
    expect(moveNode(state, 'inner', 'loose').ok).toBe(true)
  })

  it('rejects unknown nodes and destinations', () => {
    const state = fixture()
    expect(errorOf(moveNode(state, 'nope', 'area'))).toBe('unknownNode')
    expect(errorOf(moveNode(state, 'a', 'nope'))).toBe('unknownParent')
  })

  it('leaves every node reachable after any accepted move', () => {
    const state = fixture()
    const before = reachableIds(state)

    for (const [nodeId, parentId] of [
      ['a', 'inner'],
      ['inner', null],
      ['loose', 'inner'],
      ['area', null],
      ['deep', 'area']
    ] as const) {
      const result = moveNode(state, nodeId, parentId)
      if (!result.ok) continue
      expect(reachableIds(result.state)).toEqual(before)
      expect(result.state.nodesById.size).toBe(state.nodesById.size)
    }
  })

  it('keeps selection-relevant identity stable, so the projection follows', () => {
    const state = fixture()
    const { state: next } = ok(moveNode(state, 'a', 'inner'))
    const projection = projectProjection(next)

    // Same id, new parent — which is exactly what lets selection and expansion
    // survive a move without any special handling.
    expect(projection.index.byId.has('a')).toBe(true)
    expect(projection.index.parentIdOf.get('a')).toBe('inner')
  })
})

describe('progress after mutation', () => {
  it('counts a newly added task', () => {
    const state = fixture()
    // `loose` is a leaf whose file says `active`, so it counts as in progress.
    expect(projectProjection(state).progress.total).toEqual({ todo: 1, inProgress: 1, done: 1 })

    const { state: next } = ok(
      createNode(state, 'area', { title: 'New', kind: 'task', status: 'todo' }, counter())
    )
    expect(projectProjection(next).progress.total).toEqual({ todo: 2, inProgress: 1, done: 1 })
  })

  it('stops counting a leaf that becomes a parent', () => {
    const state = fixture()
    const { state: next } = ok(
      createNodes(
        state,
        'a',
        [
          { title: 'Step one', kind: 'task', status: 'todo' },
          { title: 'Step two', kind: 'task', status: 'done' }
        ],
        counter()
      )
    )

    // `a` was one open task; it is now a container over one open and one done.
    expect(projectProjection(next).progress.total).toEqual({ todo: 1, inProgress: 1, done: 2 })
  })
})
