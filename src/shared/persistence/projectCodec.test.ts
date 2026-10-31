import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { JsonValue, ProjectDocument } from '@shared/types'
import {
  exportProject,
  importProject,
  type PreservationRecord
} from '@shared/persistence/projectCodec'
import type { ProjectState } from '@shared/model/project'

/**
 * The codec's contract is "nothing is lost", so most of these tests are about
 * what a save must *not* change.
 *
 * The real knowledge base is read here, and only read. It is the only fixture
 * that exercises the shapes that actually matter — 548 nodes, eight preserved
 * fields per node, a `schema` envelope, semantic ids — and nothing in this file
 * writes to it or to any path derived from it.
 */

const REAL_FILE = 'data/music-brain.json'

function readJson(path: string): ProjectDocument {
  return JSON.parse(readFileSync(path, 'utf8')) as ProjectDocument
}

interface Imported {
  state: ProjectState
  preservation: PreservationRecord
}

/** The editable import, or a failure the test can report usefully. */
function importEditable(document: ProjectDocument): Imported {
  const result = importProject(document)
  if (result.status !== 'editable') {
    throw new Error(`expected an editable import, got: ${result.reason}`)
  }
  return { state: result.state, preservation: result.preservation }
}

/**
 * Applies a field change the way a mutation would, without depending on the
 * mutation layer — these tests are about the codec alone.
 */
function withNode(
  state: ProjectState,
  nodeId: string,
  patch: Partial<ProjectState['nodesById'] extends ReadonlyMap<string, infer N> ? N : never>
): ProjectState {
  const node = state.nodesById.get(nodeId)
  if (node === undefined) throw new Error(`no node ${nodeId}`)
  const nodesById = new Map(state.nodesById)
  nodesById.set(nodeId, { ...node, ...patch })
  return { ...state, nodesById, revision: state.revision + 1 }
}

/** Finds a node in a raw document by its persisted id. */
function findNode(document: ProjectDocument, id: string): Record<string, JsonValue> | undefined {
  let found: Record<string, JsonValue> | undefined

  function walk(value: JsonValue): void {
    if (found !== undefined) return
    if (Array.isArray(value)) {
      for (const item of value) walk(item)
      return
    }
    if (typeof value !== 'object' || value === null) return
    if (value['id'] === id) {
      found = value
      return
    }
    for (const child of Object.values(value)) walk(child)
  }

  walk(document)
  return found
}

describe('importProject', () => {
  it('imports the real knowledge base as editable', () => {
    const { state } = importEditable(readJson(REAL_FILE))

    expect(state.name).toBe('Music Brain')
    expect(state.nodesById.size).toBe(548)
    expect(state.rootIds.length).toBe(13)
    expect(state.revision).toBe(0)
  })

  it('gives every node explicit parentage rather than deriving it from the id', () => {
    const { state } = importEditable(readJson(REAL_FILE))

    for (const [id, node] of state.nodesById) {
      if (node.parentId === null) {
        expect(state.rootIds).toContain(id)
      } else {
        expect(state.nodesById.get(node.parentId)?.childIds).toContain(id)
      }
    }
  })

  it('does not let an id that looks hierarchical imply parentage', () => {
    const { state } = importEditable(readJson(REAL_FILE))

    // `quad.base.cab` reads like a child of `quad.base`, and is not one.
    const node = state.nodesById.get('quad.base.cab')
    expect(node).toBeDefined()
    expect(node?.parentId).not.toBe('quad.base')
  })

  it('recognises status aliases without changing what is stored', () => {
    const { state } = importEditable(readJson(REAL_FILE))

    const active = [...state.nodesById.values()].filter((n) => n.persistedStatus === 'active')
    expect(active.length).toBe(3)
    for (const node of active) {
      expect(node.status).toBe('in_progress')
      // All three sit on top-level domains, which is why displaying them as In
      // Progress costs nothing and rewriting them would.
      expect(node.kind).toBe('domain')
    }
  })

  it('keeps an absent status absent rather than defaulting it to todo', () => {
    const { state } = importEditable(readJson(REAL_FILE))

    const absent = [...state.nodesById.values()].filter((n) => n.persistedStatus === undefined)
    expect(absent.length).toBe(9)
    for (const node of absent) expect(node.status).toBeUndefined()
  })

  it('refuses a file whose ids are not unique', () => {
    const result = importProject({
      brain: {
        title: 'Duplicated',
        children: [
          { id: 'same', title: 'One', nodeType: 'task' },
          { id: 'same', title: 'Two', nodeType: 'task' }
        ]
      }
    })

    expect(result.status).toBe('unsupported')
    if (result.status === 'unsupported') expect(result.reason).toContain('"same"')
  })

  it('refuses a file whose nodes have no ids', () => {
    const result = importProject(readJson('examples/sample-project.json'))

    expect(result.status).toBe('unsupported')
  })

  it('accepts the trimmed Music Brain fixture', () => {
    expect(importProject(readJson('examples/music-brain-project.json')).status).toBe('editable')
  })

  it('refuses a document with no node hierarchy at all', () => {
    expect(importProject({ hello: 'world' }).status).toBe('unsupported')
    expect(importProject(42).status).toBe('unsupported')
    expect(importProject(null).status).toBe('unsupported')
  })
})

describe('exportProject', () => {
  it('round-trips the real knowledge base to an identical document', () => {
    const document = readJson(REAL_FILE)
    const { state, preservation } = importEditable(document)

    expect(exportProject(state, preservation)).toEqual(document)
  })

  it('round-trips it to identical text, which proves key order survived', () => {
    const document = readJson(REAL_FILE)
    const { state, preservation } = importEditable(document)

    // `JSON.stringify` walks keys in insertion order, so an identical string is
    // a stronger claim than `toEqual`, which ignores order entirely.
    expect(JSON.stringify(exportProject(state, preservation), null, 2)).toBe(
      JSON.stringify(document, null, 2)
    )
  })

  it('round-trips the real file to identical bytes once CRLF is reapplied', () => {
    const raw = readFileSync(REAL_FILE, 'utf8')
    const { state, preservation } = importEditable(JSON.parse(raw) as ProjectDocument)

    const written = JSON.stringify(exportProject(state, preservation), null, 2).replace(
      /\n/g,
      '\r\n'
    )

    expect(written).toBe(raw)
  })

  it('preserves unknown fields through an edit to a modeled one', () => {
    const document = readJson(REAL_FILE)
    const { state, preservation } = importEditable(document)
    const id = 'ableton.template.project.create'

    const written = exportProject(withNode(state, id, { title: 'Renamed' }), preservation)

    const before = findNode(document, id)
    const after = findNode(written, id)
    for (const key of [
      'taskType',
      'priority',
      'energy',
      'related',
      'dependsOn',
      'resources',
      'outputs',
      'successCriteria'
    ]) {
      expect(after?.[key]).toEqual(before?.[key])
    }
    expect(after?.['title']).toBe('Renamed')
  })

  it('changes exactly one line of the serialized file for a one-field edit', () => {
    const document = readJson(REAL_FILE)
    const { state, preservation } = importEditable(document)

    const written = exportProject(
      withNode(state, 'ableton.template.project.create', { title: 'Renamed' }),
      preservation
    )

    const before = JSON.stringify(document, null, 2).split('\n')
    const after = JSON.stringify(written, null, 2).split('\n')
    expect(after.length).toBe(before.length)

    const changed = before.flatMap((line, i) => (line === after[i] ? [] : [i]))
    expect(changed.length).toBe(1)
  })

  it('preserves a status alias when another field on that node is edited', () => {
    const document = readJson(REAL_FILE)
    const { state, preservation } = importEditable(document)

    // R2: renaming, retyping or retagging must never canonicalise `active`.
    const renamed = withNode(state, 'ableton', { title: 'Ableton Live' })
    expect(findNode(exportProject(renamed, preservation), 'ableton')?.['status']).toBe('active')

    const retagged = withNode(state, 'ableton', { tags: ['daw'] })
    expect(findNode(exportProject(retagged, preservation), 'ableton')?.['status']).toBe('active')

    const retyped = withNode(state, 'ableton', { kind: 'area', persistedKind: undefined })
    expect(findNode(exportProject(retyped, preservation), 'ableton')?.['status']).toBe('active')
  })

  it('writes a canonical status once the alias has been explicitly cleared', () => {
    const document = readJson(REAL_FILE)
    const { state, preservation } = importEditable(document)

    // What `setNodeStatus` does: choose a state, and drop the persisted spelling.
    const set = withNode(state, 'ableton', { status: 'done', persistedStatus: undefined })

    expect(findNode(exportProject(set, preservation), 'ableton')?.['status']).toBe('done')
  })

  it('does not materialise defaults on nodes that never carried them', () => {
    const document = readJson(REAL_FILE)
    const { state, preservation } = importEditable(document)

    // Nine areas in the real file carry only `id`, `title`, `nodeType` and
    // `children`. They model as `tags: []`, `notes: ''` and no status, and must
    // come back out exactly as thin as they went in.
    const id = 'ableton.template.rhythm'
    const areaBefore = findNode(document, id)
    expect(Object.keys(areaBefore ?? {})).toEqual(['id', 'title', 'nodeType', 'children'])

    const areaAfter = findNode(exportProject(state, preservation), id)
    expect(Object.keys(areaAfter ?? {})).toEqual(['id', 'title', 'nodeType', 'children'])
  })

  it('writes a field a node did not have once it carries a value', () => {
    const document = readJson(REAL_FILE)
    const { state, preservation } = importEditable(document)

    const id = 'ableton.template.rhythm'
    const noted = withNode(state, id, { notes: 'Set the tempo first' })
    const written = findNode(exportProject(noted, preservation), id)

    expect(written?.['notes']).toBe('Set the tempo first')
    // Appended after the fields it already had, not inserted among them.
    expect(Object.keys(written ?? {})).toEqual(['id', 'title', 'nodeType', 'children', 'notes'])
  })

  it('keeps child order exactly as the model holds it', () => {
    const document = readJson(REAL_FILE)
    const { state, preservation } = importEditable(document)

    const parentId = 'ableton.template.project'
    const parent = state.nodesById.get(parentId)
    expect(parent).toBeDefined()

    const reordered = withNode(state, parentId, {
      childIds: [...(parent?.childIds ?? [])].reverse()
    })

    const children = findNode(exportProject(reordered, preservation), parentId)?.['children']
    expect(Array.isArray(children)).toBe(true)
    const writtenIds = (children as Record<string, JsonValue>[]).map((c) => c['id'])
    expect(writtenIds).toEqual([...(parent?.childIds ?? [])].reverse())
  })

  it('preserves the document envelope around the tree', () => {
    const document = readJson(REAL_FILE)
    const { state, preservation } = importEditable(document)

    const written = exportProject(state, preservation) as Record<string, JsonValue>
    expect(Object.keys(written)).toEqual(['schema', 'brain'])
    expect(written['schema']).toEqual((document as Record<string, JsonValue>)['schema'])
  })

  it('preserves the root node fields it does not model', () => {
    const document = readJson(REAL_FILE)
    const { state, preservation } = importEditable(document)

    const brainBefore = (document as Record<string, JsonValue>)['brain'] as Record<
      string,
      JsonValue
    >
    const brainAfter = (exportProject(state, preservation) as Record<string, JsonValue>)[
      'brain'
    ] as Record<string, JsonValue>

    expect(Object.keys(brainAfter)).toEqual(Object.keys(brainBefore))
    expect(brainAfter['version']).toBe(brainBefore['version'])
    expect(brainAfter['priority']).toBe(brainBefore['priority'])
  })
})
