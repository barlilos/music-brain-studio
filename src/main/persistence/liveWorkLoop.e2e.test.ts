import { createHash } from 'node:crypto'
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { JsonValue, ProjectDocument } from '@shared/types'
import {
  exportProject,
  importProject,
  type PreservationRecord
} from '@shared/persistence/projectCodec'
import type { ProjectState } from '@shared/model/project'
import {
  changeNodeType,
  createNodes,
  moveNode,
  setNodeStatus,
  updateNode,
  type MutationResult
} from '@shared/model/projectMutations'
import { projectProjection } from '@shared/model/projectProjection'
import { parseBulkLines } from '@shared/model/bulkCapture'
import { readProjectFile, saveProjectFile, type FileFormat } from '@main/persistence/projectFile'

/**
 * The whole milestone, end to end, on a disposable copy of the real 548-node
 * knowledge base:
 *
 *   Discover → Capture → Structure → Work → Complete → Continue tomorrow
 *
 * Every step goes through the same functions the UI calls. The components on top
 * of them hold no rules of their own — a menu item calls `createNodes`, the
 * canvas checkbox calls `setNodeStatus`, Ctrl+S calls `saveProjectFile` — so
 * exercising this pipeline is exercising the product, deterministically and
 * without a window.
 *
 * **The real file is copied once, read-only, and never written.** Its hash is
 * captured before anything happens and asserted at the end.
 */

const REAL_FILE = 'data/music-brain.json'

const hashOf = (path: string): string =>
  createHash('sha256').update(readFileSync(path)).digest('hex')

let workspace: string
let projectPath: string
let realHashBefore: string

beforeAll(() => {
  realHashBefore = hashOf(REAL_FILE)
  workspace = mkdtempSync(join(tmpdir(), 'mbs-e2e-'))
  projectPath = join(workspace, 'music-brain.json')
  copyFileSync(REAL_FILE, projectPath)
})

afterAll(() => {
  rmSync(workspace, { recursive: true, force: true })
})

/** Unwraps a command, reporting the domain error rather than a null-pointer. */
function ok(result: MutationResult): ProjectState {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
  return result.state
}

/** The ids a command created, for the "select what you just made" behaviour. */
function created(result: MutationResult): string[] {
  if (!result.ok) throw new Error(result.error.code)
  return result.createdIds
}

/** Deterministic ids, standing in for the provider's `crypto.randomUUID()`. */
function ids(prefix: string): () => string {
  let n = 0
  return () => `${prefix}-${++n}`
}

interface Opened {
  state: ProjectState
  preservation: PreservationRecord
  revision: string
  format: FileFormat
}

/** What the application does on launch, and again on reopen. */
async function open(): Promise<Opened> {
  const read = await readProjectFile(projectPath)
  if (read.status !== 'read') throw new Error(`could not read: ${read.status}`)

  const imported = importProject(read.content.document)
  if (imported.status !== 'editable') throw new Error(imported.reason)

  return {
    state: imported.state,
    preservation: imported.preservation,
    revision: read.content.revision,
    format: { newline: read.content.newline, hasTrailingNewline: read.content.hasTrailingNewline }
  }
}

function findRaw(document: ProjectDocument, id: string): Record<string, JsonValue> | undefined {
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

describe('the live work loop, end to end', () => {
  // Ids that exist in the real file, used as the anchors for the session.
  const AREA = 'ableton.template.project'
  const TASK = 'ableton.template.project.create'
  const OTHER_AREA = 'ableton.template.rhythm'

  /** Carried between steps, exactly as a running session would. */
  let session: Opened
  let addedIds: string[] = []
  let bulkIds: string[] = []
  let savedRevision: string

  it('1. opens the knowledge base', async () => {
    session = await open()

    expect(session.state.nodesById.size).toBe(548)
    expect(session.state.name).toBe('Music Brain')
    // The layout that has to survive every save.
    expect(session.format).toEqual({ newline: '\r\n', hasTrailingNewline: false })
  })

  it('2. discovers what is left to do, without a percentage in sight', () => {
    const projection = projectProjection(session.state)

    expect(projection.progress.total).toEqual({ todo: 397, inProgress: 0, done: 0 })
    // The three `active` domains are containers, so R2 changes no count.
    expect(projection.progress.byId.get(AREA)).toEqual({ todo: 5, inProgress: 0, done: 0 })
  })

  it('3. captures a new task', () => {
    const result = createNodes(
      session.state,
      AREA,
      [{ title: 'Check the click track', kind: 'task', status: 'todo' }],
      ids('new')
    )
    addedIds = created(result)
    session.state = ok(result)

    expect(addedIds).toHaveLength(1)
    expect(session.state.nodesById.get(addedIds[0] ?? '')?.parentId).toBe(AREA)
  })

  it('4. bulk-captures a set of tasks in one transaction', () => {
    const before = session.state.revision
    const titles = parseBulkLines('  Tune the snare \n\n Re-amp the DI \n\n\nBounce a rough mix\n')
    expect(titles).toEqual(['Tune the snare', 'Re-amp the DI', 'Bounce a rough mix'])

    const result = createNodes(
      session.state,
      AREA,
      titles.map((title: string) => ({ title, kind: 'task', status: 'todo' as const })),
      ids('bulk')
    )
    bulkIds = created(result)
    session.state = ok(result)

    expect(bulkIds).toHaveLength(3)
    // One transaction, so one revision — not three.
    expect(session.state.revision).toBe(before + 1)
  })

  it('5. renames something', () => {
    session.state = ok(updateNode(session.state, TASK, { title: 'Create a clean project' }))

    expect(session.state.nodesById.get(TASK)?.title).toBe('Create a clean project')
    // Identity is untouched, which is what lets selection and expansion survive.
    expect(session.state.nodesById.get(TASK)?.id).toBe(TASK)
  })

  it('6. lets a task grow into a project', () => {
    session.state = ok(changeNodeType(session.state, TASK, 'project'))

    expect(session.state.nodesById.get(TASK)?.kind).toBe('project')
    expect(session.state.nodesById.get(TASK)?.id).toBe(TASK)
  })

  it('7. structures the work by moving a subtree', () => {
    const moved = bulkIds[0] ?? ''
    session.state = ok(moveNode(session.state, moved, OTHER_AREA))

    expect(session.state.nodesById.get(moved)?.parentId).toBe(OTHER_AREA)
    expect(session.state.nodesById.get(AREA)?.childIds).not.toContain(moved)
    expect(session.state.nodesById.get(OTHER_AREA)?.childIds).toContain(moved)
  })

  it('8. refuses a move that would detach a branch', () => {
    const result = moveNode(session.state, AREA, TASK)

    // `TASK` is inside `AREA`, so this would strand the whole subtree.
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('wouldCycle')
  })

  it('9. completes a task', () => {
    const done = addedIds[0] ?? ''
    session.state = ok(setNodeStatus(session.state, done, 'done'))

    expect(session.state.nodesById.get(done)?.status).toBe('done')
  })

  it('10. marks something as in progress', () => {
    const doing = bulkIds[1] ?? ''
    session.state = ok(setNodeStatus(session.state, doing, 'in_progress'))

    expect(session.state.nodesById.get(doing)?.status).toBe('in_progress')
  })

  it('11. fills in details without disturbing a preserved status alias', () => {
    session.state = ok(
      updateNode(session.state, TASK, {
        tags: ['setup', 'ableton'],
        notes: 'Start from the template.'
      })
    )

    // `ableton` is one of the three domains whose file says `active` (R2).
    const domain = session.state.nodesById.get('ableton')
    expect(domain?.status).toBe('in_progress')
    expect(domain?.persistedStatus).toBe('active')
  })

  it('12. shows the counts moving as work is done and discovered', () => {
    const projection = projectProjection(session.state)

    // 397 original tasks, plus 4 captured. One done, one in progress.
    expect(projection.progress.total).toEqual({ todo: 399, inProgress: 1, done: 1 })
    // Discovery raised the known total rather than lowering a score.
    expect(
      projection.progress.total.todo +
        projection.progress.total.inProgress +
        projection.progress.total.done
    ).toBe(401)
  })

  it('13. saves', async () => {
    const document = exportProject(session.state, session.preservation)
    const outcome = await saveProjectFile(projectPath, session.format, session.revision, document)

    expect(outcome.status).toBe('written')
    if (outcome.status !== 'written') return

    savedRevision = outcome.revision
    session.revision = outcome.revision

    // The file's own conventions survived.
    const raw = readFileSync(projectPath, 'utf8')
    expect(raw.includes('\r\n')).toBe(true)
    expect(/(?<!\r)\n/.test(raw)).toBe(false)
    expect(raw.endsWith('\n')).toBe(false)
  })

  it('14. reopens tomorrow with everything exactly as it was left', async () => {
    const reopened = await open()

    expect(reopened.state.nodesById.size).toBe(552)

    // Identity survived the round trip.
    for (const id of [...addedIds, ...bulkIds, TASK, AREA]) {
      expect(reopened.state.nodesById.has(id)).toBe(true)
    }

    // Edits survived.
    expect(reopened.state.nodesById.get(TASK)?.title).toBe('Create a clean project')
    expect(reopened.state.nodesById.get(TASK)?.kind).toBe('project')
    expect(reopened.state.nodesById.get(TASK)?.tags).toEqual(['setup', 'ableton'])
    expect(reopened.state.nodesById.get(TASK)?.notes).toBe('Start from the template.')
    expect(reopened.state.nodesById.get(addedIds[0] ?? '')?.status).toBe('done')
    expect(reopened.state.nodesById.get(bulkIds[1] ?? '')?.status).toBe('in_progress')

    // Structure survived.
    expect(reopened.state.nodesById.get(bulkIds[0] ?? '')?.parentId).toBe(OTHER_AREA)

    // Counts survived.
    expect(projectProjection(reopened.state).progress.total).toEqual({
      todo: 399,
      inProgress: 1,
      done: 1
    })

    session = reopened
  })

  it('15. kept every field the model does not know about, and the child order', async () => {
    const read = await readProjectFile(projectPath)
    if (read.status !== 'read') throw new Error('expected a read')

    const original = JSON.parse(readFileSync(REAL_FILE, 'utf8')) as ProjectDocument

    // An untouched node is byte-for-byte the node it always was.
    const untouchedBefore = findRaw(original, 'ableton.template.project.tracks')
    const untouchedAfter = findRaw(read.content.document, 'ableton.template.project.tracks')
    expect(untouchedAfter).toEqual(untouchedBefore)
    expect(Object.keys(untouchedAfter ?? {})).toEqual(Object.keys(untouchedBefore ?? {}))

    // An *edited* node kept the eight fields the model never models.
    const editedBefore = findRaw(original, TASK)
    const editedAfter = findRaw(read.content.document, TASK)
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
      expect(editedAfter?.[key]).toEqual(editedBefore?.[key])
    }

    // R2: the alias was never rewritten, even though its node was renamed's sibling.
    expect(findRaw(read.content.document, 'ableton')?.['status']).toBe('active')

    // The envelope survived.
    const written = read.content.document as Record<string, JsonValue>
    expect(Object.keys(written)).toEqual(['schema', 'brain'])
    expect(written['schema']).toEqual((original as Record<string, JsonValue>)['schema'])

    // Child order is the model's order, with the captured tasks appended.
    const area = findRaw(read.content.document, AREA)
    const childIds = (area?.['children'] as Record<string, JsonValue>[]).map((c) => c['id'])
    expect(childIds).toEqual(session.state.nodesById.get(AREA)?.childIds)
  })

  it('16. refuses to overwrite the file after something else changes it', async () => {
    // Another program edits the file while this session has it open.
    const external = readFileSync(projectPath, 'utf8').replace('Music Brain', 'Edited Elsewhere')
    writeFileSync(projectPath, external, 'utf8')
    const externalHash = hashOf(projectPath)
    expect(externalHash).not.toBe(savedRevision)

    // A stale save, using the revision this session loaded.
    session.state = ok(updateNode(session.state, TASK, { title: 'Renamed while stale' }))
    const outcome = await saveProjectFile(
      projectPath,
      session.format,
      session.revision,
      exportProject(session.state, session.preservation)
    )

    expect(outcome.status).toBe('conflict')
    // The other program's work is exactly as it left it.
    expect(hashOf(projectPath)).toBe(externalHash)
    expect(readFileSync(projectPath, 'utf8')).toBe(external)

    // Reload is the recovery: it takes what is on disk.
    const reloaded = await open()
    expect(reloaded.state.name).toBe('Edited Elsewhere')
  })
})

describe('the real knowledge base', () => {
  it('was never written to', () => {
    // The guarantee the whole isolated-workspace slice exists to provide.
    expect(hashOf(REAL_FILE)).toBe(realHashBefore)
  })
})
