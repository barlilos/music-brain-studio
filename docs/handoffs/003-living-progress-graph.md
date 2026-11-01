# 003 — Design exploration 02: Living Progress Graph

**Written:** 2026-11-01, on branch `design/living-progress-graph`, from `0ebc367` (handoff 002).
**Status:** **proposal awaiting design review. No decision on this page is approved yet.**
**Mockups:** [Music Brain Studio — Design Exploration 02: Living Progress Graph](https://claude.ai/artifact/64WK348xfxvov7cyD9HNAo)
(a private Claude Design canvas; 18 artboards in five rows).

Inputs: [`000`](000-product-vision-and-roadmap-history.md), [`001`](001-design-and-next-direction.md),
[`002`](002-design-exploration.md) and
[`../validation/005-live-work-loop-final-acceptance.md`](../validation/005-live-work-loop-final-acceptance.md).
M005 is still accepted **as the editing foundation only**. Nothing in this exploration changes that.

---

## 1. Why a second exploration

The product owner rejected both directions in 002 as the primary visual direction. Both read as a
conventional task manager: Direction A was a canvas of cards, Direction B a Kanban-style board.

Music Brain Studio should instead be **a living graphical representation of evolving creative work,
with real task management embedded inside it**. The guiding principle is **discovery is progress**.
The success test is simple: you look at the graph and feel the progress you have made before reading
any list.

**Carried over from 002 unchanged:** status semantics, the split between _nothing open right now_
(derived) and _Finished_ (declared), the search model, the single change journal, the storage
locations, and the move-search findings. **Dropped:** 002's card and lane visual language.

## 2. Data on the boards

- **Insaint** uses an illustrative sample built around the 8 real tasks from the 31 Oct walkthrough.
  It has 6 branches and 39 known tasks. The misfiled "Decide stage outfits" is kept, so the edit boards
  have a real move to show.
- The same four stages appear in every experiment:

  | Stage | Done | Known | New | Recording branch                               |
  | ----- | ---- | ----- | --- | ---------------------------------------------- |
  | 1     | 5    | 39    | —   | —                                              |
  | 2     | 17   | 39    | —   | —                                              |
  | 3     | 18   | 46    | 7   | —                                              |
  | 4     | —    | —     | —   | Nothing open; Vocal tracking declared Finished |

- **Whole-brain boards** (A0, C1) use the real structure: 558 nodes, all ids unique. Statuses outside
  Insaint are **illustrative**, because every task outside Insaint is To do in the real file today.
  Both boards say so on the artboard.
- The real file was read only, from the disposable copy. Its hash was unchanged at the end of the
  session.

## 3. Shared visual grammar (artboard G1)

**Dark, calm ground. One family of marks at every scale.**

- **To do:** a hollow ring.
- **In progress:** half filled, blue.
- **Done:** filled green with a tick.
- **New:** a dashed amber ring around any state. It marks work added since you last looked, and
  clears once you have seen it.

States differ in **shape and lightness as well as hue**. The colours were run through the dataviz
validator on the dark ground:

- all pairs pass colour-blind separation (ΔE ≥ 8);
- green and amber are closest under tritan vision (ΔE 6.0), so New also differs by its dashed ring;
- all marks are at least 3:1 against the ground.

**Branch and project states:**

- **Open:** neutral outline.
- **Nothing open right now:** green outline. The app works this out, and it reverts as soon as work is
  added.
- **Finished:** filled and sealed, with a date. The user declares it. A parent never finishes itself.

**Rules:**

- Progress is _counted_: one mark per known task, never a percentage or a score.
- Discovery adds marks and never removes green.
- Words appear only when there is room, or when the user points at something.

## 4. The three experiments

All three use the same data and stages. They differ in **interaction behaviour**, not only styling.

### A — Bubble Constellation (A0–A4)

- **Levels:** explicit. Brain map → project → branch → project. Clicking a bubble re-roots on it, Esc
  goes up a level, and siblings stay visible as a trail.
- **Progress:** each container is a bubble of task seeds, sorted by status. Done seeds gather at the
  centre as a **green heart**. New seeds land on the rim, and the bubble grows.
- **Editing:** a seed card beside the selected seed covers name, status, type, move-with-search, notes
  and add subtask. Capture works by typing one task per line into the open bubble.
- **Strongest at:** the emotional read. Completed regions are unmistakable, at every level including
  the dense brain map.
- **Costs:**
  - Task names need room, so they appear only on hover or at the deepest level.
  - A seed moves when its status changes. You remember regions, not positions.
  - Editing is one step removed from the graph.

### B — Hybrid graph and detailed nodes (B1–B4)

- **Levels:** focus and context. Clicking a bubble **unfolds it in place** into a working node with
  rows. Sibling branches stay as bubbles around the project.
- **Progress:** one bead per task on a spiral with fixed spacing, done first from twelve o'clock. A
  green run **never shrinks**; discovery lengthens the tail.
- **Editing:** inline rows (hover actions, rename, status) plus an Inspector for type, move, notes and
  subtasks. _Add several_ lives inside the node. Rows keep the user's order, so tasks never jump.
- **Strongest at:** doing the work. It is closest to M005 and needs the least new interaction.
- **Costs:**
  - Only one level is open at a time.
  - Spirals are a quieter signal than A's green hearts.
  - The unfolded node is a large rectangle.

### C — Semantic zoom canvas (C1–C5)

- **Levels:** none. One continuous radial map of the whole brain. You zoom and pan, and nothing
  re-roots.
- **Layout:** every task has a fixed place on the outer ring, in its own order.
- **Detail by zoom:**
  - territories, as status ticks (about 17%);
  - branch names and task dots (about 42%);
  - every task labelled (80%);
  - editable pills (150%).

  Ancestors pin to the top edge when they scroll away.

- **Strongest at:** the whole brain in one picture, and spatial memory.
- **Costs:**
  - Horizontal labels only work on the left and right of the ring; the top and bottom need rotated
    text.
  - Inserting work shifts neighbours unless each branch reserves slack.
  - Branch nodes crowd near the centre, so labels must change form between zoom bands.
  - Moving a task to a far branch still needs search.

## 5. Semantic zoom versus explicit focus

Continuous semantic zoom is **not automatically better**.

**Performance is not the problem.** About 560 nodes is small, and drawing them as SVG or React Flow
nodes is cheap.

**These are the problems:**

- **Readability.** In C, the useful label positions depend on where a branch falls on the ring.
- **Predictability.** The same gesture shows different things at different zooms, and C needs four
  label regimes.
- **Stability.** Discovery changes geometry, and so does every new task.

Explicit levels (A, B) keep the contextual-Canvas benefit the owner values: focus on one branch while
the rest stays visible as context.

**Recommended rule:** explicit levels, plus a light, two-step zoom dependency inside a level.

- Bubbles show names when they are big enough.
- An unfolded node shows rows.

Continuous zoom can return later as an overview mode.

## 6. Comparison

Judgements from the mockups, not measurements.

|                           | A Constellation                    | B Hybrid                   | C Semantic zoom                          |
| ------------------------- | ---------------------------------- | -------------------------- | ---------------------------------------- |
| Visual clarity            | strong at a glance; weak for names | strong when unfolded       | strong overview; uneven labels           |
| Felt progress             | **strongest** (green hearts)       | good (green runs)          | good overall; scattered inside a branch  |
| Hierarchy comprehension   | strong (nesting)                   | medium (one level open)    | strong (whole tree)                      |
| Navigating large projects | good (re-root plus trail)          | good                       | good for overview; fiddly when deep      |
| Doing actual work         | medium (card beside a seed)        | **strongest** (rows)       | medium (exact zoom needed)               |
| Scaling to ~560 nodes     | good (A0 fits at 1:1)              | good (one level at a time) | good to draw; label and insert problems  |
| Fit with M005 editing     | medium                             | **strongest**              | weakest                                  |
| Complexity and risk       | medium: packing and sort animation | **lowest**                 | **highest**: layout, zoom levels, labels |

## 7. Recommendation

### Product recommendation

Adopt the **combination on artboard R1**:

- **B's interaction:** unfold in place, with rows for doing the work.
- **A's seed bubbles:** these draw unfocused branches, the project, and the brain map (A0). Unfolded
  nodes carry a small seed pod in their header, so the green heart stays visible while working.
- **From C:** keep the minimap and pinned ancestors. Defer continuous zoom.

This combination uses the strongest progress signal for _seeing_ and the strongest work surface for
_doing_. It also keeps the existing editing components.

### Visual hypotheses to validate in review

- A green heart reads as "progress I made", and is not mistaken for a percentage.
- Amber "new" rings read as healthy discovery, not as a warning.
- Seeds moving to the centre on completion feel rewarding rather than disorienting, given that rows
  in the unfolded node keep a fixed order.
- A dark ground suits long sessions.

### Technical feasibility

- **No new dependencies.** `@xyflow/react` is already used. It supports custom SVG nodes, nodes that
  change size (unfold), and reading the zoom level for small detail changes.
- **Layouts must be deterministic, with no force simulation**, so positions are stable between
  sessions. The mockups' circle packing, seed spiral and bead spiral are each a few dozen lines of
  arithmetic.
- **Data:**
  - _Nothing open right now_ is derived from the tree.
  - _Finished_ needs a stored field (002 decision 3).
  - _New since you last looked_ needs a last-seen marker per branch. The proposal is to keep it in app
    data (`%APPDATA%`), not in the knowledge base.
  - None of this needs a database.
- **C would additionally need:** a radial layout over the whole tree, slack reservation per branch, and
  four label regimes. That is the main reason it is not recommended first.

## 8. Composite views (artboard X1, Future)

The example is **April Show**: a saved _view_ over existing branches.

- It gathers Insaint, Practice › Guitar, Quad Cortex › Song Presets and Live Performance › Set
  Preparation.
- **It is not a container.** Nothing is copied: deleting the view leaves every branch unchanged.
- **Identity.** The view stores node ids. A task reached through two included branches still counts
  once, by id.
- **Completion.** Completing a task in the view writes to the same node in its home branch.
- **Prerequisite met.** Ids are already unique in the real file (558 of 558).
- **Possible duplicates.** For example "Service and restring guitars" and "Prepare guitars". These are
  shown as suggestions to link or ignore, and are never merged automatically.
- **Open question.** Where view definitions live: in the knowledge base or in app data.

## 9. Decisions needed from the product owner

1. **Direction:** the R1 combination, or one experiment on its own.
2. **Seed movement (A):** may a seed move to the green heart when it is completed (animated)? Or must
   every task keep a fixed place in every view?
3. **Brain map:** bubbles (A0) or the radial ring (C1)?
4. **"New since you last looked":** is it cleared by opening the branch, or by an explicit "seen"? Is
   it stored in app data (proposed)?
5. **Explorer:** keep it as a drawer on the left rail (proposed), or keep it visible by default?
6. **Theme:** dark by default, as in all the mockups, with light later? Or both from the start?
7. **Finished:** carried over from 002 decision 3. Which container types can be Finished, and how it is
   stored.
8. **Composite views:** when, and where their definitions are stored.

## 10. Decisions log

- **2026-11-01 (product owner):** 002 Directions A and B are rejected as the primary visual direction.
  Their functional findings are kept (see §1).
- _Further entries after the design review._
