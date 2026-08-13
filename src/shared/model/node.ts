/**
 * The explorer's view of a node, independent of how the file stores it.
 *
 * This is what the UI navigates. It is produced from a project document by
 * `./adapter`, which is the only module that knows the file's field names — so
 * a change to the persistence format stops here and never reaches a component.
 *
 * Isomorphic on purpose: no React, no DOM, no Node. The main process will need
 * this same model for search indexing and schema validation.
 */

/**
 * What kind of thing a node is — an area, a project, a task, and so on.
 *
 * Deliberately a bare `string` rather than a union of known kinds. The value
 * comes from a user's file at runtime, so it was never statically knowable, and
 * a union here would be two things at once: a false promise about the data, and
 * a second copy of the vocabulary that would drift from the real one.
 *
 * The vocabulary is written down in exactly one place — the renderer's node
 * kind registry — and this layer passes the value through untouched. Nothing in
 * `src/shared` compares a kind to a literal or enumerates the possibilities.
 */
export type NodeKind = string

/** The kind used when a node does not declare one at all. */
export const UNKNOWN_NODE_KIND: NodeKind = 'unknown'

/** A node as the explorer sees it. */
export interface ExplorerNode {
  /**
   * Explorer node identity — the address selection, expansion, search,
   * favorites, navigation and deep links all refer to this node by.
   *
   * The contract is only that it is unique across the loaded knowledge base,
   * stable while the node is on screen, derivable from the model, and opaque to
   * everything above it. Nothing outside `./adapter` may parse it or take it
   * apart.
   *
   * How it is produced is a detail of whatever currently stores the knowledge
   * base — today `@shared/utils/nodeId` derives it from the node's position. A
   * different store would satisfy the same contract with a primary key or a row
   * id, and no consumer would change.
   */
  id: string
  /**
   * The node's name, as the user wrote it. `undefined` when the file has no
   * usable title — the UI substitutes a placeholder rather than showing a blank
   * row, and never falls back to an array index.
   */
  label: string | undefined
  /** See `NodeKind`. Never empty; unrecognised values are legal and expected. */
  kind: NodeKind
  /**
   * Completion state, for kinds that have one. `undefined` means the node said
   * nothing about it, which is different from `false` — the UI shows a checkbox
   * only when the node actually carries the concept.
   */
  isComplete: boolean | undefined
  /** Free-text labels, already filtered to non-empty strings. Possibly empty. */
  tags: string[]
  /** Child nodes, already adapted. Empty for leaves. */
  children: ExplorerNode[]
}

/** An opened project, reduced to what the explorer needs to render it. */
export interface ExplorerProject {
  /**
   * The project's own name, taken from the file's contents rather than its
   * filename. `undefined` when the file does not name itself.
   */
  name: string | undefined
  /** Top-level nodes. Empty when the document has no recognisable node list. */
  roots: ExplorerNode[]
}
