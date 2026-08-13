# 003 — Music Brain Explorer UI

**Branch:** `feature/music-brain-explorer-ui`
**Status:** implemented — awaiting review

## Goal

Turn the JSON viewer into the first Music Brain Explorer: a navigator that shows the user their own
world in their own words, with no JSON vocabulary on screen.

Done when: opening a project shows named, typed nodes — areas, projects, tasks — arranged so the
hierarchy can be scanned at a glance; the words `children`, `nodeType` and `metadata` appear nowhere
in the UI; and the user would open the app to browse rather than to inspect a file.

## Context

Milestone 002 established the file channel and rendered whatever came back as a generic JSON tree.
That was the correct shape for a milestone whose job was the IPC surface, and it deliberately left
the document opaque everywhere except `TreeView`.

The consequence is that the application currently teaches the user its persistence format. A row
reads `title: "Track Ideas"` and a container reads `children {2}`. The user has to perform a
translation in their head on every single row, from the file's structure back to the meaning they
put into it. That translation is the entire cost this milestone removes.

Two things make now the right time. First, node identity and the document-opacity discipline already
exist, so the work is a rendering change rather than a foundational one. Second, every feature after this — search, filtering, an inspector, drag & drop —
operates on _rows the user recognises_. Building any of them on top of a JSON dump would mean
building them twice.

### The schema

Design began from a stated assumption — nodes carry an explicit `nodeType`, alongside a `metadata`
object — with the vocabulary unknown. **Implementation replaced that assumption with the real file**,
now versioned in the repository as `data/music-brain.json` (304 KB). What it actually contains:

```jsonc
{
  "schema": { "version": …, "supportedNodeTypes": [ … 13 … ], "commonFields": [ … ] },
  "brain":  { "title": "Music Brain", "children": [ … 13 domains … ] }
}
```

Four differences from the assumption, each of which changed the code:

| Assumed                                 | Actually                                                       |
| --------------------------------------- | -------------------------------------------------------------- |
| Nodes at the document's top level       | Wrapped: the tree hangs off `brain`, beside a `schema` sibling |
| Fields possibly nested under `metadata` | Flat on the node — `title`, `nodeType`, `status`, `tags`, …    |
| Vocabulary unknown, guessed at 4 kinds  | Declared by the file: 13 `supportedNodeTypes`                  |
| Completion as `done` / `completed`      | A `status` string — `todo`, `active`; no `done` present yet    |

Measured, and used below instead of estimates:

- **548 nodes, maximum depth 4**, across 13 top-level domains.
- **Type distribution:** `task` 397, `area` 99, `project` 39, `domain` 13. Nine of the thirteen
  supported types are declared but unused so far.

  Reviewing this milestone changed the file: at design time twelve top-level nodes were `domain`
  and one — _Riff Picker_ — was a `project`, the only node in 548 breaking the otherwise strict
  `domain → project → area → task` grammar. Nothing in the code cared; the explorer rendered it
  faithfully with a project icon among twelve domain icons. That is what made it visible, and it
  was reclassified in the data. Worth recording as the milestone's first evidence that giving kinds
  distinct icons surfaces inconsistencies the raw JSON hid.

- **`id` is not unique.** 548 nodes carry an `id`, but only 547 are distinct — `quad.base.cab` names
  both _Choose Cab_ and _Cab Optimization_. This is why Explorer node identity stays derived rather
  than adopting the file's own field; see _Explorer node identity stays derived_.

The adapter still treats every one of these as tolerated rather than required, so the degradation
guarantees below are unchanged.

### Two fixtures, kept permanently

`examples/sample-project.json` from milestone 002 carries neither `nodeType` nor `metadata`. It is
**kept unchanged**, and a second fixture `examples/music-brain-project.json` is added alongside it
carrying the real schema.

This is not redundancy. The two fixtures test opposite halves of the adapter, and both halves have
to keep working:

| Fixture                    | Exercises                                                                   |
| -------------------------- | --------------------------------------------------------------------------- |
| `music-brain-project.json` | The happy path — the real envelope, and every registered kind at least once |
| `sample-project.json`      | The degradation path — no `nodeType` anywhere, no `metadata` anywhere       |

The Music Brain fixture is a trimmed copy of the real file's _shape_, not of its content: same
`{ schema, brain }` envelope, same field names, same `supportedNodeTypes` list, at 36 nodes instead
of 548. It goes further than the real file in one direction on purpose — the real file uses only
four of the thirteen kinds, so the fixture uses all of them, plus one deliberately unregistered
kind and one deliberately untitled node. Those two are test cases, and are commented as such in the
file itself so they are not mistaken for content.

The generic fixture is the permanent regression test for _Unknown kinds are first-class_. It is the
cheapest possible proof that the explorer never drops, hides or crashes on a node it does not
understand — and because it is a real file the user can open, that proof is re-run by hand every
time anyone touches the adapter, not only in a test suite that does not exist yet.

## Research — navigation in desktop productivity software

Five applications, read for interaction patterns rather than appearance.

### VS Code Explorer

**Works.** The whole row is the hit target, not just the label, which makes a dense tree forgiving
to click. Twisties occupy reserved space even on leaves, so labels align down the column and the eye
can run straight down them. Indent guides let you track which parent a deeply nested item belongs to
without counting pixels. Rows are ~22px — very dense, and the density is the point: you see more of
the structure at once, which is what makes a large tree navigable at all. Sticky scroll pins ancestor
rows to the top so context survives scrolling.

**Does not fit.** Every node is a file or a folder — exactly two meanings, both structural. Music
Brain nodes carry kind as _content_, and a tree that renders an Area and a Task identically throws
away the thing the user cares most about. VS Code's tree is also intentionally ignorant of what is
inside a node; ours should surface it.

**Adopt.** Full-row hit target, reserved twisty column, indent guides, high density. Sticky scroll
is noted as a later win, not now.

### Obsidian

**Works.** The strict split of navigator from content — tree on the left, the thing you are reading
in the main area — means the tree never has to also be the reader. Container rows can show a count
so you can judge weight without expanding. The chrome is quiet enough to disappear during use.

**Does not fit.** Obsidian's real navigation is search and links; the tree is a fallback most users
touch rarely. We have no search this milestone, so our tree must carry the entire navigation load on
its own and cannot lean on a command palette to rescue a confusing hierarchy.

**Adopt.** The navigator/content split as the _layout the app grows into_, and counts on containers.

### GitHub Desktop

**Works.** This is the closest match in spirit to our actual problem. Underneath it is git — refs,
objects, index, hashes — and the application's entire value is that it never says any of those
words. It shows changed files, a message box, and one primary button. Strong empty states do real
teaching work: an empty repository list explains what to do next instead of showing nothing.

**Does not fit.** It is barely hierarchical, so it offers no help with nesting or depth.

**Adopt.** The philosophy, which is the milestone's thesis: name things in the user's language and
let the substrate vanish. Also the commitment to a real empty state.

### Linear

**Works.** Demonstrates how far density can go without clutter — around 32–36px rows, almost no
borders, a single accent colour. Crucially, hierarchy and grouping are carried by **typography and
spacing** rather than by boxes, cards, rules and background fills. That is why it stays legible at
density where a more decorated UI would turn to noise.

**Does not fit.** Its model is keyboard-first and command-driven, and its lists are flat. Keyboard
shortcuts are explicitly out of scope here, so we cannot borrow the interaction model, only the
visual restraint.

**Adopt.** Typographic hierarchy over containers; consistent row height; one accent, used sparingly.

### ClickUp

**Works.** It gives every level of its hierarchy a _name_ — Space, Folder, List, Task — and a
consistent glyph, and users genuinely learn that vocabulary and navigate by it. That is precisely
the transformation this milestone wants: not "an object with children" but "an Area".

**Does not fit — and is the useful cautionary case.** Each row accumulates icons, colours, badges,
avatars, counts and hover actions until scanning becomes work. Colour is used for so many meanings
simultaneously that it stops meaning anything. Deep nesting plus heavy per-row chrome is the failure
mode this design is most at risk of drifting into.

**Adopt.** Named levels with consistent glyphs, and counts. **Reject** per-row control density and
broad colour coding.

### What this points to

1. **One tree, one column.** Not Miller columns or a breadcrumb drill-down — those trade
   whole-structure visibility for depth, and seeing the shape of their world is the point.
2. **A row is a fixed-height, full-width, single-line unit.** Uniform rows are what let the eye
   scan; variable-height rows destroy it.
3. **Kind is carried by an icon and by type weight — not by colour.** Colour is reserved so it stays
   available for state that changes (completion, and later search matches and selection).
4. **Counts on containers**, so weight is legible while collapsed.
5. **Indent guides**, because depth without them is unreadable past about level three.
6. **Restraint per row.** No hover action buttons yet. Every affordance added now is one the later
   inspector, context menu and drag handle have to negotiate with.

## Product thinking

The brief's success test is behavioural — _would I open this every day_ — so the design is judged on
recognition speed, not feature count.

**The core transformation is subtraction.** Almost every improvement is something the UI stops
saying:

| Today the UI says             | It should say                                 | Why                                                                          |
| ----------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------- |
| `children {4}` as a row       | nothing — nesting _is_ the child relationship | the row is a container; showing the container's container-ness is pure noise |
| `nodeType: "area"` as a row   | an icon on the Area's own row                 | kind is an attribute of the node, not a child of it                          |
| `metadata {…}` as a subtree   | nothing this milestone                        | metadata is inspector material, not navigation material                      |
| `title: "Ableton"`            | **Ableton**                                   | the title _is_ the node's name; the key is scaffolding                       |
| `sample-project.json` as root | the project's name in a header                | the file is where it is stored, not what it is                               |

The last row is worth stating plainly: the filename should leave the tree entirely. A project is a
thing the user made; the file is an implementation detail of how it persists.

**The deliberate loss.** After this change, the app shows _less raw data_ than it does today.
Arbitrary metadata keys become invisible. This is a real regression in fidelity and it is the
central bet of the milestone: that a person browsing their creative world is served far better by
five meaningful rows than by fifty faithful ones. Nothing is lost from the file, only from the
view, and the inspector milestone gives every field a home. Flagged here because it is the decision
most worth challenging in review.

**One judgement call for review.** The brief rules out an inspector, but does not mention
_selection_. This design includes a selected-row highlight — one piece of state, no detail panel —
because when scanning a large tree you need to keep your place, and because it is the seam the
inspector plugs into with no rework. If that reads as scope creep, it is a clean thing to cut: it is
one `useState` and one CSS class.

## UX decisions

### 1. The row

A fixed-height row, 28px, full width, one line, in this order:

```
[twisty] [icon] Label                                    [count / state]
```

- The **twisty** column is always reserved, on leaves too, so labels align into a single scannable
  column.
- The **whole row** is the click target for expand/collapse and selection.
- Nothing is ever allowed to wrap. Long titles truncate with an ellipsis and expose the full text as
  a `title` attribute. Wrapping would break the fixed row height that scanning depends on.

### 2. The label

`title` is the label, rendered as prose — no quotes, no key prefix, no monospace. The tree drops
`font-mono` entirely, which alone removes much of the "this is a data file" feeling.

A node with no usable title falls back to a kind-derived placeholder — _Untitled task_ — in a muted
italic, never to an array index and never to a blank row. A blank row is unclickable and looks like
a bug; an index is JSON leaking back in.

### 3. Kind, expressed twice

Kind is signalled by an icon **and** by type weight, deliberately redundantly, so the structure
survives at a glance and does not depend on icon recognition. Containers read slightly heavier than
their contents, which is what produces the sense of hierarchy without drawing a single box.

Every one of those choices is data in the kind registry, not logic in a component — see
_One registry owns the vocabulary_ for why that matters. The registry holds all thirteen types the
file's own `schema.supportedNodeTypes` declares, grouped by what they are for:

| Group               | Kinds                                             | Weight                 |
| ------------------- | ------------------------------------------------- | ---------------------- |
| Containers          | Domain (globe), Area (folder), Project (layers)   | medium, full-contrast  |
| Things done         | Task (checkbox), Checklist, Experiment (flask)    | normal, slightly muted |
| Things written down | Knowledge, Playbook, Template, Decision, Question | normal, slightly muted |
| Things kept         | Resource (box), Asset (image)                     | normal, slightly muted |
| Registered ahead    | Goal, Idea, Reference, Inspiration                | normal, slightly muted |
| _Unregistered_      | neutral dot                                       | normal, muted          |

Only four of the thirteen (`domain`, `area`, `project`, `task`) appear in the file today. The other
nine are registered anyway: a _supported_ type that renders as an anonymous grey dot the first time
someone uses it is a bug lying in wait, not a feature pending. The last four are outside the schema
entirely and are entered because they were named as likely additions — they are also the standing
demonstration that a new kind costs one object literal.

Icons are a small set of hand-rolled inline SVGs, not emoji. Emoji render at different sizes and
colours per platform, cannot inherit `currentColor` for hover and dark mode, and read as toy-like in
a productivity surface. The cost is one tiny component each.

### 4. Tasks show their state

A task that does not show whether it is done is not really a task. Completion comes from the node's
own data and renders as a checked/unchecked glyph plus muted, struck-through text when complete.
This is **display only** — the glyph is not clickable, because editing is out of scope.

### 5. Containers show a count

Right-aligned, muted, and only when collapsed and non-empty. It answers "is there anything in here"
before you spend a click. It disappears when expanded because the answer is then on screen.

### 6. Depth

16px of indent per level, plus a 1px indent guide per ancestor. Sixteen is enough to read and cheap
enough to survive depth; the guides are what keep level six attributable to the right parent.

### 7. Hover and selection

Hover: a subtle full-row background — the only hover affordance. No action buttons, no reveal-on-
hover controls.

Selection: a stronger background plus an accent left-edge marker. Selection is not exclusive with
expansion; clicking a container both selects it and toggles it.

### 8. Metadata is not shown as data

No raw key/value rows anywhere. A small curated set surfaces, and only where it carries navigational
meaning — completion state, and tags rendered as quiet inline text on the row. Everything else is
present in the file, absent from the view, and belongs to the inspector.

### 9. The header replaces the root row

The project's own name becomes a header above the tree, with the filename demoted to muted secondary
text. The tree then starts at the user's real top-level nodes, so the first thing they see is
_Ableton, Album, Guitar, Research, Marketing_ rather than a filename.

### 10. Default expansion: the root, and nothing below it

The tree opens with every node collapsed. Since the root is the header rather than a row, that is
the state in which the root alone is expanded: the whole world named at the top level, and nothing
beneath it yet.

This was revised during implementation. The design originally expanded the top level, on the
reasoning that showing one layer down helps orient. Measured against the real file, that mounts
**60 rows** where collapsing everything mounts **13** — and, more importantly, the expanded count
grows with the file while the collapsed one does not. A default whose cost scales with the size of
the knowledge base is the wrong default for a knowledge base meant to grow.

The count on each collapsed row is what makes this affordable: you can still see how much sits
inside each domain without opening it, so the information the extra layer was providing is still
there, in one line instead of sixty.

Correction worth recording: this document previously claimed top-level expansion mounted 13 rows.
It did not — it mounted 60. The 13 was the collapsed number all along, asserted for the wrong
configuration and never measured until now.

### 11. Empty state

Two situations reach the no-project screen and they need different words. At launch the default
project is still being read, so it shows a quiet _Opening…_ — saying "open a project" there would be
wrong and briefly alarming. Afterwards the only way to be here is that the default failed, so it
explains what the application is and offers **Open Project** as the way out. The error itself is in
the banner above, so this does not repeat it.

### 12. The right pane is removed

Currently a permanently empty 320px panel reading _Select a node_. It advertises a feature that does
not exist, and it costs a fifth of the window width on a screen whose only job is scanning long
titles. Removing it gives the tree the full window and makes the app feel finished rather than
half-built. It returns, earning its space, in the inspector milestone — re-adding a flex sibling is
a trivial change and the design is not compromised by its absence.

### 13. Window size

Recommend raising the default from **1200×800 to 1440×900**, keeping minimum at 900×600 (up from
800×600). 1440×900 is the modal laptop logical resolution, fits comfortably on a 1920-wide display,
and leaves room for the sidebar/content split the app is growing into. It is a two-line change in
`src/shared/constants.ts`.

## Architecture decisions

### The pipeline

```
project file  (JSON — schema unchanged)
      │
      ▼  adapter — the only module that knows the file's field names
ExplorerNode  { id, label, kind, childCount, isComplete, tags, children }
      │
      ▼  flattenTree — walks the model, emits only what is visible
ExplorerRow[] { node, depth, isExpanded, hasChildren, isSelected }
      │
      ▼  presentational components          ┌── nodeKinds registry
ExplorerTree → ExplorerRow ─────────────────┘    kind → icon, name, styling
```

Each arrow is a seam a later feature plugs into, and each is load-bearing for a named milestone
rather than speculative.

Note that the registry hangs off the side of the pipeline rather than sitting in it. `kind` flows
through the adapter and the flattener as an opaque string; only the row resolves it to an
appearance. Nothing upstream of rendering knows the vocabulary exists.

### One registry owns the vocabulary

A single module maps a `nodeType` value to everything the UI does with it — icon, display name, and
styling — as **data**:

```ts
const NODE_KINDS: Record<string, NodeKindPresentation> = {
  area: { name: 'Area', Icon: FolderIcon, labelClassName: …, showsCompletion: false },
  task: { name: 'Task', Icon: CheckboxIcon, labelClassName: …, showsCompletion: true },
  …
}
```

No component contains a `switch` on kind, an `if (kind === 'task')`, or a hardcoded icon choice.
`ExplorerRow` does one lookup and renders whatever comes back. Adding `goal`, `idea`, `reference`,
`inspiration` or `resource` is one object literal and one small SVG — rendering logic is not
touched, and neither is the adapter, the flattener or the model.

**Why the registry lives in the renderer, not in `shared/`.** Its values are React components and
Tailwind class strings, which are DOM concerns; `tsconfig.node.json` has no DOM lib, so putting them
in `shared/` would break the main process build. That is the type system enforcing the boundary
described in the README, and it is the right answer rather than an inconvenience.

The consequence is that the model deliberately carries **no** kind vocabulary at all. `ExplorerNode`
has `kind: string` — the normalised `nodeType`, passed through untouched. There is no
`type NodeKind = 'area' | 'project' | …` union anywhere, because such a union would be a second
place the vocabulary is written down, and the two would drift. The registry's keys _are_ the
vocabulary, and they are the only copy of it.

The cost is that TypeScript cannot check a kind string against the registry at compile time. That is
accepted deliberately: the values come from a user's file at runtime, so they were never statically
knowable, and a union type would have been a false promise. The runtime fallback below is the real
guarantee, and it covers typos in the registry and unknown types from the file with the same code
path.

### One adapter owns the file format

A single module translates the file's shape into `ExplorerNode`. It is the **only** code that names
`nodeType`, `metadata`, `children` or `title`. This is the direct successor to milestone 002's rule
that only `TreeView` may inspect a document — same discipline, better placed, because the knowledge
now lives in a pure function instead of inside a React component.

It goes in `src/shared/model/` rather than the renderer because it is pure and isomorphic, and the
main process will need it: search indexing and schema validation both belong in main and both need
to understand nodes.

Consequence: a schema change is a change to this module. Nothing in the component tree learns about
it.

### The application opens into a project, not onto a picker

Added during implementation. `data/music-brain.json` loads on launch, over a second IPC channel —
`project:loadDefault` — that reads a fixed file with no dialog.

The product reason is that this is a single-project application being optimised for daily personal
use. Making someone pick the same file every morning is a tax on the one workflow that matters, and
"open the app, see my world" is the behaviour the milestone is judged on.

Three things kept it from being a shortcut:

- **`project:open` stays.** The picker is not removed — it is the recovery path when the default is
  missing or malformed, and it is what keeps arbitrary files openable until project switching
  returns as a real feature. A startup default that could strand the user would be worse than the
  picker it replaced.
- **Neither channel takes a path.** The renderer still cannot name a file for `readFile` to open.
  The two reachable files are the one the user picks in a dialog and one fixed constant, so
  milestone 002's "no renderer-supplied paths" property is unchanged.
- **One reader, two callers.** `readProject` does the read, parse and error description; both
  channels call it. A project therefore loads identically however it was chosen, and a failure is
  described the same way. `LoadProjectResult` is the outcome of reading a file, and
  `OpenProjectResult` is that plus the one outcome only a prompt can produce — `canceled`.

The path is resolved in the main process, not shared as a location: `app.getAppPath()` in
development so edits to the working copy are picked up on restart, and `process.resourcesPath` in a
packaged build, where `data/` ships beside the asar archive via electron-builder's `extraResources`.
Shipping it is easy to forget, so the config and the resolver carry pointers to each other.

### The root node is discovered, not named

The tree does not hang off the document — it hangs off `brain`, which sits beside a `schema` object
that is metadata about the file rather than content. The adapter therefore looks for the root: the
document itself if it carries a child list, otherwise the first property that does. `schema` is
skipped for free, because it has no children.

Hardcoding `brain` was the obvious alternative and was rejected. It would tie the adapter to one
generation of one file for no benefit — the discovery rule is three lines, covers the wrapped
layout, the flat layout and a bare array at the root, and needs no change when the envelope is
renamed or a second sibling appears.

This was found by running the application against the real file, which rendered "This project has
no entries yet." The design had assumed a top-level node list. Recorded here because the assumption
looked safe and was not.

### Explorer node identity stays derived

**`ExplorerNode.id` is an Explorer concept, not a storage one.** It is the address selection,
expansion, search, favorites, navigation and deep links all refer to a node by. What the Explorer
requires of it is only this:

- **Unique** across the loaded knowledge base — two nodes must never share one.
- **Stable** for as long as a node is on screen, so selection and expansion survive re-renders.
- **Derivable** from the loaded model, so it costs nothing to produce and cannot go stale.
- **Opaque** to everything above the model. No component parses it or takes it apart.

Today the adapter satisfies that contract by deriving a JSON Pointer from the node's position, and
that is an implementation detail of the current persistence format rather than part of the product
model. When storage stops being a JSON file — SQLite, Postgres, a service — the same contract can be
met by a primary key or a row id, and nothing above `src/shared/model/` needs to notice. The
requirements above are the durable part; the pointer is not.

The reason the file's own `id` is not used is worth recording, because it looks like the obvious
choice: every node carries one (`ableton`, `ableton.template`), it is shorter, and it survives a node
being moved. But of 548 nodes only 547 ids are distinct — `quad.base.cab` is on two different nodes.
Colliding identity is worse than none because it fails silently: selecting one node would highlight
two, and expanding one would expand the other. Milestone 002 rejected a non-injective scheme for
exactly this reason; the real data now confirms that empirically rather than theoretically.

So the file's `id` is left unread, available to a later milestone that needs a name stable across
moves — which a positional derivation is not, whatever the storage layer turns out to be.

### Unknown kinds are first-class

A `nodeType` with no registry entry resolves to a shared fallback presentation — neutral icon,
muted styling — and otherwise behaves exactly like any other node. It keeps its label, keeps its
children, stays expandable and stays selectable. It is never dropped, never collapsed into an error
row, never a crash.

This is a correctness requirement, not politeness. The file is the user's real knowledge base, the
vocabulary is not fully known at design time, and an explorer that hides nodes it does not recognise
is worse than one that shows raw JSON — the user cannot even tell something is missing. The same
rule covers a missing `title`, a `children` that is not an array, and a `metadata` that is not an
object.

`examples/sample-project.json` is the standing proof: every node in it takes this path, so opening
it is a full-tree exercise of the fallback rather than a single contrived row.

### Flattening replaces recursion — the significant change

Milestone 002 rendered recursively, with expansion state as a `useState` inside each node. That was
right for the scope, and it is now the main obstacle. It cannot be virtualized, cannot be filtered,
cannot support "expand all" or "reveal this node", and scatters state across the component tree
where nothing can read it.

Replacing it:

- **Expansion is a `Set<nodeId>`** owned by the tree, keyed by Explorer node identity. O(1) checks;
  serializable, so persisting expansion per project later is storage, not redesign; and addressable,
  which is what "reveal this node" needs.
- **`flattenTree` is a pure function** — model plus expansion set in, flat array of visible rows out.
  No React import, independently testable, and the natural place for filtering and search to insert
  themselves later as an extra parameter.
- **Rendering is a flat `.map`.** Depth becomes a number on the row, expressed as padding.

This is the highest-leverage decision in the milestone: it is what makes search, filtering,
virtualization and drag & drop each a contained addition rather than a rewrite.

### Deliberately not virtualizing yet

The brief asks about thousands of nodes, so this is answered directly rather than deferred silently.

Flattening already bounds the DOM to _expanded_ rows, not total rows — with top-level-only default
expansion, a 10,000-node file renders perhaps a dozen. The pathological case is a user expanding
everything, and it is the only case that would stutter.

Adding virtualization now would mean a new dependency and scroll/measurement handling to serve a
case no real file has yet produced. Deferring it is safe **specifically because** `flattenTree`
already emits the flat, uniform-height array a virtualizer takes as input — the change is swapping
the `.map` for a windowed renderer, in one component. The threshold worth acting on is roughly 2,000
simultaneously visible rows; the verification checklist measures against a generated 5,000-node file
so the decision rests on a number rather than an assumption.

The adapter's own pass is O(total nodes), runs once per file open, and is memoized on the document.

### Rows are presentational

`ExplorerRow` receives a row descriptor and callbacks. It never touches the document, the adapter or
the expansion set. Later features extend the _descriptor_ — a match range for search highlighting, a
drag handle, a context-menu target — without reaching into the tree's internals.

### `ProjectDocument` stays `JsonValue`

Tempting to type it now. Deliberately not doing so: making it a typed `MusicBrainNode` would be a
claim the main process has verified the file matches, and it has not — validation is still just
`JSON.parse`. The adapter narrows at the boundary and tolerates anything, which is the honest
arrangement while the vocabulary is still being confirmed.

Real schema validation remains future work, and milestone 002's `invalid` arm is still where it will
report. That contract does not change.

## Tradeoffs

| Decision                              | Cost                                               | Why it is worth it                                                                                |
| ------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Flatten instead of recurse            | More code than recursion; expansion state moves up | Unblocks search, filtering, virtualization and DnD at once; recursion blocks all four             |
| No virtualization yet                 | A fully-expanded huge file may stutter             | No dependency, no measurement code, and the flattened array makes it a one-component change later |
| Hide arbitrary metadata               | Shows strictly less of the file than today         | The milestone's central bet; nothing is lost from disk and the inspector restores access          |
| Remove the right pane                 | Loses a visible promise of the inspector           | Stops advertising a missing feature; returns trivially                                            |
| Inline SVG icons over emoji           | ~6 small components to write                       | Consistent cross-platform, inherits `currentColor` for hover and dark mode                        |
| Icon + weight, not colour, for kind   | Kind is subtler than colour-coding                 | Keeps colour free for state that changes; avoids ClickUp's colour saturation                      |
| Include selection                     | Slight scope stretch                               | Keeps your place while scanning; the inspector's seam; one `useState` to cut                      |
| Adapter in `shared/` not renderer     | Renderer-shaped code in a shared folder            | Main needs it for search indexing and validation later                                            |
| `kind: string`, no union type         | No compile-time check that a kind is known         | The vocabulary is written down once, in the registry; a union is a second copy that drifts        |
| Registry in renderer, model in shared | The model layer spans two folders                  | Icons and Tailwind classes are DOM concerns; `tsconfig.node.json` would reject them in `shared/`  |
| Keep both fixtures                    | Two files to maintain instead of one               | They test opposite halves of the adapter; the generic one permanently proves graceful degradation |

## Files changed

**Shared** (isomorphic — no Node, no DOM)

| File                          | Change                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `src/shared/model/node.ts`    | New — `ExplorerNode`. Carries `kind: string`; declares no vocabulary                                                      |
| `src/shared/model/adapter.ts` | New — the only module naming `nodeType` / `metadata` / `children`                                                         |
| `src/shared/constants.ts`     | Window size → 1440×900 / 900×600; adds `IPC_LOAD_DEFAULT_PROJECT` and `DEFAULT_PROJECT_PATH`                              |
| `src/shared/types/index.ts`   | Splits `LoadProjectResult` out of `OpenProjectResult`; adds `ProjectApi.loadDefault`. `ProjectDocument` still `JsonValue` |

**Renderer**

| File                                                    | Change                                                                           |
| ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/renderer/src/components/explorer/nodeKinds.ts`     | New — **the single vocabulary**: kind → icon, name, styling, as data             |
| `src/renderer/src/components/explorer/icons.tsx`        | New — the inline SVG set the registry points at                                  |
| `src/renderer/src/components/explorer/ExplorerTree.tsx` | New — owns expansion + selection, renders the flat list                          |
| `src/renderer/src/components/explorer/ExplorerRow.tsx`  | New — presentational row; one registry lookup, no kind logic                     |
| `src/renderer/src/components/explorer/flattenTree.ts`   | New — pure; the future search/filter insertion point                             |
| `src/renderer/src/components/explorer/EmptyState.tsx`   | New — the no-project screen; distinguishes still-loading from failed             |
| `src/renderer/src/components/TreeView.tsx`              | **Deleted** — fully replaced                                                     |
| `src/renderer/src/App.tsx`                              | Rewritten — header with project name, single full-width pane, right pane removed |

**Main / preload**

| File                      | Change                                                                         |
| ------------------------- | ------------------------------------------------------------------------------ |
| `src/main/ipc/project.ts` | `readProject` extracted and shared; `project:loadDefault` added; path resolver |
| `src/preload/index.ts`    | Exposes `loadDefault` alongside `open`                                         |
| `electron-builder.yml`    | `extraResources` ships `data/` beside the asar so packaged builds find it      |

**Other**

| File                                | Change                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------ |
| `examples/music-brain-project.json` | New — the real schema, with the brief's areas: Ableton, Album, Guitar, Research, Marketing |
| `examples/sample-project.json`      | **Unchanged** — kept as the permanent no-`nodeType` degradation fixture                    |
| `README.md`                         | Status, milestone table row, both fixtures and what each is for                            |

## Verification checklist

Gates

- [x] `pnpm typecheck` — both Node and web projects
- [x] `pnpm lint`
- [x] `pnpm build`
- [~] `pnpm format:check` — passes for every file this milestone touched.
  `examples/sample-project.json` still fails, and did before this branch: it is stored with LF
  and checked out with CRLF, which Prettier's `endOfLine: "lf"` rejects. Its content diff is
  empty. The fix is a repo-wide `.gitattributes` (`* text=auto eol=lf`) plus a renormalise,
  which is deliberately **not** done here — it would touch every file in the repository and has
  nothing to do with this feature.

  `data/` is excluded via `.prettierignore`: the knowledge base is data, not source, and
  reformatting it would produce a large diff that says nothing about the code.

Verified against the real file — `data/music-brain.json`, 548 nodes

- [x] Opens, and yields **13 roots / 548 nodes / depth 4**, matching a direct count of the file
- [x] The project is titled **Music Brain**, taken from `brain.title` and not from the filename
- [x] Every one of the 548 nodes resolves to a registered kind — **0 fall back** to the neutral dot
- [x] Kind distribution matches the file exactly: `task` 397, `area` 99, `project` 39, `domain` 13
- [x] **All 548 derived node IDs resolve** to the node they claim to address — checked by
      walking each pointer back through the raw document and comparing titles, 0 mismatches
- [x] Top-level rows read as the user's own domains — _Ableton_, _Guitar Pro_, _Practice_,
      _Quad Cortex_, _Album_, _Reference Library_, _Content Creation_, …

Startup — confirmed by running the built app and capturing its window

- [x] Launching goes straight into the project. No file picker appears
- [x] The header reads **Music Brain**, with `music-brain.json` demoted beside it
- [x] All 13 domains render collapsed, chevrons pointing right
- [x] Each collapsed row shows its child count, and all thirteen match `flattenTree` exactly —
      7, 1, 5, 8, 3, 3, 4, 6, 2, 1, 3, 1, 3
- [x] **Open Project** is still present in the header; the picker was not removed
- [x] The window measures 1440×900 logical (2160×1350 physical at this display's 150% scale)

Robustness — all three files

- [x] `examples/music-brain-project.json` — 36 nodes, every registered kind exercised at least once
- [x] `examples/sample-project.json` — opens **unchanged from milestone 002**, all 5 nodes take the
      fallback path with titles intact, children intact, 0 pointer mismatches, nothing dropped
- [x] The unregistered `field-recording` kind renders and stays navigable
- [x] The deliberately untitled node yields `label: undefined`, so the row shows its placeholder
- [x] A node whose `children` is absent or not an array is treated as a leaf without throwing
- [x] Non-node siblings of the root (`schema`) are skipped rather than rendered

Scale

- [x] The real 548-node file adapts in a single pass with no perceptible delay. Measured through
      `flattenTree`: **13 rows** mounted on open (fully collapsed), 60 under the previous
      top-level-expanded default, 548 fully expanded. Comfortably below the ~2,000-visible-row
      threshold at which virtualization would be worth adding, so it is not added.
- [x] The startup row count is now independent of file size — it is the number of top-level nodes,
      whatever sits beneath them

Discipline

- [x] `App.tsx` never indexes, `typeof`-tests or iterates `project.document`
- [x] `nodeType`, `metadata`, `children` and `title` are named in `adapter.ts` and nowhere else
- [x] No `switch` on kind, and no comparison of a kind to a string literal, outside `nodeKinds.ts`
- [x] No kind vocabulary — no union type, no list of kind names — exists in `src/shared/`
- [x] `flattenTree.ts` has no React import

Window

- [x] The window opens at exactly 1440×900, confirmed by reading back its rect while running

Left for review — requires driving the UI by hand

These are the items that need a person at the keyboard. The file picker is a native dialog, and this
machine could not be automated safely while in use, so they were **not** verified:

- [ ] Domains, areas, projects and tasks are distinguishable without reading the labels
- [ ] Clicking anywhere on a container row expands/collapses it
- [ ] Collapsed non-empty containers show a child count; expanded ones do not
- [ ] Selection highlight follows clicks and survives expanding and collapsing other nodes
- [ ] Opening a different project resets expansion and selection
- [ ] A node at depth 4 is attributable to its parent via the indent guides
- [ ] Completed tasks are muted and struck through — note that the real file currently contains no
      completed work at all (`status` is `todo` ×536, `active` ×3), so this needs the fixture
- [ ] A malformed JSON file still shows milestone 002's error and clears the tree
- [ ] The window remains usable when resized to the 900×600 minimum

## Out of scope

As specified in the brief: editing, saving, drag & drop, an inspector, search, filtering, favorites,
keyboard shortcuts, AI, context menus, canvas. The JSON schema does not change and no new IPC is
added.

Also deliberately absent:

- **Virtualization** — justified above with a measurable threshold rather than deferred by default.
- **Persisted expansion state** — expansion resets on reopen. The `Set` is serializable; storing it
  needs a persistence layer this milestone does not have.
- **Sticky ancestor rows** — a genuine win from VS Code, but it is scroll-position machinery, and
  this milestone should not add scroll machinery it cannot yet justify.
- **Schema validation** — still `JSON.parse` only, for the reason given under `ProjectDocument`.
- **A design system** — no tokens, no theme layer, no component library. Tailwind utilities inline,
  as today.

**Selection is included**, against a strict reading of "no inspector" — see _Product thinking_ for
the reasoning and how to cut it.

## Future considerations

### The automatic startup project is temporary

Opening straight into `data/music-brain.json` is a deliberate simplification for this stage, not the
intended end state. The application is single-project because it is being optimised for one person
opening it every day, and a fixed default is the shortest path to that. A later milestone replaces
it with real workspace and project management — recent projects, switching without restarting,
possibly several open at once.

Nothing here has to be undone to get there, because the shortcut was kept to one place:

- **`DEFAULT_PROJECT_PATH` is the only hardcoded file.** Nothing else in the application assumes
  which project is open, or that there is exactly one.
- **`project:loadDefault` is additive.** `project:open` was deliberately kept rather than replaced,
  so the ability to open any file already exists and does not need rebuilding — what is missing is
  UI for choosing among projects, not the capability.
- **`readProject` already takes a path.** A channel that loads a named project is a new caller of a
  function that exists, not new plumbing. The renderer still must not supply the path; a recent
  projects list lives in main, and the renderer refers to entries by index or id.
- **`Project` carries `filePath`.** Milestone 002 kept it for saving; it is equally what a recent
  projects list and a window title will key on.
- **`LoadProjectResult` is separate from `OpenProjectResult`.** Loading a known project and
  prompting for one are already distinct outcomes in the type system, which is the distinction
  project switching is built on.
- **Expansion and selection are per-tree state**, keyed by node identity and reset by remounting on
  `filePath`. Several projects open at once means several trees, not shared state to untangle.

The one thing that will need revisiting is the assumption that a failed startup load leaves the user
on an empty screen with a picker. With a project list there is somewhere better to fall back to.

### JSON is today's persistence format, not part of the product model

The Explorer navigates `ExplorerNode`, and `ExplorerNode` describes a knowledge base rather than a
file. That is deliberate, and it is what makes a change of persistence layer — SQLite, Postgres, a
service — a change to a small number of modules rather than to the application.

Verified rather than asserted: `src/renderer/src/components/explorer/` contains **no** reference to
`filePath`, `fileName`, `ProjectDocument` or JSON. The flattener, the tree, the row and the kind
registry are already storage-agnostic, and would not change if the store did.

What currently keeps that true, and should be preserved:

- **`adapter.ts` is the only module that names a field of the stored format.** Replacing it is how
  the store changes. Everything else consumes `ExplorerNode`.
- **Node identity is a contract, not a format.** Unique, stable, derivable, opaque — see
  _Explorer node identity stays derived_. A JSON Pointer satisfies it today; a primary key would
  satisfy it equally.
- **`ProjectDocument` is still `JsonValue`.** That alias is where the format is admitted, and it is
  the single place a typed or non-file-backed model would replace it.
- **The IPC contract is written in terms of projects, not files.** `LoadProjectResult` says a project
  was loaded, not that a file was read. A database-backed loader fits the same union.

The honest caveat, because "storage-independent" is easy to overclaim. Three places do know they are
dealing with a file, and would all change:

- **`src/main/ipc/project.ts`** — `readProject`, `defaultProjectPath`, the dialog. This is the right
  place for storage to be visible, and the least surprising to rewrite.
- **`Project` itself** — `filePath` and `fileName` are file concepts sitting in a shared type.
- **`App.tsx`** — displays `fileName` beside the project name, keys the tree on `filePath` so a
  different project remounts, and phrases one error as "is not valid JSON".

So the boundary today runs through the application shell, not through the Explorer. The Explorer is
clean; `App.tsx` is where storage still shows. A store change would want `Project` to carry a
generic workspace identity instead of a path — which is the same change project management wants
anyway, and a reason to expect the two milestones to land together.

### Seams

Left open on purpose, each already load-bearing for a specific later milestone:

- **`flattenTree`** — takes model + expansion and returns visible rows. Search and filtering enter
  here as an additional predicate parameter; every consumer downstream is unaffected. This is the
  single most valuable seam the milestone creates.
- **The row descriptor** — search match ranges, drag handles and context-menu targets are fields
  added to it, not surgery on the tree.
- **The expansion `Set`** — serializable and keyed by node identity, so persisting expansion per
  project is storage work only. Also what "reveal node X" will manipulate: expand every ancestor of
  the target.
- **`ExplorerNode.id`** — Explorer node identity, and now the selection value. The inspector and deep
  links inherit it complete. Because the contract is only unique-stable-derivable-opaque, a change of
  persistence layer changes how it is produced and nothing that consumes it — see
  _Explorer node identity stays derived_.
- **The adapter** — the single point of contact with the file format. Schema migration, the
  currently-unread `version` field, and eventual real validation all land here.
- **`nodeKinds.ts`** — the single point of contact with the kind vocabulary. New node types are
  entries. It is also where per-kind behaviour that does not exist yet will attach: which kinds may
  contain which others (drag & drop), which are filterable as a group, which get a specialised
  inspector panel. Each of those is a new field on the entry, not a new `switch` somewhere.
- **Both fixtures** — the regression pair. Any future change to the adapter or the registry should
  be checked against both, because they exercise opposite paths through the same code.
- **The file's `id` field** — read by nothing today, because it is not unique enough to be identity.
  It is still the only name in the file that survives a node being moved, which a positional pointer
  cannot, so anything wanting stable cross-session references (bookmarks, deep links, `related` /
  `dependsOn` edges) will want it — after the collisions are resolved.
- **`related`, `dependsOn`, `resources`, `outputs`** — four fields on every real node, holding what
  are almost certainly cross-references between nodes. The explorer ignores them entirely. They are
  the raw material for a graph view or a backlinks panel, and the reason the model was kept a tree
  rather than being hardcoded as one.
- **`status` beyond done/not-done** — the real file uses `todo` and `active`, and the explorer only
  asks the yes/no question "is this complete". Surfacing `active` as a distinct state is a small,
  obvious win once there is a place to put it.
- **`priority` and `energy`** — present on every node, unused. Natural sort and filter keys.
- **The removed right pane** — the inspector re-adds it as a flex sibling, reading the selected
  `ExplorerNode.id`. Both halves of that contract exist after this milestone.
- **`shared/model/` being isomorphic** — main can import it, which is what lets search indexing and
  validation move off the renderer when they arrive.
- **Virtualization** — swap the `.map` in `ExplorerTree` for a windowed renderer. Uniform 28px rows
  were chosen partly to keep this a fixed-size, not variable-size, virtualization problem.

## Why this is the smallest possible step to a significantly more usable product

Everything else the application could gain — editing, saving, search, an inspector — is worth nothing
if the user cannot recognise their own content on screen. Recognition is the precondition for all of
it: you cannot search a world you cannot read, and you cannot meaningfully edit a node you are
identifying by its JSON path. This milestone buys that precondition and nothing else.

It is the _smallest_ way to buy it. There is no new data, no new IPC channel, no persistence, no
schema change, no editing and no dependency. The application already reads the file and already
walks it. The change is one pure adapter and one rendering pipeline — it converts an existing
capability into a usable one rather than adding a capability.

Nothing here could be removed and still deliver the goal. Drop the adapter and the UI is still
showing `nodeType` rows. Drop the icons and typography and every kind looks identical, so the
hierarchy is structure again rather than meaning. Drop the flattening and it _would_ still look
right today — but search, filtering, virtualization and drag & drop would each begin by undoing the
recursion, which is why the one piece of internal work in this milestone is also the one that pays
for itself soonest.

And it is honest about being a slice rather than a layer: it ships a screen the user can open every
day, and leaves the architecture better only as a by-product of doing so.

## Sources

Research references consulted for navigation and rendering patterns:

- [Tree View Pattern — UX Patterns for Developers](https://uxpatterns.dev/patterns/data-display/tree-view)
- [PatternFly — Tree view design guidelines](https://www.patternfly.org/components/tree-view/design-guidelines/)
- [3 alternatives to tree navigation — Justinmind](https://www.justinmind.com/blog/3-modern-alternatives-to-tree-navigation/)
- [Notebook Navigator — Obsidian two-pane explorer](https://github.com/johansan/notebook-navigator)
- [How we redesigned the Linear UI (part Ⅱ)](https://linear.app/now/how-we-redesigned-the-linear-ui)
- [Sidebar Navigation Design: Patterns for Web Applications](https://www.girardmedia.com/blog/sidebar-navigation-design-web-applications)
- [List Virtualization — patterns.dev](https://www.patterns.dev/vanilla/virtual-lists/)
- [Windowing and Virtualization — Steve Kinney](https://stevekinney.com/courses/react-performance/windowing-and-virtualization)
