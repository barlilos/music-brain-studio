# 002 — Open and Display Project

**Branch:** `feature/open-and-display-project`
**Status:** implemented

## Goal

Let the user open a JSON project file from disk and see its hierarchy.

Done when: clicking **Open Project** opens a native file picker; choosing a file that contains
valid JSON renders it as a collapsible tree; choosing one that does not shows a clear error;
dismissing the picker changes nothing.

## Context

Milestone 001 left the application as a shell: a window showing its own name, with no IPC surface
at all. `src/preload/index.ts` exposed nothing and carried a comment describing the pattern for
whenever the first call was needed.

This is that first call. Opening a native dialog and reading a file are Node and Electron
capabilities, so the renderer cannot do this alone — the feature necessarily establishes the
main ↔ renderer channel that every later feature will reuse. Most of the decisions below are about
keeping that channel narrow and shaped so it survives the model becoming real.

## Architecture decisions

### No new dependencies

The native picker is `electron.dialog`, the read is `node:fs/promises`, validation is `JSON.parse`,
and the tree is a recursive component. No tree library and no schema validator: "valid JSON" at this
milestone means "parses", which `JSON.parse` already decides.

### The main process returns outcomes, not file contents

`project:open` performs dialog + read + parse and returns a discriminated union —
`opened` / `canceled` / `invalid` / `failed`. IPC payloads are structured-cloned either way, so
parsing in main costs nothing, and the renderer never handles file text or decides what a failure
means.

### Failure travels as a value, not a rejection

A rejected `ipcRenderer.invoke` reaches the renderer wrapped in Electron's own
`Error invoking remote method …` text, which buries the real message. Invalid JSON is an expected
result of asking a user to pick a file, not an exception, so it is returned.

### One channel, one verb, no renderer-supplied paths

The renderer cannot ask the main process to read a path of its choosing. The only input reaching
`readFile` is what the user selected in the dialog, so there is no path-injection surface.

### `ProjectDocument` insulates the contract from today's model

```ts
export type ProjectDocument = JsonValue // ← later: MusicBrainNode
```

The channel, the handler, `OpenProjectResult`, `Project`, `ProjectApi` and the preload bridge are
all written in terms of `ProjectDocument` and never name `JsonValue`. Swapping in a typed Music
Brain model is a change to this alias plus `TreeView`, and nothing else.

Caveat recorded honestly: once the model is typed, `JSON.parse` will no longer prove a file matches
it and the main process will need real schema validation. That has somewhere to report through
already — the `invalid` arm — so adding it does not change the contract's shape either.

### Only `TreeView` may inspect a document

Everywhere else — `App.tsx`, preload, main — a document is opaque: carried, stored, passed on, never
indexed, `typeof`-tested or iterated. All runtime narrowing happens in one file, which is what makes
the previous decision real rather than aspirational.

### Node IDs are domain identity, and are JSON Pointers

`src/shared/utils/nodeId.ts` derives an ID from a node's position: root is `''`, each step appends
`'/'` plus the key with `~`→`~0` and `/`→`~1` escaped (RFC 6901).

- **Why a pointer, not `parent.key`** — the naive scheme is not injective: `{ "a.b": 1 }` and
  `{ "a": { "b": 1 } }` collide. IDs that collide are worse than no IDs. As a standard, the same
  string also works as the address for reading or writing that node later.
- **Why it is not "the React key"** — `nodeId` is a domain value that selection, editing, search,
  favorites, navigation and deep links will address nodes by. It is produced by a module with no
  React import, usable from the main process, and passed to `TreeNode` as a declared prop it can
  read and act on. React's `key` receives the same string as a convenience, but `key` is consumed by
  the reconciler and cannot be read back from props. If reconciliation ever wanted a different key,
  `nodeId` would be unaffected.
- IDs are derived, never stored in the file, so they cannot go stale relative to their document.

### Expansion state lives on each node

Each branch node owns a `useState`. No expansion map, no context, no store — nothing outside the
tree has a reason to know what is open, and a store would need an owner this milestone does not have.

### `filePath` is kept even though nothing uses it

`Project` is `{ filePath, fileName, document }`. The UI only shows `fileName`; the absolute path is
carried so that saving does not have to re-derive it or ask the user again.

## Files changed

**Shared** (isomorphic — no Node, no DOM)

| File                         | Change                                                                             |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| `src/shared/types/index.ts`  | Added `JsonValue`, `ProjectDocument`, `Project`, `OpenProjectResult`, `ProjectApi` |
| `src/shared/constants.ts`    | Added `IPC_OPEN_PROJECT`, `PROJECT_API_NAMESPACE`                                  |
| `src/shared/utils/nodeId.ts` | New — `ROOT_NODE_ID`, `childNodeId`; replaced the folder's `.gitkeep`              |

**Main**

| File                      | Change                                                              |
| ------------------------- | ------------------------------------------------------------------- |
| `src/main/ipc/project.ts` | New — `registerProjectIpc()`: dialog → read → parse → union         |
| `src/main/index.ts`       | Calls `registerProjectIpc()` in `whenReady`, before window creation |

**Preload**

| File                   | Change                                                        |
| ---------------------- | ------------------------------------------------------------- |
| `src/preload/index.ts` | Exposes `projectApi.open`; `ipcRenderer` itself stays private |

**Renderer**

| File                                       | Change                                                     |
| ------------------------------------------ | ---------------------------------------------------------- |
| `src/renderer/src/types/window.d.ts`       | New — types `window.projectApi` from the shared definition |
| `src/renderer/src/App.tsx`                 | Rewritten — button, two panes, `project` and `error` state |
| `src/renderer/src/components/TreeView.tsx` | New — `TreeView` + recursive `TreeNode`                    |

**Other**

| File                           | Change                                              |
| ------------------------------ | --------------------------------------------------- |
| `examples/sample-project.json` | New — nested fixture carrying a top-level `version` |
| `README.md`                    | Status, IPC surface, pointer to `docs/milestones/`  |

## Verification checklist

- [x] `pnpm typecheck` — both the Node and web projects
- [x] `pnpm lint`
- [x] `pnpm format:check`
- [x] `pnpm build`
- [x] `App.tsx` never indexes, `typeof`-tests, iterates or `Object.keys`-es `project.document`
- [ ] `pnpm dev` → **Open Project** opens a native picker filtered to `.json`
- [ ] Dismissing the picker changes nothing and shows no error
- [ ] `examples/sample-project.json` renders as a tree; branches expand and collapse; nesting indents
- [ ] A malformed JSON file shows a clear error naming the file, and clears any previous tree
- [ ] The right pane reads "Select a node"

## Out of scope

Editing, saving, drag & drop, search, filtering, favorites, AI, multiple projects, workspace
management, auto-save, recent projects.

Also deliberately absent: **node selection**. The right pane is a fixed placeholder. Node IDs are
generated but nothing consumes them — groundwork, not an unfinished feature.

## Future considerations

Seams left open on purpose, each already load-bearing for a specific later milestone:

- **`ProjectDocument`** — the single swap point for a typed Music Brain node model. Changing it
  should not touch the IPC contract, the bridge or the handler. When it changes, schema validation
  joins the main process and reports through the existing `invalid` arm.
- **`nodeId`** — the addressing scheme awaiting selection, editing, search, favorites, navigation
  and deep links. It is a JSON Pointer, so it is already a valid address into the document, not only
  a label. Currently surfaced in the DOM as `data-node-id`.
- **`filePath`** — awaiting Save.
- **`version` in the project file** — awaiting schema migration. It is not read or validated yet; it
  exists so real files already carry the anchor a migration will need.
- **The right pane** — the obvious home for a node detail view once selection exists.
