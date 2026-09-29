/**
 * The three states a piece of work can be in, and how a file's `status` value is
 * read into one of them.
 *
 * **Reading is tolerant; writing is conservative.** Those are two different
 * rules and this module only owns the first. It recognises the values other
 * tools write — `active`, `complete`, `completed` — so nothing displays wrongly,
 * and it never decides what goes back to disk. That decision belongs to
 * `ProjectNode.persistedStatus` and is made in the codec, so that merely opening
 * a file can never rewrite it.
 *
 * The distinction matters for the real knowledge base. All three of its `active`
 * values sit on top-level `domain` nodes, where the word means "this is the
 * domain I am working in" — lifecycle, not the work state of a task. Displaying
 * that as In Progress is harmless. Persisting `in_progress` over it would throw
 * away a distinction the user made.
 *
 * Isomorphic: no React, no DOM, no Node.
 */

/** The work states the application understands. */
export type WorkStatus = 'todo' | 'in_progress' | 'done'

/**
 * Every state, in the order they progress. Used to build pickers, so the order
 * is product vocabulary rather than an implementation detail.
 */
export const WORK_STATUSES: readonly WorkStatus[] = ['todo', 'in_progress', 'done']

/**
 * Values that are not canonical but unambiguously mean one of the three.
 *
 * Deliberately short. Each entry is a value seen in a real file or named in the
 * milestone; guessing at further synonyms would invent meaning the user never
 * wrote, and an unrecognised value is already handled gracefully — it is
 * preserved verbatim and simply shows no work state.
 */
const ALIASES: Readonly<Record<string, WorkStatus>> = {
  active: 'in_progress',
  complete: 'done',
  completed: 'done'
}

/**
 * Reads a persisted `status` into a work state, or `undefined` when the value
 * says nothing this application understands.
 *
 * `undefined` covers three different situations that all deserve the same
 * treatment — the field was absent, it was not a string, or it held a word we do
 * not know — because in all three the honest answer is "this node does not carry
 * a work state I can act on". Nine nodes in the reference file have no `status`
 * at all, and that is different from Todo.
 */
export function recognizeWorkStatus(value: unknown): WorkStatus | undefined {
  if (typeof value !== 'string') return undefined

  const normalized = value.trim().toLowerCase()
  if (normalized.length === 0) return undefined

  if (normalized === 'todo' || normalized === 'in_progress' || normalized === 'done') {
    return normalized
  }

  return ALIASES[normalized]
}

/**
 * The state the status control moves to next.
 *
 * Two steps rather than three: the common gesture is "I finished this" and its
 * undo, so the cycle is `todo`/`in_progress` → `done` → `todo`. In Progress is
 * reachable explicitly from the Inspector and the context menu, where choosing a
 * specific state is the point. A three-step cycle would put an extra press
 * between a task and being done, on the one interaction that has to be cheapest.
 */
export function nextWorkStatus(status: WorkStatus | undefined): WorkStatus {
  return status === 'done' ? 'todo' : 'done'
}
