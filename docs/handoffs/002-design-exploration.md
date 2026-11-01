# 002 — Design exploration 01: findability, progress and trust

**Written:** 2026-11-01, on branch `design/interaction-model-exploration`, from `a27678a`
(`main` is `89e5a60`, the M005 squash merge).
**Status:** **proposal awaiting design review. No decision on this page is approved yet.**
The decisions log at the end is empty on purpose and is filled in only after review.
**Mockups:** [Music Brain Studio — Design Exploration 01](https://claude.ai/artifact/TEhAs4i1tZ9fKkRhGTUJQk)
(a private Claude Design canvas; 16 artboards in three rows).

Inputs: [`000`](000-product-vision-and-roadmap-history.md),
[`001`](001-design-and-next-direction.md) and
[`../validation/005-live-work-loop-final-acceptance.md`](../validation/005-live-work-loop-final-acceptance.md).
M005 is accepted **as the editing foundation only**. The M005 reopen step was verified by an agent, not by
the product owner. Nothing here changes either fact.

---

## 1. Existing behaviour (verified)

Verified from source at `89e5a60` and from the M005 measurements. The application was **not** opened this
session: `pnpm dev:isolated` refused to launch because `GetCurrentDesktopNumber` returned −1, so no
safe desktop could be identified. Isolation was not overridden. Artboard 0.1 is a redraw from source,
not a screenshot.

**Move search** (`MoveDialog.tsx`), measured by replaying its exact filter against the real 548-node file:

- **Case-insensitive.** Both sides are lower-cased. `guitar`, `Guitar` and `GUITAR` return identical
  results, so the case-sensitivity suspicion is **not** the cause.
- **Ancestry matching is the cause.** A row matches if its title **or its joined ancestor path**
  contains the query. `guitar` returns 138 rows, and **102 (74%) match only because an ancestor's name
  contains the word**. `template` returns 129 rows with 7 title hits. `ableton` returns 204 rows with 3
  title hits, **silently cut to 200**.
- The query is one contiguous substring, so `rhythm guitar` finds 64 rows and `guitar rhythm` finds 0.
- Rows appear in tree order, not by relevance. Nothing shows _why_ a row matched, and the matching
  ancestor is often truncated off the path line.
- The type is displayed but cannot be searched. All 397 tasks are offered as destinations alongside
  the containers.

**Creation.** Add selects the new node, and the Explorer expands its ancestors and scrolls to it. The
only cue is the selection tint. A new container opens to a lone card with no next step. The header
**Add** files into whatever is selected (`parentId: selectedId`). With a task selected, the new item
becomes that task's child and the Canvas re-roots at the task. This was traced in code, not observed.

**Status and completion.** _In progress_ is drawn as a checkbox with a dash, which reads as
indeterminate. Leaf cards say only "Task". The Explorer badge shows one number, disappears when the row
is expanded, and turns into **✓** when all known work is done. That derived tick is the only "finished"
signal: `domain`, `area` and `project` have `showsStatus: false`, so a project cannot be finished
explicitly.

**Node types.** 17 are registered: 13 from the schema plus `goal`, `idea`, `reference` and
`inspiration`. The real file uses 4 (domain 13, area 99, project 39, task 397). Behaviour already
differs only through `showsStatus`, and the type picker lists the 4 common types first.

**Packaging.** The handoff 001 finding is confirmed. `electron-builder.yml` ships `data/` as
`extraResources`, and `defaultProjectPath()` resolves to `process.resourcesPath` when packaged. An
installed build would therefore open its own bundled snapshot, save into the installation folder, and
lose those saves on the next update. Nothing reads `app.getPath('userData')` today.

## 2. Confirmed needs (product owner, 31 Oct)

1. Reveal and select a new container, and communicate the creation clearly.
2. An empty container shows a visible _Add first task_.
3. Context stays stable while tasks are added or completed.
4. An explicit complete-branch action shows its descendant scope and can be recovered.
5. "All known children done" is distinct from "project finished".
6. Move results show type, name and ancestry, and make the reason for each match clear.
7. Status is expressed by colour, icon **and** text.
8. Multi-selection with bulk actions. The gesture is still open.
9. Better Canvas framing and readable density.
10. A clear return-to-work view, where completed work stays visible despite new scope.

## 3. Hypotheses (not confirmed by the owner)

- Search, undo, safe delete, creation feedback, branch recovery and resume can all hang off **one
  change journal** instead of five mechanisms.
- A **tally** (one mark per known task, where done marks never vanish and new marks are flagged)
  communicates "discovery is progress" better than counts alone.
- Most node types need no unique behaviour: three **roles** (container, work, reference) are enough.
- Hiding path-only matches by default, while saying how many were hidden, removes the move-search
  confusion without losing anything.

## 4. Shared model (artboard 0.2, used by both directions)

- **Status:** To do (hollow ring), In progress (half-filled, blue, always labelled), Done (filled
  tick, green). These differ in shape and lightness as well as hue.
- **"Nothing open right now"** is derived and neutral. **"Finished"** is declared by the user and
  dated. Adding work to a finished container offers to reopen it.
- **Roles:** Containers (Domain, Area, Project), Work (Task, Checklist, Experiment, Goal), Reference
  (the other 10). No type is removed. Pickers lead with the common 4.
- **Search:** keeps case-insensitivity. Every word must match, in any order. Ranking: title exact,
  starts-with, word-start, contains, with the current project first. Path-only matches are collapsed
  with a count. There is no silent cap.
- **History:** every mutation is a journal entry, which gives Undo/Redo, toasts, undoable delete,
  per-item restore after a bulk completion, and the resume recap.
- **Storage:** the knowledge base stays wherever the user keeps it (suggested default
  `Documents\Music Brain Studio`). App state (recent files, last place, last-session time) goes in
  `%APPDATA%`. **Never** in the installation folder.
- **Future, accommodated but not designed:** implemented-vs-verified as a second, opt-in axis;
  attachments with a media type separate from node type; plan import with preview and duplicate
  protection; context export.

## 5. The two directions

The same Insaint sample content appears in both. Both use the shared model above.

**A — Focused Canvas, made legible** (artboards A1–A7). Keeps Explorer | Canvas and one root plus its
children. The root becomes a docked **context card** holding the tally, counts, lifecycle and primary
actions. Children sit in one frame that wraps into columns instead of overflowing. Adding happens
inline in that frame, so the Canvas never moves. Ctrl/Shift-click selects several items and brings up
a bulk bar. Feedback comes as toasts with Undo. Go to and Move are modal and grouped by scope. Branch
completion uses a dialog that lists exactly what changes. The app reopens at the last place with a
one-time recap strip.

**B — Branch board + session journal** (B1–B5b). Launch opens a **Resume** view. The Canvas becomes a
board: a root header band with child **lanes**, each listing its own contents, so two levels are
visible at once. A persistent **journal panel** replaces toasts and carries per-entry Undo/Restore. A
**command bar** handles Go to, Move and actions, grouping results by role ("Containers" vs "Tasks —
becomes a subtask"). Branch completion is previewed in place on the lane.

|                                           | A                                            | B                                                     |
| ----------------------------------------- | -------------------------------------------- | ----------------------------------------------------- |
| Keeps the valued node-link Canvas         | yes                                          | no: lanes replace it, though rooting stays contextual |
| Two levels visible                        | peeks only (next 2 items per child)          | yes                                                   |
| Scales to Ableton (7 children, 154 tasks) | yes: frame wraps, children summarised        | weaker: very long lanes                               |
| Return to work                            | recap strip at the last place                | dedicated Resume view                                 |
| Feedback and recovery                     | toast + Undo; history behind the Undo button | always-visible journal                                |
| Data it needs                             | timestamps on nodes; last place in app data  | the same **plus a persisted activity log**            |
| Build cost                                | incremental on the existing Canvas           | layout rewrite plus new panels                        |

## 6. Recommendation

**Direction A**, keeping B's role grouping in move results ("becomes a subtask") and B's Resume
content as the source for A's recap.

Reasons: A preserves the contextual Canvas the owner called a strength. Its slices each ship
independently on the real file. It scales to the large domains. It needs no persisted activity log.
B is the stronger answer for a single board-shaped project like Insaint and for keyboard-first work.
If the review prefers B's two-level view, it can be added later as a second Canvas mode, as 000 §8.4
already anticipates.

## 7. Proposed implementation slices (after approval only)

Each slice is independently useful on the 548-node file.

1. **Status and progress legibility:** new glyphs and chips, counts that persist on expanded rows,
   no derived ✓, tally on the root card.
2. **Canvas framing and capture:** docked context card, a wrapping child frame, an empty-container
   state, inline add without re-rooting, and the header Add retargeted to the Canvas root.
3. **One search engine:** Go to (Ctrl+K) plus a rebuilt Move dialog, with a tested shared matcher.
4. **Journal:** Undo/Redo, creation and completion toasts, undoable delete.
5. **Complete branch, explicit Finished, multi-select** with a bulk bar.
6. **Return to work:** last place in app data, `createdAt`/`completedAt` on nodes, the recap strip.
7. **Workspace and opening:** start screen, recent files, user-data locations. This is a prerequisite
   for any packaged release and can run in parallel with 1–6.

## 8. Decisions needed from the product owner

1. Direction A, B, or A with named B elements.
2. May `createdAt` / `completedAt` be written into the knowledge base file? (The codec already
   round-trips unknown fields.) B would also need a persisted activity log.
3. Which container types can be **Finished** (Project only, or Area too?), and how it is stored.
4. Should tasks remain move destinations, making the moved item a subtask? Proposed: yes, grouped
   separately.
5. Multi-select gesture: Ctrl/Shift-click (proposed) or an explicit selection mode. Rectangle
   selection is deferred.
6. Delete: undoable within the session only (proposed), or a persistent trash.

## 9. Decisions log

_Empty until the design review._
