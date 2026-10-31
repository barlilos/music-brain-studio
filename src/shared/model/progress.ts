/**
 * How much work is inside a node, counted rather than scored.
 *
 * **Counts, never a percentage.** A knowledge base is discovered as it is used:
 * the reference file opens with 397 open tasks and no done ones, and the normal
 * shape of a working session is that capturing new work makes that number *go
 * up*. A completion percentage would render that as 0% and then as a bar that
 * falls every time the user writes something down — punishing exactly the
 * behaviour the application exists to encourage. `12 open · 1 in progress ·
 * 2 done` says the same thing without a verdict attached.
 *
 * Runs over an already-adapted tree rather than over the editable model, so the
 * editable and read-only paths get the identical implementation.
 *
 * Isomorphic: no React, no DOM, no Node.
 */

import type { ExplorerNode } from '@shared/model/node'

export interface ProgressSummary {
  todo: number
  inProgress: number
  done: number
}

export const EMPTY_PROGRESS: ProgressSummary = { todo: 0, inProgress: 0, done: 0 }

export interface ProgressIndex {
  /** Each node's summary of the work *below* it, by `ExplorerNode.id`. */
  byId: ReadonlyMap<string, ProgressSummary>
  /** The whole project, for the project card. */
  total: ProgressSummary
}

/** Whether a summary counts anything at all — the test for showing it. */
export function hasKnownWork(summary: ProgressSummary): boolean {
  return summary.todo > 0 || summary.inProgress > 0 || summary.done > 0
}

function add(into: ProgressSummary, from: ProgressSummary): void {
  into.todo += from.todo
  into.inProgress += from.inProgress
  into.done += from.done
}

/**
 * Counts the work under every node, in one post-order pass.
 *
 * **What counts as work: a leaf that carries a recognised status.** Two
 * consequences worth stating, because both are deliberate.
 *
 * A container is never counted, only summarised. Counting an `area` as one item
 * *and* counting the twelve tasks inside it would total thirteen pieces of work
 * where the user has twelve, and would make a parent's number change for reasons
 * that have nothing to do with what is left to do.
 *
 * A leaf that gains a child stops counting as one item and starts reporting its
 * own leaves instead. That is the "discovery increases known work" rule in its
 * concrete form: breaking a task into three subtasks moves the count from 1 to 3
 * rather than losing the original.
 *
 * A node's own status is excluded from its own summary — the summary answers
 * "what is inside this", and a card already shows its own state next to it.
 *
 * O(total nodes), once per revision.
 */
export function summarizeProgress(roots: readonly ExplorerNode[]): ProgressIndex {
  const byId = new Map<string, ProgressSummary>()

  /** The work this node contributes to its parent's count. */
  function visit(node: ExplorerNode): ProgressSummary {
    if (node.children.length === 0) {
      byId.set(node.id, { ...EMPTY_PROGRESS })

      switch (node.status) {
        case 'todo':
          return { todo: 1, inProgress: 0, done: 0 }
        case 'in_progress':
          return { todo: 0, inProgress: 1, done: 0 }
        case 'done':
          return { todo: 0, inProgress: 0, done: 1 }
        // A leaf with no recognised status is not work anybody can finish, so it
        // is not counted. Nine nodes in the reference file are in this position.
        case undefined:
          return { ...EMPTY_PROGRESS }
      }
    }

    const summary: ProgressSummary = { ...EMPTY_PROGRESS }
    for (const child of node.children) add(summary, visit(child))
    byId.set(node.id, summary)
    return summary
  }

  const total: ProgressSummary = { ...EMPTY_PROGRESS }
  for (const root of roots) add(total, visit(root))

  return { byId, total }
}
