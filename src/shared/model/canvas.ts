/**
 * The canvas model: what a canvas *is*, and what is on it.
 *
 * The canvas is the primary workspace of Music Brain; the explorer is a
 * navigation aid. This module is the domain half of that workspace, and it is
 * deliberately two layers removed from storage — it consumes `ExplorerNode`,
 * which already contains no file vocabulary, so nothing here names a JSON field,
 * a file path or a schema. It also knows nothing about how a canvas is drawn:
 * no positions, no colours, no React, no rendering library.
 *
 * Isomorphic: no React, no DOM, no Node.
 */

import type { NodeIndex } from '@shared/model/nodeIndex'
import type { ExplorerNode, NodeKind } from '@shared/model/node'
import type { WorkStatus } from '@shared/model/workStatus'

/**
 * What a canvas is anchored on — its identity.
 *
 * A canvas is always exactly one explicit root, never an arbitrary set of nodes.
 * That distinction costs nothing while one canvas is on screen and is the whole
 * game as soon as there is more than one: tabs, recent canvases, workspace
 * persistence, back/forward history and deep links all have to *name* a canvas,
 * and a set of nodes cannot be named.
 *
 * Serializable by construction — a discriminated union of strings — so storing
 * one needs no encoding step.
 */
export type CanvasRoot = { type: 'project' } | { type: 'node'; nodeId: string }

/** The canvas showing the project itself, with its top-level nodes as children. */
export const PROJECT_CANVAS_ROOT: CanvasRoot = { type: 'project' }

/** The card id reserved for the project. No node id can collide with it. */
export const PROJECT_CARD_ID = 'canvas:project'

/**
 * The kind the project's own card renders as.
 *
 * Reusing an existing registry entry rather than inventing one: a knowledge base
 * opened as a project genuinely is a project in the user's language, and the
 * canvas is not allowed to add vocabulary.
 */
const PROJECT_CARD_KIND: NodeKind = 'project'

/** A stable string form of a canvas identity, for keys and map lookups. */
export function canvasKey(root: CanvasRoot): string {
  return root.type === 'project' ? PROJECT_CARD_ID : `canvas:node:${root.nodeId}`
}

/**
 * Which canvas a selection opens.
 *
 * **The rooting rule, and the only place it lives.** A selected node with
 * children roots its own canvas. A leaf does not: it roots at its parent and is
 * highlighted among its siblings, because 72% of the nodes in a real knowledge
 * base are leaves and a canvas holding one lonely card is not a workspace. A
 * top-level leaf roots at the project, which stands in the parent's position.
 *
 * The mapping is deliberately many-to-one: every leaf under one parent opens the
 * *same* canvas. That is exactly what a tab needs — clicking three sibling tasks
 * should not open three tabs — and it is what makes moving between siblings
 * leave the canvas completely still.
 */
export function canvasRootFor(selectedId: string | null, index: NodeIndex): CanvasRoot {
  if (selectedId === null) return PROJECT_CANVAS_ROOT

  const node = index.byId.get(selectedId)
  if (node === undefined) return PROJECT_CANVAS_ROOT
  if (node.children.length > 0) return { type: 'node', nodeId: selectedId }

  const parentId = index.parentIdOf.get(selectedId) ?? null
  return parentId === null ? PROJECT_CANVAS_ROOT : { type: 'node', nodeId: parentId }
}

/** One card. Identity is its own; `nodeId` links it back to the knowledge base. */
export interface CanvasCard {
  /**
   * Card identity. Equal to the node's identity for a node card, so a card that
   * appears on two consecutive canvases is recognised as the same card and is
   * moved rather than replaced.
   */
  id: string
  /** The `ExplorerNode.id` this card stands for, or `null` for the project card. */
  nodeId: string | null
  /**
   * The node's name as the user wrote it, or `undefined` when the file has none.
   * The placeholder is applied in the view model, not here — naming an untitled
   * node needs the kind registry, and the model does not carry vocabulary.
   */
  label: string | undefined
  kind: NodeKind
  status: WorkStatus | undefined
  role: 'root' | 'child'
}

/**
 * One connection.
 *
 * An explicit record rather than something implied by containment. Today every
 * link is parent→child and the array looks redundant; it is not. Real nodes
 * carry `related`, `dependsOn`, `resources` and `outputs` — cross-references
 * that are not containment — and a model that derives edges from the tree could
 * never draw them. This one draws them by appending.
 */
export interface CanvasLink {
  id: string
  fromId: string
  toId: string
}

export interface CanvasGraph {
  /** Which canvas this is. The graph renders this root and nothing else. */
  root: CanvasRoot
  /** The card standing for the root. */
  rootCard: CanvasCard
  /** The root's immediate children, in model order — never sorted. */
  children: CanvasCard[]
  links: CanvasLink[]
  /**
   * The card wearing the selection ring — the root card, one of the children, or
   * `null` when nothing is selected.
   *
   * Focus is transient view state and is deliberately separate from `root`,
   * which is the durable identity. A tab remembers where it is rooted; it does
   * not remember which card was highlighted when you last left it.
   */
  focusedId: string | null
}

function toCard(node: ExplorerNode, role: CanvasCard['role']): CanvasCard {
  return {
    id: node.id,
    nodeId: node.id,
    label: node.label,
    kind: node.kind,
    status: node.status,
    role
  }
}

/**
 * Builds the graph for one canvas.
 *
 * Total: an unknown root falls back to the project rather than failing, because
 * the root is derived from a selection that a reloaded document may no longer
 * contain.
 *
 * **Cost is proportional to the root's fan-out, never to the project.** The root
 * is resolved by one map lookup and only its own child list is read, so a canvas
 * under one domain does no work related to any other. That is the property that
 * keeps this indifferent to a knowledge base of 10,000 nodes.
 *
 * @param focusNodeId The current selection, used only to place the ring. It is
 *   ignored when it is not on this canvas.
 */
export function buildCanvasGraph(
  root: CanvasRoot,
  index: NodeIndex,
  projectName: string | undefined,
  focusNodeId: string | null
): CanvasGraph {
  const rootNode = root.type === 'node' ? index.byId.get(root.nodeId) : undefined

  const rootCard: CanvasCard =
    rootNode === undefined
      ? {
          id: PROJECT_CARD_ID,
          nodeId: null,
          label: projectName,
          kind: PROJECT_CARD_KIND,
          status: undefined,
          role: 'root'
        }
      : toCard(rootNode, 'root')

  const childNodes = rootNode === undefined ? index.roots : rootNode.children
  const children = childNodes.map((node) => toCard(node, 'child'))

  const links = children.map((child) => ({
    id: `${rootCard.id}→${child.id}`,
    fromId: rootCard.id,
    toId: child.id
  }))

  const isOnCanvas =
    focusNodeId !== null &&
    (rootCard.id === focusNodeId || children.some((child) => child.id === focusNodeId))

  return { root, rootCard, children, links, focusedId: isOnCanvas ? focusNodeId : null }
}
