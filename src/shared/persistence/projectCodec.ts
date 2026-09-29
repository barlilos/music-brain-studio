/**
 * Between `ProjectState` and the file on disk.
 *
 * This is the **only** module allowed to look inside a `ProjectDocument` for an
 * editable project — the same discipline `@shared/model/adapter` holds for the
 * read-only path, and the reason no component in the application names a JSON
 * field.
 *
 * Its real job is not translation, which is easy, but **not losing anything**.
 * The reference file carries `taskType`, `priority`, `energy`, `successCriteria`,
 * `related`, `dependsOn`, `resources` and `outputs` on nearly every node, and the
 * first Inspector edits five fields. Everything else has to survive a load and a
 * save untouched — not merely present, but in the same place, in the same order,
 * spelled the same way. A save that reorders keys or materialises defaults would
 * turn a one-word rename into a twelve-thousand-line diff, which is the same as
 * having no diff at all.
 *
 * So import keeps a **preservation record**: for every node, its original entries
 * in file order, with the child list marked rather than copied. Export replays
 * that record, substituting the modeled fields in place. A field the model has
 * never heard of passes straight through, at its original index.
 *
 * Isomorphic: no React, no DOM, no Node.
 */

import type { JsonValue, ProjectDocument } from '@shared/types'
import { UNKNOWN_NODE_KIND, type NodeKind } from '@shared/model/node'
import { recognizeWorkStatus } from '@shared/model/workStatus'
import type { NodeId, ProjectNode, ProjectState } from '@shared/model/project'

/** A JSON object — the only shape a node or a document may take. */
type JsonObject = { [key: string]: JsonValue }

/**
 * The fields the model owns and may rewrite. Everything not in this list is
 * preserved verbatim.
 *
 * Also the order appended fields are written in, for a node that gains one it
 * did not have — so a task that acquires notes gets them where a reader expects,
 * rather than wherever iteration happened to put them.
 */
const MODELED_KEYS = ['id', 'title', 'nodeType', 'status', 'tags', 'notes'] as const
type ModeledKey = (typeof MODELED_KEYS)[number]

const MODELED = new Set<string>(MODELED_KEYS)

/** Keys a child list may live under, canonical first. */
const CHILD_KEYS = ['children', 'nodes'] as const

/** The key a node that never had children gets when it gains some. */
const DEFAULT_CHILD_KEY = 'children'

// ---------------------------------------------------------------- preservation

/**
 * One entry of an original object, in its original position.
 *
 * The child list is a marker rather than a value: keeping the raw children would
 * duplicate the whole document in memory and, worse, leave a second stale copy of
 * the tree that could be exported by mistake.
 */
type PreservedSlot =
  { slot: 'field'; key: string; value: JsonValue } | { slot: 'children'; key: string }

interface PreservedNode {
  slots: readonly PreservedSlot[]
}

/** The document's own entries, with the position of the tree root marked. */
type DocumentSlot =
  | { slot: 'field'; key: string; value: JsonValue }
  /** `key` is `null` when the document itself is the root node. */
  | { slot: 'root'; key: string | null }

export interface PreservationRecord {
  documentSlots: readonly DocumentSlot[]
  /** The root/`brain` node. Not a `ProjectNode` — it is the project's envelope. */
  root: PreservedNode
  nodes: ReadonlyMap<NodeId, PreservedNode>
}

export type ImportResult =
  | { status: 'editable'; state: ProjectState; preservation: PreservationRecord }
  /**
   * The file is not a Music Brain node hierarchy with stable unique ids, so it
   * cannot be edited safely. `reason` is shown to the user, so it explains rather
   * than diagnoses.
   */
  | { status: 'unsupported'; reason: string }

// --------------------------------------------------------------------- reading

function isObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonEmptyString(value: JsonValue | undefined): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/** The node's child list and the key it was found under, if it has one. */
function readChildEntry(node: JsonObject): { key: string; items: JsonValue[] } | undefined {
  for (const key of CHILD_KEYS) {
    const value = node[key]
    if (Array.isArray(value)) return { key, items: value }
  }
  return undefined
}

function toSlots(raw: JsonObject, childKey: string | undefined): PreservedSlot[] {
  return Object.entries(raw).map(([key, value]) =>
    key === childKey ? { slot: 'children', key } : { slot: 'field', key, value }
  )
}

/**
 * Finds the node the tree hangs off.
 *
 * Real files wrap the tree in an envelope beside metadata about the file —
 * `{ schema: {…}, brain: { title, children } }` — so the root is one step down.
 * The wrapper key is discovered rather than named, exactly as the read-only
 * adapter discovers it: hardcoding `brain` would tie the codec to one generation
 * of one file, and "the first property that looks like a node" costs nothing and
 * also covers a document that is the root itself.
 */
function findRoot(document: JsonValue): { node: JsonObject; key: string | null } | undefined {
  if (isObject(document) && readChildEntry(document) !== undefined) {
    return { node: document, key: null }
  }

  if (isObject(document)) {
    for (const [key, value] of Object.entries(document)) {
      if (isObject(value) && readChildEntry(value) !== undefined) {
        return { node: value, key }
      }
    }
  }

  return undefined
}

/** Everything import needs to hand back, accumulated as the tree is walked. */
interface Accumulator {
  nodes: Map<NodeId, ProjectNode>
  preserved: Map<NodeId, PreservedNode>
  /** The first thing that made the file uneditable, if anything did. */
  failure: string | null
}

/**
 * Imports one node and everything beneath it, returning its id.
 *
 * Validation is strict here in a way the read-only adapter deliberately is not.
 * The adapter's job is to show a user's file whatever shape it is in; this one's
 * job is to guarantee that what is written back is the same file with the user's
 * edits in it. A node without a usable id cannot be addressed, and two nodes
 * sharing an id would silently merge under selection, expansion and every future
 * cross-reference — so both are refusals rather than repairs.
 */
function importNode(
  raw: JsonValue,
  parentId: NodeId | null,
  accumulator: Accumulator
): NodeId | null {
  if (accumulator.failure !== null) return null

  if (!isObject(raw)) {
    accumulator.failure = 'This file contains entries that are not nodes.'
    return null
  }

  const id = nonEmptyString(raw['id'])
  if (id === undefined) {
    accumulator.failure = 'This file has entries without an id, so they cannot be edited safely.'
    return null
  }
  if (accumulator.nodes.has(id)) {
    accumulator.failure = `Two entries in this file share the id "${id}".`
    return null
  }

  const childEntry = readChildEntry(raw)
  const persistedKind = nonEmptyString(raw['nodeType'])
  const persistedStatus = typeof raw['status'] === 'string' ? raw['status'] : undefined
  const tags = Array.isArray(raw['tags'])
    ? raw['tags'].flatMap((tag) => {
        const text = nonEmptyString(tag)
        return text === undefined ? [] : [text]
      })
    : []

  const node: ProjectNode = {
    id,
    title: nonEmptyString(raw['title']) ?? '',
    kind: persistedKind?.toLowerCase() ?? UNKNOWN_NODE_KIND,
    status: recognizeWorkStatus(persistedStatus),
    persistedStatus,
    tags,
    notes: typeof raw['notes'] === 'string' ? raw['notes'] : '',
    persistedKind,
    parentId,
    childIds: []
  }

  // Registered before descending so a child that names its parent's id is caught
  // as a duplicate rather than silently overwriting it.
  accumulator.nodes.set(id, node)
  accumulator.preserved.set(id, { slots: toSlots(raw, childEntry?.key) })

  for (const item of childEntry?.items ?? []) {
    const childId = importNode(item, id, accumulator)
    if (childId === null) return null
    node.childIds.push(childId)
  }

  return id
}

/**
 * Reads a document into the editable model, or explains why it cannot be.
 *
 * Total: it never throws, whatever the file holds. "This is not a shape I can
 * edit" is an ordinary outcome — the user is allowed to open anything — and it
 * travels as a value so the caller can fall back to the read-only path.
 */
export function importProject(document: ProjectDocument): ImportResult {
  const root = findRoot(document)
  if (root === undefined) {
    return {
      status: 'unsupported',
      reason: 'This file does not contain a Music Brain node hierarchy.'
    }
  }

  const childEntry = readChildEntry(root.node)
  const accumulator: Accumulator = { nodes: new Map(), preserved: new Map(), failure: null }
  const rootIds: NodeId[] = []

  for (const item of childEntry?.items ?? []) {
    const id = importNode(item, null, accumulator)
    if (id === null) break
    rootIds.push(id)
  }

  if (accumulator.failure !== null) {
    return { status: 'unsupported', reason: accumulator.failure }
  }

  const documentSlots: DocumentSlot[] =
    root.key === null
      ? [{ slot: 'root', key: null }]
      : Object.entries(document as JsonObject).map(([key, value]) =>
          key === root.key ? { slot: 'root', key } : { slot: 'field', key, value }
        )

  return {
    status: 'editable',
    state: {
      name: nonEmptyString(root.node['title']),
      rootIds,
      nodesById: accumulator.nodes,
      revision: 0
    },
    preservation: {
      documentSlots,
      root: { slots: toSlots(root.node, childEntry?.key) },
      nodes: accumulator.preserved
    }
  }
}

// --------------------------------------------------------------------- writing

/**
 * What a modeled field should be written as, or `undefined` to omit it.
 *
 * `wasPresent` is what stops defaults being materialised. An `area` with no
 * `tags` key models as `tags: []`, and writing `"tags": []` back would add a line
 * to 151 nodes that nobody edited. A field is written when the file already had
 * it, or when it now carries something.
 */
function modeledValue(
  node: ProjectNode,
  key: ModeledKey,
  wasPresent: boolean
): JsonValue | undefined {
  switch (key) {
    case 'id':
      return node.id
    case 'title':
      return wasPresent || node.title.length > 0 ? node.title : undefined
    case 'nodeType':
      // `persistedKind` keeps a file's own spelling until the type is actually
      // changed, so opening a file that says `Task` and renaming the node does
      // not quietly rewrite it to `task`.
      if (node.persistedKind !== undefined) return node.persistedKind
      return wasPresent || node.kind !== UNKNOWN_NODE_KIND ? node.kind : undefined
    case 'status':
      // The whole of decision R2 lives on this line: what was on disk wins until
      // the user explicitly sets a status, at which point `persistedStatus` is
      // cleared and the canonical value is written.
      return node.persistedStatus ?? node.status
    case 'tags':
      return wasPresent || node.tags.length > 0 ? [...node.tags] : undefined
    case 'notes':
      return wasPresent || node.notes.length > 0 ? node.notes : undefined
  }
}

function exportNode(
  state: ProjectState,
  preservation: PreservationRecord,
  nodeId: NodeId
): JsonValue {
  const node = state.nodesById.get(nodeId)
  // Unreachable: ids come from `childIds`, which the mutations keep in step with
  // `nodesById`. Returning null rather than throwing keeps export total.
  if (node === undefined) return null

  const slots = preservation.nodes.get(nodeId)?.slots ?? []
  const children = (): JsonValue => node.childIds.map((id) => exportNode(state, preservation, id))

  const out: JsonObject = {}
  const written = new Set<string>()
  let hasChildSlot = false

  for (const slot of slots) {
    if (slot.slot === 'children') {
      // Kept even when the node is now empty: the file had the key, and removing
      // it would be a change the user did not make.
      out[slot.key] = children()
      hasChildSlot = true
      continue
    }

    if (MODELED.has(slot.key)) {
      const value = modeledValue(node, slot.key as ModeledKey, true)
      if (value !== undefined) out[slot.key] = value
      written.add(slot.key)
      continue
    }

    out[slot.key] = slot.value
  }

  for (const key of MODELED_KEYS) {
    if (written.has(key)) continue
    const value = modeledValue(node, key, false)
    if (value !== undefined) out[key] = value
  }

  if (!hasChildSlot && node.childIds.length > 0) out[DEFAULT_CHILD_KEY] = children()

  return out
}

/**
 * Writes the model back out, with everything the model does not know about still
 * in place.
 *
 * The root node is replayed entirely verbatim apart from its child list: its
 * `title` names the project and M005 does not rename projects, so there is
 * nothing here the model is entitled to rewrite.
 */
export function exportProject(
  state: ProjectState,
  preservation: PreservationRecord
): ProjectDocument {
  const rootObject: JsonObject = {}
  let rootHasChildSlot = false

  for (const slot of preservation.root.slots) {
    if (slot.slot === 'children') {
      rootObject[slot.key] = state.rootIds.map((id) => exportNode(state, preservation, id))
      rootHasChildSlot = true
      continue
    }
    rootObject[slot.key] = slot.value
  }

  if (!rootHasChildSlot) {
    rootObject[DEFAULT_CHILD_KEY] = state.rootIds.map((id) => exportNode(state, preservation, id))
  }

  const documentSlots = preservation.documentSlots
  if (documentSlots.length === 1 && documentSlots[0]?.slot === 'root') {
    return rootObject
  }

  const out: JsonObject = {}
  for (const slot of documentSlots) {
    if (slot.slot === 'root') {
      // `key` is non-null here: a null key only ever occurs as the single slot
      // handled above.
      if (slot.key !== null) out[slot.key] = rootObject
      continue
    }
    out[slot.key] = slot.value
  }

  return out
}

/**
 * The preservation record a project that was never imported starts from.
 *
 * Not used by the application, which always imports a real file, but it keeps
 * `exportProject` total for tests that build a state by hand.
 */
export function emptyPreservation(): PreservationRecord {
  return {
    documentSlots: [{ slot: 'root', key: null }],
    root: { slots: [{ slot: 'children', key: DEFAULT_CHILD_KEY }] },
    nodes: new Map()
  }
}

/** Re-exported so callers do not have to reach for `NodeKind` separately. */
export type { NodeKind }
