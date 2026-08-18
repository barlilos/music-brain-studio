# 005 — Live Work Loop

**Branch:** `feature/live-work-loop`
**Status:** approved — implementation in progress

## Goal

Make Music Brain Studio usable as the only source of truth open during a real music session:

> Discover → Capture → Structure → Work → Complete → Continue tomorrow

Done means a user can add and bulk-add work, rename and retype it, move a subtree, set Todo /
In Progress / Done, see recursive work counts, save explicitly, reopen with the same state, and never
silently overwrite a file that changed underneath them. Explorer and Canvas update immediately from
one in-memory model; disk persistence happens only on Save.

This is not generic CRUD, a schema redesign, or a Notion clone. The Canvas stays local: one root and
its immediate children.

### Where each review question is answered

| #   | Question                                               | Section               |
| --- | ------------------------------------------------------ | --------------------- |
| 1   | Canonical editable model                               | Architecture 1        |
| 2   | Where the mutation API lives                           | Architecture 2        |
| 3   | Immediate Explorer / NodeIndex / Canvas reaction       | Architecture 3        |
| 4   | Identity stable across rename / move / reparent        | Architecture 4        |
| 5   | New ID generation                                      | Architecture 5        |
| 6   | JSON round-trip without losing unknown fields          | Architecture 6        |
| 7   | Dirty-state model                                      | Architecture 7        |
| 8   | Revision signal against stale overwrites               | Architecture 7        |
| 9   | Safe / atomic save on Windows                          | Architecture 8        |
| 10  | Preventing renderer-selected write paths               | Architecture 9        |
| 11  | Todo / In Progress / Done representation and migration | Architecture 10, R2   |
| 12  | Canvas checkbox without navigation                     | Architecture 11       |
| 13  | Efficient recursive progress                           | Architecture 12       |
| 14  | Which descendants count as known work                  | Architecture 12       |
| 15  | Exact first-Inspector fields                           | Architecture 13       |
| 16  | One mutation system for all editing surfaces           | Architecture 14       |
| 17  | Selection / CanvasRoot / expansion after mutation      | Architecture 15       |
| 18  | Disposable writable copy for `dev:isolated`            | Architecture 16       |
| 19  | Safest implementation order                            | Implementation slices |
| 20  | Tests and end-to-end checks                            | Verification          |

## Context

### What exists now, in code

The read path has good boundaries and none of them have to be unpicked:

- `App` holds the raw `Project` (`src/renderer/src/App.tsx:24`), adapts it with `toExplorerProject`
  and indexes it with `indexNodes` in two chained `useMemo`s (`App.tsx:32-41`). Selection is one
  `useState` in `App` (`App.tsx:29`); expansion is a `Set` local to `ExplorerTree`
  (`ExplorerTree.tsx:44`).
- `toExplorerProject` (`src/shared/model/adapter.ts:200`) is the only module that names JSON fields.
  It is total: any `ProjectDocument`, never throws.
- `NodeIndex` (`src/shared/model/nodeIndex.ts:41`) gives O(1) identity and parentage, and
  `ancestorIdsOf` (`:67`) already walks parentage by link rather than by parsing an ID.
- The Canvas pipeline runs `canvasRootFor` → `buildCanvasGraph` → `layoutCanvas` →
  `toCanvasViewModel` → `toReactFlow`, bounded by the root's fan-out
  (`src/shared/model/canvas.ts`, `src/renderer/src/components/canvas/`).
- Main reads only. `registerProjectIpc` (`src/main/ipc/project.ts:90`) handles two channels, neither
  taking a path. `defaultProjectPath` (`:34`) resolves `DEFAULT_PROJECT_PATH`
  (`src/shared/constants.ts:58`) against the repo root or `process.resourcesPath`.
- `dev:isolated` isolates the _window's desktop_, not its _data file_
  (`scripts/dev-desktop-isolation.mjs:424`).

Three things block editing:

1. **`ExplorerNode.id` is a positional JSON Pointer** (`src/shared/utils/nodeId.ts:48`). Rename is
   safe; add and move change the identity of the affected node _and every following sibling_.
2. **`ExplorerNode` is a projection, not state** (`src/shared/model/node.ts:30`). Its recursive
   `children` and the `NodeIndex` built from it can disagree the moment anything mutates one of them.
3. **Nothing can write.** `ProjectApi` (`src/shared/types/index.ts:82`) exposes `loadDefault` and
   `open`.

### What the data actually says

Measured directly against `data/music-brain.json` on this branch — every number below was verified,
not carried over from an earlier draft.

| Fact                                                         | Value                                    |
| ------------------------------------------------------------ | ---------------------------------------- |
| Nodes below `brain`                                          | 548                                      |
| Kinds                                                        | 397 task, 99 area, 39 project, 13 domain |
| Containers / leaves                                          | 151 / 397                                |
| Max depth                                                    | 5                                        |
| Nodes with an `id`                                           | 548 (all non-empty strings)              |
| Distinct `id` values                                         | **547** — `quad.base.cab` occurs twice   |
| Statuses                                                     | 536 `todo`, 3 `active`, 9 absent         |
| Child-list key                                               | `children`, everywhere                   |
| Entries in `related` / `dependsOn` / `resources` / `outputs` | **0 in the entire file**                 |
| Nodes with non-empty `tags` / `notes`                        | 0 / 0                                    |
| Distinct `priority` values                                   | `3`                                      |
| Line endings                                                 | CRLF, no trailing newline                |

Four findings change the design:

**The duplicate is reference-free, twice over.** The two `quad.base.cab` nodes are `Choose Cab` (a
task) and `Cab Optimization` (an area with children). The string occurs exactly twice in the file,
both times as an `id` field. There are no references to update because _there are no references at
all_ — every relation array in the file is empty.

**Every `active` status is on a container, never on work.** All three are `domain` nodes at depth 1 —
`Ableton`, `Guitar Pro`, `Practice`. All 397 leaves are `todo`. All 9 absent-status nodes are `area`
containers. So `active` is being used as _"this is the domain I am working in"_, which is domain
lifecycle, not the work state of a task. This is the basis of decision **R2** below.

**The file round-trips byte-exactly.** `JSON.stringify(doc, null, 2)` with `\n` rewritten to `\r\n`
reproduces `data/music-brain.json` to the byte. Serializing with LF instead would rewrite all 8,737
lines on the first save — a diff that hides the real change completely. The newline convention is
therefore part of what a save has to preserve.

**Both example fixtures are still needed, and they land on different paths.**
`examples/music-brain-project.json` has 36 nodes with unique IDs → editable.
`examples/sample-project.json` has no `id` anywhere, uses `nodes` rather than `children`, and carries
`done` / `bpm` / `links` → viewable, read-only. That is the concrete test case for the read-only
banner, not a hypothetical.

## Architecture decisions

### 1. The canonical editable model

A normalized, storage-independent `ProjectState` in `src/shared/model/project.ts` becomes the only
editable truth:

```ts
type NodeId = string

interface ProjectNode {
  id: NodeId
  title: string
  kind: NodeKind
  status: NodeStatus | undefined
  tags: string[]
  notes: string
  parentId: NodeId | null
  childIds: NodeId[]
}

interface ProjectState {
  name: string | undefined
  rootIds: NodeId[]
  nodesById: ReadonlyMap<NodeId, ProjectNode>
  revision: number
}
```

Flat, not recursive, so there is exactly one place a node lives and no second structure to keep in
step. Parentage is an explicit field. Child order is an explicit array. `revision` increments on
every successful command and is the identity every derived structure is memoized on.

JSON stops being the model and becomes a format the codec adapts. React components receive selectors
and commands and never see a `ProjectDocument`.

### 2. The mutation API

Pure functions in `src/shared/model/projectMutations.ts` — no React, no IO, one file:

```ts
createNode(state, parentId, input, idFactory): MutationResult
createNodes(state, parentId, inputs, idFactory): MutationResult
updateNode(state, nodeId, patch): MutationResult
moveNode(state, nodeId, newParentId, index?): MutationResult
changeNodeType(state, nodeId, kind): MutationResult
setNodeStatus(state, nodeId, status): MutationResult
```

Every success returns a new `ProjectState` with `revision + 1` plus the IDs it created; every failure
returns a typed domain error and no state. `moveNode` accepts `null` for the project root and rejects
self-parenting, moving under a descendant, and unknown targets. Bulk Add is _one_ `createNodes`
transaction, not N sequential UI mutations — so it is one revision, one undo point when undo arrives,
and one canvas reframe.

Copying a 548-entry `Map` per command is microseconds. Structural sharing is not worth its complexity
at this size and can be added behind the same signatures if the knowledge base grows an order of
magnitude.

### 3. How Explorer, NodeIndex and Canvas react immediately

One projector, `src/shared/model/projectProjection.ts`, memoized on `ProjectState` identity — which
changes exactly when `revision` does:

```ts
projectProjection(state) -> {
  name, roots: ExplorerNode[], index: NodeIndex, progressById: Map<NodeId, ProgressSummary>
}
```

It builds all three in one O(N) pass: the recursive `ExplorerNode[]` the current Explorer API already
consumes, `byId` / `parentIdOf` from the model's explicit links rather than by walking a projection,
and the progress summaries.

This is a _substitution_, not an addition: `App.tsx:32-41` already runs adapt-then-index as two
chained memos and the components already take `roots` and `index` as props. Rebuilding one snapshot
per user mutation is simpler and safer than incrementally patching three structures, and at 548 nodes
it is free. Card rendering stays O(fan-out); nothing in the Canvas pipeline changes.

### 4. Identity stable across rename, move and reparent

`ProjectNode.id` is the node's own persisted `id`, carried unchanged through every mutation. Rename
writes `title`, retype writes `kind`, move rewrites `parentId` and two `childIds` arrays — none of
them touches `id`. Because parentage is a field rather than a substring, nothing needs to parse an ID
to find a parent, and `ancestorIdsOf` keeps working unchanged.

This requires persisted IDs to be unique, which today they are not. See decision **R1**.

`src/shared/utils/nodeId.ts` stops being the identity source for editable projects. It stays for the
read-only tolerant path, where positional pointers are still the only identity available.

### 5. New IDs

Non-semantic UUIDs from an injected `NodeIdFactory`; the runtime implementation is
`crypto.randomUUID()`. `createNode` asks the factory, so tests inject a deterministic counter and get
readable fixtures.

Injected rather than imported because `crypto` resolves differently in the three build targets and
`src/shared` is compiled for all of them. UI code never generates or parses an ID — the store
provider mints one and hands the opaque string back to the caller so "create and select the child"
stays a synchronous, single-render operation.

Existing semantic IDs are never rewritten. New nodes are simply not semantic, and nothing in the
application derives meaning from an ID's text.

### 6. Round-trip without losing unknown fields

A codec in `src/shared/persistence/projectCodec.ts` owns both directions and is the only module that
may look inside a `ProjectDocument` for editable projects.

Import captures a **preservation record** alongside the model:

- the document's own top-level entries in order, with the wrapper key marked (`schema` survives);
- the root/`brain` node's entries and its child-list key — the root is _not_ a `ProjectNode`, its
  `title` becomes `ProjectState.name` and everything else is preserved verbatim;
- per node id, that node's original entries **in file order**, minus the child list.

Export rebuilds each node by walking its preserved entries in their original order, substituting the
five modeled fields and the rebuilt child array in place, and appending any modeled field that has
become non-default but was not previously written. A field the model never heard of — `taskType`,
`priority`, `energy`, `successCriteria`, `related`, `dependsOn`, `resources`, `outputs`, anything a
future schema adds — passes through untouched and in position.

Two details make the diff honest rather than merely correct:

- **Key order is preserved**, so an edited node shows one changed line rather than a reordered block.
- **Defaults are not materialized.** An `area` with no `tags` key models as `tags: []` and must not
  gain `"tags": []` on save. A field is written when it was already present _or_ its value is now
  non-default.

Combined with the CRLF finding above, editing one title produces a one-line diff.

Files that are not an object-node hierarchy — `examples/sample-project.json` — keep loading through
the existing tolerant adapter and are **read-only**, with a banner saying why. Converting arbitrary
JSON into the Music Brain shape is the schema redesign this milestone explicitly excludes, and doing
it silently would be worse than declining.

### 7. Dirty state, and the revision signal

Two independent counters, deliberately not merged:

```ts
interface OpenProjectSession {
  projectToken: string // opaque handle to a main-process path
  diskRevision: string // SHA-256 of the exact bytes last read or written
  savedModelRevision: number // ProjectState.revision at the last successful save
}
```

- **Dirty** is `project.revision !== session.savedModelRevision`. Purely in-memory, no hashing, no
  IO.
- **Staleness** is `diskRevision` versus what is on disk _now_, checked by main immediately before
  writing.

A save sends the revision it exported and, on success, sets `savedModelRevision` to _that_ value —
not to the current one — so edits made while the write was in flight correctly leave the project
dirty. A failed or conflicted save changes neither counter.

SHA-256 of file bytes rather than mtime or size: mtime has ~1s resolution on some Windows
configurations and can be preserved by tools that rewrite a file, and size misses same-length edits.
The hash is over the exact bytes read, so it is comparable without any parsing or normalization.

### 8. Safe, atomic save on Windows

Main owns the whole sequence for a given token, serialized so two Ctrl+S presses cannot interleave:

1. Re-read the target and hash it.
2. Hash differs from `expectedRevision` → return `conflict`, write nothing.
3. Hash matches → serialize with the token's recorded newline convention, write to a unique temporary
   sibling in the same directory, fsync, then atomically replace the target.
4. Return the new hash, which becomes the session's `diskRevision`.
5. Any failure returns a typed error and leaves the project dirty.

A temporary _sibling_ because a cross-volume rename is a copy and stops being atomic. Replacement
uses `write-file-atomic` rather than hand-rolled `MoveFileEx` semantics.

**Atomic replacement can still fail on Windows, and is treated as expected rather than exceptional.**
Indexers, antivirus scanners, backup agents and editors take transient handles on a file, and the
replacement then fails with `EPERM`, `EACCES` or `EBUSY` for a few hundred milliseconds. Per R4:

- saves are serialized **per project token**, so two Ctrl+S presses can never interleave on one file;
- a transient replacement error is retried a **bounded** number of times with a short backoff;
- a **revision conflict is never retried** — it is not transient, and retrying it is precisely the
  silent overwrite this milestone exists to prevent;
- exhausting the retries returns a typed `failed` result naming the underlying code;
- every failure path leaves `savedModelRevision` and `diskRevision` untouched, so the project stays
  dirty and the user's edits stay in memory;
- because the payload is fully written and fsynced to the sibling _before_ the replace is attempted,
  a failure at any point leaves either the untouched original or the completely replaced file on
  disk. There is no interval in which the target is partially written, and the temporary sibling is
  removed on failure.

Conflict UI states that the file changed on disk and offers **Reload** (discarding this instance's
edits, after an explicit confirmation) or **Cancel**. M005 does not merge. A changed hash always
blocks the write.

### 9. IPC, and why the renderer can never name a write path

The renderer never sees a filesystem path in either direction.

On open, main stores `{ path, diskRevision, newline, hasTrailingNewline }` in a process-local map
under an opaque `projectToken` and returns the token plus the parsed document. Save takes
`{ projectToken, expectedRevision, document }`. An unknown token is rejected. There is no channel
that accepts a path, exactly as `openProject` and `loadDefaultProject` accept none today.

This also removes an existing leak: `Project.filePath` (`src/shared/types/index.ts:45`) currently
ships the absolute path to the renderer, where `App.tsx:153` uses it only as a React key. The token
replaces it in both roles. `fileName` stays, because it is displayed.

Close and open-while-dirty need main's help, because a renderer cannot block window teardown while it
shows asynchronous UI:

- The renderer pushes a dirty flag to main whenever it changes.
- Main intercepts `close`, and when dirty shows a native **Save / Don't Save / Cancel** message box.
  "Save" asks the renderer to run its normal save and report back; the window closes only on success.
- Opening a different project while dirty is entirely in-renderer and uses the same three choices in
  an in-app dialog, because nothing is being torn down and an in-app dialog is the better surface.

### 10. Todo / In Progress / Done

Persisted as the existing top-level `status` field, with three recognized values: `todo`,
`in_progress`, `done`.

Reading is tolerant: `active` → In Progress and `complete` / `completed` → Done are recognized so a
file written by another tool displays correctly. Absent stays absent — it means "this node does not
carry the concept", which is different from Todo, and 9 real nodes rely on that.

Writing is conservative: a canonical value is written only for a node the user actually edited. An
alias that was merely _read_ is preserved verbatim. This is the difference between a display rule and
a migration, and it is what decision **R2** is about.

New nodes default to `todo`. Whether a node shows a work control at all stays a property of its kind
in the existing registry (`nodeKinds.ts:72`), which is why the three `active` domains show no
checkbox today and will show none after this milestone.

The model change ripples predictably: `ExplorerNode.isComplete` (`node.ts:59`) becomes `status`, and
the consumers that read it — `adapter.ts:80`, `canvas.ts:93`, `canvasViewModel.ts:81`,
`ExplorerRow.tsx:47`, `CanvasCard.tsx:53`, `icons.tsx:22`, `nodeKinds.ts:72` — read the richer value
instead. `CheckboxIcon` gains a third glyph.

### 11. The Canvas checkbox, without triggering navigation

Today the whole card is one `<button>` (`CanvasCard.tsx:59-83`), so a status control inside it would
be a button inside a button — invalid HTML with undefined focus behaviour.

**Per R5, the card becomes a non-interactive wrapper holding two sibling native buttons.** Not a
`role="button"` container with hand-written keyboard handling, which was the original proposal and is
rejected:

```
<div class="card">          ← presentational only: no role, no tabIndex, no handler
  <button class="status">   ← 1. cycles status
  <button class="body">     ← 2. selects and navigates
</div>
```

- **The status button** cycles `todo` / `in_progress` → `done` → `todo` and calls `setNodeStatus`. It
  never selects and never navigates, so completing a task cannot re-root the Canvas. Because it is a
  sibling rather than a descendant, that is a structural guarantee rather than a `stopPropagation`
  call a later refactor could drop. It renders only for kinds that carry a work status, so the
  project card and containers grow no control.
- **The navigation button** keeps today's behaviour exactly: same `onSelect`, same `disabled` when
  the card is the project card or is already focused, same `aria-current`, same tooltip.

Both are real `<button>` elements, so native focus, Enter/Space activation, `disabled` semantics and
assistive-technology roles come for free and nothing is reimplemented. The cost is one extra tab stop
per task card, which is the correct trade: the status control is a genuine action and ought to be
keyboard reachable.

All three states stay reachable explicitly from the Inspector and the context menu, since a two-step
cycle cannot express "set this to In Progress" on its own.

### 12. Recursive progress, and what counts as work

One post-order pass inside the existing projector, O(N) per revision, no per-render traversal:

```ts
interface ProgressSummary {
  todo: number
  inProgress: number
  done: number
}
```

**A descendant counts as known work when it is a leaf and carries a recognized status.** Containers
are not counted — they are the thing being summarized. A node's own status is excluded from its own
aggregate. When a leaf gains a child it stops counting as one work item and its own leaves are
counted instead.

Cards and rows show restrained counts — `12 open · 1 in progress · 2 done` — and never a dominant
percentage. That is not decoration: with today's data the project root reads `397 open`, and a
percentage there would read as 0% complete and would _fall_ every time the user captures a new task.
Counting discovered work as an increase, not as lost progress, is the whole reason for the count
form.

### 13. The first Inspector

Exactly five fields: `title`, `nodeType`, `status`, `tags`, `notes`.

`priority` is deliberately excluded. It exists on 539 nodes and its value is `3` on every single one
of them — it is a generator artifact, not a workflow. Exposing it would invite the user to curate a
field nothing consumes.

`related`, `dependsOn`, `resources`, `outputs`, `energy`, `taskType` and `successCriteria` stay
preserved and hidden. All are empty or uniform today, and relations need a picker and a graph
surface, which is its own milestone.

### 14. One mutation system behind every editing surface

Explorer rows and Canvas cards open the _same_ context-menu component, which dispatches into the
_same_ command API through the same store:

| Action       | Command          | Surface                                                             |
| ------------ | ---------------- | ------------------------------------------------------------------- |
| Add child    | `createNode`     | compact title + kind form, defaults to `task`                       |
| Rename       | `updateNode`     | inline, in whichever surface invoked it; Enter commits, Esc cancels |
| Edit details | `updateNode`     | Inspector                                                           |
| Change type  | `changeNodeType` | submenu built from the kind registry                                |
| Move to…     | `moveNode`       | searchable tree picker, self and descendants excluded, root allowed |
| Set status   | `setNodeStatus`  | glyph, menu, Inspector                                              |
| Bulk Add     | `createNodes`    | parent + kind + multiline text + `Add N`                            |

The menu is rendered once at application level and positioned at the cursor, so neither `ExplorerRow`
nor `CanvasCard` grows menu state, and neither gains persistence knowledge. Bulk Add trims lines,
discards empty ones, preserves order, and creates one child per remaining line in a single command.

The store lives in `src/renderer/src/state/` as a `useReducer` — no external state library is
justified at 548 nodes — exposing commands and read selectors through context to the Inspector,
Explorer, Canvas, context menu and dialogs.

### 15. Selection, CanvasRoot and expansion after a structural mutation

These stay three separate concepts with three separate owners: selection in `App`, CanvasRoot derived
by `canvasRootFor`, expansion local to `ExplorerTree`.

Because identity is stable, **selection and expansion survive rename, retype and move without any
special handling at all.** Expansion only needs to prune IDs that no longer exist, and deletion is out
of scope, so even that is defensive.

The more interesting result is that `canvasRootFor` (`canvas.ts:65-74`) already produces all four
required post-mutation behaviours from its existing rule, with no change:

| Situation                           | Existing rule                     | Required behaviour                             |
| ----------------------------------- | --------------------------------- | ---------------------------------------------- |
| Selected container is moved         | still has children → roots itself | stays the CanvasRoot ✓                         |
| Selected leaf is moved              | leaf → roots at its parent        | shows the new parent, keeps the leaf focused ✓ |
| Selected leaf gains its first child | now has children → roots itself   | becomes its own CanvasRoot ✓                   |
| Node is retyped                     | rule reads children, not kind     | nothing changes ✓                              |

Deriving the root from the model instead of storing it is what makes this fall out for free. The
Canvas stays local — root plus immediate children — and `layoutCanvas` (`canvasLayout.ts:70`) stays
deterministic and untouched.

### 16. A disposable writable copy for `dev:isolated`

`scripts/dev-desktop-isolation.mjs` already owns the launch and already spawns the child with a
prepared environment (`:432`). Its `run` command gains three steps: create a temp directory, copy
`data/music-brain.json` into it, and pass that absolute path to the child in a launcher-owned
environment variable. Best-effort cleanup runs when the child exits; a leftover temp directory after a
hard kill is harmless.

`pnpm dev` runs the `off` command, which does not launch at all — `electron-vite dev` is a separate
command in the same npm script — so it sets no override and continues to open the real file. There is
no flag to forget and no way for the two paths to converge.

In main, `defaultProjectPath` (`src/main/ipc/project.ts:34`) consults the override only when
`!app.isPackaged`. Startup logs identify `REAL` versus `ISOLATED COPY`; the path itself never reaches
renderer code, which after §9 has no field to carry it anyway. The working directory is unchanged, so
VS Code desktop discovery from PR #4 keeps working.

## Review decisions

All five were reviewed and approved. R2 gained a precision requirement, R4 gained Windows
failure handling, and R5 was revised; the outcomes are recorded with each.

### R1 — Repairing the duplicate persisted ID

Stable, move-safe identity is impossible while two nodes answer to `quad.base.cab`: selection,
expansion, parentage and every future deep link would silently merge two unrelated nodes. The existing
adapter already documents this as the reason identity is positional today (`adapter.ts:190-196`).

**Proposal:** rename the second occurrence — `Cab Optimization`, the area at line 5363 — to
`quad.base.cab-optimization`, as a single reviewed commit that touches one line of
`data/music-brain.json` and nothing else.

Verified before proposing: the string appears exactly twice in the file, both as `id` fields, and
every `related` / `dependsOn` / `resources` / `outputs` array in the file is empty. Nothing points at
either node.

**Rejected alternative:** assign every node an internal UUID at import and treat the persisted `id` as
just another preserved field. This touches no data, but it moves the collision rather than fixing it —
the file still contains two nodes that any other tool, any export, and any future cross-reference will
treat as one — and it makes identity non-durable across reloads for no gain.

**Decision: approved.** The reference check is repeated immediately before the edit rather than
relied on from this document, and the commit changes only the intended `id` line — CRLF, key order
and every unrelated byte unchanged, verified by inspecting the diff and by comparing the parsed
document for structural equality.

### R2 — `active` should _not_ be normalized to `in_progress`

The attached draft proposed mapping `active` → `in_progress` on import. Measurement argues against it.

All three `active` values are on `domain` nodes at depth 1: `Ableton`, `Guitar Pro`, `Practice`. No
leaf carries it. `domain` has `showsCompletion: false` in the kind registry (`nodeKinds.ts:97-103`),
so those nodes render no work control today and would render none afterwards. Progress counts leaves
only, so normalization changes no count anywhere.

So the migration would rewrite three lines of the user's file to change nothing observable, while
discarding a distinction the user plausibly relies on — _these are the domains I am currently working
in_, which is domain lifecycle, not task progress.

**Proposal:** recognize `active` on read as In Progress so nothing displays wrongly, but preserve the
stored value verbatim unless the user explicitly changes that node's status. Same rule for `complete`
/ `completed`, which do not occur in this file at all. Absent stays absent.

This keeps every promise the milestone actually needs — three real states, a working checkbox, correct
counts — without a semantic migration of data the milestone never has to touch. It costs one extra
preserved field in the codec.

**Decision: approved, with a precision requirement.** Reading is tolerant — `active` displays as In
Progress, `complete` / `completed` display as Done, absent stays absent. Writing preserves the
original alias verbatim **unless the user specifically edits that node's `status`**.

The precision requirement is that field-level editing must not leak into status: renaming a node,
retyping it, or changing its tags or notes must leave a preserved alias byte-identical on disk. Only
`setNodeStatus` — from the checkbox, the context menu or the Inspector's status control — clears the
preserved alias and writes one of `todo`, `in_progress`, `done`.

This is enforced in the codec rather than in the UI: a node's preserved alias is dropped only by the
status command, so no editing surface can canonicalize a status as a side effect. Covered by a
dedicated test.

### R3 — Read-only mode is a real, reachable state

`examples/sample-project.json` has no IDs and will load read-only. That is correct behaviour, but it
means "Open Project" can put the application into a state where every editing affordance is absent.
**Decision: approved.** A file without stable unique IDs, or without the supported object-node
hierarchy, stays viewable and read-only. The banner explains why in the user's terms and does not
read as a failure; every editing and saving affordance is hidden or disabled rather than left to fail
on use. Arbitrary JSON is never silently converted.

### R4 — Two new dependencies

The repository has **no test runner**, and this milestone's core is pure functions that must be unit
tested.

- **Vitest** — Vite is already a dependency, so one config file resolves the existing `@shared`
  aliases and TypeScript with no extra toolchain. Test-only, never bundled.
- **`write-file-atomic`** — for step 3 of §8. The design explicitly prefers a proven package over
  hand-rolled Windows replacement semantics.

Milestone 002 recorded "no new dependencies" as a decision, so these were raised rather than assumed.
`write-file-atomic` is the only one that ships.

**Decision: approved, with Windows failure handling.** `write-file-atomic` must not be trusted as
though an atomic rename can never fail. The requirements — per-token serialization, bounded retry for
transient `EPERM` / `EACCES` / `EBUSY`, never retrying a revision conflict, typed errors, dirty state
preserved on every failure, and never a partially written target — are specified in §8 and verified
on Windows.

### R5 — The Canvas card's interactive structure

The original proposal replaced the card's native `<button>` with a `role="button"` container carrying
hand-written `tabIndex` and Enter/Space handling, to avoid nesting the new status control inside it.

**Decision: revised.** Hand-rolling button semantics trades a real accessibility guarantee for a
cosmetic one. The card instead becomes a **non-interactive wrapper containing two sibling native
buttons** — status, and navigation. This avoids the nesting problem without giving up native focus,
Enter/Space, `disabled` behaviour or assistive-technology semantics. §11 is written to this
structure.

## Tradeoffs

- **Whole-snapshot reprojection per mutation.** O(N) per committed edit rather than a patch. At 548
  nodes this is well under a frame; at 50,000 it is not, and the projector is the one place that would
  change.
- **Map copy per command.** Same reasoning, same containment.
- **No merge on conflict.** Reload or Cancel is the entire recovery model. Merging a tree is its own
  milestone; blocking the write is what actually protects the file.
- **Read-only for non-Music-Brain JSON.** A narrower promise than "open anything and edit it", and the
  only one that can be kept without a schema redesign.
- **Preserved aliases mean the file can hold values the model calls unrecognized.** Accepted
  deliberately under R2: tolerant on read, conservative on write.

## Implementation slices

The proposed A–K order is sound with **one change, which matters**: the disposable workspace (D) must
land _before_ save exists in the UI (C), not after it.

D is roughly thirty lines in a launcher plus one guarded environment read in main. C is the first
slice in which pressing Ctrl+S can overwrite the real 548-node knowledge base. Ordering D first costs
nothing and removes the window in which a routine dev run can damage real data. The attached draft
made the same correction; this one goes one step further by putting it ahead of persistence rather
than after it.

1. **Identity + model foundation** — the R1 repair as its own commit; codec, import validation,
   `ProjectState`, projection; unit tests.
2. **Mutation layer** — six commands, typed errors, cycle rejection; unit tests.
3. **Disposable isolated workspace** — temp copy, env handoff, cleanup, and an automated check that
   the real file's hash is unchanged by a launch. _Moved ahead of persistence._
4. **Persistence safety** — tokenized load/save IPC, SHA-256 conflict response, atomic write, newline
   preservation, dirty state, Ctrl+S, close and open guards.
5. **Status loop** — three states, alias tolerance, functional Canvas checkbox.
6. **Capture** — Add Child and Rename from both surfaces.
7. **Inspector + Change Type** — the five approved fields; Task → Project/Area evolution.
8. **Move** — searchable reparent picker, cycle tests.
9. **Progress** — post-order summaries and restrained card counts.
10. **Bulk Add + end-to-end verification.**

Each slice is a small commit on this branch; the milestone lands as one squash-merged PR.

## Verification

**Unit (new runner):** codec round-trip on the real file read-only, unknown-field and key-order
preservation, default fields not materialized, newline preservation, import rejection of duplicate and
missing IDs, all six mutations, cycle and self-parent rejection, status alias tolerance and
write-conservatism, progress aggregation including the leaf-becomes-parent case, bulk-add parsing, and
save-conflict outcomes.

**Before PR:**

- `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm format:check`, and the new test command;
- the full product workflow executed on an **isolated** 548-node copy, never the real file;
- SHA-256 of `data/music-brain.json` captured before and after all isolated testing, required equal;
- save → reopen → verify IDs, unknown fields, child order, selection, status and progress;
- modify the file externally after load, then prove a stale Save returns `conflict` and changes
  nothing on disk;
- open `examples/sample-project.json` and confirm read-only mode and its banner;
- inspect the final JSON diff by hand for schema loss or broad reordering — with the CRLF and
  key-order rules above, editing one title must produce a one-line diff.

## Files changed

**New:** `src/shared/model/project.ts`, `projectMutations.ts`, `projectProjection.ts`,
`src/shared/persistence/projectCodec.ts`, `src/renderer/src/state/` (store + provider),
`src/renderer/src/components/editing/` (context menu, dialogs, Inspector, move picker), test config
and test files.

**Modified:** `src/shared/types/index.ts` (session, save contract, `filePath` → `projectToken`),
`src/shared/constants.ts` (channels), `src/shared/model/node.ts` (`isComplete` → `status`),
`adapter.ts`, `canvas.ts`, `src/main/index.ts` (close guard), `src/main/ipc/project.ts` (tokens, save,
dev override), `src/preload/index.ts`, `App.tsx`, `ExplorerTree.tsx`, `ExplorerRow.tsx`,
`CanvasCard.tsx`, `canvasViewModel.ts`, `icons.tsx`, `nodeKinds.ts`,
`scripts/dev-desktop-isolation.mjs`, `package.json`.

**Data:** `data/music-brain.json` — one line, under R1.

## Out of scope

Delete, drag-and-drop, undo/redo, custom statuses, Kanban, dashboards, search, filters,
expand/collapse all, deep Canvas expansion, alternate Canvas modes, manual card positions, editing
`related` / `dependsOn` / `resources` / `outputs`, database migration, schema redesign, AI task
generation, and merging on conflict.

## Future considerations

- **Undo/redo** is cheap once every edit is a command returning a new immutable state: keep a bounded
  stack of `ProjectState` references.
- **Delete** is deliberately absent because it needs the confirmation and recovery story undo
  provides.
- **Structural sharing** in the mutation layer, behind unchanged signatures, if the knowledge base
  grows an order of magnitude.
- **Relations** — `related` and `dependsOn` are preserved from day one and `CanvasLink`
  (`canvas.ts:106`) already models non-containment edges, so drawing them is additive.
- **Multiple canvases** — `CanvasRoot` is already serializable and already separate from focus.
