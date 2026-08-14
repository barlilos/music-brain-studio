# 004 — Canvas View

**Branch:** `feature/canvas-view`
**Status:** implemented — awaiting review

## Goal

Stop being a JSON explorer and start being an application: give the knowledge base a **workspace**,
and demote the tree to what it is good at.

**The Canvas is the primary workspace of Music Brain. The Explorer is a navigation aid.** This
milestone is where that becomes true, and it is the framing every later milestone is built on — see
_The Canvas is the workspace_ below.

Done when: the app opens into a two-pane workspace with no action required; selecting anything in
the Explorer redraws the Canvas around it; clicking a card in the Canvas navigates and the Explorer
follows; the graph is recognisably a graph — cards, connections, pan, zoom — and nothing on it can be
edited, dragged or saved.

Explicitly **not** done here: editing, drag & drop, save, physics. This milestone is visual
navigation only — but it is the surface everything else will be built on, not a one-off view.

## Changes from review

Eight decisions changed in the first review round, and six framing and architecture points were
added in the second. All of it before any code. Recorded so the document can be read against the
versions that were reviewed.

**Third round — the navigation relationship**

| #   | Change                                                                                       | Where it landed |
| --- | -------------------------------------------------------------------------------------------- | --------------- |
| 15  | The Explorer chevron expands only; the row label selects. Expansion never touches the Canvas | _UX decision 7_ |
| 16  | Canvas → Explorer navigation confirmed complete, with reveal and parent-rooting for leaves   | _UX decision 7_ |
| 17  | The project name returns to the project Canvas, built as the first breadcrumb                | _UX decision 8_ |

**Second round — framing and architecture**

| #   | Change                                                                                 | Where it landed                     |
| --- | -------------------------------------------------------------------------------------- | ----------------------------------- |
| 9   | The Canvas is stated as the **primary workspace**; the Explorer is a navigation aid    | _The Canvas is the workspace_       |
| 10  | **Canvas Identity** — a canvas always represents one explicit Canvas Root              | _Canvas Identity_                   |
| 11  | The layout algorithm is **deterministic**, to the pixel, forever                       | _Layout is pure, and deterministic_ |
| 12  | Rendering depends only on the Canvas Root and its descendants, never the whole project | _Rendering is bounded by the root_  |
| 13  | Future zoom may change card **detail** rather than card size                           | _Future considerations_             |
| 14  | An explicit note that later milestones add editing on the Canvas itself                | _The Canvas is not a one-off view_  |

**First round — product and UX**

| #   | Change                                                                                                                                     | Where it landed                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| 1   | Leaf selections root the Canvas at the **parent**, with the selection highlighted among its siblings — now the primary rule, not an option | _The rooting rule_               |
| 2   | Canvas → Explorer navigation confirmed as in scope                                                                                         | _UX decision 7_                  |
| 3   | React Flow's zoom controls removed                                                                                                         | _UX decision 6_                  |
| 4   | Dot-grid background removed                                                                                                                | _UX decision 6_                  |
| 5   | Child-count badge removed from the card                                                                                                    | _UX decision 3_                  |
| 6   | Cards enlarged to 280 × 72                                                                                                                 | _UX decision 3_, _UX decision 5_ |
| 7   | New **Animation philosophy** section                                                                                                       | its own section                  |
| 8   | A **ViewModel** layer inserted between layout and React Flow                                                                               | _The pipeline_, _The ViewModel_  |

| #   | Change                                                                                                                                     | Where it landed                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| 1   | Leaf selections root the Canvas at the **parent**, with the selection highlighted among its siblings — now the primary rule, not an option | _The rooting rule_               |
| 2   | Canvas → Explorer navigation confirmed as in scope                                                                                         | _UX decision 7_                  |
| 3   | React Flow's zoom controls removed                                                                                                         | _UX decision 6_                  |
| 4   | Dot-grid background removed                                                                                                                | _UX decision 6_                  |
| 5   | Child-count badge removed from the card                                                                                                    | _UX decision 3_                  |
| 6   | Cards enlarged to 280 × 72                                                                                                                 | _UX decision 3_, _UX decision 5_ |
| 7   | New **Animation philosophy** section                                                                                                       | its own section                  |
| 8   | A **ViewModel** layer inserted between layout and React Flow                                                                               | _The pipeline_, _The ViewModel_  |

Changes 1, 5 and 6 interact, and the interaction is the best thing in the first revision — see
_The rooting rule_ and _Animation philosophy_.

## The Canvas is the workspace

> **The Canvas is the primary workspace of Music Brain. The Explorer is a navigation aid.**
>
> The Explorer is where you _find_ something. The Canvas is where you _work on_ it. That holds for
> the lifetime of the application, not only for this milestone.

This is a small sentence with large consequences, and it is being written down now — while the Canvas
can do almost nothing — precisely because it is a statement about direction rather than about
capability. Every decision in this document is meant to be evaluated against it.

**What it changes about this milestone.** The 25 / 75 split stops being an allocation of pixels and
becomes a statement of intent. It is also why the Canvas gets `fitView`, an animation philosophy and
a ViewModel layer while the Explorer gets a controlled `selectedId` prop and nothing else: effort
follows the workspace.

**What it changes about the milestones after it.** When a new capability could plausibly live in
either pane, it goes on the Canvas. Editing, status changes, forms, drag & drop and connections all
land there — see _The Canvas is not a one-off view_. The Explorer grows only in ways that make it a
better _finder_: search, filtering, reveal, favourites. It does not acquire an edit affordance, and
if it ever seems to need one, that is a signal the Canvas is missing something.

**What it revises about milestone 003.** That document treated the Explorer as the application — it
removed the right pane precisely so the tree could have the full window. That was correct then and is
superseded now. The tree is not being demoted in quality, only in role: it stays the fastest way to
locate anything in 548 nodes, which is a job the Canvas is bad at and should not attempt.

**The honest caveat.** Today the Canvas is read-only, so calling it "the workspace" describes an
intention rather than an accomplished fact. Nobody can work on anything in it yet. The claim earns
its place because the architecture is being chosen to make it true — a canvas has an identity, the
layout is deterministic, rendering is bounded by the root, and the rendering library is isolated
behind a ViewModel — and none of those choices would be justified for a visualization.

## Context

Milestone 003 removed the JSON vocabulary from the screen. What it left is a very good tree in a
window that contains nothing else. The application is now honest about _what_ the user's content is,
but it still presents it in exactly one shape — a list — and a list is a navigator, not a workspace.
There is nowhere to look at something; there is only somewhere to find it.

That is the gap this milestone closes, and it is why the Canvas is the right next feature rather than
an inspector or search. An inspector answers "what are this node's fields", which is a question about
a record. The Canvas answers "what is this thing part of, and what is in it", which is a question
about a _structure_ — and structure is what a hierarchical knowledge base is for. The tree already
answers that question, but only as indentation, and indentation is a very low-bandwidth way to show a
relationship.

Three things make now the right time:

1. **The model already exists.** `ExplorerNode` is storage-agnostic and carries everything a card
   needs — label, kind, completion, children. The Canvas needs no new IPC, no new data and no schema
   change. It is a second view over a model that was deliberately built not to be a view.
2. **The kind registry already exists.** Icons, display names and completion behaviour are data in
   `nodeKinds.ts`. The Canvas can render kinds correctly on day one and adds **zero** new vocabulary.
   This is the first real dividend of that decision, and the cheapest possible test of whether the
   registry was factored correctly.
3. **Every capability the brief defers — editing, drag & drop, forms, persistence — is a Canvas
   capability.** Introducing the surface while it is read-only is the lowest-risk moment to do it.
   Deferring the Canvas means adding the surface _and_ mutation _and_ a rendering library in one
   milestone, debugging all three against each other.

### What the data says about the graph

The Canvas shows one node and its immediate children, so its size is not the size of the file — it is
the **fan-out** of one node. Measured against `data/music-brain.json`:

| Measure                       | Value                                            |
| ----------------------------- | ------------------------------------------------ |
| Total nodes                   | 548                                              |
| Nodes with children (parents) | 151                                              |
| **Leaves**                    | **397 — 72% of all nodes**                       |
| Fan-out: min / median / p90   | 1 / 3 / 6                                        |
| Fan-out: max                  | **14** — _Main Template_, the only node above 10 |
| Nodes per depth (0…4)         | 13 / 47 / 113 / 347 / 28                         |

Full fan-out histogram, for the 151 parents:

| Children | 1   | 2   | 3   | 4   | 5   | 6   | 7   | 8   | 9   | 10  | 14  |
| -------- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Parents  | 30  | 19  | 32  | 31  | 18  | 8   | 5   | 4   | 2   | 1   | 1   |

Two numbers decide most of this design.

**The graph is never bigger than 15 cards.** One root plus at most fourteen children, and typically
one plus three. That removes an entire category of work from this milestone before it starts: no
virtualization, no clustering, no level-of-detail, no force simulation, no incremental layout, no
edge bundling. A deterministic layout computed in a single pass is not a simplification of the right
answer — at this size it _is_ the right answer, and any physics engine would be a slower, less
predictable way to arrive at a worse one. This is the concrete reason the brief's "no physics" is
easy to honour rather than a constraint to work around.

It is also what makes the larger cards affordable. At 15 cards there is room to be generous; at 150
there would not be.

**72% of nodes are leaves.** This is what drives the rooting rule below, and it was the biggest open
question in the first draft.

## The rooting rule

**The Canvas roots at the selected node — unless the selected node is a leaf, in which case it roots
at the leaf's parent and highlights the leaf among its siblings.**

The first draft implemented the brief literally ("the selected Explorer node becomes the Canvas
root") and flagged the consequence: 397 of 548 nodes are leaves, so nearly three of every four
Explorer clicks would produce a Canvas holding one card and no connections. Review adopted the
alternative, and it is now the primary rule rather than an option.

The rule still satisfies the brief's shape — the Canvas always shows exactly one node and its
immediate children. What changes is only _which_ node is chosen as that root.

```
Selecting a container            Selecting a leaf
(e.g. "Ableton", 7 children)     (e.g. "Set up return tracks")

  ┌─────────┐   ┌──────────┐       ┌─────────┐   ┌──────────────┐
  │ Ableton │──▶│ Main Tem…│       │ Mixing  │──▶│ Bus routing  │
  │  ◄ ring │   ├──────────┤       │         │──▶├──────────────┤
  └─────────┘──▶│ Mixing   │       └─────────┘   │ Set up ret…◄ │ ring
               ├──────────┤                      ├──────────────┤
               │ …        │                      │ Gain staging │
               └──────────┘                      └──────────────┘

  root = selection                 root = parent, ring = selection
```

Three consequences worth stating, because two of them are what make the revised design cohere:

- **The ring marks the selection, not the root.** One rule, both cases. When a container is selected
  the ring is on the root card; when a leaf is selected it is on one of the children.
- **Clicking between sibling leaves does not change the graph.** Same root, same cards, same
  positions — only the ring moves. This is what gives the Canvas its spatial continuity, and it is
  the reason the animation section below has something real to work with rather than a set of
  aspirations.
- **The graph only changes shape when you click a container.** And when it does, the card you clicked
  survives the redraw as the new root, so there is always at least one anchor between consecutive
  graphs.

Two edge cases the function must handle: a leaf with no parent (a childless top-level node — none
exist in the real file, but the model permits it) roots at itself and shows a single card; and no
selection at all is covered under _UX decision 8_.

This lives in one function, `canvasRootFor(selectedId, index)`, so the rule is one expression and
nothing downstream knows which rule is in force.

## Research — graph surfaces in productivity software

Five surfaces, read for interaction model and for what they cost, not for looks.

### React Flow (`@xyflow/react`)

**Works.** It is the de-facto standard for node-based UIs in React and it is factored the way this
milestone needs: nodes and edges are plain data you own, rendering of a node is _your_ component
registered under a `nodeTypes` key, and the library's job is the viewport — pan, zoom, edge paths,
hit testing. Every interaction it provides is individually switchable (`nodesDraggable`,
`nodesConnectable`, `elementsSelectable`, `nodesFocusable`), so a strictly read-only canvas is a
configuration rather than a fight. `fitView` plus `fitViewOptions` solves framing, which is the one
piece of viewport maths that is genuinely fiddly to get right by hand. Nodes are keyed by id and
positioned by transform, which is what makes cross-redraw continuity possible at all.

**Does not fit.** It is built for flow editors — its centre of gravity is connecting, dragging and
mutating, which is exactly what this milestone forbids. Most of its surface area will go unused for
now. It also brings the application's first runtime dependency beyond React (see
_Architecture decisions_ for the full weight), and its default look is a flowchart, which has to be
overridden rather than adopted — including the parts this design now removes entirely.

**Adopt.** The library, and specifically its separation of _graph data you own_ from _viewport
behaviour it owns_. Reject its defaults wholesale: no minimap, no controls, no background grid, no
default node types, no draggable nodes, no connection handles that respond to the mouse.

### Obsidian Canvas

**Works.** It is the closest product analogue — a knowledge base that grew a spatial view — and its
central lesson is that a card is a **first-class object with a stable identity**, not a rendering of
a row. Cards carry their own type; edges are explicit records with `fromNode` / `toNode` and a side,
not implied by position. Because the canvas is stored in the open JSON Canvas format, the graph model
is separable from the renderer by construction. It is also proof that a graph view and a tree view
can coexist without either becoming the "real" one.

**Does not fit.** Obsidian's canvas is a _manual_ artifact: the user places every card, and position
is meaningful content. Ours is derived — position is computed from the hierarchy and carries no user
intent, because there is nowhere to store it and nothing to store it for. This is also the argument
against Obsidian's dot grid, which exists to support manual alignment we do not offer. Obsidian has
no notion of "the canvas is a view of the current selection" either; a canvas is a document.

**Adopt.** A typed card model with its own identity, and explicit edge records. That model is what
this milestone's `CanvasGraph` is.

### Linear

**Works.** The relevant lesson is not visual this time, it is about _state_: skeletons rather than
spinners, mutations applied locally first, and interactions that feel instantaneous because the UI
never waits on anything. Applied here, that means the Canvas must never show a loading state when
selection changes — the data is already in memory, and any perceptible delay would be self-inflicted.
Its visual restraint from milestone 003 still applies: one accent colour, hierarchy by typography, no
decoration that does not carry meaning.

**Does not fit.** Linear has no graph surface to borrow from, and its keyboard-first model is out of
scope.

**Adopt.** The state discipline, which is now written down as its own section. Restraint on the card.

### ClickUp Whiteboards

**Works.** Very little, and that is why it is in the list. It demonstrates that a graph surface
bolted onto a productivity app can become the slowest and least-loved part of it: user feedback is
dominated by "slow and cumbersome", "loads slowly and sometimes does not load at all", and an
interface that "tries to cram in so many features simultaneously that it feels like a cluttered
mess."

**The cautionary reading.** Both failure modes are avoidable here for structural reasons rather than
by being careful. The performance problem comes from unbounded canvases; ours is bounded at 15 cards
by the shape of the feature itself. The clutter problem comes from every tool, panel and control
living on the canvas at once; ours ships with no editing tools at all, and after review with no
controls and no grid either.

**Adopt.** Nothing. **Reject** on-canvas toolbars, floating action buttons, per-card hover controls,
zoom controls, and a minimap — all of which are chrome in service of features that do not exist yet.

### VS Code Explorer

**Works.** The pattern that matters is the **two-way relationship between the navigator and the
workspace**. Opening a file from the tree focuses the editor; focusing an editor reveals and
highlights the corresponding row in the tree, expanding whatever ancestors were collapsed
(`explorer.autoReveal`). Neither surface is subordinate: the tree is where you _search_, the editor
is where you _are_, and the two never disagree about which thing is current.

**Does not fit.** VS Code's workspace holds many things open at once (tabs), and its tree selection
and editor state can deliberately diverge. Ours shows exactly one graph, and divergence would be a
bug rather than a feature.

**Adopt.** One shared selection between the two panes, and auto-reveal: when selection changes from
the Canvas side, the Explorer expands ancestors and scrolls the row into view. This is what stops the
two panes from becoming two applications.

### What this points to

1. **The graph is derived, not authored.** Position carries no user intent, so layout is a pure
   function, nothing about it needs saving, and no alignment affordances are owed to the user.
2. **One selection, two views.** Selection is application state, not tree state. Both panes read it;
   both panes set it.
3. **The card is a model object, not a rendered row.** Edges are explicit records.
4. **Read-only is a configuration, not an absence.** Every interaction React Flow offers is turned off
   explicitly and by name, so enabling one later is a deliberate act rather than a discovery.
5. **No chrome for features that do not exist.** No minimap, no toolbar, no hover actions, no
   controls, no grid.

## Product thinking

**The Canvas is not a prettier tree. It is a different question.** The tree answers "where is it"; the
Canvas answers "what is this among, and what is in it". Keeping both is the point — this milestone
does not make the Explorer less important, it stops the Explorer from having to be everything.

That framing decides the split. The Explorer is a scanning surface, so it needs enough width for a
title and no more; 25% of 1440px is 360px, which at depth 4 leaves ~250px of label — comfortably
above the 24-character p90 title. The Canvas is where you look at things, so it gets the rest, and
after review it gets it with as little furniture on it as possible.

### The completion indicator will look like it does not work

The brief asks for a completion indicator "if available". It is available, and it will render on all
397 tasks — as **unchecked**, because the real file contains no completed work at all: `status` is
`todo` on 536 nodes and `active` on 3, and there is no `done` value anywhere in it.

So the feature is correct and will appear inert. Recording this now so it is not mistaken for a bug
in review. The genuinely useful signal in this file is `active` versus `todo`, which the model does
not carry — `ExplorerNode` reduces status to a yes/no `isComplete`. Surfacing `status` properly is a
small adapter change plus a registry field, and it is deliberately **not** in this milestone: it
changes the shared model, and the brief asked for visual navigation over model work. It is the first
entry under _Future considerations_.

### What removing the child-count badge costs

Confirmed as a design decision in review, and worth recording the cost so it is a known trade rather
than an oversight.

The badge was the only signal distinguishing a card that **drills in** (has children) from one that
merely **moves the ring** (a leaf). Without it, the two clicks are indistinguishable until performed.
Three things soften this and none of them fully replace it:

- The kind name on the card already implies it. This file follows a strict `domain → project → area →
task` grammar, so "Project" reliably means "there is more inside" and "Task" reliably does not.
  That is a property of _this_ data, not a guarantee.
- Neither outcome is destructive or surprising. The worst case is a click that visibly does very
  little, which is recoverable by looking.
- The Explorer is beside the Canvas at all times and still shows counts on collapsed rows, so the
  information has not left the application.

The card is calmer for the removal, which is the goal. If predictability turns out to matter more
than calm, the cheapest replacement is not the badge returning but the connection stub — drawing a
short outgoing edge nub on cards that have children — which says the same thing with no text. Noted
for later; not proposed now.

### Removing the controls creates one trap

With `<Controls />` gone and `fitView` running only on selection change, there is **no way to reframe
the current graph** once the user has zoomed or panned away from it. Selecting a different node and
coming back is the only route, and clicking the root card is deliberately inert.

This is the one place where the minimal direction has a rough edge, and it is being shipped as
specified rather than quietly worked around. The zero-chrome remedy, if it turns out to be needed, is
to bind double-click on the background to `fitView` — the double-click gesture is already free
because `zoomOnDoubleClick` is off, and it adds nothing visible to the surface. It is **not** in this
design; it is one line when wanted.

## UX decisions

### 1. The layout: two panes, no splitter

```
┌───────────────────────────────────────────────────────────────────────┐
│ Music Brain  music-brain.json                          [Open Project] │
├────────────────────┬──────────────────────────────────────────────────┤
│ Explorer  ~25%     │ Canvas  ~75%                                     │
│                    │                                                  │
│ ▾ Ableton          │                        ┌────────────────────────┐│
│   ▸ Main Template  │   ┌───────────────┐    │  ▤  Main Template      ││
│   ▸ Mixing         │   │ ◆  Ableton    │───▶│     Project            ││
│ ▸ Guitar Pro       │   │    Domain     │    └────────────────────────┘│
│ ▸ Quad Cortex      │   └───────────────┘    ┌────────────────────────┐│
│ ▸ Album            │            └──────────▶│  ▤  Mixing             ││
│                    │                        │     Project            ││
│                    │                        └────────────────────────┘│
└────────────────────┴──────────────────────────────────────────────────┘
```

The existing header stays above both panes: it names the project, and the project spans both. The
Explorer keeps its own scroll; the Canvas has its own viewport.

The split is a fixed proportion — 25% / 75% — with a minimum width on the Explorer so it does not
collapse at the 900px minimum window. **Not resizable this milestone.** A draggable splitter is
pointer capture, a persisted size and a hit target, and none of that makes the application more
usable today than the two panes existing at all.

### 2. Direction: left to right, root on the left

The root card sits at the left, vertically centred; children stack in a single column to its right.
Edges run left→right as bezier curves from the root's right edge to each child's left edge.

Rejected alternatives:

- **Radial** (root centred, children on a circle) — reads as a network rather than a hierarchy, puts
  labels at every angle, and becomes unstable in appearance as fan-out changes. Obsidian's _graph_
  view does this and it is the least useful thing in Obsidian for finding anything specific.
- **Top-down** (children in a row beneath the root) — a row of 14 cards at 280px is 4,000px wide,
  unreadable at any zoom the pane allows. Top-down only works when cards are small, and after review
  they are deliberately not.
- **Left-to-right** wins because vertical stacking is what fits a landscape pane, and because a
  column of cards is scannable the same way the tree is: one axis, aligned left edges.

### 3. The card

Fixed **280 × 72px** — enlarged in review from 240 × 56. The graph never exceeds 15 cards, so the
space is available, and spending it here is what makes the Canvas read as calm rather than as a list
that has been spread out. Fixed dimensions keep layout arithmetic rather than measurement, and keep
every card a peer of every other.

```
┌──────────────────────────────────────┐
│                                      │
│   ◆    Main Template                 │   ← icon 20px, title 14px
│        Project                   ☐   │   ← kind name 11px, completion
│                                      │
└──────────────────────────────────────┘
   14px padding, 280 × 72
```

- **Icon** — from the kind registry, 20px (up from the row's 16px). Same glyph and colour as the
  Explorer uses for the same kind.
- **Title** — 14px, single line, truncated with an ellipsis and exposed in full as a `title`
  attribute. The wider card leaves ~222px of text, about 29 characters, against a 15-character median
  and 24-character p90 — so p90 now fits comfortably and only the long tail truncates. Wrapping to
  two lines is still rejected: it makes card height variable, which turns layout from arithmetic into
  measurement, and it breaks the peer-to-peer reading that uniform cards produce.
- **Kind name** — 11px, muted, the registry's `name` ("Project", "Task"). This is the "subtle node
  type" the brief asks for, and it is what makes the icon vocabulary learnable rather than decorative.
- **Completion** — a small checkbox glyph, shown only for kinds whose registry entry says
  `showsCompletion` and only when the node actually carries the concept. Not clickable.
- **No child count.** Removed in review; see _What removing the child-count badge costs_.

The card does **not** use the registry's `labelClassName`. That field is row typography — containers
read heavier than their contents so a dense list acquires hierarchy without boxes. A canvas has no
list to create hierarchy in, and a card's title is its primary content, so all titles take full
contrast. (Noted under _Architecture decisions_: this is the first sign the registry mixes "what a
kind is" with "how a row draws it".)

### 4. The selection ring

The selected node's card carries a subtle accent ring; every other card is plain. Size is never used
to signal it — size differences imply importance ordering between siblings, and a ring says "this is
the one you selected" without claiming a project matters more than a task.

Per _The rooting rule_, the ring sits on the root card when a container is selected and on a child
card when a leaf is selected. One rule, and the thing it marks is always the same thing.

### 5. Geometry, and what it costs at the extremes

Card 280 × 72, vertical gap 12 (pitch **84px**), horizontal gap between root and column 140px. The
root plus one column is 700px wide against roughly 965px of usable pane width, so width is never the
constraint — height always is.

The Canvas viewport is roughly 855px tall (900px window less the header). `fitView` with 12% padding
leaves about 690px of usable height, and zoom is capped at 1.0 on the way in and floored at 0.8 on
the way out:

| Children            | Column height | Zoom after fit               | 14px title renders at | How many parents |
| ------------------- | ------------- | ---------------------------- | --------------------- | ---------------- |
| ≤ 8                 | ≤ 660px       | 1.00 (capped)                | 14.0px                | 147 of 151       |
| 9                   | 744px         | 0.93                         | 13.0px                | 2                |
| 10                  | 828px         | 0.83                         | 11.7px                | 1                |
| 13 _(project root)_ | 1,080px       | **0.67** (fitted, own floor) | 9.4px                 | — (launch view)  |
| 14                  | 1,164px       | 0.80 (floored)               | 11.2px                | 1                |

**147 of 151 parents render at full size**, and three of the remaining four still fit entirely in the
viewport. Exactly one node in the file — _Main Template_, with 14 children — cannot be shown whole:
at the 0.8 floor about 10 of its 14 cards are visible and the rest are a short pan away.

The floor is the notable choice, and it is a change of position from the first draft, which let zoom
fall as far as 0.6 to fit everything. With larger cards that would have rendered a 14px title at 8px,
which is neither calm nor legible. **Below 0.8 it is better to pan than to shrink**: a tall column is
a list, lists are made to be scrolled, and the user already has the gesture.

**The project root is the one exception, and it has its own floor of 0.55.** Added in a later polish
pass, because the rule above produced the wrong answer for exactly one canvas. The overview is the
answer to "what is in here at all", and an overview that cuts the top and bottom off the list is not
an overview — at 0.8 the thirteen domains overflowed the pane and the first and last were clipped.
Every other canvas is somewhere you navigated _to_, where reading the cards matters more than
counting them and panning is natural because you already know what you are looking at.

The lower value is a floor, not a target: the zoom still comes from the graph bounds, the viewport
and the padding, and on the reference file the computed fit lands at **0.67** — above the floor, so
the floor does not bind and nothing is hardcoded for today's thirteen domains. What 0.55 buys is that
a knowledge base with a very large top level degrades to panning rather than to illegibility, which
is the same judgement as the 0.8 floor made once at a more permissive setting.

Measured at 1440×900: the overview frames all 14 cards with 43px of clear space above and below,
centred. At the 900×600 minimum the floor does bind — cards stay 40px tall and about 22px overflows
top and bottom — which is the floor doing its job rather than a framing failure.

Column wrapping (splitting a tall column into two side-by-side columns) remains **deliberately not
built**. It would serve one node in 548, and edges routed into a second column must cross the first,
trading a legibility problem for an edge-crossing problem. The trigger to revisit is a file where
more than ~10% of parents exceed 10 children.

### 6. Viewport behaviour, and what is not on the surface

- **Pan** — drag the background, or scroll. Not by dragging cards; cards do not move.
- **Zoom** — mouse wheel and trackpad pinch, 0.4 to 1.5.
- **Fit** — `fitView` runs on every selection change, so a new graph always arrives framed. The
  viewport is not preserved between selections: position carries no meaning here, so preserving it
  would mean arriving at a new graph looking at empty space.
- **No controls.** React Flow's `<Controls />` panel is removed. Zoom and pan are gestures the user
  already has, and a three-button panel floating over a 15-card graph is chrome for a problem that
  does not exist. The consequence — no way to manually reframe — is stated plainly under
  _Removing the controls creates one trap_.
- **No background grid.** React Flow's `<Background />` is removed. A dot grid is an alignment aid,
  and alignment is meaningless on a surface where the user cannot place anything: it would advertise
  an editor the Canvas is not. The pane instead takes a flat surface colour, one step separated from
  the Explorer's, so the split reads without a heavy divider.
- **No minimap.** At ≤ 15 cards it is pure clutter.

One honest consequence of removing the grid: with a plain background, panning has no visual reference
except the cards themselves, so a drag through empty space can briefly look like nothing is
happening. With `fitView` framing every graph and cards nearly always on screen, this is a small
cost — but it is the reason the grid exists in tools that have one, and it is being traded knowingly.

### 7. Selection, and the two-way relationship

Confirmed in review: the Canvas navigates. One selection, owned by the application, read and written
by both panes.

**An Explorer row has two hit targets, and they mean different things.** Revised in a later review
round, and it is the most consequential of the three interaction changes:

| Target                  | Does                                  | Touches the Canvas                                      |
| ----------------------- | ------------------------------------- | ------------------------------------------------------- |
| The **chevron**         | Expands or collapses that node        | **No** — not selection, not the root, not even a redraw |
| The **rest of the row** | Selects the node and opens its Canvas | Yes                                                     |

The reason is what the Explorer is _for_. It is a navigator, and browsing a 548-node hierarchy means
opening things to see what is inside them. When disclosure also re-rooted the workspace, the user
could not look around without losing the thing they were looking at — every glance cost them their
place. Expansion is Explorer-only state; selection is shared.

They are two separate `<button>`s rather than one button that inspects the click target, so the
behaviour is structural rather than a coordinate test, and each gets its own hover so the targets are
visibly distinct and not merely differently behaved. The chevron is deliberately out of the tab order:
the label is the row's one tab stop, and a second stop per row would double the tree's length for
keyboard users while real tree keyboard navigation does not exist yet.

Everything else about selection:

- Clicking a Canvas card selects that node. The Canvas re-roots per _The rooting rule_, and the
  Explorer **reveals** it: every ancestor is expanded and the row is scrolled into view with
  `block: 'nearest'`, so the tree moves as little as it can while still showing the row.
- Clicking a container card drills into it; clicking a leaf keeps the parent-rooted Canvas and moves
  only the ring.
- Clicking the card that is already selected does nothing.
- The two panes never disagree, because there is one selection and both read it.

`block: 'nearest'` is deliberate: `'center'` would jump the tree on every click, which makes the
Explorer feel like it is fighting you. The scroll is also deferred by one animation frame — not a
detail, and the reason is under _Found by running it_.

Because leaf selections root at the parent, clicking between siblings keeps the Canvas still and
moves only the ring — so the common case of "look through the tasks in this area" is a sequence of
clicks with no redraw at all. That behaviour is the reason this milestone can promise continuity
rather than merely animate.

### 8. What the Canvas shows when nothing is selected

At launch nothing is selected. Rather than an empty pane or a prompt, the Canvas roots at **the
project itself** — a card bearing the project's name, with the 13 domains as its children.

This is right because it is true: a project _is_ a node with children, and the Explorer already
treats it that way by putting its name in the header rather than in a row. It also means the
application opens showing the user's top level as a picture, which is the strongest available answer
to "does this feel like an application".

The project card is not an Explorer node — it has no `ExplorerNode.id` — so clicking it does nothing.

**The project's name in the header is the way back to it.** Added in a later review round, and it
closes a real hole: every other route into the Canvas roots it at a node, so before this the
project-level Canvas was reachable only by restarting the application. Clicking the name clears the
selection, which is all that is needed — `canvasRootFor(null, …)` already returns the project root, so
"go to the top" is an ordinary selection change rather than a special case.

Two things about how it is built:

- **It is a crumb, not a title with an `onClick`.** The markup is a `<nav>` around an ordered list
  with one entry, because the intended end state is `Music Brain › Album › Production` and that is
  the same list with more entries in it. Ancestors already come from `ancestorIdsOf`, which reveal
  uses. Nothing has to change shape to grow a breadcrumb, which is why the single crumb is built as
  one now rather than as a heading that would later be thrown away.
- **It reads as a title, behaves as a link.** No border, no fill, no padding that would make it look
  like a control parked in the header — an underline on hover, and `aria-current="page"` when the
  Canvas is already at the root. A separate "Show All" button was considered and rejected: it would
  be a second thing in the header competing with **Open Project**, to do what the name already
  implies.

### 9. Empty and degenerate states

| Situation                          | What the Canvas shows                                                        |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| No project (loading or failed)     | Nothing — the existing full-width `EmptyState` still owns this               |
| Project open, nothing selected     | The project card and its top-level nodes                                     |
| Selection has children             | That node as root, its children in the column, ring on the root              |
| Selection is a leaf with a parent  | The parent as root, the siblings in the column, ring on the selection        |
| Selection is a leaf with no parent | A single card — the only degenerate case left, and absent from the real file |
| Project has no recognisable nodes  | The Explorer's existing "no entries yet" message, in the Canvas              |

The two-pane layout only appears once there is a project. Splitting the window before there is
anything to put in either half would advertise two empty things instead of one.

### 10. Nothing on the Canvas suggests it can be edited

Cards have no drag cursor, no resize handles, no visible connection points, no hover controls and no
context menu. Connection handles exist in the DOM because React Flow needs anchor points for edge
paths, but they are non-interactive and invisible.

This is a product decision, not a rendering detail. A card that looks draggable and is not is worse
than a card that looks static — it teaches the user the application is broken. Every affordance the
Canvas shows should be one that works. Removing the grid and the controls serves the same principle
from the other direction: the surface should not look like an editor either.

## Animation philosophy

Added in review, as a UX principle rather than an implementation note. Selection changes are the only
thing that moves in this milestone, and how they move is most of what will decide whether the
application feels finished.

**The principle: immediate should not mean abrupt.** All the data is already in memory, so nothing
the user does can legitimately take time. That makes every millisecond on screen a deliberate choice,
and the choice is not "fast versus smooth" — it is "does the user's eye keep hold of the thing it was
looking at". Transitions here exist to preserve continuity, not to decorate a wait.

Five rules, each with the mechanism that implements it.

**1. Redraws never block interaction.** Selection state updates synchronously; there is no async
boundary, no suspense, no deferred render between a click and the new graph. Every transition is on
`transform` and `opacity` only — compositor properties that never trigger layout — and pointer events
stay live for the whole duration. A user who clicks twice in 100ms gets both clicks.

**2. No loading states, ever.** No spinners, no skeletons, no "rendering…". A skeleton is a promise
that something is coming; here it has already arrived. The absence is the feature.

**3. Spatial continuity is preserved by identity, not by animation.** This is the important one, and
it is structural rather than cosmetic. Cards are keyed by node identity, and React Flow keys its
nodes by `id` — so a card present in both the outgoing and incoming graph keeps its DOM element and
is never remounted. Two things follow directly from the rooting rule:

- Clicking between sibling leaves produces an identical card set. Nothing enters, nothing leaves,
  nothing moves. Only the ring changes, and it changes on one element.
- Clicking a container promotes the clicked card to root. That card survives the redraw and **moves**
  from its position in the column to the root position, so the user's eye is carried from where they
  clicked to where the new graph is anchored. There is always at least one element in common between
  consecutive graphs, which is exactly the condition under which a transition reads as motion rather
  than as a replacement.

The mechanism is a CSS transition on the node wrapper's `transform`. It costs one rule and it is
worth more than any entrance animation could be.

**4. Entrances are subtle; exits are instant.** New cards fade in from `opacity: 0` and
`scale(0.96)` over ~140ms. Departing cards are removed immediately, because animating them out
requires tracking presence after the data says they are gone — real complexity in service of a frame
the user is not looking at. The asymmetry is deliberate and is recorded here so it is not read as an
omission.

**5. One clock, 120–180ms, no bounce.** Every duration in the Canvas sits in that band: card
entrance ~140ms, card movement ~160ms, viewport `fitView` ~180ms (React Flow's `duration` option, so
the frame eases rather than jumps), ring change ~120ms. Nothing exceeds 200ms. Easing is a standard
ease-out — no springs, no overshoot, no bounce, because bounce implies physical mass and nothing here
is physical. The brief's "no physics" applies to the animation as much as to the layout.

**Two things deliberately not animated.** Edges redraw instantly rather than interpolating their
paths: an edge is a relationship, not an object, and watching a curve crawl to a new shape draws the
eye to the least meaningful thing on screen. And the Explorer's reveal scroll is instant, not
`behavior: 'smooth'` — `block: 'nearest'` already keeps the movement to a few rows, and a smooth
scroll running against the Canvas's own 180ms transition would put two different clocks on one
interaction.

**`prefers-reduced-motion: reduce` sets every duration to zero.** Not an enhancement and not a later
pass: the transitions above are continuity aids, and for a user who has asked for less motion the
instant result _is_ the continuity. This is a verification checklist item, not a comment.

## Architecture decisions

### The pipeline

```
project file (JSON)
      │
      ▼  adapter — the only module that knows the file's field names
ExplorerNode[]                                       ← milestone 003, unchanged
      │
      ├──▶ flattenTree ──▶ ExplorerRow[] ──▶ Explorer   ← milestone 003, unchanged
      │
      ▼  indexNodes                                   id → node, id → parent id
NodeIndex
      │
      ▼  canvasRootFor(selectedId, index)             WHICH canvas
CanvasRoot       { type: 'project' | 'node', nodeId }  ← the canvas's identity
      │
      ▼  buildCanvasGraph(root, index)                WHAT is on it
CanvasGraph      { root, rootCard, children[], links[], focusedId }
      │
      ▼  layoutCanvas(graph)                          WHERE it goes
CanvasLayout     { placements[], links[] }
      │
      ▼  toCanvasViewModel(layout)                    HOW IT LOOKS
CanvasViewModel  { cards[], connections[] }           ← fully resolved presentation
      │
      ▼  toReactFlow(viewModel)                       how this LIBRARY wants it
{ nodes, edges }  ──▶  <CanvasView>  ──▶  <CanvasCard>
```

Each stage answers exactly one question, and the questions are in dependency order: which canvas,
what is on it, where it goes, how it looks, how this particular library wants to be handed it. A
stage may only read the stage above it, which is what makes each boundary a real seam rather than a
naming convention.

The property that matters is the direction of ignorance. `CanvasRoot` does not know what a card is;
`CanvasGraph` does not know React Flow exists; `layoutCanvas` does not know React exists;
`CanvasViewModel` does not know React Flow exists either. Only `toReactFlow` and the two components
below it do.

### Canvas Identity

**A canvas is always exactly one explicit root, never an arbitrary set of nodes.** Added in review,
and it is the change with the longest reach in this revision.

The distinction is easy to under-rate because today there is only ever one canvas on screen, derived
from one selection. But "the canvas of _this root_" and "whatever nodes are currently displayed" are
different concepts the moment there is more than one canvas, and everything the application is
heading towards involves more than one: tabs, Open Canvas, recent canvases, a saved workspace, a
back/forward history, a deep link. Every one of those needs to name a canvas, and a set of nodes
cannot be named.

```ts
// src/shared/model/canvas.ts

/**
 * What a canvas is anchored on. Serializable by construction: a tab, a recents
 * entry or a persisted workspace stores this and nothing else.
 */
export type CanvasRoot = { type: 'project' } | { type: 'node'; nodeId: string }

/** A stable string form, for tab keys, map keys and React remounting. */
export function canvasKey(root: CanvasRoot): string

/** Which canvas a selection opens — the rooting rule, and the only place it lives. */
export function canvasRootFor(selectedId: string | null, index: NodeIndex): CanvasRoot
```

Three properties, and each of them is what a later feature will need:

**Identity is separate from selection.** `canvasRootFor` maps a selection to a canvas, and the
mapping is many-to-one: every leaf under _Mixing_ opens the same canvas, because the rooting rule
roots them all at _Mixing_. That is exactly the relationship a tab needs — clicking three sibling
tasks should not open three tabs — and it falls out of the model rather than needing a rule.

**Identity is separate from focus.** `CanvasRoot` says which canvas; `CanvasGraph.focusedId` says
which card wears the ring. Focus is transient view state and belongs to the moment; the root is the
durable thing. A tab persists its root; it does not persist which card was highlighted when you last
left it.

**Identity is serializable and storage-shaped.** `CanvasRoot` is a plain discriminated union of
strings, so a recents list, a session file or a URL can carry one with no encoding step. It holds an
`ExplorerNode.id`, which keeps the "unique, stable, derivable, opaque" contract from milestone 003 —
and inherits its known limitation, that a positional id does not survive a node being moved. That is
the same prerequisite editing already has, and it is named again under _What "no editing" costs_.

The immediate practical effect on this milestone is small and worth stating honestly: `App` holds a
`selectedId`, derives a `CanvasRoot` from it, and passes that down. One extra value in the pipeline.
The reason to introduce it now rather than when tabs arrive is that retrofitting identity onto a
component that has only ever known "the current nodes" means touching every layer at once, whereas
adding it here costs a type and a function.

### The Canvas model is two layers removed from JSON

The brief requires "an adapter layer that converts the project model into a Canvas model", and that
the Canvas "must not know anything about JSON". Milestone 003 already bought half of this:
`ExplorerNode` is the project model and it contains no file vocabulary.

So the Canvas adapter converts **model → model**, not file → model:

```ts
// src/shared/model/canvas.ts — isomorphic: no React, no DOM, no Node, no React Flow

/** One card. Identity is its own; `nodeId` links it back to the knowledge base. */
export interface CanvasCard {
  id: string
  /** The `ExplorerNode.id` this card stands for, or null for the project card. */
  nodeId: string | null
  label: string | undefined
  kind: NodeKind
  isComplete: boolean | undefined
  role: 'root' | 'child'
}

/** One connection. Explicit records, following Obsidian's canvas format. */
export interface CanvasLink {
  id: string
  fromId: string
  toId: string
}

export interface CanvasGraph {
  /** Which canvas this is — see `Canvas Identity`. The graph renders this and nothing else. */
  root: CanvasRoot
  /** The card standing for the root. */
  rootCard: CanvasCard
  /** Its immediate children, in model order — never sorted. See determinism, below. */
  children: CanvasCard[]
  links: CanvasLink[]
  /** The card the selection ring belongs to — the root card, or one of the children. */
  focusedId: string
}
```

`label` stays `string | undefined`, exactly as on `ExplorerNode`, rather than being resolved to
"Untitled task" here. The placeholder needs the kind registry's display name, the registry lives in
the renderer for reasons milestone 003 established, and the Explorer and the Canvas must agree on
what an untitled node is called. So the fallback is applied once, in the ViewModel, and the domain
model stays honest about the fact that the file said nothing.

`childCount` is gone from the model as well as from the card, because nothing renders it. It is one
field on `ExplorerNode` away if the Inspector wants it later.

`links` is a separate array rather than being implied by `children`, which looks redundant at a
fan-out of three. It is not: it is the field that stops the Canvas model from being a tree. The real
file carries `related`, `dependsOn`, `resources` and `outputs` on every node — cross-references that
are not parent/child — and rendering those is the obvious second thing the Canvas does. A model that
derives edges from containment cannot represent them; one with an edge list can, by appending.

### The ViewModel

Added in review. The pipeline previously went `CanvasLayout → React Flow`, which meant `toReactFlow`
was doing three unrelated jobs at once: resolving presentation (registry lookup, title placeholder,
which card gets the ring), and constructing library types. Splitting them puts a fully-resolved
presentation model between the domain and the library:

```ts
// src/renderer/src/components/canvas/canvasViewModel.ts
// Pure. No React import, no React Flow import.

export interface CanvasCardView {
  id: string
  /** null when this card is not a knowledge-base node — the project card. */
  nodeId: string | null
  x: number
  y: number
  width: number
  height: number
  /** Already resolved — the placeholder has been applied, never `undefined`. */
  title: string
  /** The registry entry, looked up once. No consumer resolves a kind again. */
  presentation: NodeKindPresentation
  isComplete: boolean | undefined
  isFocused: boolean
  /** False for the project card, which stands for nothing selectable. */
  isNavigable: boolean
}

export interface CanvasConnectionView {
  id: string
  fromId: string
  toId: string
}

export interface CanvasViewModel {
  cards: CanvasCardView[]
  connections: CanvasConnectionView[]
}
```

Three things this buys, in order of how much they matter:

**`toReactFlow` becomes mechanical.** It maps `CanvasCardView` to `Node` and `CanvasConnectionView`
to `Edge`, carrying the view object through as `data`. No lookups, no conditionals, no decisions —
which is exactly the property that makes "replace the rendering library" a small job. A replacement
consumes `CanvasViewModel` and the same two components are the only other things that change.

**`CanvasCard.tsx` becomes a pure function of one object.** It reads `card.title`,
`card.presentation.Icon`, `card.isFocused` and renders. It performs no registry lookup, applies no
fallback, and contains no conditional that depends on where the card came from. A component with
nothing to decide is a component that cannot drift from the Explorer's rendering of the same node.

**The registry lookup happens exactly once, in one place.** Previously the card component would have
called `presentationFor` per render; now the ViewModel builder does it per graph. Same guarantee that
no `switch` on kind exists outside `nodeKinds.ts`, and one fewer place that could stop honouring it.

The ViewModel holds `NodeKindPresentation`, which contains React component references. That is why it
lives in the renderer rather than `shared/` — the same boundary `nodeKinds.ts` and `flattenTree.ts`
already sit on, and the same one `tsconfig.node.json` enforces by having no DOM lib. It holds
component references, never JSX, so it stays a data structure and remains testable without a
renderer.

The honest cost: four transformations between an `ExplorerNode` and a pixel, for a graph of fifteen
cards. That is more indirection than this milestone alone needs, and it is being taken on the
explicit basis that the rendering library is the component of this design most likely to be replaced
and the one whose replacement would otherwise be most expensive.

### A node index, and why it is worth a module

`buildCanvasGraph` needs to find a node by id and — under the rooting rule — its parent; reveal needs
its ancestors. All three are walks over 548 nodes, fast enough to do naively, but they would be
written three times and `parentIdOf` is now load-bearing for the primary rooting rule rather than for
an option.

```ts
// src/shared/model/nodeIndex.ts
export interface NodeIndex {
  byId: ReadonlyMap<string, ExplorerNode>
  parentIdOf: ReadonlyMap<string, string | null>
  roots: readonly ExplorerNode[]
}
export function indexNodes(roots: readonly ExplorerNode[]): NodeIndex
export function ancestorIdsOf(index: NodeIndex, nodeId: string): string[]
```

Built once per project, memoized on `explorer.roots` in `App`. O(n) to build, O(1) to query. It goes
in `shared/` for the same reason the adapter did: it is pure, it is isomorphic, and the main process
will want it when search indexing arrives.

This is also where the "IDs are opaque" contract earns its keep. `parentIdOf` is derived by walking
the tree, not by truncating a JSON Pointer — so it keeps working when identity stops being positional.

**What a refit is keyed on.** Framing compares the canvas root, the pane size and a signature of the
rendered geometry — every card's id and graph-space position. Keying it on root and pane size alone
was wrong in a way that would not have surfaced until later: a root is not a promise about what is
underneath it, so the same root holding a different graph reported itself as already framed and
skipped the `fitView` its new bounds needed. That is reachable today by reopening a project whose
file changed on disk, and becomes routine once adding or removing a node exists.

The signature carries positions rather than content, which is what makes the sibling case fall out
rather than need excusing: moving the ring between sibling leaves produces identical ids at identical
positions, so nothing reframes and the viewport is left exactly alone. A renamed card likewise moves
no bounds and triggers nothing. Because the layout is deterministic, the signature is stable without
consulting the DOM.

### Layout is pure, and deterministic

```ts
// src/renderer/src/components/canvas/canvasLayout.ts — pure, no React import
export interface CardPlacement {
  card: CanvasCard
  x: number
  y: number
}
export interface CanvasLayout {
  placements: CardPlacement[]
  links: readonly CanvasLink[]
  focusedId: string
}
export function layoutCanvas(graph: CanvasGraph): CanvasLayout
```

Renderer rather than `shared/`, for the same reason `nodeKinds.ts` is: card width and height are
presentation. `flattenTree.ts` set the precedent — pure, testable, React-free, but rendering-adjacent
and therefore not in `shared/`.

The whole function is: stack the children at `pitch` intervals, place the root at the column's
vertical centre. Roughly fifteen lines. It is a separate module anyway, because it is the seam a
later layout — column wrapping, depth control, or honouring saved positions once cards can be moved —
replaces wholesale without touching a component or the ViewModel's shape.

**The layout algorithm is deterministic. The same Canvas Root always produces the same layout, to
the pixel, always.** Stated as a requirement in review, and it is a UX property rather than an
implementation nicety: a workspace whose contents shift by a few pixels between visits does not feel
like a place, and the animation philosophy's promise of spatial continuity is worthless if the
destination moves.

Six rules make it true, and each is a thing `layoutCanvas` must not do:

- **No randomness, no time, no counters.** No `Math.random`, no `Date.now`, no module-level mutable
  state. The function's output is a function of its argument and of nothing else.
- **No measurement.** Card dimensions are constants, not read from the DOM. This is the real reason
  card height is fixed and titles do not wrap — a measured layout is a layout that depends on font
  loading, and font loading is a race.
- **No viewport dependency.** Positions are in graph space and never consult the window size.
  Resizing the window changes what `fitView` frames, never where a card is. This is a stronger
  guarantee than it looks: it means the same canvas at 1440×900 and at 900×600 is the same canvas,
  zoomed.
- **No sorting.** Children keep the order the model gave them, which is the order in the file, which
  is the order the Explorer shows. A sort by title, status or completion would reorder cards when
  data changes, and would put the Canvas and the Explorer in different orders for the same node.
- **No dependence on the previous layout.** Nothing is relaxed, nudged, or carried over from the
  last render. Navigating away and back reproduces the identical result, rather than an equivalent
  one.
- **No dependence on focus.** The ring is a ViewModel concern. Two selections that resolve to the
  same `CanvasRoot` — every sibling leaf under one parent — produce byte-identical layouts, which is
  what makes clicking between siblings move nothing at all.

This is checkable rather than aspirational: run `layoutCanvas` twice on the same graph and deep-equal
the results, and navigate away and back and compare positions. Both are verification checklist items.

The one thing determinism deliberately does not promise is stability across a _change to the data_.
Inserting a child shifts its siblings down, because their positions come from their index. That is
correct — the layout reflects the model, and the model changed — and it is a case that only arises
once editing exists.

### Rendering is bounded by the Canvas Root

**Canvas rendering depends only on the current Canvas Root and its descendants — never on the whole
loaded project.** Stated as a principle in review, and it is what makes the Canvas indifferent to the
size of the knowledge base.

Concretely, per selection change:

| Step                | Cost                | Depends on                |
| ------------------- | ------------------- | ------------------------- |
| `canvasRootFor`     | O(1)                | two map lookups           |
| `buildCanvasGraph`  | O(children of root) | the root's own child list |
| `layoutCanvas`      | O(cards)            | the graph                 |
| `toCanvasViewModel` | O(cards)            | the layout                |
| `toReactFlow`       | O(cards)            | the ViewModel             |
| React Flow render   | O(cards)            | the nodes handed to it    |

Everything after the root is resolved is proportional to **fan-out**, which is at most 15. Selecting
something under _Quad Cortex_ does no work proportional to _Ableton_, and React Flow is never handed
a node that is not on the current canvas. At 10,000 nodes every row of that table is unchanged.

The honest boundary: **`indexNodes` is O(total nodes)**, and it is the only step that is. It runs
once per project open, memoized on `explorer.roots`, and it is what buys the O(1) lookups above — so
it is not an exception to the principle, it is the price of it. Two things follow. First, the
verification checklist asserts it runs once per open and not once per selection, because a
memoization mistake there is exactly how this principle would silently stop holding. Second, if a
project ever grows large enough for that single pass to be felt at startup, it moves to the main
process — `shared/model/` is isomorphic precisely so it can.

What this rules out, in case a later change is tempted: no precomputing every canvas up front, no
map of graphs keyed by node id, no layout of the full tree that the Canvas then windows into. Each of
those reintroduces a whole-project cost to serve a 15-card view.

### Selection lifts out of the tree

`ExplorerTree` currently owns `selectedId`. Two panes need it, so it moves to `App`:

```tsx
<ExplorerTree selectedId={selectedId} onSelect={setSelectedId} … />
<CanvasView  selectedId={selectedId} onSelect={setSelectedId} … />
```

`ExplorerTree` keeps owning **expansion**, which is genuinely tree-local — except that reveal must be
able to expand ancestors. Rather than lifting expansion too, `ExplorerTree` takes the selection as a
prop and runs one effect: when `selectedId` changes to something not currently visible, expand its
ancestors and scroll it into view.

This keeps the smaller thing in the smaller place. Expansion is a `Set` that only the tree renders
from; selection is a single string two views render from. Lifting only selection is the minimum
change that makes both panes agree, and it is precisely the state the inspector milestone will read.

The reveal effect finds its row by exact match rather than by building a selector:

```ts
const row = Array.from(container.querySelectorAll('[data-node-id]')).find(
  (el) => el instanceof HTMLElement && el.dataset.nodeId === selectedId
)
// `block: 'nearest'` by hand: only when the row is outside the visible band,
// and moving this one container rather than every scrollable ancestor.
if (row.offsetTop < scroller.scrollTop) scroller.scrollTop = row.offsetTop
```

`data-node-id` already exists on every row from milestone 002. Matching in JavaScript rather than
interpolating the id into a CSS selector keeps the "IDs are opaque" contract intact — the code never
has to know whether an id could contain a quote — and it costs one pass over the visible rows, which
is at most a few dozen.

### React Flow is a dependency, and this is the cheapest moment to take it

This is the application's **first runtime dependency beyond React**, so it deserves the argument in
full.

|                     |                                                        |
| ------------------- | ------------------------------------------------------ |
| Package             | `@xyflow/react` 12.11.3, MIT                           |
| Direct dependencies | `@xyflow/system`, `zustand`, `classcat`                |
| Transitively        | `d3-zoom`, `d3-drag`, `d3-selection`, `d3-interpolate` |
| Unpacked            | ~1.15MB + ~0.66MB for `@xyflow/system`                 |

**The alternative was seriously considered.** At 15 cards with a deterministic layout, the rendering
itself is trivial — absolute-positioned divs and a handful of SVG bezier paths, maybe 80 lines. What
is _not_ trivial is the viewport: wheel-to-zoom about the cursor, pointer-captured panning, trackpad
pinch, transform composition, and `fitView` maths that is correct at every aspect ratio. That is the
part `d3-zoom` exists for, and hand-rolling it is a week of pointer-event bugs that produce nothing
the user can see.

Removing the controls and the background in review reduces how much of React Flow is used, and it is
worth being explicit that it does **not** weaken the case. Both were one-line components; what the
library is being taken for is the viewport, node keying and edge geometry, and all three remain.

**The decisive argument is timing, not this milestone's cost.** Editing, drag & drop, connections and
persistence are all named as near-term goals, and all four are React Flow's core competence. The
choice is not "library or no library" — it is "introduce it now, against a read-only surface with no
mutations to debug, or later, simultaneously with the first feature that mutates the graph." The
first is obviously safer.

**What is being accepted honestly:**

- `zustand` enters the dependency tree, and the README currently says state management is
  deliberately absent. That claim needs qualifying rather than deleting: zustand is React Flow's
  internal store for viewport and node state, not the application's. Application state is still
  `useState` in `App`.
- The bundle grows by roughly 2MB unpacked. In an Electron application that ships a browser this is
  not a meaningful cost, and it is stated rather than waved away.
- React Flow's base stylesheet must be imported, and it is global CSS in a codebase that is otherwise
  entirely Tailwind utilities. It is imported once, in `main.tsx`, **after** `styles.css`, so its
  `.react-flow__*` rules are not overridden by Tailwind's preflight. Import order is load-bearing and
  easy to break; the verification checklist covers it.

### React Flow is configured read-only, by name

Every interactive default is switched off explicitly rather than left unused, so that enabling one
later is a deliberate act:

```tsx
<ReactFlow
  nodes={nodes} edges={edges}
  nodeTypes={CANVAS_NODE_TYPES}     // one entry: our card
  nodesDraggable={false}            // the brief: no drag & drop
  nodesConnectable={false}          // the brief: no editing
  elementsSelectable={false}        // selection is ours, not React Flow's
  nodesFocusable={false}            // the card is a real <button>; no double focus target
  edgesFocusable={false}
  zoomOnDoubleClick={false}         // double-click will mean "open" later
  fitView
  fitViewOptions={{ padding: 0.12, maxZoom: 1, minZoom: 0.8, duration: 180 }}
  minZoom={0.4} maxZoom={1.5}
  colorMode="system"                // React Flow's own dark-mode support
  proOptions={{ hideAttribution: false }}
  onNodeClick={…}
/>
// No <Controls />, no <Background />, no <MiniMap /> — see UX decision 6.
```

Two of these are worth calling out. `elementsSelectable={false}` is deliberate even though the Canvas
obviously has a selection: _our_ selection is application state shared with the Explorer, and React
Flow's is a per-node flag inside its own store. Letting both exist would be two sources of truth that
disagree the first time selection changes from the Explorer side.

`nodesFocusable={false}` is because the card's content is a real `<button>`. React Flow's Tab-cycling
would put focus on the wrapping node div as well, giving every card two tab stops and only one of
them useful.

The attribution stays visible. Hiding it requires a paid licence, and the milestone is not going to
quietly violate one.

### The Canvas adds no vocabulary

The Canvas renders through `presentationFor(card.kind)` — the same registry function, the same icons,
the same display names as the Explorer row — called once per card in the ViewModel builder. There is
no canvas-specific kind table, no `switch` on kind, and no second copy of the vocabulary.

This is the load-bearing test of milestone 003's registry decision, and it is worth stating what
would count as failure: if adding the Canvas required a single new per-kind conditional outside
`nodeKinds.ts`, the registry was factored wrong. It requires none.

One honest observation. The Canvas uses four of the registry's five fields and **not**
`labelClassName`, because that field encodes row typography — container-versus-content weighting that
exists to create hierarchy in a dense list. That is the first evidence the registry conflates _what a
kind is_ (name, icon, whether it has completion) with _how one surface draws it_. It is not worth
splitting for one consumer; it will be at two. Recorded rather than fixed.

### `ExplorerNode` does not change

No field is added, removed or retyped, and neither is `adapter.ts`. The Canvas is a second view over
milestone 003's model, which is the strongest available evidence that the model was built as a model
and not as the tree's props. If the Canvas had required a model change, that claim was false.

## Tradeoffs

| Decision                                 | Cost                                                                                              | Why it is worth it                                                                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Adopt React Flow                         | First runtime dependency beyond React; ~2MB; zustand enters the tree                              | Viewport interaction is the expensive part; every deferred capability is its core competence; read-only is the safest moment to introduce it |
| Root at the parent for leaf selections   | The Canvas root is not always the Explorer selection                                              | Turns 72% of clicks from a lonely card into a node among its siblings, and is what makes redraws continuous                                  |
| Deterministic layout, no physics         | Cannot express non-hierarchical clustering                                                        | At ≤15 cards a simulation is a slower, less predictable route to a worse answer                                                              |
| 280 × 72 cards, single-line titles       | The long tail of titles still truncates; tall columns need more zoom-out than smaller cards would | The graph never exceeds 15 cards, so the space exists; p90 titles now fit                                                                    |
| Floor zoom at 0.8, pan instead of shrink | One node in 548, and the launch view, need a short pan                                            | Below 0.8 a 14px title stops being legible; a tall column is a list, and lists are made to be scrolled                                       |
| Single column, no wrapping               | One node in 548 cannot be seen whole                                                              | Wrapping trades a legibility problem for an edge-crossing problem, for one node                                                              |
| No zoom controls                         | No way to reframe after zooming away                                                              | Gestures already exist; a floating panel over 15 cards is chrome. The trap is documented, and the remedy is one line if wanted               |
| No background grid                       | Panning empty space has no visual reference                                                       | A grid is an alignment aid for placement the user cannot do; it would advertise an editor                                                    |
| No child-count badge                     | Cannot predict whether a click drills in or moves the ring                                        | The card is calmer, and neither outcome is destructive; the Explorer still shows counts                                                      |
| `fitView` on every selection change      | Viewport is not preserved between graphs                                                          | Position carries no meaning; preserving it means arriving at empty space                                                                     |
| Fixed 25/75 split, no splitter           | Cannot rebalance the panes                                                                        | A splitter is pointer capture plus persistence and makes nothing more usable today                                                           |
| Lift selection, leave expansion          | State lives in two places                                                                         | Selection is what two views share; expansion is what one view renders from                                                                   |
| A ViewModel layer                        | Five transformations between a node and a pixel                                                   | `toReactFlow` becomes mechanical and the card component has nothing to decide, which is what makes the library replaceable                   |
| An explicit `CanvasRoot`                 | One more value in the pipeline, for an application that shows one canvas                          | A canvas can be named, so tabs, recents, persistence and history are additions rather than a retrofit through every layer                    |
| Deterministic layout as a hard rule      | Rules out measured text, sorted children and viewport-aware placement                             | A workspace that shifts between visits is not a place; it is also the precondition for semantic zoom and for saved positions                 |
| Separate `links[]` in the model          | Redundant while edges are only parent→child                                                       | It is what lets `related` / `dependsOn` be rendered by appending rather than by redesigning                                                  |
| Layout and ViewModel in the renderer     | The Canvas layer spans two folders                                                                | Card geometry and registry entries are presentation; `flattenTree.ts` set the precedent                                                      |
| Completion shown but always unchecked    | Looks inert on the real file                                                                      | It is correct; the file genuinely contains no completed work. Fixing it means a model change this milestone should not make                  |

## Files changed

**Shared** (isomorphic — no Node, no DOM, no React)

| File                            | Change                                                                                                               |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `src/shared/model/canvas.ts`    | New — `CanvasRoot`, `canvasKey`, `canvasRootFor`, then `CanvasCard`, `CanvasLink`, `CanvasGraph`, `buildCanvasGraph` |
| `src/shared/model/nodeIndex.ts` | New — `NodeIndex`, `indexNodes`, `ancestorIdsOf`                                                                     |
| `src/shared/model/node.ts`      | **Unchanged** — stated explicitly; the Canvas needs no model change                                                  |
| `src/shared/model/adapter.ts`   | **Unchanged** — no new file vocabulary is read                                                                       |

**Renderer**

| File                                                      | Change                                                                                                |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `src/renderer/src/components/canvas/CanvasView.tsx`       | New — the React Flow host; owns viewport config and node click                                        |
| `src/renderer/src/components/canvas/CanvasCard.tsx`       | New — the custom node type; renders one `CanvasCardView` and decides nothing                          |
| `src/renderer/src/components/canvas/canvasLayout.ts`      | New — pure geometry; no React import                                                                  |
| `src/renderer/src/components/canvas/canvasViewModel.ts`   | New — resolves presentation; the layer React Flow consumes                                            |
| `src/renderer/src/components/canvas/toReactFlow.ts`       | New — the only module that constructs React Flow node/edge objects; mechanical                        |
| `src/renderer/src/components/canvas/CanvasLocation.tsx`   | New — the project crumb; today's root navigation, shaped as the breadcrumb it will become             |
| `src/renderer/src/components/canvas/canvasInteraction.ts` | New — the context a card reaches selection through, so the view model stays pure data                 |
| `src/renderer/src/components/canvas/canvas.css`           | New — the transitions from _Animation philosophy_, including the reduced-motion block                 |
| `src/renderer/src/components/explorer/ExplorerTree.tsx`   | Selection becomes a controlled prop; adds the reveal effect                                           |
| `src/renderer/src/App.tsx`                                | Owns selection and the node index; renders the two-pane layout                                        |
| `src/renderer/src/main.tsx`                               | Imports React Flow's base stylesheet after `styles.css`                                               |
| `src/renderer/src/components/explorer/explorer.css`       | New — the explorer's scrollbar, scoped by class; replaces Chromium's 15px Windows scrollbar           |
| `src/renderer/src/components/explorer/ExplorerRow.tsx`    | Split into two hit targets — a chevron button that only expands, and a label button that only selects |
| `src/renderer/src/components/explorer/nodeKinds.ts`       | **Unchanged** — the Canvas adds no vocabulary                                                         |
| `src/renderer/src/components/explorer/icons.tsx`          | Possibly one addition if the card needs a glyph the registry lacks                                    |

**Main**

| File                | Change                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/main/index.ts` | `backgroundThrottling: false` — Chromium must keep running the rendering lifecycle while the window is occluded, or the canvas never measures its cards |

**Other**

| File           | Change                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| `package.json` | Adds `@xyflow/react` — the first runtime dependency beyond React                                                    |
| `README.md`    | Status, milestone table row, the dependency and what it is for, and a correction to the "no state management" claim |

No change to: the IPC surface, `src/main/`, `src/preload/`, `src/shared/types/`,
`src/shared/constants.ts`, the JSON schema, or either fixture.

## Verification checklist

Nothing below is checked: this document is the deliverable and no code has been written.

Gates

- [x] `pnpm typecheck` — both Node and web projects
- [x] `pnpm lint`
- [x] `pnpm format:check` for every file this milestone touches
- [x] `pnpm build`
- [x] `pnpm start` — the packaged bundle renders the Canvas, confirming React Flow's CSS is bundled
      rather than only resolving in dev

Against the real file — `data/music-brain.json`, 548 nodes

- [x] Launch shows two panes, Explorer left, Canvas right, roughly 25/75
- [x] With nothing selected, the Canvas roots at the project card with the **13** domains as children
- [x] The overview is fully framed at launch: all 14 cards on screen, none clipped, 43px clear above
      and below, at a bounds-derived zoom of 0.67 rather than the node-canvas floor
- [x] The same framing after returning home via the project crumb, and after resizing the window
- [x] At the 900×600 minimum the overview's own 0.55 floor binds and it becomes pannable rather than
      illegible
- [x] Selecting _Ableton_ roots the Canvas at _Ableton_ with its **7** children, ring on the root
- [x] Card icons and kind names are identical to the Explorer's for the same node, on all four kinds
      present in the file
- [x] Cards measure 280 × 72 and titles at the 24-character p90 do not truncate
- [x] _Main Template_ (14 children) renders at the 0.8 floor with ~10 cards visible and the rest
      reachable by panning — not shrunk to fit
- [x] Completion glyphs render on tasks and none are checked, matching the file's 536 `todo` /
      3 `active` / 0 `done`
- [x] No card anywhere displays a child count

The rooting rule

- [x] Selecting a leaf roots the Canvas at its **parent** and rings the leaf among its siblings
- [x] Selecting a container roots at that container and rings the root card
- [x] Clicking from one sibling leaf to another leaves the card set and every position unchanged —
      only the ring moves
- [x] Clicking a child that has children promotes it to root, and that card is not remounted
- [x] A childless top-level node (constructed in a fixture; none exist in the real file) shows a
      single card without throwing

Hit testing and real pointer input

Driven with `Input.dispatchMouseEvent`, so every one of these goes through the renderer's own hit
testing rather than dispatching to an element reference.

- [x] Empty canvas: `.react-flow__pane` wins the hit test and the cursor is `grab`
- [x] A navigable card wins the hit test, with `cursor: pointer` and pointer events enabled
- [x] All four corners and all four edge midpoints of the card are inside the hit target
- [x] The project card and the already-focused card show `cursor: default`, not `pointer`
- [x] A real mouse click on a container card drills in and the Explorer follows
- [x] A real mouse click on a leaf keeps the parent-rooted canvas and moves only the ring
- [x] A real mouse click on the already-focused card changes nothing
- [x] A drag beginning on a card does **not** pan the canvas
- [x] A drag beginning on the non-navigable project card does not pan either
- [x] A drag on empty canvas still pans
- [x] A real click on the project crumb returns to the project canvas

Explorer expansion is separate from Canvas navigation

- [x] Expanding four domains with only their chevrons grows the tree and leaves the Canvas
      **byte-identical** — same cards, same transforms, same viewport
- [x] Chevron-only expansion selects nothing, and the project crumb stays current
- [x] Collapsing them again likewise moves nothing on the Canvas
- [x] Repeated expand/collapse never causes Canvas motion, refitting or a selection change
- [x] Clicking a row's label selects it and re-roots the Canvas
- [x] Selecting a node does **not** expand it — disclosure is the chevron's job alone
- [x] The chevron and the label are separate buttons with separate hover states
- [x] The explorer's scrollbar is 8px, subtle, and appears only when the tree actually overflows —
      never at startup's 13 rows, and it disappears again when they are collapsed
- [x] `scrollbar-gutter: stable` keeps the tree's content width constant at 348px whether the
      scrollbar is shown or not, so expanding a node no longer narrows the tree by 15px
- [x] The tree is inset from the pane edge without changing the indentation step: measured chevron
      offsets of 8 / 30 / 52 / 74px across depths 1–4, a constant 22px per level with no
      double-indentation of children

Returning to the project Canvas

- [x] After navigating several levels deep, clicking the project name returns the Canvas to the
      project root with all **13** domains
- [x] It clears the node selection and removes the ring
- [x] It marks the crumb as current (`aria-current="page"`)
- [x] Explorer expansion is left exactly as the user had it

Navigation

- [x] Clicking a Canvas card moves the Explorer highlight to the same node
- [x] Reveal expands collapsed ancestors — drill three levels from a fully collapsed tree and every
      ancestor is open
- [x] Reveal scrolls the row into view without recentering the whole tree
- [x] Clicking the already-selected card does nothing
- [x] Clicking the project card does nothing
- [x] Explorer → Canvas and Canvas → Explorer never disagree about which node is selected

Animation

- [x] A card that survives a redraw keeps its DOM element — verified by watching the node in devtools
      across a drill-down, not by eye
- [x] The promoted card visibly travels from its column position to the root position
- [x] Entering cards fade and scale in; departing cards disappear immediately
- [x] `fitView` eases over ~180ms rather than jumping
- [x] Framing is keyed on the canvas root, the pane size **and** the rendered geometry: a child
      added, removed or reordered reframes, while focusing a different sibling or renaming a
      card does not
- [x] No transition exceeds 200ms, and none overshoots
- [x] Clicking twice within 100ms registers both clicks; no transition swallows input
- [x] `prefers-reduced-motion: reduce` removes all motion — verified by toggling the OS setting, not
      by reading the CSS
- [x] No spinner, skeleton or loading state appears at any point after the project is open

Surface minimalism — the review's explicit removals

- [x] No zoom controls are rendered anywhere on the Canvas
- [x] No dot grid or pattern is rendered; the pane is a flat surface distinguishable from the Explorer
- [x] No minimap
- [ ] Wheel and trackpad pinch still zoom; dragging the background still pans

Read-only guarantees — the brief's explicit exclusions

- [ ] Dragging a card does not move it, and dragging one pans the viewport or does nothing — never a
      partial drag
- [x] No connection handle is visible or grabbable
- [x] No card, edge or background exposes a context menu, hover control or edit affordance
- [x] Nothing anywhere writes to disk; `project:open` and `project:loadDefault` remain the only IPC
- [x] Card positions are recomputed on every render and stored nowhere

Layout and appearance

- [x] Dark mode: cards, edges and the pane background are legible, and React Flow's
      `colorMode="system"` actually follows the OS setting
- [x] At the 900×600 minimum window both panes remain usable and the Explorer does not collapse
- [ ] A title longer than the card truncates with an ellipsis and shows in full on hover
- [ ] An untitled node's card reads "Untitled task" — the same placeholder the Explorer row uses

Robustness — the other two fixtures

- [ ] `examples/music-brain-project.json` — every registered kind renders correctly as a card
- [ ] `examples/sample-project.json` — every node takes the unknown-kind fallback; cards render with
      the neutral dot and stay navigable, nothing is dropped
- [ ] The deliberately unregistered `field-recording` kind produces a card, not a crash and not a gap

Discipline

- [x] `src/renderer/src/components/canvas/` contains no reference to `filePath`, `fileName`,
      `ProjectDocument`, `nodeType`, `children`, `metadata` or JSON
- [x] `@xyflow/react` is imported only by `CanvasView.tsx`, `CanvasCard.tsx` and `toReactFlow.ts`
- [x] `canvas.ts` and `nodeIndex.ts` import nothing from React, the DOM, Node or React Flow
- [x] `canvasLayout.ts` and `canvasViewModel.ts` have no React import and no React Flow import
- [x] `toReactFlow.ts` contains no conditional and no registry lookup — it only maps fields
- [x] `CanvasCard.tsx` calls `presentationFor` zero times and applies no title fallback
- [x] No `switch` on kind and no comparison of a kind to a literal outside `nodeKinds.ts`
- [x] Nothing outside `src/shared/model/` parses or takes apart an `ExplorerNode.id`
- [x] `src/shared/model/node.ts` and `adapter.ts` are byte-identical to `main`

Determinism — the layout must not move by a pixel

- [x] `layoutCanvas` called twice on the same graph deep-equals itself
- [x] Navigating away from a canvas and back reproduces byte-identical positions, not equivalent ones
- [x] Two different sibling leaves under the same parent produce identical layouts — only `focusedId`
      differs
- [x] Resizing the window from 1440×900 to 900×600 changes what is framed and no card's graph-space
      position
- [x] `canvasLayout.ts` contains no `Math.random`, no `Date`, no module-level mutable state, no DOM
      measurement and no sort
- [x] Children appear in the same order as the Explorer shows them

Canvas Identity

- [x] Every canvas is derived from exactly one `CanvasRoot`; no code path builds a graph from a bare
      list of nodes
- [x] Every leaf under one parent resolves to the same `CanvasRoot` — verified across all of one
      area's children
- [x] `CanvasRoot` survives `JSON.stringify` / `JSON.parse` unchanged, and `canvasKey` is stable for
      equal roots
- [x] Nothing outside `canvasRootFor` decides what a canvas is rooted at

Performance — bounded by the root

- [x] The canvas measures and draws correctly when the window is not focused — 20 consecutive
      canvas changes with the window behind another, against 10/12 failures with Electron's
      default `backgroundThrottling`
- [x] Selection changes redraw with no perceptible delay and no loading state
- [ ] Rapidly clicking down a chain of Explorer rows does not queue or stutter
- [ ] `indexNodes` runs once per project open, not per selection change — verified by instrumenting it
      and clicking twenty rows
- [x] `buildCanvasGraph`, `layoutCanvas`, `toCanvasViewModel` and `toReactFlow` each touch only the
      root and its children — instrumented with a counter, selecting a node under _Quad Cortex_ must
      not read a single node under _Ableton_
- [x] React Flow is never handed a node that is not on the current canvas — `nodes.length` equals
      `children.length + 1` on every redraw
- [x] No graph, layout or ViewModel is precomputed or cached per node id anywhere

### How it was verified

Two suites, both run against the real 548-node file:

- **Real pointer input** (`pointer`), 22 assertions driven entirely through
  `Input.dispatchMouseEvent`: hit testing, cursors, real clicks, and pan-versus-click. It exists
  because synthetic `.click()` cannot prove a control is reachable — see _Found by running it_.
- **Explorer/Canvas navigation** (`nav`), 27 assertions covering the six cases this round asked for:
  chevron-only expansion, row-label selection, drilling in from a card, sibling leaves, the project
  crumb, and repeated expand/collapse.
- **The pure pipeline**, exercised directly in Node — 28 assertions over `indexNodes`,
  `canvasRootFor`, `buildCanvasGraph`, `layoutCanvas`, `toCanvasViewModel` and `toReactFlow`.
  Notable: all **397 leaves** were checked to appear on their own canvas and be ringed there; all
  **93 sibling groups** were checked to share one `CanvasRoot`; and across all 548 selections the
  largest canvas ever produced was **15 cards** and **0 of 3,026 cards** fell back to the unknown
  kind.
- **The running application**, driven over the Chrome DevTools Protocol — 33 behavioural assertions
  plus 10 covering animation, reduced motion and resize. Both suites were run three times each from
  clean launches, all passing.

The last nine boxes are unticked because they need a person: two need the native file picker, which
cannot be automated on this machine, and the rest need real pointer input or a fixture with a
deliberately untitled node.

## Found by running it

Seven defects that no amount of reading would have caught. Five are properties of React Flow that are
not obvious from its documentation, one is the kind of thing only a screenshot shows, and the last
turned out not to be a React Flow problem at all.

**1. `.react-flow` has no dimensions of its own.** Its stylesheet sizes none of its own root element,
and every child is absolutely positioned — so inside a flex parent it collapses to zero height. The
graph still rendered, which is what made it confusing: cards and edges appeared, just unframed and
half off the pane, because `fitView` had no viewport to fit into. Fixed by sizing it explicitly.

**2. Gating the refit on `useNodesInitialized` silently disabled it.** In this configuration the hook
stayed `false`, so every refit after the first never happened and the app kept the first canvas's
viewport. The measurements do exist, in `nodeLookup`, and reading them directly is what the code
does now. The hook's exact contract here was never pinned down and the code no longer depends on it.

**3. Setting `width`/`height` on a node put it on a measurement path that did not complete.** Done
originally so the first frame could be framed without waiting for a layout pass. It marks the node as
externally sized, and in this configuration the cards ended up without the handle bounds edges are
routed between. Removing it — letting React Flow measure the cards itself, with the card carrying the
same dimensions as an inline style — is the arrangement that works. Some of what was attributed to
this at the time was very likely defect 7 below, which was active throughout and not understood until
much later.

**4. Every task card drew a checkbox twice.** The `task` kind's icon _is_ a checkbox, and a separate
completion indicator was rendered beside it. Obvious in a screenshot, invisible in the code. The icon
now carries completion on its own, exactly as it does in the explorer row.

A fifth, found by the checklist rather than by accident: the canvas did not reframe when the window
resized, so shrinking the window pushed the graph off the pane — with no zoom controls to recover it.
Framing now depends on the pane size as well as on the canvas root.

### 6. Canvas cards were not clickable at all — React Flow had switched off their pointer events

Reported from real use: **the cursor stayed the canvas "grab" over a card instead of becoming a
pointer.** That framing was exactly right, and it turned a navigation puzzle into a hit-testing one.

`document.elementFromPoint` at a card's centre returned `.react-flow__pane` — the panning surface
_underneath_ the graph — with `cursor: grab`. The card and its node wrapper both computed
`pointer-events: none`, and the wrapper carried it as an **inline** style, which meant React Flow had
put it there deliberately. Its `NodeWrapper` decides:

```js
const hasPointerEvents =
  isSelectable || isDraggable || onClick || onMouseEnter || onMouseMove || onMouseLeave
```

Every one of those is off in this design — the canvas is read-only, and selection is application
state rather than React Flow's — so it concluded the nodes were decoration and made them
transparent to the pointer. Clicks landed on the pane, drags panned straight through the cards, and
the cursor never changed.

The fix is a per-node `style: { pointerEvents: 'all' }`. React Flow spreads `node.style` _after_ its
own computed value, so this is the supported way to say "these nodes are interactive even though none
of your built-in interactions are enabled", and it is set as a constant so `toReactFlow` keeps its
property of containing no conditionals. Cards also get `nopan`, so a drag beginning on a card can
never become a pan, and a `cursor-pointer` / `cursor-default` split so the cursor tells the truth
about which cards do something.

**This is also a verification failure worth recording.** Every existing suite drove the canvas with
`element.click()`, which dispatches straight to a node and bypasses hit testing entirely — so a
canvas whose cards were completely unclickable passed 43 assertions. The suites now include one that
uses `Input.dispatchMouseEvent` for every interaction, which the renderer hit-tests exactly as it
would a physical mouse. A synthetic click can only prove a handler works; it cannot prove the user
can reach it.

### 7. The wedged canvas — Chromium was not running the rendering lifecycle

The long-running intermittent failure, now understood and fixed. It is worth reading as a whole,
because almost every earlier conclusion in this document about it was wrong, and wrong in an
instructive way.

**The symptom.** After a canvas change the store held the right cards, every one of them with
`measured: {}` and `handleBounds: MISSING`, so no edges rendered and `fitView` had no bounds and left
the viewport on the previous canvas. It never recovered on its own.

**What ruled everything else out.** Two experiments, run against a reproduced wedge with React Flow's
store attached:

- `updateNodeInternals` on every card — the library's own "re-measure these" call — **did not
  recover it**.
- Changing each node element's size to force a `ResizeObserver` callback — **did not recover it**.
- Remounting `<ReactFlow>` entirely, giving it a brand-new observer — **did not recover it**, and
  additionally threw away the viewport.

A fresh observer on correctly-sized, painted DOM elements that still never measures is not a React
Flow bug. Nothing was wrong with the graph, the nodes, or the library: **`ResizeObserver` callbacks
are delivered as part of the rendering lifecycle, and Chromium suspends that lifecycle for a window
it considers occluded or backgrounded.** The cards were laid out and painted; the observation that
would have measured them was never delivered, and nothing would ever deliver it retroactively.

That explains every property that made this so hard to pin down. It looked load-sensitive because a
busy machine is one where the window spends more time behind something else. It survived every code
change because no code change can make a suspended lifecycle run. And it was invisible in ordinary
use, where the window is in front, while being nearly constant under an automated harness, where the
window is always behind a terminal.

**The fix is one line in the main process:** `backgroundThrottling: false` on the window's
`webPreferences`. Measured back to back in one session, on a machine loaded enough to reproduce
reliably:

| `backgroundThrottling`      | Wedge rate  |
| --------------------------- | ----------- |
| `true` (Electron's default) | **10 / 12** |
| `false`                     | **0 / 14**  |
| `false`, stress run         | **0 / 20**  |

It is the right fix rather than a workaround. This is a knowledge base its owner leaves open beside a
DAW and a browser, so "the window was not on top for a moment" is the normal case, and a canvas that
silently breaks when the app is not focused is not acceptable at any rate. The cost is that the
renderer keeps its timers and rendering running while backgrounded, which for a single-window desktop
application on mains power is not a meaningful trade.

**The method lesson, recorded because it cost the most.** This bug reproduces at a rate that swings
between 0% and 80% depending on nothing in the codebase, and for a long time it was chased with
single-run A/B comparisons across time. Three "fixes" were adopted and later disproved that way. What
finally worked was measuring a rate, in one session, back to back, with a control arm — and inspecting
the failing state directly instead of inferring it from whether a change appeared to help.

Worth recording as method: the first three were all initially misdiagnosed from screenshots taken
with `PrintWindow`, which returned stale composites of a GPU-rendered window — one of them
convincingly showed a control that was actually on screen as missing. Every conclusion here comes
from querying the live DOM and React Flow's own store instead.

## Out of scope

As the brief specifies: **editing, drag & drop, save, physics.** Also: forms, database migration,
context menus, multi-select, node creation and deletion.

Removed in review and therefore explicitly absent: **zoom controls**, the **background grid**, and
the **child-count badge**.

Beyond those, deliberately absent:

- **Non-hierarchical edges.** `related`, `dependsOn`, `resources` and `outputs` are on every node in
  the real file and are almost certainly the most interesting thing the Canvas will ever draw. The
  model has a place for them (`CanvasLink`) and this milestone renders none of them, because
  resolving cross-references needs the file's own `id` field, which is not unique — see milestone 003.
- **Grandchildren, or any depth control.** One level, per the brief. Depth is the obvious next dial
  and `layoutCanvas` is where it lands.
- **Saved card positions.** Position is derived. There is nothing to save and nowhere to save it.
- **A resizable splitter.**
- **A minimap.**
- **Exit animations for departing cards**, for the reason given under _Animation philosophy_.
- **Search, filtering, an inspector, keyboard navigation on the Canvas.**
- **`status` beyond complete / not complete.** Named as the first future consideration below.
- **Tests.** There is still no test runner. `buildCanvasGraph`, `layoutCanvas`, `toCanvasViewModel`,
  `indexNodes` and `flattenTree` are now five pure functions with obvious inputs and outputs — the
  case for adding one is getting stronger, and it is its own milestone rather than a rider on this
  one.

## Future considerations

### The Canvas is not a one-off view

**Later milestones will progressively add editing, forms, status changes, drag & drop and graph
editing directly on the Canvas.** This milestone deliberately ships none of it, and every decision
here should be read against that trajectory rather than against today's read-only surface.

A rough sense of the direction, so the architecture can be judged against something concrete:

| Later capability                  | Where it lands                                                  | What already exists for it                                         |
| --------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------ |
| Status changes on a card          | `CanvasCardView` gains a field; the card gains a control        | The ViewModel layer, and the registry's `showsCompletion`          |
| Inline editing of a title         | The card becomes an input; a mutation goes back to the document | Node identity, and a projection that recomputes rather than caches |
| Forms / inspector for a node      | A third pane, or a card that expands                            | Lifted selection in `App`                                          |
| Drag & drop to reparent           | `nodesDraggable` flips per card; `onNodeDragStop` writes        | `toReactFlow` is the one place those flags are set                 |
| Drawing connections               | `nodesConnectable` flips; `onConnect` writes a link             | `CanvasLink` already exists and is not derived from containment    |
| Tabs / Open Canvas / recents      | Several `CanvasRoot` values instead of one                      | _Canvas Identity_                                                  |
| Depth control, multi-level graphs | `layoutCanvas` is replaced                                      | Layout is one pure function behind the ViewModel                   |
| Saved card positions              | Layout consults stored positions before computing               | Determinism is what makes "stored" and "computed" comparable       |

This is the reason for the parts of today's design that are more structure than this milestone needs
— the ViewModel, the Canvas Root, the explicit link list. Each of them is cheap now and expensive to
retrofit, and each is aimed at a specific row of that table rather than at generality for its own
sake. Anything not on this list is not being designed for.

The corollary is a warning: because these are coming, **no decision in this milestone should assume
the Canvas stays read-only**. Where a shortcut would be safe forever in a visualization but wrong in
a workspace, this document takes the longer route and says so.

### Zoom may eventually change detail, not size

Today zoom is purely optical: cards scale, and at the 0.8 floor the design chooses panning over
shrinking rather than showing less. That is the right behaviour while a card holds three fields.

**A later milestone may make zoom semantic — revealing or hiding information as the zoom level
changes, while the layout stays fixed.** Rather than a card getting smaller, it would get simpler:

```
Zoomed out                     Zoomed in

●  Guitar                      🎸  Guitar
●  Ableton                         Domain · 18 projects
●  Mixing                          142 of 190 complete
                                   Last touched 3 days ago
```

Two properties of the current design are what would make that a contained change, and they are the
reason it is worth naming now:

- **The card footprint is fixed and the layout is deterministic.** Semantic zoom only works if
  positions do not move as detail changes — otherwise the graph reflows underneath the user while
  they are zooming, which is disorienting in exactly the way the animation section is trying to
  avoid. Because `layoutCanvas` never consults card _content_, only its constant dimensions, detail
  can change freely without moving a single card.
- **The card renders from a `CanvasCardView`.** Additional detail is additional fields on that
  object, resolved once in the ViewModel, plus a density prop on the component. No new lookup, no
  access to the domain model from the component, and no per-kind conditional.

Not proposed for this milestone, and not designed for beyond those two properties — which are both
things the design wanted anyway.

### `status` is the next small win

The Canvas makes the gap visible in a way the Explorer did not: cards have room for state and the
file has state to show, but the model reduces `todo` / `active` / `done` to a boolean. Surfacing it
is `ExplorerNode.status`, one line in `readCompletion`'s neighbourhood in the adapter, and a per-kind
decision in the registry about which statuses a kind can hold. It benefits both views at once, which
is the argument for doing it as its own small milestone rather than folding it in here.

### Seams left open, each for a named later milestone

- **`CanvasGraph.links`** — an explicit edge list, so `related` and `dependsOn` become extra entries
  rather than a redesign. This is the single most valuable seam the milestone creates.
- **`CanvasRoot`** — the identity of a canvas, serializable and separate from both selection and
  focus. Tabs, Open Canvas, recent canvases, workspace persistence, back/forward history and deep
  links all name a canvas with this and nothing else. See _Canvas Identity_.
- **`canvasRootFor`** — one function deciding which canvas a selection opens. The leaf rule lives
  here, and so does any future rule ("root at the nearest container", "pin this root", "show two
  levels").
- **`layoutCanvas`** — the whole layout in one pure function. Depth control, column wrapping, and
  honouring user-placed positions once cards can be dragged all replace this function and nothing
  else. Its output shape is what the ViewModel consumes, so a new layout does not reach the renderer.
- **`CanvasViewModel`** — the boundary the rendering library sits behind. Replacing React Flow means
  writing a new consumer of this type; nothing above it changes. It is also where per-card visual
  state that does not exist yet (a drag handle, a validation error, a search match) attaches, as
  fields rather than as component logic.
- **`toReactFlow`** — where `draggable` and `connectable` flip from constant `false` to per-card
  values when editing arrives.
- **`CanvasCardView.nodeId`** — nullable on purpose. The project card has none today; a future card
  representing something other than a knowledge-base node (a group, a note, an annotation) fits the
  same model.
- **`NodeIndex.parentIdOf`** — already load-bearing for the rooting rule and reveal. It is also what
  a breadcrumb, "go up one level" and deep links will need.
- **Lifted selection in `App`** — the state the inspector reads. Both halves of that contract now
  exist, and the removed right pane from milestone 003 returns as a third flex sibling. Child counts,
  removed from the card in review, are the inspector's material.
- **React Flow itself** — `onNodeDragStop` is where drag & drop lands, `onConnect` is where linking
  lands, and `onNodeDoubleClick` is where opening an editor lands. All three are props on a component
  that will already exist, and the double-click gesture is deliberately left free for it.
- **`canvas.css`** — one file holding every duration in the application. When a second animated
  surface appears, these become tokens.
- **`nodeKinds.ts` splitting** — when a second surface needs per-kind styling, the registry should
  separate semantics (name, icon, has-completion) from per-surface presentation. One consumer is not
  enough to justify it; two will be.

### What "no editing" costs, and why it is recoverable

This milestone builds a Canvas that cannot change anything, which means the entire write path is
absent: no mutation API, no undo, no dirty state, no save. That is a lot of missing machinery, and it
is worth being clear that none of it is _prevented_ by anything here.

The reason is that the Canvas renders a projection. `CanvasGraph` is derived from `ExplorerNode[]`,
which is derived from the document, and the derivation is a pure function run on every render.
Editing means adding an inverse — a mutation applied to the document, after which the projection
recomputes. Nothing in this milestone stores derived state that would have to be invalidated, which
is the thing that usually makes retrofitting editing painful.

The one genuine constraint is that mutation needs node identity that survives a change to the tree,
and today's identity is positional — a JSON Pointer. Moving a node changes its id, and therefore its
selection and its expansion state. That was already true after milestone 003; the Canvas does not make
it worse, but editing is the milestone where it stops being theoretical, and resolving the duplicate
`id` in the file is a prerequisite for it.

### The application shell is still where storage shows

Unchanged from milestone 003 and worth re-verifying rather than re-asserting: `App.tsx` still keys the
tree on `filePath` and displays `fileName`, and `Project` still carries both. The Canvas adds no new
place where storage is visible — `components/canvas/` will be as free of file vocabulary as
`components/explorer/` is, and the verification checklist has an item for it.

## Why this is the smallest possible step to a significantly more usable product

The brief's test is whether the application stops feeling like a JSON explorer. Everything in it that
could be cut has been:

- **No new data.** No IPC channel, no schema change, no field added to the model. The Canvas renders
  what milestone 003 already produced.
- **No new vocabulary.** The kind registry is reused verbatim. A second view over the same kinds is
  the cheapest possible proof that the first view was factored correctly.
- **No mutation.** No write path, no undo, no dirty state, no save, because none of those are needed
  to answer "what is this among, and what is in it".
- **No layout engine.** Fifteen lines of arithmetic, because at 15 cards that is the right answer and
  not a shortcut.
- **No surface chrome.** After review: no controls, no grid, no minimap, no badge. What is left on
  screen is cards, connections and one ring.
- **One dependency**, taken at the moment it is cheapest to take.

And nothing that remains could be removed and still deliver the goal. Drop the second pane and there
is no workspace. Drop the adapter and the Canvas becomes a component that knows the storage format —
the exact mistake milestones 002 and 003 spent their architecture budget avoiding. Drop the lifted
selection and the two panes are two applications. Drop the rooting rule and 72% of clicks land on a
single card. Drop the cards' kinds and completion and the graph is boxes with words in them, which is
a diagram of the tree rather than a view of the knowledge base.

Three things are added rather than removed — the **ViewModel** layer, the **Canvas Root**, and the
explicit **link list** — and together they are the milestone's only deliberate over-engineering. Each
is taken knowingly, and each is aimed at a specific named future rather than at generality:

- The rendering library is the part of this design most likely to be replaced, and the ViewModel is
  what makes that replacement one file instead of a rewrite.
- A canvas that cannot be named cannot be tabbed, reopened, remembered or linked to, and retrofitting
  identity means touching every layer at once.
- Edges derived from containment cannot express `related` or `dependsOn`, which is the most obviously
  valuable thing the Canvas will ever draw.

None of the three would be worth its cost in a visualization. All three are worth it in a workspace,
which is what this document commits the Canvas to being.

## Sources

Consulted for graph rendering, layout and navigator/workspace interaction:

- [React Flow — Quickstart](https://reactflow.dev/learn)
- [React Flow — `<ReactFlow />` props reference](https://reactflow.dev/api-reference/react-flow)
- [React Flow — Core concepts](https://reactflow.dev/learn/concepts/core-concepts)
- [React Flow — Layouting overview](https://reactflow.dev/learn/layouting/layouting)
- [xyflow/xyflow on GitHub](https://github.com/xyflow/xyflow)
- [Canvas visual system — Obsidian help](https://deepwiki.com/obsidianmd/obsidian-help/6-canvas-visual-system)
- [Obsidian Canvas: a complete guide to visual thinking and planning](https://www.obsibrain.com/blog/obsidian-canvas-complete-guide)
- [ClickUp feedback — Whiteboards speed & performance](https://feedback.clickup.com/feature-requests/p/whiteboards-speed-performance)
- [ClickUp feedback — Whiteboards need major improvements](https://feedback.clickup.com/feature-requests/p/whiteboards-need-major-improvements)
- [Linear design breakdown — why every SaaS team copies this UI](https://www.925studios.co/blog/linear-design-breakdown-saas-ui-2026)
- [How is Linear so fast? A technical breakdown](https://performance.dev/how-is-linear-so-fast-a-technical-breakdown)
- [microsoft/vscode #175690 — separate `explorer.autoReveal` into two options](https://github.com/microsoft/vscode/issues/175690)
- [microsoft/vscode #169070 — a single option to toggle click behaviour in the File Explorer](https://github.com/microsoft/vscode/issues/169070)
