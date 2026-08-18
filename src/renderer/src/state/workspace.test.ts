import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Project, ProjectDocument } from '@shared/types'
import {
  canSave,
  editableContentOf,
  initialWorkspace,
  isDirty,
  workspaceReducer,
  type WorkspaceAction,
  type WorkspaceState
} from '@renderer/state/workspace'

/**
 * The dirty/saved bookkeeping, tested without a filesystem or a renderer.
 *
 * The cases that matter are the awkward ones: a save that lands while the user
 * is still typing, a save that is refused, a save that fails outright. Each has
 * exactly one safe answer, and getting any of them wrong loses work silently.
 */

const REAL = 'data/music-brain.json'

function projectFrom(path: string, diskRevision = 'hash-1'): Project {
  return {
    token: 'token-1',
    fileName: 'project.json',
    document: JSON.parse(readFileSync(path, 'utf8')) as ProjectDocument,
    diskRevision
  }
}

function reduce(state: WorkspaceState, ...actions: WorkspaceAction[]): WorkspaceState {
  return actions.reduce(workspaceReducer, state)
}

function opened(path = REAL): WorkspaceState {
  return workspaceReducer(initialWorkspace, { type: 'opened', project: projectFrom(path) })
}

/** A rename, which is the cheapest way to make the project dirty. */
function edit(state: WorkspaceState, title: string): WorkspaceState {
  return workspaceReducer(state, {
    type: 'updateNode',
    nodeId: 'ableton.template.project.create',
    patch: { title }
  })
}

describe('opening', () => {
  it('imports the real knowledge base as editable and clean', () => {
    const state = opened()

    expect(state.isLoading).toBe(false)
    expect(state.content?.mode).toBe('editable')
    expect(state.source?.token).toBe('token-1')
    expect(isDirty(state)).toBe(false)
    expect(canSave(state)).toBe(false)
  })

  it('falls back to a read-only project when the file cannot be edited safely', () => {
    const state = opened('examples/sample-project.json')

    expect(state.content?.mode).toBe('readOnly')
    if (state.content?.mode !== 'readOnly') return

    // Still fully browsable — decision R3.
    expect(state.content.project.roots.length).toBeGreaterThan(0)
    expect(state.content.reason.length).toBeGreaterThan(0)
    expect(isDirty(state)).toBe(false)
  })

  it('reports a failure to open without leaving a half-open project', () => {
    const state = workspaceReducer(initialWorkspace, {
      type: 'openFailed',
      message: 'Could not read it.'
    })

    expect(state.content).toBeNull()
    expect(state.source).toBeNull()
    expect(state.isLoading).toBe(false)
    expect(state.error).toBe('Could not read it.')
  })
})

describe('dirty state', () => {
  it('becomes dirty on an edit and clean again when that revision is saved', () => {
    const edited = edit(opened(), 'Renamed')
    expect(isDirty(edited)).toBe(true)
    expect(canSave(edited)).toBe(true)

    const revision = editableContentOf(edited)?.state.revision ?? -1
    const saved = workspaceReducer(edited, {
      type: 'saved',
      diskRevision: 'hash-2',
      modelRevision: revision
    })

    expect(isDirty(saved)).toBe(false)
    expect(saved.source?.diskRevision).toBe('hash-2')
  })

  it('stays dirty when an edit lands while the save is in flight', () => {
    // The case that loses work if it is got wrong: the save serialized
    // revision N, the user typed, and the acknowledgement is still for N.
    const first = edit(opened(), 'First')
    const inFlightRevision = editableContentOf(first)?.state.revision ?? -1

    const second = edit(workspaceReducer(first, { type: 'saveStarted' }), 'Second')
    const saved = workspaceReducer(second, {
      type: 'saved',
      diskRevision: 'hash-2',
      modelRevision: inFlightRevision
    })

    expect(isDirty(saved)).toBe(true)
    expect(saved.isSaving).toBe(false)
  })

  it('is not dirtied by a rejected command', () => {
    const state = opened()
    const rejected = workspaceReducer(state, {
      type: 'updateNode',
      nodeId: 'does-not-exist',
      patch: { title: 'X' }
    })

    expect(isDirty(rejected)).toBe(false)
    expect(rejected.error).not.toBeNull()
  })

  it('ignores commands entirely on a read-only project', () => {
    const state = opened('examples/sample-project.json')
    const after = workspaceReducer(state, {
      type: 'setNodeStatus',
      nodeId: 'anything',
      status: 'done'
    })

    expect(after).toBe(state)
  })
})

describe('save outcomes', () => {
  it('keeps the work and blocks saving after a conflict', () => {
    const conflicted = workspaceReducer(edit(opened(), 'Renamed'), { type: 'saveConflicted' })

    expect(conflicted.hasConflict).toBe(true)
    expect(isDirty(conflicted)).toBe(true)
    // Nothing may be written until the user decides what to do.
    expect(canSave(conflicted)).toBe(false)
    expect(conflicted.isSaving).toBe(false)
  })

  it('allows saving again once the conflict is dismissed', () => {
    const state = reduce(
      edit(opened(), 'Renamed'),
      { type: 'saveConflicted' },
      {
        type: 'dismissConflict'
      }
    )

    expect(canSave(state)).toBe(true)
  })

  it('keeps the project dirty when the write fails', () => {
    const failed = workspaceReducer(edit(opened(), 'Renamed'), {
      type: 'saveFailed',
      message: 'EPERM: locked'
    })

    expect(isDirty(failed)).toBe(true)
    expect(failed.error).toContain('EPERM')
    expect(failed.isSaving).toBe(false)
    // Recoverable: the user can simply try again.
    expect(canSave(failed)).toBe(true)
  })

  it('does not advance the disk revision on a failed or conflicted save', () => {
    const edited = edit(opened(), 'Renamed')

    expect(
      workspaceReducer(edited, { type: 'saveFailed', message: 'x' }).source?.diskRevision
    ).toBe('hash-1')
    expect(workspaceReducer(edited, { type: 'saveConflicted' }).source?.diskRevision).toBe('hash-1')
  })
})

describe('commands reach the mutation layer', () => {
  it('creates nodes with the ids it was given', () => {
    const state = workspaceReducer(opened(), {
      type: 'createNodes',
      parentId: 'ableton.template.project',
      inputs: [
        { title: 'One', kind: 'task', status: 'todo' },
        { title: 'Two', kind: 'task', status: 'todo' }
      ],
      ids: ['id-a', 'id-b']
    })

    const model = editableContentOf(state)?.state
    expect(model?.nodesById.get('id-a')?.title).toBe('One')
    expect(model?.nodesById.get('ableton.template.project')?.childIds).toContain('id-b')
  })

  it('refuses a move that would detach a subtree, and says why', () => {
    const state = workspaceReducer(opened(), {
      type: 'moveNode',
      nodeId: 'ableton',
      newParentId: 'ableton.template'
    })

    expect(state.error).toContain('cannot be filed inside')
    expect(isDirty(state)).toBe(false)
  })
})
