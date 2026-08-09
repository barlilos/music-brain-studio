/**
 * Stable identity for a node within a project document.
 *
 * A node ID is a domain concept, not a rendering one. It is the address of a
 * node, and it is what selection, editing, search, favorites, navigation and
 * deep links will all refer to a node by. The tree happens to also hand it to
 * React as an element `key`, but that is an incidental convenience: `key` is
 * consumed by React's reconciler and cannot even be read back from props,
 * whereas a node ID is passed explicitly, read, stored and acted upon.
 *
 * IDs are derived from a node's position, never stored in the project file, so
 * they cost nothing to produce and cannot go stale relative to their document.
 *
 * The format is a JSON Pointer (RFC 6901): the root is `''`, and each step down
 * appends `'/'` plus the escaped key. Chosen over the obvious `parent.key`
 * scheme because that one is not injective — `{ 'a.b': 1 }` and
 * `{ a: { b: 1 } }` would produce the same string, and IDs that collide are
 * worse than no IDs at all. Being a standard also means the same string already
 * works as the address for reading or writing that node later.
 */

/** The ID of a document's root node. */
export const ROOT_NODE_ID = ''

/**
 * Escapes a single JSON Pointer token. `~` must be replaced first, otherwise the
 * `~` introduced by escaping `/` would itself be escaped on the second pass.
 */
function escapeToken(key: string): string {
  return key.replace(/~/g, '~0').replace(/\//g, '~1')
}

/**
 * Derives the ID of a child node from its parent's ID and its own key.
 *
 * @param parentId ID of the containing node — `ROOT_NODE_ID` at the top.
 * @param key Object property name, or array index.
 */
export function childNodeId(parentId: string, key: string | number): string {
  return `${parentId}/${escapeToken(String(key))}`
}
