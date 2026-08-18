/**
 * Translates a project document into the explorer's model.
 *
 * This is the **only** module in the application that names the file's fields —
 * `nodes`, `children`, `title`, `nodeType`, `metadata`, `tags`, `done`. Milestone
 * 002 confined that knowledge to `TreeView`; it now lives in a pure function
 * instead of a React component, which is what lets the main process reuse it for
 * search indexing and validation later.
 *
 * Since milestone 005 this is the **read-only** path. A file that is a Music
 * Brain hierarchy with stable unique ids is imported by
 * `@shared/persistence/projectCodec` and becomes editable; everything else lands
 * here, stays viewable, and is never written back. That split is why this module
 * can go on accepting anything at all: nothing it produces will ever be saved.
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
import { recognizeWorkStatus, type WorkStatus } from '@shared/model/workStatus'

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
 * The node's work state, or `undefined` if it does not carry the concept.
 *
 * A textual `status` is the canonical spelling and is read through the shared
 * vocabulary, so this path and the editable one recognise exactly the same
 * words. A boolean `done` or `completed` is accepted as well, because both are
 * common in hand-written files and the difference is not one the user should
 * have to care about — `false` means the node has work state and has not
 * finished it, which is Todo rather than "no state at all".
 */
function readStatus(node: ProjectDocument): WorkStatus | undefined {
  const recognized = recognizeWorkStatus(field(node, 'status'))
  if (recognized !== undefined) return recognized

  const done = field(node, 'done') ?? field(node, 'completed')
  if (typeof done === 'boolean') return done ? 'done' : 'todo'

  return undefined
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
 * The raw child list, along with the document key it was found under, or
 * `undefined` if this value carries no child list at all.
 *
 * The key is returned rather than assumed because it becomes part of every
 * descendant's JSON Pointer, and a pointer that names the wrong field would not
 * address the node it claims to.
 *
 * Presence is distinguished from emptiness because `findRootNode` uses "does
 * this have a child list" to recognise the root, and a node with zero children
 * is still a node.
 */
function readChildEntry(
  node: ProjectDocument
): { key: string; items: ProjectDocument[] } | undefined {
  for (const key of ['children', 'nodes'] as const) {
    const value = property(node, key)
    if (Array.isArray(value)) return { key, items: value }
  }
  return undefined
}

/**
 * Adapts one node and, recursively, everything beneath it.
 *
 * @param node The raw value, which may be of any shape including a primitive.
 * @param id This node's JSON Pointer, built by the caller from its position.
 */
function toExplorerNode(node: ProjectDocument, id: string): ExplorerNode {
  const entry = readChildEntry(node)
  const children =
    entry === undefined
      ? []
      : entry.items.map((child, index) =>
          toExplorerNode(child, childNodeId(childNodeId(id, entry.key), index))
        )

  return {
    id,
    label: readLabel(node),
    kind: readKind(node),
    status: readStatus(node),
    tags: readTags(node),
    children
  }
}

/** The node whose children form the top level, and its pointer in the document. */
interface DocumentRoot {
  node: ProjectDocument
  pointer: string
}

/**
 * Finds the node the tree hangs off, which is not always the document itself.
 *
 * Real project files wrap the tree in a envelope alongside metadata about the
 * file — `{ schema: {…}, brain: { title, children } }` — so the document's own
 * top level holds no nodes and the root is one step down. Simpler files put the
 * child list at the top level, and some are a bare array.
 *
 * The wrapper key is discovered rather than named. Hardcoding `brain` would tie
 * the adapter to one generation of one file, and the rule "the root is the first
 * property that looks like a node" costs nothing extra and covers all three
 * layouts. Non-node siblings such as `schema` are skipped because they carry no
 * child list.
 */
function findRootNode(document: ProjectDocument): DocumentRoot | undefined {
  if (readChildEntry(document) !== undefined) {
    return { node: document, pointer: ROOT_NODE_ID }
  }

  if (isObject(document)) {
    for (const [key, value] of Object.entries(document)) {
      if (readChildEntry(value) !== undefined) {
        return { node: value, pointer: childNodeId(ROOT_NODE_ID, key) }
      }
    }
  }

  return undefined
}

/**
 * Adapts a whole document.
 *
 * The root node is not turned into a row: a project is presented by its name in
 * the header, and the tree starts at the user's real top-level entries. Its
 * title is what names the project, falling back to the document's own.
 *
 * Node identity is derived here rather than taken from the file, even though
 * real files carry an `id` on every node. Those are not usable — the reference
 * file has 548 nodes and only 547 distinct `id` values, so two different nodes
 * share one. Colliding identity silently merges selection and expansion between
 * unrelated nodes, which is worse than having no IDs at all. This module is
 * where that decision lives; see `ExplorerNode.id` for the contract it has to
 * meet, and note that the contract says nothing about JSON.
 *
 * Cost is one pass over the file, at open time. Callers memoize on the document.
 */
export function toExplorerProject(document: ProjectDocument): ExplorerProject {
  // A bare array at the root is the node list itself, and names nothing.
  if (Array.isArray(document)) {
    return {
      name: undefined,
      roots: document.map((node, index) => toExplorerNode(node, childNodeId(ROOT_NODE_ID, index)))
    }
  }

  const root = findRootNode(document)
  const entry = root === undefined ? undefined : readChildEntry(root.node)

  return {
    name:
      (root === undefined ? undefined : readLabel(root.node)) ??
      nonEmptyString(property(document, 'name')) ??
      nonEmptyString(property(document, 'title')),
    roots:
      root === undefined || entry === undefined
        ? []
        : entry.items.map((node, index) =>
            toExplorerNode(node, childNodeId(childNodeId(root.pointer, entry.key), index))
          )
  }
}
