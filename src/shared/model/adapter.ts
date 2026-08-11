/**
 * Translates a project document into the explorer's model.
 *
 * This is the **only** module in the application that names the file's fields —
 * `nodes`, `children`, `title`, `nodeType`, `metadata`, `tags`, `done`. Milestone
 * 002 confined that knowledge to `TreeView`; it now lives in a pure function
 * instead of a React component, which is what lets the main process reuse it for
 * search indexing and validation later.
 *
 * Every function here is **total**: it accepts any `ProjectDocument` and never
 * throws. The input is a file the user picked, and `JSON.parse` is still the only
 * thing that has vetted it, so "this field is missing or the wrong type" is a
 * normal case rather than an error. A node the adapter does not understand keeps
 * its label, keeps its children and stays navigable — see the milestone document
 * for why silently dropping it would be worse than showing raw JSON.
 */

import type { ProjectDocument } from '@shared/types'
import { ROOT_NODE_ID, childNodeId } from '@shared/utils/nodeId'
import {
  UNKNOWN_NODE_KIND,
  type ExplorerNode,
  type ExplorerProject,
  type NodeKind
} from '@shared/model/node'

/** A JSON object, which is the only shape any field below can be read from. */
type JsonObject = { [key: string]: ProjectDocument }

function isObject(value: ProjectDocument): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Reads a property, tolerating a container that is not an object at all. */
function property(value: ProjectDocument, key: string): ProjectDocument | undefined {
  return isObject(value) ? value[key] : undefined
}

/** A string property, but only if it carries something once trimmed. */
function nonEmptyString(value: ProjectDocument | undefined): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/**
 * Reads a field from the node itself or, failing that, from its `metadata`.
 *
 * Both placements appear in practice and the distinction is bookkeeping the user
 * never sees, so the explorer accepts either. The node's own property wins,
 * being the more specific of the two.
 */
function field(node: ProjectDocument, key: string): ProjectDocument | undefined {
  return property(node, key) ?? property(property(node, 'metadata') ?? null, key)
}

/** The node's display name. `title` is canonical; `name` is accepted too. */
function readLabel(node: ProjectDocument): string | undefined {
  if (typeof node === 'string') return nonEmptyString(node)
  return nonEmptyString(property(node, 'title')) ?? nonEmptyString(property(node, 'name'))
}

/**
 * The node's kind, normalised to lower case so that `Task`, `task` and `TASK`
 * reach the registry as one key. Anything missing or non-textual becomes
 * `UNKNOWN_NODE_KIND`, which the registry resolves to its fallback presentation.
 */
function readKind(node: ProjectDocument): NodeKind {
  const declared = nonEmptyString(field(node, 'nodeType')) ?? nonEmptyString(field(node, 'type'))
  return declared?.toLowerCase() ?? UNKNOWN_NODE_KIND
}

/**
 * Whether the node is complete, or `undefined` if it does not carry the concept.
 *
 * Three spellings are accepted because all three are common and the difference
 * is not one the user should have to care about: a boolean `done`, a boolean
 * `completed`, or a `status` of `done`/`complete`/`completed`.
 */
function readCompletion(node: ProjectDocument): boolean | undefined {
  const done = field(node, 'done') ?? field(node, 'completed')
  if (typeof done === 'boolean') return done

  const status = nonEmptyString(field(node, 'status'))?.toLowerCase()
  if (status === undefined) return undefined
  return status === 'done' || status === 'complete' || status === 'completed'
}

/** Tags, filtered to the entries that are actually usable as text. */
function readTags(node: ProjectDocument): string[] {
  const tags = field(node, 'tags')
  if (!Array.isArray(tags)) return []

  return tags.flatMap((tag) => {
    const text = nonEmptyString(tag)
    return text === undefined ? [] : [text]
  })
}

/**
 * The raw child list, along with the document key it was found under.
 *
 * The key is returned rather than assumed because it becomes part of every
 * descendant's JSON Pointer, and a pointer that names the wrong field would not
 * address the node it claims to.
 */
function readChildEntry(node: ProjectDocument): { key: string; items: ProjectDocument[] } {
  for (const key of ['children', 'nodes'] as const) {
    const value = property(node, key)
    if (Array.isArray(value)) return { key, items: value }
  }
  return { key: 'children', items: [] }
}

/**
 * Adapts one node and, recursively, everything beneath it.
 *
 * @param node The raw value, which may be of any shape including a primitive.
 * @param id This node's JSON Pointer, built by the caller from its position.
 */
function toExplorerNode(node: ProjectDocument, id: string): ExplorerNode {
  const { key, items } = readChildEntry(node)
  const childrenId = childNodeId(id, key)

  return {
    id,
    label: readLabel(node),
    kind: readKind(node),
    isComplete: readCompletion(node),
    tags: readTags(node),
    children: items.map((child, index) => toExplorerNode(child, childNodeId(childrenId, index)))
  }
}

/**
 * Adapts a whole document.
 *
 * The document's own root is not turned into a node: a project is presented by
 * its name in the header, and the tree starts at the user's real top-level
 * entries. A bare array at the root is accepted as the node list directly.
 *
 * Cost is one pass over the file, at open time. Callers memoize on the document.
 */
export function toExplorerProject(document: ProjectDocument): ExplorerProject {
  const roots = Array.isArray(document) ? { key: '', items: document } : readChildEntry(document)

  const rootsId = roots.key === '' ? ROOT_NODE_ID : childNodeId(ROOT_NODE_ID, roots.key)

  return {
    name: nonEmptyString(property(document, 'name')) ?? nonEmptyString(property(document, 'title')),
    roots: roots.items.map((node, index) => toExplorerNode(node, childNodeId(rootsId, index)))
  }
}
