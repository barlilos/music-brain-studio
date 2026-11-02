import { createHash } from 'node:crypto'
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { JsonValue } from '@shared/types'
import {
  exportProject,
  importProject,
  type PreservationRecord
} from '@shared/persistence/projectCodec'
import type { ProjectState } from '@shared/model/project'
import {
  createNodes,
  setNodeFinished,
  setNodeStatus,
  type MutationResult
} from '@shared/model/projectMutations'
import { projectProjection } from '@shared/model/projectProjection'
import { regionStateOf } from '@shared/model/progress'
import { readProjectFile, saveProjectFile, type FileFormat } from '@main/persistence/projectFile'

/**
 * Milestone 006, end to end, on a disposable copy of the demo fixture: open the
 * graph's data, complete a task, discover work, declare a branch Finished, save,
 * and reopen. Each step is the function the graph's controls call.
 *
 * Neither the fixture nor the real knowledge base is ever written; both hashes
 * are checked at the end.
 */

const FIXTURE = 'examples/living-progress-graph-demo.json'
const REAL_FILE = 'data/music-brain.json'

const hashOf = (path: string): string =>
  createHash('sha256').update(readFileSync(path)).digest('hex')

let workspace: string
let projectPath: string
const hashesBefore: Record<string, string> = {}

beforeAll(() => {
  hashesBefore[FIXTURE] = hashOf(FIXTURE)
  hashesBefore[REAL_FILE] = hashOf(REAL_FILE)
  workspace = mkdtempSync(join(tmpdir(), 'mbs-lpg-'))
  projectPath = join(workspace, 'demo.json')
  copyFileSync(FIXTURE, projectPath)
})

afterAll(() => {
  rmSync(workspace, { recursive: true, force: true })
})

function ok(result: MutationResult): ProjectState {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
  return result.state
}

function find(state: ProjectState, title: string): string {
  for (const node of state.nodesById.values()) if (node.title === title) return node.id
  throw new Error(`No node titled ${title}`)
}

interface Opened {
  state: ProjectState
  preservation: PreservationRecord
  revision: string
  format: FileFormat
}

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

describe('the living progress graph, end to end', () => {
  it('opens the fixture with the states the graph distinguishes', async () => {
    const { state } = await open()
    const { progress, index } = projectProjection(state)
    const region = (title: string): string => {
      const id = find(state, title)
      return regionStateOf(progress.byId.get(id), index.byId.get(id)?.finishedAt)
    }
    expect(region('Vocal tracking — Single 1')).toBe('finished')
    expect(region('Drums — Single 1')).toBe('nothingOpen')
    expect(region('Rhythm guitar recording')).toBe('open')
    expect(region('Summer festival set')).toBe('empty')
    expect(state.nodesById.size).toBe(598)
  })

  it('round-trips the fixture untouched, including the finished date and the envelope note', async () => {
    const { state, preservation } = await open()
    const original = JSON.parse(readFileSync(FIXTURE, 'utf8')) as JsonValue
    expect(exportProject(state, preservation)).toEqual(original)
  })

  it('completes, discovers, finishes, saves and reopens', async () => {
    const opened = await open()
    let state = opened.state

    const guitar = find(state, 'Rhythm guitar recording')
    const review = find(state, 'Review takes')
    const drums = find(state, 'Drums — Single 1')
    const before = projectProjection(state).progress.byId.get(guitar)!

    // Complete a task: the containing region counts it at once.
    state = ok(setNodeStatus(state, review, 'done'))
    const afterDone = projectProjection(state).progress.byId.get(guitar)!
    expect(afterDone.done).toBe(before.done + 1)

    // Discover two more: done stays, open grows.
    let n = 0
    state = ok(
      createNodes(
        state,
        guitar,
        [
          { title: 'Re-record intro riff', kind: 'task', status: 'todo' },
          { title: 'Fix timing in take 3', kind: 'task', status: 'todo' }
        ],
        () => `lpg-new-${++n}`
      )
    )
    const afterDiscovery = projectProjection(state).progress.byId.get(guitar)!
    expect(afterDiscovery.done).toBe(afterDone.done)
    expect(afterDiscovery.todo).toBe(afterDone.todo + 2)

    // Declare Drums finished. Nothing inside it changes.
    state = ok(setNodeFinished(state, drums, '2026-11-02'))

    const saved = await saveProjectFile(
      projectPath,
      opened.format,
      opened.revision,
      exportProject(state, opened.preservation)
    )
    expect(saved.status).toBe('written')

    const reopened = await open()
    const projection = projectProjection(reopened.state)
    expect(reopened.state.nodesById.get(review)?.status).toBe('done')
    expect(reopened.state.nodesById.get('lpg-new-1')?.title).toBe('Re-record intro riff')
    expect(reopened.state.nodesById.get(drums)?.finishedAt).toBe('2026-11-02')
    expect(projection.progress.byId.get(guitar)).toEqual(afterDiscovery)

    // Reopening removes the key rather than writing an empty one.
    const again = ok(setNodeFinished(reopened.state, drums, null))
    expect(JSON.stringify(exportProject(again, reopened.preservation))).not.toContain(
      '"finishedAt":"2026-11-02"'
    )
  })
})

describe('protected files', () => {
  it('never wrote to the fixture or the real knowledge base', () => {
    expect(hashOf(FIXTURE)).toBe(hashesBefore[FIXTURE])
    expect(hashOf(REAL_FILE)).toBe(hashesBefore[REAL_FILE])
  })
})
