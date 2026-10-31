/**
 * One snapshot of everything the UI renders, derived from `ProjectState`.
 *
 * The Explorer wants a recursive `ExplorerNode[]`; the Canvas wants O(1) identity
 * and parentage; cards want work counts. Before editing existed these were built
 * once per file and it did not matter how. Now they have to agree after every
 * mutation, and three structures kept in step by three separate pieces of code is
 * three chances to be wrong.
 *
 * So they are rebuilt together, from the model, once per revision. Not patched —
 * **rebuilt**. Patching would be faster and would be the wrong trade at this size:
 * one full projection of the reference file is a walk over 548 nodes, far inside a
 * frame, while an incremental update that is subtly wrong shows the user a tree
 * that disagrees with their own file. If the knowledge base ever grows an order of
 * magnitude, this function is the single place that changes.
 *
 * Memoized by the caller on `ProjectState` identity, which changes exactly when
 * `revision` does.
 *
 * Isomorphic: no React, no DOM, no Node.
 */

import type { ExplorerNode } from '@shared/model/node'
import { indexNodes, type NodeIndex } from '@shared/model/nodeIndex'
import { summarizeProgress, type ProgressIndex } from '@shared/model/progress'
import type { NodeId, ProjectState } from '@shared/model/project'

export interface ProjectProjection {
  /** The project's own name, for the header and the project card. */
  name: string | undefined
  roots: ExplorerNode[]
  index: NodeIndex
  progress: ProgressIndex
}

/**
 * The model's flat nodes, rebuilt as the recursive shape the Explorer consumes.
 *
 * This is the only walk this module adds. Indexing and progress reuse the
 * functions the read-only path already uses, so an editable project and a
 * read-only one are rendered by identical code below this point — worth more than
 * the two extra passes it costs over a list this size.
 */
function toExplorerNodes(state: ProjectState, ids: readonly NodeId[]): ExplorerNode[] {
  const nodes: ExplorerNode[] = []

  for (const id of ids) {
    const node = state.nodesById.get(id)
    // Unreachable while the mutations keep `childIds` and `nodesById` in step.
    // Skipping rather than throwing keeps a projection total, because this runs
    // during render and a throw here would take the window down.
    if (node === undefined) continue

    nodes.push({
      id: node.id,
      // The model stores `''` for untitled; the Explorer's contract is
      // `undefined`, so the row substitutes a placeholder rather than showing a
      // blank line.
      label: node.title.length > 0 ? node.title : undefined,
      kind: node.kind,
      status: node.status,
      tags: node.tags,
      children: toExplorerNodes(state, node.childIds)
    })
  }

  return nodes
}

export function projectProjection(state: ProjectState): ProjectProjection {
  const roots = toExplorerNodes(state, state.rootIds)

  return {
    name: state.name,
    roots,
    index: indexNodes(roots),
    progress: summarizeProgress(roots)
  }
}
