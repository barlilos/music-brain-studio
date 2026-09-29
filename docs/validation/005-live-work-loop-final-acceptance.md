# Milestone 005 — Live Work Loop: final acceptance

**Date:** 2026-09-29
**Branch:** `feature/live-work-loop`
**HEAD before validation:** `00899d88c09d495950807d7b5d684958bb5e95b1`
**Base:** `main` at `d4344d6702ff97608d175f3967f6c9f9ba4b0a4b` (0 behind, 18 ahead)
**Platform:** Windows 10 Pro 22H2, build 19045.6466 · Node 23.11.0 · pnpm 10.8.0

This is the acceptance record for PR #5. It exists because the conversations in
which M005 was designed and first verified were lost to a retention purge, and a
milestone that claims to protect a knowledge base should not rest its evidence on
chat history. Everything below was re-run from scratch against the code at the
HEAD above.

## Scope

Make the application usable as the only source of truth open during a real music
session: `Discover → Capture → Structure → Work → Complete → Continue tomorrow`.
Add, bulk-add, rename, retype, move, three work states, recursive counts,
explicit save, conflict refusal, and a restart that finds everything where it was
left.

## Standing decisions confirmed for this phase

- **The `quad.base.cab` repair stays.** `data/music-brain.json` had 548 nodes and
  547 distinct ids; the area _Cab Optimization_ now carries
  `quad.base.cab-optimization` (commit `23e09c6`, one line). Without it the codec
  refuses the file as unsafe to edit and it loads **read-only**, so the repair is
  a precondition for the milestone rather than a nicety. The commit is on this
  branch only — it is not on `main`.
- **Canvas column overflow is accepted as non-blocking.** A node with roughly
  fifteen or more children produces a column taller than the window, so controls
  at the ends need panning. Observed again during this run: the first child card
  laid out at viewport `y = -9`, i.e. behind the header. Recorded as deferred
  work; M005 is not expanded to redesign Canvas layout.

## Commands executed

| Command                                                      | Result                                         |
| ------------------------------------------------------------ | ---------------------------------------------- |
| `pnpm typecheck`                                             | pass (exit 0) — both the Node and web projects |
| `pnpm lint`                                                  | pass (exit 0)                                  |
| `pnpm format:check`                                          | pass (exit 0)                                  |
| `pnpm test`                                                  | pass (exit 0) — **142 tests, 9 files**         |
| `pnpm build`                                                 | pass (exit 0)                                  |
| `pnpm dev:isolated --project-file=… --remoteDebuggingPort=…` | used for every UI check                        |
| `node scripts/dev-desktop-isolation.mjs status`              | read-only; routing disabled at rest            |

`format:check` had been failing before this phase, on the untracked handoff
document alone. That file is a historical source preserved byte-for-byte, so it
is excluded in `.prettierignore` rather than reformatted. Every tracked file
passed Prettier unchanged.

### Test count

142 across 9 files — one more than the 141 recorded in the PR description. The
addition is the new test asserting that a disposable copy never lands inside the
repository `data/` directory.

| File                                                       | Tests |
| ---------------------------------------------------------- | ----- |
| `src/shared/model/projectMutations.test.ts`                | 32    |
| `src/shared/persistence/projectCodec.test.ts`              | 21    |
| `src/main/persistence/liveWorkLoop.e2e.test.ts`            | 17    |
| `src/shared/model/projectProjection.test.ts`               | 17    |
| `src/main/persistence/projectFile.test.ts`                 | 15    |
| `src/renderer/src/state/workspace.test.ts`                 | 14    |
| `scripts/dev-isolated-workspace.test.mjs`                  | 14    |
| `src/shared/model/bulkCapture.test.ts`                     | 6     |
| `src/renderer/src/components/explorer/rowProgress.test.ts` | 6     |

### Build

`electron-vite build` produced `out/main/index.js` (11.05 kB), `out/preload/index.js`
(1.30 kB) and `out/renderer/assets/index-*.js` (1,019.31 kB). The renderer bundle
is past Vite's warning threshold because of React Flow; that is pre-existing and
unchanged by this milestone. `out/` is git-ignored and nothing from it is staged.

## Isolated UI-test environment

|                       |                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Launch command        | `pnpm dev:isolated` — `pnpm dev` was never used                                                                  |
| Virtual desktops      | 4, verified by a real `GetDesktopCount()` call through `VirtualDesktopAccessor.dll` (`ok=1`, Windows 10.0.19045) |
| Target desktop        | index 1, "following this project's VS Code window"                                                               |
| Active desktop        | 0 / 2 / 3 at various points — **never the target**                                                               |
| Startup line          | `[dev-desktop] Data: ISOLATED COPY (reused) — …`                                                                 |
| Main-process line     | `[project] Default project: ISOLATED COPY — …`                                                                   |
| Disposable project    | `%TEMP%\mbs-acceptance\music-brain.json` — outside the repository, outside `data/`                               |
| Disposable start hash | `c95a33e9c031338aeca21d59cf8063855470f13f3663308d081d3284820b998a` (a copy of the real file)                     |
| UI driving            | CDP `Input.dispatchMouseEvent` / `dispatchKeyEvent` — real pointer and key input, never `element.click()`        |

The launcher also refused a malformed `--project-file` during setup, printing
_"no such file. Prepare the disposable copy first."_ and aborting without
starting Electron — an unplanned but welcome demonstration that the guard fails
closed.

## Product workflow results

Every step below was driven through the real UI. Hit-testing was asserted before
each click, so a control that was present but unreachable — M004's exact defect —
would have failed rather than passed silently.

| #    | Step                                                   | Result                                                                            |
| ---- | ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| 1    | Application opens                                      | pass — title `Music Brain Studio`                                                 |
| 2    | Explorer and Canvas render                             | pass — 13 rows, 14 cards                                                          |
| 2.5  | Chevron expands without changing the Canvas            | pass — root stayed `canvas:project`; rows 13 → 20                                 |
| 3    | Select a node from the Explorer                        | pass — Canvas rooted at `ableton.rhythm`                                          |
| 4    | Select a node from the Canvas                          | pass — re-rooted at `ableton.template.structure`                                  |
| 5    | Add a child                                            | pass — children 5 → 6                                                             |
| 6    | Bulk-add, one transaction                              | pass — button read `Add 3`; blank line ignored; children → 9                      |
| 7    | Rename, inline                                         | pass — id unchanged across the rename                                             |
| 8    | Change type                                            | pass — Task → Project, same id                                                    |
| 9    | Move / reparent                                        | pass — node re-filed; Canvas follows to the destination                           |
| 10   | Cyclic move refused                                    | pass — picker offered 200 destinations, excluding the node **and** its descendant |
| 10.5 | Leaf selection roots the Canvas at its parent          | pass — M004's parent-rooting rule intact                                          |
| 11   | Status through all three states                        | pass — In progress ✓, Done ✓, To do ✓                                             |
| 12   | Canvas card status button                              | pass — `Mark as done` → `Mark as to do`, **Canvas root unchanged**                |
| 13   | Explorer, Canvas, Inspector, counts, dirty state agree | pass — see below                                                                  |
| 14   | Save with Ctrl+S                                       | pass — `Unsaved — Save` → `Saved`                                                 |
| 15   | Second, independent process opens the file             | pass — opened **clean**                                                           |
| 16   | Saved mutations survived the restart                   | pass — all four, by id                                                            |
| 17   | Stale save refused                                     | pass — nothing written                                                            |
| 18   | Close guard: Save / Don't Save / Cancel                | pass — all three                                                                  |
| 19   | Alias status preserved                                 | pass — all three `active` values verbatim                                         |
| 20   | No unexpected normalisation or broad rewrite           | pass — 99.98 % of lines unchanged                                                 |

**Step 13 detail.** The Inspector exposed exactly `Title`, `Type`, `Status`,
`Tags`, `Notes`; `priority` was **not** present, as decided. The Canvas root card
read `Track Structure · Area · 7 open · 1 done`. No percentage appeared anywhere
in the document. The header read `Unsaved — Save` while dirty and `Saved` after.

**Step 12 detail.** The status control and the navigation control are two sibling
native `<button>` elements inside a non-interactive wrapper, confirmed in the
live DOM. Pressing the status button changed the work state and left the Canvas
root untouched, which is the structural guarantee decision R5 was revised to get.

## Two-process restart

Not a simulated reopen. Two separate Electron applications, on separate remote
debugging ports, with disjoint process sets, against one prepared disposable
file.

|            | Process 1                   | Process 2                 |
| ---------- | --------------------------- | ------------------------- |
| Started    | 14:38:57                    | 14:41:28                  |
| PIDs       | `1876, 12184, 13792, 15088` | `496, 8128, 11828, 15572` |
| Debug port | 9222                        | 9333                      |

Process 1's PIDs were each confirmed `alive=False` before process 2 was started;
the two sets share no member. Process 2 opened the same file **clean, not dirty**,
and found:

- the added child, the bulk-added siblings and the renamed node, all present;
- the renamed node under its original id `8f589540-0d43-4612-93b8-ecdd9c1ce31c`,
  proving identity survived rename, retype and move;
- the completed task still Done — its control offered `Mark as to do`;
- recursive counts reading `Area · 7 open · 1 done`.

## Persistence fidelity

Measured on the disposable file after saving, against the original bytes:

| Property                                          | Before                       | After                                    |
| ------------------------------------------------- | ---------------------------- | ---------------------------------------- |
| Nodes                                             | 549                          | 553 (+4)                                 |
| Distinct ids                                      | 548 / 548                    | 552 / 552                                |
| Original ids lost                                 | —                            | **0**                                    |
| New ids                                           | —                            | 4, all v4 UUIDs                          |
| Line endings                                      | 8,736 CRLF, 0 bare LF        | 8,762 CRLF, **0 bare LF**                |
| Trailing newline                                  | none                         | **none**                                 |
| Top-level keys                                    | `schema, brain`              | `schema, brain`                          |
| `taskType` / `successCriteria`                    | 397 / 397                    | **397 / 397**                            |
| `priority` / `energy`                             | 540 / 540                    | **540 / 540**                            |
| `related` / `dependsOn` / `resources` / `outputs` | 540 each                     | **540 each**                             |
| Statuses                                          | 537 todo, 3 active, 9 absent | 540 todo, **3 active**, 1 done, 9 absent |
| Original lines still present verbatim             | —                            | 8,735 of 8,737 (**99.98 %**)             |

The three `active` values on `ableton`, `guitarpro` and `practice` came back
byte-identical after a save that renamed, retyped, moved and completed other
nodes — decision R2's precision requirement, demonstrated rather than asserted.
The two changed lines are the two nodes actually edited.

## Conflict protection

With one unsaved edit in memory, the file was modified underneath the running
process, as another program would. Ctrl+S then:

- refused the write — the on-disk bytes were byte-identical before and after the
  attempt;
- left the project dirty, so no work was lost;
- showed: _"This file changed on disk. Nothing was written, so the other version
  is intact. Reload to take it and lose the changes made here, or keep working
  and save elsewhere later."_ with **Reload** and **Dismiss**.

## Close guard

Driven through the real window-close path (`WM_CLOSE`, what the title-bar X
sends), answered with posted `BM_CLICK` messages so no window was ever activated
and the active desktop never changed. The dialog is titled **Unsaved changes**
with buttons **Save**, **Don't Save**, **Cancel**.

| Choice     | Window      | File                                              |
| ---------- | ----------- | ------------------------------------------------- |
| Cancel     | stayed open | unchanged                                         |
| Save       | closed      | **updated** — the edit was written before closing |
| Don't Save | closed      | unchanged — the edit correctly discarded          |

The Save path is the one that commit `049e01b` fixed, and it behaves correctly:
the file changed _and_ the window closed, rather than one without the other.

## Deviations and observations

1. **`window.close()` from renderer script is not guarded.** Calling
   `window.close()` in the renderer closed a dirty window without prompting,
   while `WM_CLOSE` — the path a user takes — was correctly intercepted. No UI
   in the application calls `window.close()`, and a packaged build exposes no
   console, so this is not user-reachable. Recorded as an observation, not a
   defect, and not treated as a merge blocker.
2. **Canvas column overflow reproduced**, as accepted above.
3. **The real knowledge base was never opened for writing.** Its hash was taken
   before and after every stage.

No step failed. Three early runs were discarded and restarted from a pristine
copy because of faults in the _test harness_ — a mangled path, a newline that
did not reach a textarea, and two assertions that predicted the wrong correct
behaviour. Each was fixed in the harness; no product code was changed to make a
check pass.

## Real Music Brain integrity

`data/music-brain.json`, SHA-256:

| Stage                         | Hash                                                               |
| ----------------------------- | ------------------------------------------------------------------ |
| Before validation             | `c95a33e9c031338aeca21d59cf8063855470f13f3663308d081d3284820b998a` |
| After the full test suite     | `c95a33e9c031338aeca21d59cf8063855470f13f3663308d081d3284820b998a` |
| After all Electron UI testing | `c95a33e9c031338aeca21d59cf8063855470f13f3663308d081d3284820b998a` |

Unchanged, and `data/` contains nothing but that one file.

## Recommendation

**Ready to be marked ready-for-review**, and ready to squash-merge once reviewed.

Every automated gate passes, the twenty-step product workflow passes against a
real running application driven by real input, persistence survives a genuine
two-process restart, a stale save is refused, all three close-guard paths behave,
and the user's knowledge base was never touched.

## Remaining actions before merge

1. Human review of PR #5 — it currently has no GitHub review, and the review of
   record was lost with the deleted conversations.
2. Mark PR #5 ready for review (it is still a draft).
3. Squash-merge, as intended for this branch.
4. Note that `23e09c6` carries the only change to real data and lands with this
   merge or not at all.

Not required for merge, and deliberately left for later: Canvas column overflow;
read-only projects cannot be reloaded in-app; the renderer bundle size; and the
unguarded scripted `window.close()` noted above.
