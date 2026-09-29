# Music Brain Studio — Product Vision and Roadmap History

> **Intended repository path:** `docs/handoffs/000-product-vision-and-roadmap-history.md`
>
> **Purpose:** Durable product-and-engineering handoff reconstructed from the original planning conversation. This document is meant to let a new senior product/engineering agent continue Music Brain Studio without access to the missing ChatGPT / Claude Code history.
>
> **Source discipline:** This document records only ideas, decisions, implementation facts, constraints, and open questions that were actually discussed in the planning history. Where the conversation did not settle a detail, it is marked as tentative, deferred, or unknown rather than filled in by guesswork.

---

# 1. Document Purpose

Music Brain Studio has accumulated product decisions, architecture choices, workflow principles, and milestone history across a long planning conversation and several implementation sessions. Some Claude Code development sessions were later lost, so the project needs a durable record that separates:

- what the product is meant to become;
- what is already implemented;
- what has been explicitly accepted into the roadmap;
- what was considered but postponed;
- what was rejected;
- what remains unresolved;
- what future agents must preserve even if the implementation changes.

This document is not a code-level substitute for the repository. It is the product intent and historical rationale that should be read alongside:

- the current codebase;
- `docs/milestones/`;
- Git history and merged pull requests;
- `README.md`;
- `CLAUDE.md`;
- the canonical Music Brain JSON data;
- any later handoff files.

When this document and the current repository disagree on implementation details, inspect the repository and Git history. Product intent recorded here should still be treated as important context unless a later explicit product decision supersedes it.

---

# 2. Executive Product Summary

**Status: Product intent / Confirmed direction**

Music Brain Studio is a personal, musician-first creative operating environment for organizing and acting on a large, evolving “Music Brain”: the user’s structured map of musical projects, tasks, ideas, knowledge, decisions, references, experiments, templates, and future work.

Its near-term job is not to become a general-purpose productivity suite. Its job is to make real music work easier to start, easier to continue, easier to structure while it is happening, and safer to resume later without losing context.

The core product loop has converged on:

`Discover → Capture → Structure → Work → Complete → Continue tomorrow`

The product should let a musician:

1. open the app and immediately see where meaningful work exists;
2. enter a focused area without being overwhelmed by the entire hierarchy;
3. start working on a real musical task;
4. capture new subtasks or discoveries the moment they appear;
5. restructure work when understanding changes;
6. mark what is in progress and what is complete;
7. see local and recursive progress without treating discovery of more work as failure;
8. save safely;
9. return the next day with the exact context preserved.

The application should become the **single source of truth** for what musical work exists, what is understood, what is currently happening, what is done, and what should happen next.

The current desktop application already provides a read-only Explorer and Canvas over the real Music Brain JSON. The next accepted product direction is to make that model live and writable through a Milestone 005 called **Live Work Loop**.

---

# 3. Original Motivation and Problem

## 3.1 Why Music Brain Studio exists

**Status: Product intent**

The user has a large and growing musical workflow that crosses many tools and domains:

- Ableton;
- Guitar Pro;
- guitar practice;
- production templates;
- Quad Cortex;
- album work;
- composition;
- reference material;
- plugins and samples;
- lyrics;
- content;
- live performance;
- AI-assisted research;
- future creative systems.

The problem is not a lack of tools. The problem is fragmentation, friction, and the fear of losing the real state of work.

Generic project-management tools were not satisfying enough for this workflow. The user wants a system tailored to how musical work actually develops: non-linearly, recursively, and through discovery.

Examples that motivated the product:

- A task that looks simple may reveal ten subtasks during a session.
- A “task” may need to become a project because its scope becomes clearer.
- A music template may need many small improvements before it is truly usable.
- A practice or production investigation may generate more work than it completes in the same session.
- The musician may hesitate to start research or experimentation because there is no trusted place to record all the branches that might appear.
- The user wants to return tomorrow without rebuilding mental context.

The product should remove that hesitation.

## 3.2 The core psychological problem

**Status: Confirmed product principle**

A central product insight is that **discovering more work is often progress**.

Example:

- start with 3 known tasks;
- complete 2;
- discover 12 additional subtasks.

A naive task manager may make this look like progress fell dramatically because the denominator increased.

That framing is wrong for this product.

The additional tasks may represent:

- reduced uncertainty;
- better understanding;
- a more complete map;
- a formerly vague project becoming executable.

Therefore:

> **Discovery is progress.**

Music Brain Studio must not psychologically punish the user for understanding a project more deeply.

This is one of the strongest differentiators from a generic checklist.

## 3.3 The “money time” problem

**Status: Confirmed product problem**

The product becomes truly useful when the musician is already working and suddenly realizes:

- “I need three more subtasks here.”
- “This belongs under a different project.”
- “This task is actually a project.”
- “I should mark this In Progress before I stop.”
- “I need to capture ten things before I forget them.”

The app must support these moments in seconds.

If the user has to:

- leave the app;
- edit raw JSON;
- ask ChatGPT to rewrite the JSON;
- open a separate task manager;
- perform significant administrative setup;

then the app has failed its core purpose.

---

# 4. Product Identity

## 4.1 What “Music Brain” means

**Status: Confirmed product concept**

The Music Brain is the structured representation of the user’s musical world.

It is not merely a task list. It contains or may contain:

- domains;
- projects;
- areas;
- tasks;
- knowledge;
- playbooks;
- templates;
- resources;
- experiments;
- decisions;
- assets;
- questions;
- checklists;
- relationships;
- dependencies;
- notes;
- tags;
- statuses;
- future fields not yet surfaced in the application.

At the current stage, the Music Brain is persisted as a large hierarchical JSON file.

The JSON is the **current persistence representation**, not the final conceptual product architecture.

## 4.2 What Music Brain Studio is

**Status: Confirmed direction**

Music Brain Studio is:

- a desktop workspace for navigating the Music Brain;
- a focused work environment;
- a structural map of musical work;
- a place to capture newly discovered work;
- a place to maintain progress state;
- a place to resume unfinished work;
- a future foundation for deeper creative intelligence.

It should feel closer to a musician-specific creative operating surface than to a conventional to-do app.

## 4.3 What it is not

**Status: Confirmed boundary**

Music Brain Studio is explicitly not intended, at this stage, to become:

- Notion;
- ClickUp;
- a Kanban-first task manager;
- a generic notes app;
- a replacement DAW;
- a general-purpose project-management suite;
- a giant “everything OS” monolith.

The user has a broader future concept around WHAT / WHAT OS, but the current strategy is deliberately narrower:

> Build small, immediately useful in-house tools that solve the user’s real workflow first.

Music Brain Studio should not duplicate other tools without a clear reason. Obsidian may still be useful for knowledge capture, audio clips, or references. The Studio’s purpose is the live operational layer for the Music Brain and creative work.

## 4.4 Intended audience

**Status: Confirmed near-term / Tentative long-term**

Near-term primary audience:

- the user as the first and most important customer;
- a musician working across writing, guitar, production, practice, templates, sound design, and project development.

Long-term possible audience:

- other musicians or creative professionals with similarly complex creative workflows;
- potentially a broader commercial/open-source product.

However, the project should be optimized for the user’s workflow first. Generalization comes later.

## 4.5 Long-term creative intelligence vision

**Status: Long-term product intent, not current milestone scope**

The broader Music Brain vision eventually extends beyond task organization.

The user wants a system that may one day:

- ingest an artist’s creative history;
- analyze stylistic development over time;
- model how musical choices evolve;
- explain transitions between eras;
- use that learned representation to support future creative development.

A reference example discussed was the stylistic evolution of Avenged Sevenfold across early metalcore, modern metal, *The Stage*, *Life Is But a Dream…*, and later stylistic shifts.

The long-term dream is not simply “AI writes music.” It is a system that understands a body of work and helps explain or extend creative identity.

This is a north star, not a current implementation requirement.

---

# 5. Product Principles

## 5.1 Single source of truth

**Status: Confirmed product principle**

The user wants to trust Music Brain Studio as the place where current musical work lives.

That means:

- newly discovered work must be capturable immediately;
- changes must persist;
- task state must survive sessions;
- the app must not silently lose or overwrite newer data;
- the user should not need parallel truth in a JSON editor, chat, task manager, and memory.

The desired mental state is:

> “If it matters to my music workflow, I can put it here and trust that it will still be here tomorrow.”

## 5.2 Reduce time from opening the app to real work

**Status: Confirmed development principle**

A standing milestone principle is:

> **Optimize every milestone toward reducing the time between opening Music Brain Studio and starting real work.**

This has influenced the roadmap repeatedly.

Features are preferred when they produce immediate workflow value, even if future refactors are expected.

## 5.3 Capture without breaking creative flow

**Status: Confirmed product principle**

During guitar, composition, production, or practice, the interface should be fast enough that capturing a new idea or subtask does not become a second activity.

Examples:

- right-click → Add child;
- inline rename;
- quick status change;
- multiline bulk add;
- simple move/reparent;
- minimal Inspector;
- keyboard shortcuts where useful.

The product should reduce cognitive load, not create administration.

## 5.4 The hierarchy is allowed to evolve

**Status: Confirmed product principle**

The initial structure does not have to be perfect.

A task may become a project.
A project may gain many subtasks.
A node may move elsewhere.

The product should support the reality that understanding develops through work.

This was one reason “Change type” and “Move to…” became important proposed interactions.

## 5.5 Focus beats visual overload

**Status: Confirmed Canvas principle**

The Canvas should not automatically become an enormous graph of the entire Music Brain.

The current Canvas is intentionally local/focused.

The user considered a deeper “expand in place” model where clicking a project would reveal children while keeping the broader graph visible. That idea remains interesting, but it was not chosen for Milestone 005 because it risks reintroducing overwhelm.

A future system may support both:

- focused navigation;
- expanded graph exploration.

But the focused Canvas model should not be casually discarded.

## 5.6 Trust beats convenience when data is at risk

**Status: Confirmed safety principle**

Examples:

- explicit save is preferred before autosave;
- external file conflicts must block blind overwrite;
- test instances must not modify the real Music Brain;
- unknown Windows/DLL compatibility should fail closed rather than guess;
- isolated development launch should abort rather than interrupt the user’s active desktop.

Predictability is a product feature.

---

# 6. Intended User and Use Cases

## 6.1 Primary use cases

**Status: Confirmed**

### A. Decide what to work on

The Explorer and Canvas provide a navigable map that helps the user decide where to focus.

### B. Run a real work session

Examples:

- work on an Ableton template;
- improve rhythm guitar production setup;
- build Guitar Pro practice templates;
- research exercises;
- refine a Quad Cortex setup;
- work through album/production tasks;
- organize composition work.

### C. Capture discoveries while working

Examples:

- add six newly discovered subtasks;
- convert a task into a project;
- move a misplaced item;
- bulk-add a list of work;
- note what is In Progress.

### D. Resume tomorrow

The app should answer:

- What was I working on?
- What did I finish?
- What is still open?
- What newly discovered work exists?
- Where should I continue?

## 6.2 Secondary/future use cases

**Status: Deferred / Future**

- search and filtering;
- alternate Canvas views;
- deep graph exploration;
- richer progress analytics;
- configurable statuses;
- AI-assisted structuring;
- relationships and dependency visualization;
- creative-history analysis;
- artist-evolution modeling;
- generalized/open-source use by other developers or musicians.

---

# 7. End-to-End Music Workflow

## 7.1 The accepted conceptual loop

**Status: Confirmed product direction**

`Discover → Capture → Structure → Work → Complete → Continue tomorrow`

### Discover

The musician begins a real activity.

Examples:

- opens an Ableton template;
- practices guitar;
- designs a rhythm tone;
- researches exercises;
- organizes a production project.

New information appears while working.

### Capture

The app must let the user record that information immediately.

Accepted/planned examples:

- Add child;
- quick rename;
- Bulk Add;
- status change;
- notes in Inspector.

Capture should take seconds.

### Structure

As understanding grows, the user may realize:

- the item belongs elsewhere;
- the node type is wrong;
- a task is now a project;
- many children belong under one parent.

Planned structural actions:

- Change type;
- Move / reparent;
- organize via hierarchy;
- later possibly richer graph relations.

### Work

The user should remain focused on a local Canvas and the current piece of work.

The product should not force broad portfolio management during the session.

### Complete

The planned first work-state model is intentionally small:

- `todo`;
- `in_progress`;
- `done`.

Completion should be visible immediately.

The existing checkbox-like element on Canvas cards was intended to become functional.

### Continue tomorrow

The app should preserve:

- work state;
- newly created nodes;
- hierarchy changes;
- notes;
- current source of truth.

The next session should not require reconstructing context from memory.

---

# 8. Information Architecture and UX

# 8.1 Explorer

**Status: Implemented / Confirmed**

The Explorer is a VS Code / Obsidian-inspired left navigation tree.

Its purpose:

> find things quickly.

Durable behavior decisions:

- hierarchy is visible as a tree;
- rows are dense;
- expansion/collapse is separate from selection;
- clicking only the chevron should expand/collapse without changing the Canvas;
- the row/label selects/navigates;
- indentation guides help hierarchy scanning;
- node kinds have icons/presentation;
- unknown kinds have a fallback;
- expansion state is Explorer-only state;
- selection/focus is shared with the Canvas;
- project title can return to project root;
- scrollbar styling is scoped to the Explorer.

The separation between expansion and selection was explicitly considered important because the user should be able to inspect structure without losing the current work context.

Future Explorer features discussed but deferred:

- search;
- filters;
- Collapse All;
- Expand All;
- possibly recent/focused views.

# 8.2 Canvas

**Status: Implemented / Confirmed**

The Canvas is the primary workspace.

The design statement established during Milestone 004:

> **The Canvas is the primary workspace of Music Brain. The Explorer is a navigation aid.**

The Explorer answers:

> Where is something?

The Canvas answers:

> What am I working on here?

Current Canvas behavior:

- split layout with Explorer and Canvas;
- a Canvas has one explicit `CanvasRoot`;
- Canvas identity is separate from selection/focus;
- a selected container roots the Canvas at itself;
- a selected leaf roots the Canvas at its parent so the user sees the leaf among siblings;
- sibling leaf selections keep the same Canvas geometry and only move the selection/focus ring;
- Canvas cards are connected in a deterministic graph;
- root → immediate children is the current graph scope;
- layout is deterministic to the pixel;
- React Flow provides pan/zoom and future interaction infrastructure;
- project root can show top-level domains;
- the local graph intentionally stays small.

The Canvas must remain a stable “place.” The same root should not produce random movement between visits.

## 8.3 Canvas navigation model

**Status: Confirmed**

- Explorer selection can drive Canvas navigation.
- Canvas container click can drill into a node.
- Canvas leaf click keeps the parent-rooted context and changes focus.
- project title returns to project-level Canvas.
- future breadcrumb was envisioned.

## 8.4 Deep/expanded Canvas idea

**Status: Deferred, not rejected**

The user proposed a more dynamic Canvas in which:

- a domain remains visible;
- clicking a project expands its children in-place;
- the Canvas does not re-root immediately;
- more of the branch becomes visible while retaining context.

This was recognized as useful for understanding progress inside very large projects.

However, the planning conversation concluded that this should not replace the focused Canvas yet.

Reason:

- the focused Canvas reduces cognitive overload;
- infinite/deep expansion can quickly reproduce the “whole giant project at once” problem.

Possible future direction:

- a second Canvas mode;
- explicit “expand branch” interaction;
- potentially click vs Shift+Click or another distinct gesture.

No final UX was chosen.

## 8.5 Inspector

**Status: Planned for Milestone 005**

A lightweight details panel was accepted as part of the next major milestone.

First fields considered useful:

- title;
- node type;
- status;
- tags;
- notes.

Possibly priority if strongly justified.

Fields that should not automatically be exposed merely because they exist in JSON:

- energy;
- outputs;
- resources;
- related;
- dependsOn.

The Inspector should reflect actual product concepts, not blindly mirror persistence schema.

## 8.6 Context menus

**Status: Planned for Milestone 005**

Both Explorer nodes and Canvas cards should expose fast actions where appropriate.

Initial menu direction:

- Add child;
- Rename;
- Edit details;
- Change type;
- Move to…;
- status actions if useful.

Delete was intentionally not required for Milestone 005.

## 8.7 Bulk Add

**Status: Accepted into Milestone 005**

The user considers bulk capture important enough to include early.

Desired first version:

- choose/current parent;
- choose one type, usually Task;
- multiline text;
- one non-empty line = one new child;
- submit once.

Explicitly not required yet:

- hierarchy syntax;
- CSV;
- AI parsing;
- templates;
- complex import.

## 8.8 Status and completion

**Status: Accepted into Milestone 005**

Initial fixed statuses:

- Todo;
- In Progress;
- Done.

No custom Notion-style status sets in the initial version.

Proposed checkbox behavior:

- Todo or In Progress → Done;
- Done → Todo.

Inspector or context menu can explicitly select all three states.

The exact interaction was left for design review, but the three-state model was accepted as a practical first version.

## 8.9 Progress communication

**Status: Confirmed product principle / Planned**

Parent nodes should eventually reflect recursive descendant work state.

Preferred first direction:

- counts rather than a dominant percentage;
- for example:
  - 2 done;
  - 1 in progress;
  - 12 open.

Reason:

A percentage can falsely imply regression when new subtasks are discovered.

Future conceptual distinction discussed:

- **execution progress**: how much known work is done;
- **definition maturity**: how well the project is understood/structured.

Definition maturity is not part of the current milestone.

## 8.10 Empty, loading, error, and conflict states

### Loading

**Status: Existing app behavior, no major special model established**

The current app loads a default project and renders the Explorer/Canvas. No broad loading-system redesign was discussed.

### Read-only

**Status: Current pre-M005 state**

Before writable editing, the app is effectively read-only.

### Conflict state

**Status: Mandatory for writable M005**

If the project file changed externally after this instance loaded it, save must not overwrite silently.

Expected user-facing state:

> The project changed on disk.

Minimum actions discussed:

- Reload;
- Cancel.

No merge engine is required for Milestone 005.

### Save error

**Status: Safety requirement**

Save failures must be visible and non-destructive.

Exact UI was not finalized.

---

# 9. Domain Model and Persistent Data

## 9.1 Current JSON

**Status: Implemented / Confirmed**

The current canonical development Music Brain is a large JSON file in-repo:

`data/music-brain.json`

At the time discussed, it had approximately:

- 548 nodes;
- 13 root domains;
- max depth around 4;
- approximately 397 tasks;
- 99 areas;
- 39 projects;
- 13 domains.

The data is intentionally rich and hierarchical.

The user historically preferred:

- capture first;
- do not prematurely normalize;
- do not deduplicate too early;
- use real hierarchy;
- new discoveries become new nodes;
- avoid speculative empty branches.

## 9.2 Supported node types

**Status: Current schema knowledge**

The JSON schema included supported node types such as:

- domain;
- project;
- area;
- task;
- knowledge;
- playbook;
- template;
- resource;
- experiment;
- decision;
- asset;
- question;
- checklist.

Not every type is equally important in the current UI.

## 9.3 Common fields

**Status: Current schema knowledge**

Fields discussed/observed include:

- id;
- title;
- nodeType;
- status;
- tags;
- related;
- dependsOn;
- resources;
- notes;
- priority;
- energy;
- outputs.

The planning conversation explicitly warned against treating every persistence field as a product field.

## 9.4 Raw ID issue

**Status: Known technical risk**

A duplicate raw ID exists in the Music Brain data:

`quad.base.cab`

It appears on more than one node.

This was harmless in the read-only Explorer/Canvas because UI identity was not based on that raw ID alone.

However, it becomes important once nodes can move, be referenced, or be edited persistently.

Future agents must not assume current raw IDs are globally unique without verifying/fixing the model.

## 9.5 Current UI identity

**Status: Implemented, but under pressure from future editing**

Explorer identity was derived from JSON Pointer / path-like identity in the current read-only implementation.

This satisfied read-only stability at the time, but moving a node can change its path.

For Milestone 005, the design prompt explicitly required answering:

- how identity remains stable across create/move/rename;
- how new IDs are generated.

This remains an architectural question to resolve in M005.

## 9.6 JSON is persistence, not domain architecture

**Status: Confirmed architectural principle**

The application must not become mentally or structurally tied to JSON forever.

A future migration to SQLite or another database is expected to be possible.

Therefore:

- Canvas components should not edit `children[...]` directly;
- Explorer should not own persistence mutations;
- the Inspector should not know JSON layout;
- mutation operations should be expressed at the domain/application layer.

## 9.7 Expected mutation model

**Status: Planned for Milestone 005**

Conceptual mutation API discussed:

- `createNode(parentId, data)`
- `updateNode(nodeId, patch)`
- `moveNode(nodeId, newParentId)`
- `changeNodeType(nodeId, nodeType)`
- `setNodeStatus(nodeId, status)`

Exact APIs are not final.

The important invariant is that:

- Inspector;
- Canvas context menu;
- Explorer context menu;
- Bulk Add;
- future keyboard commands;
- future AI features

should use the same mutation system.

## 9.8 Persistence preservation requirements

### Confirmed

- Saving must not silently destroy newer data.
- External modification must be detected.
- Save should be explicit initially.
- A safe write strategy such as temp file + replace was preferred.
- Test instances must not write to the real Music Brain.

### Intended but not fully specified

The handoff request asks about:

- lossless reading/writing;
- unknown fields;
- ordering;
- formatting;
- line endings;
- backward compatibility.

The original planning conversation did **not** fully settle a serializer strategy for these.

Therefore:

**Unknown / unresolved from this conversation:**

- whether formatting must be byte-stable;
- whether original indentation must be preserved;
- whether line endings must be preserved exactly;
- whether comments are possible/allowed in the persistence format;
- whether unknown fields are guaranteed losslessly preserved by the future write path;
- whether sibling ordering is explicitly semantically meaningful beyond current array order.

However, given the source-of-truth role and the “do not destructively rewrite data” principle, future implementation should treat unknown-field preservation and meaningful ordering as safety-critical concerns and explicitly verify them rather than assuming them.

---

# 10. Safety, Trust, and Data Integrity

# 10.1 Explicit save before autosave

**Status: Confirmed Milestone 005 direction**

Initial writable version should prefer:

- in-memory edits;
- dirty indicator;
- explicit Save / Ctrl+S.

Autosave was considered premature because editing semantics are still evolving.

## 10.2 Dirty state

**Status: Planned**

The UI should visibly indicate unsaved changes.

Possible visual examples were discussed conceptually, but no final styling was chosen.

## 10.3 External change protection

**Status: Mandatory**

Before saving:

- compare the file against the revision loaded by this instance;
- if it changed externally, do not blind-overwrite.

Possible revision signals discussed:

- mtime/stat;
- content hash;
- or both.

Exact mechanism was left to design.

## 10.4 Atomic writes

**Status: Preferred technical direction**

Save should use a safe strategy, preferably:

- write temporary file;
- replace/rename atomically where appropriate.

Exact cross-platform implementation was not finalized.

## 10.5 No merge engine required yet

**Status: Confirmed scope boundary**

Milestone 005 does not need a full three-way merge or collaborative editing system.

Conflict detection is enough.

## 10.6 Multi-instance risk

**Status: Confirmed critical risk**

Once the file becomes writable, two instances loading the same JSON can overwrite each other.

Example failure:

- Instance A and B both load version X.
- A adds tasks and saves version Y.
- B still holds X and saves.
- B destroys A’s newer work.

This must not be allowed.

## 10.7 Test-data isolation

**Status: Mandatory for Milestone 005, not yet implemented at latest known state**

Desktop isolation and data isolation are different problems.

Already implemented:

- Claude’s Electron window can be routed away from the user’s active desktop.

Still required for writable M005:

- `pnpm dev:isolated` must not mutate the real `data/music-brain.json`;
- it should receive a disposable or temporary copy of realistic Music Brain data;
- automated UI tests may then create/move/status-change/save freely without touching the user’s source of truth.

Desired conceptual split:

`pnpm dev`
→ user instance
→ may use real Music Brain
→ writable

`pnpm dev:isolated`
→ Claude/testing instance
→ disposable/test copy
→ safe to mutate

## 10.8 Read-only fallback

**Status: General safety principle, exact UX not finalized**

If the application cannot safely save, it should prefer refusing destructive writes over pretending success.

A specific read-only fallback design was not fully specified.

---

# 11. Complete Roadmap and Milestones

# 11.1 Long-term roadmap shape

The roadmap evolved from:

1. load and display the Music Brain;
2. make navigation pleasant;
3. establish Canvas as the workspace;
4. make the Brain writable and usable during real sessions;
5. improve rapid capture/focus;
6. later add richer search, views, relationships, AI, and deeper creative intelligence.

The strongest current roadmap principle is usability-first.

---

## Milestone 001 — Foundation

**Status: Implemented**

### Purpose

Create the Electron desktop foundation.

### Technology

- Electron;
- React;
- TypeScript;
- Tailwind;
- pnpm;
- Windows-first development environment.

### User problem addressed

There was no dedicated application surface.

### Contribution

Established the shell in which all later product work lives.

### Intentionally deferred

Product behavior.

---

## Milestone 002 — Open and Display Project

**Status: Implemented and merged**

Known branch:

`feature/open-and-display-project`

Known milestone document:

`docs/milestones/002-open-and-display-project.md`

### Purpose

Open a Music Brain project and display it.

### Key implementation direction

- `project:open` IPC;
- native file picker;
- main process reads file;
- JSON parse;
- explicit result union such as opened/canceled/invalid/failed;
- renderer does not provide arbitrary paths;
- limited preload API;
- recursive tree rendering;
- generic JSON viewing.

### User problem addressed

The application could not inspect a Music Brain project.

### Constraints

No editing.
No search.
No save.
No Inspector.
No selection-driven workspace yet.

### Contribution

Proved safe file opening and project loading.

---

## Milestone 003 — Music Brain Explorer UI

**Status: Implemented and merged**

Known branch:

`feature/music-brain-explorer-ui`

Known milestone document:

`docs/milestones/003-music-brain-explorer-ui.md`

Known merged PR:

PR #2, “Feature: Music Brain Explorer UI”

### Purpose

Stop feeling like a JSON viewer and start feeling like a Music Brain application.

### Key UX decisions

- Explorer becomes the main visible navigation surface;
- no raw JSON vocabulary in the user-facing tree;
- full-row selection target;
- separate chevron behavior;
- dense tree;
- node-kind icons;
- restrained visual system;
- flattened visible rows;
- expansion state separated from selection;
- unknown-kind fallback.

### Architecture

Pipeline:

project data
→ adapter
→ `ExplorerNode`
→ flattening
→ rows
→ UI

The adapter was intended to isolate persistence vocabulary from the UI.

### Startup behavior

The real `data/music-brain.json` could auto-load as an early-development convenience.

### User problem addressed

The app was technically displaying JSON, but not yet useful as a navigable Music Brain.

### Deferred

- Canvas;
- editing;
- save;
- Inspector;
- search.

### Important later supersession

Milestone 003 temporarily framed the Explorer as “the application.”

Milestone 004 later superseded that framing:

> Canvas = primary workspace; Explorer = navigation aid.

---

## Milestone 004 — Canvas View

**Status: Implemented and merged**

Known branch:

`feature/canvas-view`

Known milestone document:

`docs/milestones/004-canvas-view.md`

Known PR:

PR #3, “Feature: Canvas View”

The planning conversation later confirmed it was merged.

### Purpose

Turn the app from a tree navigator into a focused workspace.

### Product framing

> Explorer = where you find something.
>
> Canvas = where you work on it.

### Core model

Explicit Canvas root:

`CanvasRoot = project | node`

Canvas identity is separate from:

- selection;
- focus;
- Explorer expansion.

### Parent-rooting rule

Because roughly 72% of nodes were leaves, a leaf should not create a lonely single-card Canvas.

Instead:

- select container → Canvas root = selected container;
- select leaf → Canvas root = its parent;
- selected leaf is highlighted among siblings.

This keeps context useful.

### Deterministic layout

Hard rule:

> Same CanvasRoot → same layout to the pixel.

No:

- random positions;
- physics;
- viewport-dependent graph structure;
- selection-dependent geometry.

### Performance model

- one O(n) index over project data;
- local graph work based on root/fan-out;
- no need for virtualization or physics for the current 548-node data.

### React Flow

Adopted as Canvas infrastructure for:

- pan;
- zoom;
- nodes;
- edges;
- future editing/drag/connections.

### Two-way navigation

- Explorer selection updates Canvas;
- Canvas click updates selection and reveals Explorer path;
- project title returns to project root.

### Framing behavior

Fit view after navigation with stable rules.
Sibling leaf selection should not refit.

A robustness bug in framing was found and fixed by including deterministic graph geometry in framing identity.

### Pointer bug

React Flow card wrappers originally became non-clickable because nodes were neither selectable/draggable nor handled by React Flow.

Fixed by explicit pointer behavior.

### Background-throttling bug

Chromium measurement could wedge when the window was occluded/backgrounded.

The chosen fix:

`backgroundThrottling: false`

This was accepted because Canvas reliability matters more than idle power optimization at this stage.

### Explorer scrollbar

Scoped custom scrollbar and stable gutter.

### Deferred

- editing;
- save;
- drag/drop;
- deeper graph;
- relationships;
- manual positioning;
- accessibility-perfect ARIA tree keyboard navigation.

---

## Development Infrastructure Feature — Dynamic Desktop Isolation

**Status: Implemented and merged in PR #4**

This is not a numbered product milestone, but it became a critical development capability.

Known PR:

PR #4, “Dev tooling: dynamic development-workspace desktop routing”

The planning conversation later confirmed it was merged.

### Purpose

Allow Claude to run Electron UI verification without interrupting the user’s active desktop.

### Why it matters

The user wants to continue normal work while Claude:

- launches the app;
- performs UI tests;
- takes screenshots;
- interacts with Electron.

This removes a large friction from iteration speed.

Detailed infrastructure is documented in Section 13.

---

## Milestone 005 — Live Work Loop

**Status: Latest accepted product direction; planned, not yet implemented in the planning conversation**

Proposed branch:

`feature/live-work-loop`

Proposed milestone document:

`docs/milestones/005-live-work-loop.md`

### Product goal

> I can use Music Brain Studio as the only task/source-of-truth tool open during a real music session.

### Core loop

`Discover → Capture → Structure → Work → Complete → Continue tomorrow`

### Accepted scope direction

#### Canonical mutation layer

One mutation system for all UI entry points.

#### Add Child

From Explorer and Canvas.

#### Rename

Fast, preferably inline or low-friction.

#### Change Node Type

Allow understanding to evolve.

#### Move / Reparent

Safe move picker; no drag/drop required yet.

#### Basic Inspector

Only useful product fields.

#### Todo / In Progress / Done

Small fixed status model.

#### Functional checkbox

Use existing Canvas visual affordance.

#### Recursive progress/work-state summary

Prefer counts over dominant percentage.

#### Basic Bulk Add

One non-empty line = one child.

#### Save

Explicit Save / Ctrl+S.

#### Dirty state

Visible unsaved changes.

#### External conflict protection

Never blind-overwrite newer external changes.

#### Safe persistence

Prefer temp write + atomic replace.

#### Immediate UI synchronization

Explorer and Canvas should update in-memory before save.

#### Isolated writable test data

Claude’s isolated UI tests must use a disposable/test copy, not the real Music Brain.

### Explicit out-of-scope list

- Delete unless trivial and clearly safe;
- drag and drop;
- undo/redo;
- custom statuses;
- per-project configurable status sets;
- Kanban;
- dashboards;
- search;
- filters;
- Collapse All / Expand All;
- deep/infinite Canvas;
- alternate Canvas modes;
- manual graph positioning;
- editing `related` / `dependsOn`;
- database migration;
- full schema redesign;
- AI task generation;
- task-dependency visualization.

### Proposed implementation slices

The planning prompt suggested evaluating this order:

A. editable in-memory model + mutation layer  
B. status + functional checkbox  
C. Add Child + Rename  
D. Save + dirty state + conflict protection  
E. Inspector  
F. Move / Change Type  
G. recursive progress  
H. Bulk Add  
I. isolated writable test workspace + full end-to-end verification

The implementation agent was explicitly instructed to inspect code, write the design, and stop before implementing.

### Acceptance scenario

The milestone succeeds when the user can:

1. open a real project;
2. discover six new subtasks;
3. add them immediately;
4. realize the parent should be a Project rather than a Task;
5. change its type;
6. mark current work In Progress;
7. complete two tasks;
8. move one misplaced task;
9. see parent work-state aggregation update;
10. save;
11. close the app;
12. return the next day;
13. find everything exactly where it was left.

At that point the product stops being a read-only map and becomes a real working source of truth.

---

## Likely post-M005 feature areas

These were discussed as plausible next directions, not yet fixed milestone numbers.

### Rapid Capture improvements

**Status: Future / partially folded into M005**

Originally Bulk Add and keyboard-first capture could have become a later milestone.

Bulk Add was later pulled into M005 because it directly supports the user’s live workflow.

Future possibilities still include:

- Add sibling;
- duplicate;
- keyboard-first commands;
- lightweight templates.

### Find & Focus

**Status: Deferred**

Potential features:

- search;
- filters;
- Collapse All;
- Expand All;
- unfinished-only views;
- recent nodes;
- focus helpers.

### Deeper Canvas / alternate Canvas mode

**Status: Deferred**

Potential ability to expand branches in-place without abandoning current context.

No final interaction chosen.

### Relationships and dependency graph

**Status: Deferred**

The schema already has `related` and `dependsOn`, but they are not yet the primary Canvas edges.

### Configurable statuses / Notion-like customization

**Status: Explicitly deferred**

The user likes the idea of future project-level configurable status sets but does not want to build Notion.

### Database migration

**Status: Expected future architecture, not current roadmap item**

JSON is not expected to remain the only persistence solution forever.

SQLite or similar was considered a likely future direction.

---

# 12. Architecture and Technical Direction

# 12.1 Technology

**Status: Implemented**

- Electron;
- React;
- TypeScript;
- Tailwind;
- pnpm;
- React Flow (`@xyflow/react`) for Canvas.

Primary development environment:

- Windows;
- Git Bash;
- VS Code;
- Claude Code.

## 12.2 Main-process security boundary

**Status: Confirmed**

Renderer should not be allowed to write arbitrary filesystem paths.

Existing file-open architecture uses:

- main process;
- native picker;
- controlled IPC;
- limited preload API.

Writable persistence should preserve that model.

## 12.3 Current read pipeline

Broadly:

project JSON
→ adapter
→ Explorer node model
→ index
→ Canvas root selection
→ Canvas graph
→ layout
→ Canvas view model
→ React Flow

The exact code may have evolved, but the architectural separation is important.

## 12.4 Adapter boundary

**Status: Confirmed**

Persistence-specific fields should be isolated from generic UI as much as possible.

Explorer and Canvas should render product concepts, not raw JSON structure.

## 12.5 Mutation architecture for M005

**Status: Planned**

Desired flow:

UI action
→ mutation/domain layer
→ canonical editable in-memory project state
→ derived Explorer + Canvas models
→ persistence on Save

Rejected anti-pattern:

UI component
→ directly mutate nested JSON object
→ manually force UI refresh

## 12.6 Stable identity

**Status: Open design question**

Current read-only identity strategy was path-derived.

Writable move/reparent introduces pressure for a more stable identity.

The M005 design must explicitly settle:

- identity across move;
- identity across rename;
- new ID generation;
- interaction with duplicate existing raw IDs.

## 12.7 Canvas architecture constraints

**Status: Confirmed**

- CanvasRoot separate from selection;
- Explorer expansion separate from selection;
- parentage must not be derived by parsing opaque IDs;
- deterministic layout;
- focused/local graph;
- React Flow is an implementation adapter, not the domain model.

## 12.8 Progress computation

**Status: Planned / Open implementation detail**

Recursive descendant status aggregation should exist, but exact caching/incremental strategy was not decided.

The M005 design was asked to explain how to avoid recomputing the entire project unnecessarily on every card render.

---

# 13. Windows / Electron Development Infrastructure

This infrastructure was extensively discussed and implemented before M005.

## 13.1 Core requirement

**Status: Confirmed**

Automated Electron UI verification must not steal focus from the desktop where the user is working.

The user wants Claude to be able to:

- start Electron;
- test UI;
- interact with the app;
- run real window-level verification;

while the user continues working normally.

## 13.2 Two launch paths

**Status: Implemented and merged**

### User/manual path

`pnpm dev`

Behavior:

- disables routing first;
- launches normally;
- opens on the user’s current desktop;
- must not be affected by a stale isolation flag.

### Claude/agent path

`pnpm dev:isolated`

Behavior:

- bootstraps local routing tooling if needed;
- selects a safe target desktop;
- never intentionally targets the active desktop;
- launches Electron;
- routes it away from the user’s active workspace;
- fails safely rather than falling back to the active desktop.

Additional commands:

- `pnpm dev:isolation:setup`
- `pnpm dev:isolation:off`
- `pnpm dev:isolation:status`

## 13.3 Dynamic target selection

**Status: Implemented**

There is no permanent hardcoded Desktop 2 target.

Priority:

1. never the active desktop;
2. follow the Music Brain Studio VS Code workspace if that workspace is already on another desktop;
3. otherwise choose a safe inactive desktop.

Explicit override:

`MUSIC_BRAIN_DEV_DESKTOP_TARGET=<index>`

The override may intentionally target the active desktop because it is explicit.

## 13.4 VS Code discovery

**Status: Implemented**

The system was researched against real Windows behavior.

Important finding:

Windows on other virtual desktops may be DWM-cloaked while still technically visible to window enumeration.

The watcher therefore needs hidden/cloaked-window detection enabled.

The implemented discovery model:

Node side:

- use `process.cwd()` to derive workspace folder basename;
- walk process ancestry to locate the owning VS Code instance/main process.

Watcher side:

- enumerate VS Code windows;
- normalize title forms;
- filter by process;
- match the workspace root name;
- call VirtualDesktopAccessor to determine desktop index.

Known ambiguity:

Two VS Code windows with the same folder basename cannot be reliably distinguished using this method.

In that case the system should not guess. It falls back to a safe inactive desktop.

## 13.5 AutoHotkey v2 and VirtualDesktopAccessor

**Status: Implemented**

Machine tooling uses:

- AutoHotkey v2;
- `VirtualDesktopAccessor.dll`.

Canonical watcher source is version-controlled in the repo.

Known canonical path:

`scripts/windows/music-brain-dev.ahk`

Additional repository tooling includes:

- setup/bootstrap script;
- DLL verification script.

Runtime toolkit location:

`C:\Tools\music-brain-dev-desktop\`

State files:

`%LOCALAPPDATA%\music-brain-dev-desktop\`

## 13.6 Canonical source vs runtime copy

**Status: Implemented**

Repository copy is canonical.

Machine-local runtime copy is installed/synced by setup.

The DLL itself is not committed to Git.

If canonical watcher source changes while an older watcher process is running:

- setup syncs the new source;
- old watcher process is stopped;
- next isolated launch starts the new code.

This prevents an old in-memory watcher from handling a newer request/status protocol.

## 13.7 DLL bootstrap

**Status: Implemented**

`pnpm dev:isolation:setup` can prepare the machine-local toolkit.

Behavior discussed/implemented:

- verify Windows;
- verify AutoHotkey v2;
- create toolkit directory;
- sync watcher;
- detect Windows build;
- choose a compatible VirtualDesktopAccessor release;
- verify existing DLL using a real call;
- back up incompatible DLL;
- download correct DLL from official GitHub release metadata;
- verify downloaded DLL;
- keep only a small number of incompatible backups.

The setup is intended to be idempotent.

## 13.8 Why real DLL verification matters

**Status: Confirmed finding**

A mismatched VirtualDesktopAccessor DLL can:

- load successfully;
- expose expected exports;
- still return `-1` for actual desktop calls.

Therefore file existence is not sufficient.

Verification uses real calls such as:

- `GetDesktopCount()`;
- `GetCurrentDesktopNumber()`.

## 13.9 Windows release mapping

**Status: Implemented at time of discussion; must be revalidated if upstream changes**

The bootstrap encoded release mappings based on VirtualDesktopAccessor release notes.

Known mapping discussed:

- Windows 10 build `< 22000` → `2019-windows10`
- Windows 11 22621.2215+ → `2023-11-10-windows11`
- Windows 11 22631.2506+ → `2023-11-10-windows11`
- Windows 11 22631.3085+ → `2024-01-25-windows11`
- Windows 11 >= 26100.2605 → `2024-12-16-windows11`
- uncovered builds → abort rather than guess

Only Windows 10 19045 was exercised end-to-end on hardware during the conversation.

## 13.10 Desktop creation limitation

**Status: Known limitation**

The Windows 10 DLL used did not provide a safe no-focus-switch path for automatically creating a virtual desktop.

Therefore at least two virtual desktops may be required.

Windows 10 may forget virtual desktops across reboot.

If no safe inactive desktop exists, isolated launch should abort rather than use the active one.

## 13.11 Focus restoration

**Status: Implemented finding**

Moving a window to another desktop can leave it as the foreground window even though it is no longer visible, causing it to receive keystrokes.

The watcher therefore explicitly returns focus to a visible window on the user’s active desktop.

## 13.12 `ELECTRON_RUN_AS_NODE`

**Status: Implemented finding**

When launched from certain VS Code/extension environments, `ELECTRON_RUN_AS_NODE=1` may leak into the child and cause Electron to behave like plain Node.

The isolated launcher clears it for the child.

## 13.13 Desktop isolation vs test-data isolation

**Status: Critical distinction**

Desktop isolation is already implemented.

Test-data isolation is still required for writable editing.

Do not confuse them.

Desktop isolation protects the user’s **attention and focus**.

Test-data isolation protects the user’s **real Music Brain file**.

---

# 14. Testing and Validation Philosophy

## 14.1 Real behavior over synthetic confidence

**Status: Confirmed**

The project repeatedly found bugs that synthetic checks missed.

Examples:

- Canvas pointer events were broken even though synthetic click tests passed.
- React Flow measurement could wedge only under real rendering lifecycle conditions.
- wrong VirtualDesktopAccessor DLL could load and expose exports but fail real calls.
- focus could remain attached to a moved invisible window.

Therefore:

> Test the real interaction when the real environment matters.

## 14.2 Current validation expectations

Before a significant PR is considered done:

- typecheck;
- lint;
- build;
- formatting checks on touched files;
- realistic UI verification where relevant;
- self-review of diff;
- documented known limitations.

## 14.3 Milestone 005 acceptance verification

The design prompt required eventually testing:

1. open Ableton/Guitar Pro area;
2. add a child task;
3. bulk-add 5+ tasks;
4. rename;
5. change Task to Project/Area;
6. move a node;
7. mark one In Progress;
8. mark two Done;
9. verify recursive progress;
10. save;
11. close/reopen;
12. verify persistence;
13. simulate external file modification;
14. verify stale instance refuses overwrite;
15. run isolated Claude UI test while user instance exists;
16. verify isolated instance does not modify real Music Brain.

## 14.4 Real Music Brain vs destructive test copy

**Status: Confirmed direction**

Use the real structure for realism, but not the real writable file for automated mutation tests.

The isolated test workspace should be disposable or temporary.

---

# 15. Collaboration Model: Human, ChatGPT, and Claude Code

## 15.1 Human product owner

**Status: Confirmed workflow**

The human user:

- owns product decisions;
- decides whether a direction feels useful in real creative work;
- reviews milestone designs;
- tests whether the UX matches actual music sessions;
- decides what to merge;
- prioritizes usability over theoretical architecture purity.

## 15.2 ChatGPT

**Status: Established role**

ChatGPT acts as:

- product partner;
- roadmap planner;
- architecture reviewer;
- UX reasoning partner;
- PR reviewer;
- prompt writer for Claude Code;
- historian of product intent.

Typical behavior:

- turn user intent into a concrete milestone;
- identify what belongs together vs should be deferred;
- produce copy/paste-ready prompts;
- review Claude’s implementation summary/PR;
- catch architectural or product risks;
- recommend approve/request-changes;
- avoid doing implementation work that belongs to Claude Code unless explicitly asked.

## 15.3 Claude Code

**Status: Established role**

Claude Code acts as:

- implementation agent;
- repository researcher;
- coding agent;
- local Windows/Electron tester;
- UI verification agent;
- Git/PR executor when instructed.

The desired process:

1. receive a scoped prompt;
2. create branch;
3. inspect current architecture;
4. write short milestone design;
5. stop for review when instructed;
6. implement in logical commits;
7. test;
8. self-review;
9. open/update PR;
10. do not merge unless told.

## 15.4 Why the roles are separated

The split is intentional:

- the human protects actual workflow needs;
- ChatGPT protects product coherence and continuity;
- Claude Code optimizes implementation velocity.

This reduces the chance that an implementation convenience silently becomes a product decision.

---

# 16. GitHub and Delivery Workflow

## 16.1 Branch-per-feature/milestone

**Status: Confirmed**

Every feature/milestone should start on its own branch unless explicitly told otherwise.

Examples:

- `feature/open-and-display-project`
- `feature/music-brain-explorer-ui`
- `feature/canvas-view`
- `feature/dev-desktop-isolation`
- planned: `feature/live-work-loop`

## 16.2 Design before implementation

**Status: Confirmed**

Especially for milestones:

- write/update `docs/milestones/<nnn>-...md`;
- keep design practical;
- stop for human review when requested;
- do not spend days over-researching when architecture is already established.

From Milestone 005 onward the user explicitly wanted:

> short design, no two-day research phase; spend the budget on building.

## 16.3 Small commits on feature branch

**Status: Confirmed**

Implementation history can be granular on the branch.

## 16.4 Squash merge to main

**Status: Confirmed**

`main` should represent product milestones, not every implementation micro-step.

Feature branches may contain many commits, but merge via Squash Merge.

## 16.5 PR review before merge

**Status: Confirmed**

The user values review checkpoints.

ChatGPT repeatedly reviewed PRs and identified blockers before recommending merge.

## 16.6 Known merged work

From the planning history:

- PR #1 — Open and Display Project — merged.
- PR #2 — Music Brain Explorer UI — merged.
- PR #3 — Canvas View — merged.
- PR #4 — dynamic development-workspace desktop routing — merged.

Exact current Git state should still be verified in the repository.

---

# 17. Decision History

## 17.1 Explorer-only app → Explorer + Canvas

Earlier direction:

Explorer as the main application surface.

Later direction:

Canvas is the primary workspace, Explorer is navigation.

**Later statement supersedes earlier framing.**

## 17.2 Fixed Desktop 2 → dynamic safe desktop

Earlier development-infrastructure idea:

Always route Claude’s Electron to Desktop 2.

Problem:

If the user happens to work on Desktop 2, isolation fails.

Later direction:

- follow the project’s VS Code desktop if safely inactive;
- otherwise choose another inactive desktop;
- never intentionally target the active desktop.

**Later direction supersedes fixed Desktop 2.**

## 17.3 “Edit + Save” milestone → broader Live Work Loop

Earlier M005 idea:

Edit node via Inspector + Save.

User clarified that adding new tasks is equally or more important because the app cannot become a trusted source of truth unless newly discovered work can be captured.

Later accepted direction:

Milestone 005 = **Live Work Loop**, including creation, restructuring, status, progress, save, and bulk capture.

**Later direction supersedes narrow Edit + Save framing.**

## 17.4 Bulk Add later → Bulk Add in M005

Earlier idea:

Bulk Add could be a later “Rapid Capture” milestone.

User clarified it is core to how work expands during real sessions.

Later decision:

Include a basic multiline Bulk Add in M005.

## 17.5 Deep Canvas expansion now → defer

Idea:

Keep broader Canvas visible and expand clicked branches in place.

Concern:

This may destroy the focus advantage of the local Canvas.

Current decision:

Keep focused Canvas for M005.
Revisit expanded/deep Canvas later, possibly as another mode.

## 17.6 Percentage as progress → counts-first

Idea:

Show completion percentage recursively.

Concern:

Discovering tasks makes the percentage drop, incorrectly signaling regression.

Current direction:

Use work-state counts first.
Treat discovery as progress.
Do not make percentage the dominant signal.

## 17.7 Direct JSON editing → mutation/domain layer

Rejected architecture:

UI components mutate nested JSON directly.

Accepted architecture:

One mutation layer feeding a canonical editable model, with persistence separated.

## 17.8 Autosave now → explicit Save first

Current direction:

Use dirty state and Ctrl+S first.

Autosave may come later.

---

# 18. Rejected and Deferred Ideas

## Rejected / actively avoided

### Generic task-manager expansion

Do not turn the product into Notion/ClickUp.

### Blind direct JSON mutation in components

Architecturally rejected.

### Hardcoded Desktop 2 isolation

Superseded by dynamic safe routing.

### Silent fallback to active desktop

Rejected.

### Guessing DLL compatibility

Rejected.

### Blind overwrite on save

Rejected.

### Dominant percentage progress

Not fully banned, but rejected as the primary progress signal for current product psychology.

## Deferred

- search;
- filters;
- Collapse All / Expand All;
- Delete semantics;
- drag/drop;
- undo/redo;
- custom statuses;
- project-configured status sets;
- Kanban;
- dashboards;
- deep/infinite Canvas;
- alternate Canvas modes;
- manual graph layout;
- related/dependency editing;
- dependency visualization;
- full schema redesign;
- database migration;
- AI task generation;
- path-exact workspace identity;
- perfect ARIA tree keyboard support;
- broader open-source generalization;
- artist-history intelligence.

---

# 19. Latest Known State

**Status: Latest state from the planning conversation**

## 19.1 Development infrastructure

PR #4 was merged.

The repository has a mature Windows development-isolation workflow that lets Claude launch/test Electron without taking over the user’s active desktop.

## 19.2 Product state

Implemented:

- Electron/React foundation;
- project loading;
- real Music Brain auto-load;
- Explorer;
- Canvas;
- two-way navigation;
- focused local Canvas;
- deterministic layout;
- read-only interaction;
- development UI-test isolation.

Not yet implemented in the planning conversation:

- writable mutation layer;
- Add child;
- rename;
- move/reparent;
- Change type;
- status mutations;
- progress aggregation;
- save;
- dirty state;
- conflict detection;
- Bulk Add;
- Inspector;
- isolated mutation-test data.

## 19.3 Latest accepted next milestone

**Milestone 005 — Live Work Loop**

Planned branch:

`feature/live-work-loop`

Planned design document:

`docs/milestones/005-live-work-loop.md`

The next implementation agent should first inspect the current code, write/update that milestone design, self-review it against the repository, and stop for product review before implementation if that has not already happened.

---

# 20. Open Questions and Risks

# 20.1 Stable identity under move/reparent

**Status: Open technical question**

Path-derived identity may not survive moves.

Need a durable strategy.

## 20.2 Duplicate raw IDs

**Status: Known risk**

Existing duplicate raw IDs mean the system cannot simply assume the current `id` field is unique.

Must be addressed before using raw IDs as universal stable identity.

## 20.3 Canonical editable in-memory model

**Status: Open M005 design question**

Need to decide what object/model is the authoritative in-memory state after edits.

## 20.4 Persistence round-trip behavior

**Status: Open**

Need to verify:

- unknown field preservation;
- array/order preservation;
- formatting/line-ending behavior;
- non-destructive writes.

## 20.5 Conflict detection mechanism

**Status: Open implementation detail**

mtime, hash, or both.

## 20.6 Move semantics for current selection/CanvasRoot

**Status: Open UX question**

If the selected/root node moves, the UI should remain deterministic and understandable.

Exact rule not yet finalized.

## 20.7 Status persistence representation

**Status: Open M005 design detail**

The UI model `todo / in_progress / done` is accepted, but exact mapping into existing JSON status values should be reviewed against real data.

## 20.8 Progress aggregation performance

**Status: Open implementation detail**

Need a practical recursive aggregation strategy.

No need for premature complexity, but avoid expensive full-project recomputation on every render if unnecessary.

## 20.9 Expanded Canvas

**Status: Deferred product question**

Need later real-use evidence to determine whether local focus + recursive progress is enough, or whether branch expansion is necessary.

## 20.10 Open-source onboarding

**Status: Future**

Desktop-isolation bootstrap already moved toward reproducible open-source-friendly tooling, but the product itself is still optimized for the user first.

---

# 21. Guidance for the Next Agent

1. **Do not treat this as a generic task manager.**  
   The product exists to support active music-making and evolving understanding.

2. **Do not optimize the JSON at the expense of workflow.**  
   JSON is persistence, not the product model.

3. **Do not assume hierarchy is fixed.**  
   Discovery changes structure.

4. **Do not punish discovery.**  
   More known tasks can mean more progress.

5. **Do not replace the focused Canvas casually.**  
   Its local scope is intentional.

6. **Do not couple UI components directly to JSON structure.**  
   Build/use the mutation layer.

7. **Do not let automated UI tests touch the real writable Music Brain.**  
   Desktop isolation is not data isolation.

8. **Do not blind-overwrite external changes.**

9. **Keep capture fast.**  
   Right-click actions, inline rename, bulk add, simple statuses.

10. **Prefer vertical slices that become usable quickly.**  
    The product owner is willing to refactor later.

11. **Use short design checkpoints, then build.**  
    Avoid architecture theater.

12. **Preserve Git discipline.**  
    Feature branch, milestone doc, logical commits, PR review, squash merge.

13. **Treat real UI/environment bugs as real requirements.**  
    Synthetic tests alone have repeatedly been insufficient.

14. **Keep human workflow as the ultimate acceptance test.**  
    A technically elegant milestone that does not make an actual music session easier is not successful.

---

# 22. Confidence and Missing Information

## High-confidence areas

The following are strongly established by repeated planning/implementation discussion:

- single-source-of-truth goal;
- Explorer/Canvas split;
- Canvas as primary workspace;
- local focused Canvas;
- Live Work Loop as next major product direction;
- Todo / In Progress / Done initial status model;
- Add/Rename/Move/Retype/Bulk Add importance;
- explicit save + conflict protection;
- test-data isolation requirement;
- development desktop isolation workflow;
- branch/design/review/squash workflow;
- “Discovery is progress” principle.

## Medium-confidence areas

These were discussed clearly but still depend on M005 design implementation:

- exact mutation API;
- exact Inspector fields;
- exact checkbox interaction;
- exact recursive progress presentation;
- exact save mechanism;
- exact revision signal.

## Unknown / must be recovered from repository or later history

- whether Milestone 005 design or implementation was completed after this conversation;
- current exact file structure after later commits;
- current CI status;
- exact serializer behavior if write support has since been implemented;
- whether raw ID duplication was resolved;
- whether identity was migrated away from JSON Pointer;
- whether new milestone numbers were assigned to search/deep Canvas/etc.;
- whether project file formatting preservation guarantees were added;
- whether open-source support advanced further.

---

# 23. Glossary

## Music Brain

The structured body of musical work, knowledge, projects, tasks, decisions, ideas, resources, and future actions represented in the product.

## Music Brain Studio

The Electron desktop application that navigates and eventually edits the Music Brain.

## Explorer

Left-side hierarchical navigation tree used to find nodes.

## Canvas

Primary visual workspace showing a focused local graph around a CanvasRoot.

## CanvasRoot

Explicit identity of the currently displayed Canvas workspace, separate from focus/selection.

## Parent-rooting

Rule where selecting a leaf shows its parent and siblings rather than a lonely single-node Canvas.

## Mutation layer

Planned application/domain layer through which creation, updates, moves, type changes, and status changes should flow.

## Live Work Loop

Accepted Milestone 005 concept:

`Discover → Capture → Structure → Work → Complete → Continue tomorrow`

## Discovery is progress

Product principle that finding more necessary work reduces uncertainty and should not be framed as failure.

## Work state

Initial planned status set:

- Todo;
- In Progress;
- Done.

## Bulk Add

Planned fast capture tool where one non-empty line creates one child node under a chosen/current parent.

## Dirty state

UI indication that in-memory changes have not yet been saved.

## Conflict protection

Requirement to refuse silent save when the underlying file changed externally after load.

## Desktop isolation

Windows development tooling that moves Claude’s Electron test window away from the user’s active desktop.

## Test-data isolation

Separate future requirement ensuring automated mutation tests use a disposable copy of the Music Brain rather than the user’s real writable source of truth.

## Canonical watcher

Repository-controlled AutoHotkey source used for dynamic Windows virtual-desktop routing.

## Focused Canvas

Current product model in which the Canvas shows a local context rather than continuously expanding the entire graph.

---

# Final Product Reminder

The central purpose of Music Brain Studio is not to maximize the number of features or to reproduce an existing productivity product.

It should make this experience possible:

> A musician starts real work, discovers more work while doing it, captures it without breaking flow, restructures the map as understanding improves, marks what is active and complete, trusts that nothing will be lost, and returns tomorrow knowing exactly where to continue.

Everything else should be judged against that standard.
