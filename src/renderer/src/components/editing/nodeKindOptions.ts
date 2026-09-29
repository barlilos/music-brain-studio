/**
 * The node kinds a user may choose, in the order they are offered.
 *
 * Derived from the presentation registry rather than written out again, so a
 * kind added there appears in every picker without touching this file. The order
 * is product vocabulary — the four kinds the real knowledge base actually uses
 * come first, because those are what a person reaches for on a normal day, and
 * an alphabetical list would bury `task` in the middle.
 *
 * Whether a new node of a kind starts with a work status is decided here too,
 * for the same reason the registry exists: nothing in `src/shared` may enumerate
 * kinds, so the caller supplies the default and the registry is what it asks.
 */

import { NODE_KINDS, presentationFor } from '@renderer/components/explorer/nodeKinds'
import type { NodeKind } from '@shared/model/node'
import type { WorkStatus } from '@shared/model/workStatus'

/** The kinds used by the reference knowledge base, offered first. */
const COMMON: readonly NodeKind[] = ['task', 'area', 'project', 'domain']

export interface NodeKindOption {
  kind: NodeKind
  label: string
}

export const NODE_KIND_OPTIONS: readonly NodeKindOption[] = [
  ...COMMON,
  ...Object.keys(NODE_KINDS).filter((kind) => !COMMON.includes(kind))
].map((kind) => ({ kind, label: presentationFor(kind).name }))

/** The kind a new entry defaults to. Most captured work is a task. */
export const DEFAULT_NEW_KIND: NodeKind = 'task'

/**
 * The status a newly created node of this kind should start with.
 *
 * `todo` for kinds that carry work state, nothing at all for the rest — so
 * adding an area does not write a `status` field its file never had.
 */
export function initialStatusFor(kind: NodeKind): WorkStatus | undefined {
  return presentationFor(kind).showsStatus ? 'todo' : undefined
}
