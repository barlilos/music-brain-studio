# 001 — Design and next direction

**Written:** 2026-10-31, immediately after milestone 005 was accepted and merged
(`89e5a60`).
**For:** a separate design conversation, before any further feature work.
**Status:** a brief and a set of hypotheses. **Nothing here is approved scope**, and
deliberately no milestone numbers are assigned — sequencing is an outcome of the design
conversation, not an input to it.

Companion documents: [`000-product-vision-and-roadmap-history.md`](000-product-vision-and-roadmap-history.md)
for how the product got here, and
[`../validation/005-live-work-loop-final-acceptance.md`](../validation/005-live-work-loop-final-acceptance.md)
for exactly what was verified and accepted.

---

## 1. The product purpose this design must serve

> **Discovering more work must not erase the visibility of work already completed.**

This is the psychological core of Music Brain Studio, not a presentational preference. A
musician who breaks "Mix the record" into six real subtasks has just become _better
informed_, and every tool that answers with a percentage dropping from 80% to 40% teaches
them to stop looking closely. The application already refuses the dominant-percentage
pattern and shows `3 open · 3 done` instead.

The design work ahead has to hold that line under harder conditions: when a branch is
completed wholesale, when a plan arrives from a conversation and adds thirty tasks at once,
and when the user returns after a week and needs to see both what moved and what grew.

## 2. Where the product actually is

**Verified capabilities** — all driven through the running application with real
hit-tested input, not inferred from source:

- opens a knowledge base and renders it as an Explorer tree plus a contextual Canvas showing
  one root and its immediate children;
- add, bulk-add (one transaction, live count), inline rename, change type, move via a
  searchable cycle-safe picker, and an Inspector over `Title`, `Type`, `Status`, `Tags`,
  `Notes`;
- Todo / In progress / Done, with recursive counts aggregating to the project root, and a
  Canvas checkbox that completes work without re-rooting the Canvas;
- explicit `Ctrl+S`, atomic writes, refusal to overwrite a file that changed on disk, and
  lossless round-tripping of unknown fields, key order and CRLF endings;
- stable node identity across rename, retype and move, proven across a two-process restart;
- unsaved-work guards on close, open-another-project and `Ctrl+R`;
- non-Music-Brain JSON opens read-only rather than being coerced.

**Verified limitations**, measured rather than assumed:

| Limitation                         | Evidence                                                                                                                                  |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| No search, filter, or jump-to-node | no text input exists in the UI; `Ctrl+F`/`K`/`P` do nothing                                                                               |
| No delete, no undo                 | the context menu offers no removal; a mis-capture can only be renamed                                                                     |
| Nothing resumes on reopen          | fresh process: 0 rows expanded, nothing selected, Canvas at project root                                                                  |
| Canvas framing degrades            | at 14 children: zoom at the 0.800 floor, child column 931 px in an 813 px pane, first card at `y = -9` behind the header, 2 cards clipped |
| Dead horizontal space              | 186–317 px of empty gutter left of the root card in every layout measured                                                                 |
| Aggregates vanish when expanded    | a collapsed row shows `154`; expanded it shows nothing                                                                                    |
| New work is hard to find           | a new top-level project is appended below 13 domains, off the fold                                                                        |
| Type choice is noisy               | 17 node types offered; the real knowledge base uses 4                                                                                     |

**Scale of the real file:** 548 nodes, depth 4, 13 top-level domains, 397 tasks.

## 3. What the product owner reported

From the acceptance session on 2026-10-31. These are first-hand usability findings, not
agent inferences.

1. **Creation feedback.** A newly created project is hard to locate. Consider selecting and
   revealing the new container, opening its Canvas, and marking it with a temporary
   highlight.
2. **Empty containers.** An empty container needs a visible anchor and an explicit
   _Add first task_ action. Right-click may remain a shortcut, not the only route in.
3. **Complete a branch.** An explicit action to complete a project or task together with all
   its descendants, with recovery/Undo and a clear count of affected items. **"All currently
   known children are done" must not silently mean the project is finished** — that
   distinction is §1 restated as an interaction.
4. **Move destination search.** Results were confusing. Case sensitivity is suspected but
   **unverified**; matching against ancestor paths is a plausible alternative explanation.
   Needs clearer item types, visible paths, and an explanation of _why_ each result matched.
5. **Status visibility.** _In progress_ is not distinct enough. Needs stronger semantic
   colour, icon and text, and must not rest on an indeterminate checkbox alone.
6. **Bulk operations.** Multi-selection and multi-item actions are wanted. Shift selection,
   rectangle selection and dragging are candidate interactions, not approved scope.
7. **Design direction.** The dynamic contextual Canvas is a **valued strength** and should be
   built on, not replaced. Visual clarity, hierarchy, status and completion feedback are
   integral to the product's purpose rather than decoration, so a dedicated design pass
   should happen **before** substantial feature expansion.

Point 7 supersedes the earlier agent assessment that a redesign was unwarranted. That
assessment was made from synthetic sessions; this one comes from use.

## 4. The two workflows the product must serve

### A. Software projects planned with ChatGPT and executed with Claude

Goals and roadmap decisions are formed in conversation; implementation happens in Claude
Code; results come back for review and the next prompt. What the knowledge base must hold:
goals, roadmap decisions, implementation results, PR and version references, and —
critically — **what is implemented but still pending human verification**.

This repository is the worked example. Milestone 005 spent weeks in exactly the state the
product has no vocabulary for: _implementation complete, human acceptance pending._

### B. Insaint recording and April-show preparation

Songs, practice, performance, equipment, styling, and other work evolving over several
months. Characteristics that differ from A: the work is discovered continuously rather than
planned once, much of it is physical and repeated (practice, rehearsal), and the deadline is
fixed and external.

A design that serves only A will produce a project tracker; one that serves only B will
produce a checklist. The product needs both, and the tension between them is the useful
constraint.

## 5. Candidate directions to evaluate

**Proposed, not committed.** Each is stated with the problem it solves so the design
conversation can reject it on the merits.

### 5.1 Structured plan and progress import

Bring a plan or a progress update from a conversation into the knowledge base without
retyping it. Non-negotiable properties if this is built:

- **Preview and confirmation before anything is applied** — never a silent write;
- **stable identity and duplicate protection**, so importing the same update twice does not
  double the tree;
- **explicit scope**: structured plans and meaningful progress updates only.

Two guardrails stated by the product owner: **do not automatically import every
conversational response**, and **do not turn the application into a chat archive.**

### 5.2 Implementation completed vs human acceptance pending

A first-class distinction, not a tag convention. Today `done` conflates "the work was done"
with "the work was accepted", and workflow A breaks on exactly that. Design question: is
this a second axis alongside status, a status value of its own, or a property only certain
node types carry?

### 5.3 Context export for a new conversation

The inverse of 5.1: produce a concise continuation package — current focus, recent progress,
open decisions, next actions — to paste into a fresh conversation. This is what makes the
knowledge base the thing that survives a conversation's retention window. It is plausibly
_cheaper and more valuable_ than import, and the design conversation should consider doing
it first.

### 5.4 A return-to-work experience

Answering "where do I continue?" in one view: current focus, work completed since last time,
**work newly discovered**, and next actions. Newly discovered scope must be presented as
information gained, never as regression — §1 again, and the place it matters most.

This subsumes the narrower "resume expansion and selection on reopen" idea; restoring the
tree exactly as it was left is one possible implementation, and probably not the most useful
one.

### 5.5 A real release

A packaged Windows executable, a visible version, release notes, and a documented update
process that **preserves user data**. Automatic updates are explicitly _not_ a prerequisite.
`electron-builder` is already configured and `package:win` already exists, so the packaging
machinery is not the gap.

**The gap is where a packaged application keeps its data, and today the answer is wrong.**
Traced at `89e5a60`, not assumed:

- `electron-builder.yml` ships `data/` as `extraResources`, so a build embeds a **snapshot
  copy** of `data/music-brain.json`;
- `defaultProjectPath()` in `src/main/ipc/project.ts` resolves the default under
  `process.resourcesPath` when `app.isPackaged`;
- so an installed application auto-opens **its own bundled copy**, and `Ctrl+S` writes back
  into the installation directory — typically not writable for a per-machine NSIS install,
  and if it ever is, silently the wrong file while the user's real knowledge base sits
  untouched;
- and the next installed version replaces that file, destroying anything saved into it.

`package:win` has never been run — there is no `release/` directory — so none of this has
been observed, only traced. It is not a milestone-005 regression and it blocks nothing that
exists today; it blocks **this** goal specifically.

What it implies for design: a packaged release needs a real answer to _where the user's
knowledge base lives_ — a user-data location outside the installation, the workspace and
recent-projects UI the README has promised since milestone 002, and a migration story
across versions. That is product design, not build configuration, which is the argument for
settling it in the design pass rather than discovering it on the first install.

### 5.6 Supporting materials (later)

Attaching or referencing text and audio, and potentially other files, with suitable
previews. One modelling point to settle early even if nothing is built: **a node type and an
attachment media type are different things** — a `task` may carry a reference track; it does
not _become_ an audio node. Audio playback and waveform display are a future candidate, not
a requirement for a first release.

### 5.7 The known gaps, solved coherently rather than piecemeal

Search · undo and safe deletion · resume state · branch completion · Canvas framing.

These were previously proposed as a sequence of separate milestones. The product owner's
feedback reframes them: they are **facets of one design problem** — how the user finds,
trusts, and returns to their work — and solving them one at a time risks five locally
sensible answers that do not add up. They should enter the design pass together.

## 6. Proposed sequence

Deliberately coarse, and without milestone numbers.

1. **Design pass.** Resolve §5.7 together, settle the §3 feedback, and decide which of
   §5.1–§5.6 earn a place. Output: a design the owner recognises as the product they want.
2. **Implementation in usable vertical slices**, each one independently useful on the real
   548-node file, per the project's standing principle that a milestone must make the
   application more useful _today_ rather than more complete architecturally.
3. **A packaged release** once the daily loop is genuinely good: version, release notes, and
   a data-preserving update path.

Effort estimates are deliberately omitted. The earlier range (roughly six to eleven focused
iterations to reach useful daily use) was calculated before this direction existed and
before a design pass was planned; it should be re-derived from whatever the design concludes,
and treated as provisional then too.

## 7. Open questions for the design conversation

- Does the Canvas stay strictly "one root and its immediate children", or does serving the
  return-to-work view (§5.4) require a second kind of view beside it?
- Is "pending human acceptance" (§5.2) a property of a node, of an edge between a plan and
  its result, or of a release?
- Should import (§5.1) write into the tree, or into a staging area the user promotes from?
- What is the smallest version of §5.4 that would genuinely change a Monday morning?
- Is Move-search's reported confusion (§3.4) a matching bug or a presentation failure? It is
  cheap to determine and would sharpen the search design — worth settling early, since
  search is the single most-requested missing capability.
