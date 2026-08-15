# Music Brain Studio

Desktop application for managing a hierarchical JSON knowledge base for music projects,
research, tasks and creative workflows.

> **Status: early.** The app opens into a two-pane workspace: an Explorer tree for finding
> things, and a Canvas that shows the selected node and its immediate children as a graph.
> **The Canvas is the primary workspace; the Explorer is a navigation aid.** There is no
> editing, saving or search yet — the Canvas is read-only.

## Requirements

- Node.js >= 22.12 (Electron 43 requires it)
- pnpm 10+

## Getting started

```bash
pnpm install   # also downloads the Electron binary via the postinstall hook
pnpm dev       # start with hot reload
```

`pnpm dev` runs the Vite dev server for the renderer and launches Electron against it.
Editing renderer code hot-reloads; editing main or preload code restarts Electron.

### Windows: keeping agent launches off your current desktop

Two launch paths, told apart by which command you type and nothing else:

```bash
pnpm dev                   # yours. Always opens on your current desktop
pnpm dev:isolated          # the agent's. Never opens on your current desktop
pnpm dev:isolation:off     # emergency manual off switch
pnpm dev:isolation:status  # the watcher's view: DLL, desktops, chosen target
```

`pnpm dev` **disables routing before it launches**, so a flag left behind by an earlier
isolated run can never divert your own launch. That guarantee is the reason `dev` does
the work itself rather than trusting anything to have cleaned up.

`pnpm dev:isolated` picks its desktop **dynamically** — there is no fixed target. In
priority order:

1. **Never the active desktop.** This is the invariant; everything below is subordinate.
2. **Follow the workspace.** If this project's own VS Code window is on some other
   desktop, the app is routed there, so it lands beside the workspace it belongs to. Move
   that VS Code window to another desktop and the next launch follows it.
3. **Otherwise any inactive desktop** — used when the workspace window is on the desktop
   you are looking at, cannot be found, or several windows match it ambiguously. The
   reason is always reported rather than guessed at silently.

`MUSIC_BRAIN_DEV_DESKTOP_TARGET=<index>` forces a specific desktop and skips discovery.
Because you asked for it explicitly, that one may be the active desktop.

Before launching, the command starts the watcher if needed, checks it can reach
`VirtualDesktopAccessor.dll`, and confirms a safe target exists. If any of that fails it
**refuses to launch** rather than opening a window on your desktop, which is the outcome
the whole feature exists to avoid. It switches routing back off when the dev server stops;
`pnpm dev` does not depend on that having worked.

The repository half is one script, [scripts/dev-desktop-isolation.mjs](scripts/dev-desktop-isolation.mjs),
which never touches virtual desktops itself. It works out _what to look for_ — the folder
name and the VS Code instance that owns the running process, found by walking the parent
chain — and writes that as a request under `%LOCALAPPDATA%\music-brain-dev-desktop\`. The
automation is an AutoHotkey v2 watcher living outside this repository in
`C:\Tools\music-brain-dev-desktop\`, which owns every call into VirtualDesktopAccessor,
resolves the target and publishes its decision back. That folder's `README.md` covers
setup, window matching and troubleshooting.

The watcher matches the window it moves on `electron.exe` plus the exact title
`Music Brain Studio`, so a packaged `Music Brain Studio.exe` structurally cannot match and
production installs are never touched. Nothing in `src/` knows any of this exists, and no
code path ever switches your active desktop.

Requires AutoHotkey v2, a `VirtualDesktopAccessor.dll` matching your Windows version, and
**at least two virtual desktops** — on Windows 10 the DLL cannot create one, and Windows
forgets them on reboot, so `Win+Ctrl+D` once per session may be needed. A Startup-folder
entry for the watcher is optional; `pnpm dev:isolated` starts it.

## Building

```bash
pnpm build          # typecheck, then bundle all three targets into out/
pnpm start          # run the bundled output, without the dev server
pnpm package:win    # build + produce an installer in release/
```

`package:mac` and `package:linux` are also available, but each must be run on its own
platform — electron-builder does not cross-compile these targets.

## Scripts

| Script                  | What it does                                      |
| ----------------------- | ------------------------------------------------- |
| `dev`                   | Dev server + Electron, on your current desktop    |
| `dev:isolated`          | Same, routed away from your active desktop        |
| `dev:isolation:*`       | `off` / `status` for that routing (Windows only)  |
| `build`                 | Typecheck, then bundle main, preload and renderer |
| `start`                 | Run the bundled output as a production app        |
| `typecheck`             | Typecheck both the Node and the web project       |
| `lint` / `lint:fix`     | ESLint over the whole repo                        |
| `format`/`format:check` | Prettier write / verify                           |
| `package:*`             | Build and produce a distributable                 |

## Architecture

An Electron app is three programs in three different environments. The structure keeps
them apart, and the type system enforces it: `tsconfig.node.json` has no DOM lib, so
`document` will not compile in the main process, and `tsconfig.web.json` has no Node
types, so `fs` will not compile in the renderer.

```
src/
├── main/       Node.js  — app lifecycle, window creation
├── preload/    bridge   — the only channel between renderer and main
├── renderer/   Chromium — React UI
└── shared/     isomorphic — imported by all three, so it must stay free of
                Node and DOM APIs
```

### IPC surface

The renderer reaches the main process only through the API the preload script publishes on
`window`. Channel names live in `src/shared/constants.ts` and payload types in
`src/shared/types`, so both ends are checked against one definition.

| Channel               | Renderer call                     | Does                                               |
| --------------------- | --------------------------------- | -------------------------------------------------- |
| `project:loadDefault` | `window.projectApi.loadDefault()` | Reads the development default workspace, no dialog |
| `project:open`        | `window.projectApi.open()`        | Prompts for a file, reads it, parses it            |

Neither channel takes a path. The only two files reachable are the one the user picks in the
dialog and the fixed default, so the renderer cannot name a file for `readFile` to open.

Every outcome — including a dismissed picker, unreadable file, or invalid JSON — comes back as a
value in a discriminated union rather than a thrown error, because a rejected `invoke` reaches the
renderer wrapped in Electron's own error text.

### Path aliases

| Alias         | Resolves to          |
| ------------- | -------------------- |
| `@main/*`     | `src/main/*`         |
| `@preload/*`  | `src/preload/*`      |
| `@renderer/*` | `src/renderer/src/*` |
| `@shared/*`   | `src/shared/*`       |

Aliases are declared twice by necessity — in `electron.vite.config.ts` for bundling and
in the two tsconfigs for type checking. Adding one means updating both.

### Module format

`package.json` is intentionally **not** `"type": "module"`. A sandboxed preload script
cannot be an ES module in Electron, so main and preload are bundled as CommonJS while
the renderer stays ESM through Vite. This also keeps `__dirname` available in main,
which is what resolves the packaged renderer and preload paths.

## Documentation

Every feature is developed on its own branch and documented in `docs/milestones/` as part of that
branch — not retrofitted afterwards. Each document is named `<NNN>-<feature-slug>.md` and covers:

**Goal** · **Context** · **Architecture decisions** · **Files changed** · **Verification checklist**
· **Out of scope** · **Future considerations**

| Milestone                                                                         | What it added                        |
| --------------------------------------------------------------------------------- | ------------------------------------ |
| 001 — foundation                                                                  | Electron + React shell (this README) |
| [002 — open and display project](docs/milestones/002-open-and-display-project.md) | The first IPC surface, and the tree  |
| [003 — Music Brain Explorer UI](docs/milestones/003-music-brain-explorer-ui.md)   | The explorer: typed nodes, not JSON  |
| [004 — Canvas View](docs/milestones/004-canvas-view.md)                           | The canvas: the workspace beside it  |

## Notes

**The Electron binary is installed by a `postinstall` hook.** Electron 43 dropped its own
postinstall script and now ships an explicit `install-electron` bin, so nothing downloads
the ~225 MB binary unless it is invoked. If you ever see `Error: Electron uninstall`, run:

```bash
pnpm exec install-electron
```

**Running from an editor-embedded terminal.** If the environment has
`ELECTRON_RUN_AS_NODE=1` set (VS Code's extension host sets this for its own child
processes), any Electron binary starts in plain Node mode and fails with
`Cannot read properties of undefined (reading 'whenReady')`. Launch from a normal
terminal, or unset the variable.

## Deliberately not included yet

No router, application state management, persistence layer, test runner, or CSP. Application
state is four `useState` calls in `src/renderer/src/App.tsx` — the open project, an error,
whether the startup load is still running, and the selected node — plus expansion owned by
the tree. Selection lives in `App` because both panes read it and both may set it.

`@xyflow/react` is the one runtime dependency beyond React, and it renders the Canvas. It
brings `zustand` with it as an internal store for its own viewport and node state; that is
the library's business, not the application's, and it is the only sense in which the
paragraph above is qualified.

The project document is still arbitrary JSON rather than a typed model. `ProjectDocument`
in `src/shared/types` is the single alias that changes when it becomes one — see
[milestone 002](docs/milestones/002-open-and-display-project.md) for why the IPC contract
is written so that swap does not reach it.

## Project files for development

> **During early development, the application automatically opens
> `data/music-brain.json` as the default workspace.** This is a development convenience,
> not intended product behaviour. It exists because the app is currently built around one
> person opening one knowledge base every day, and picking the same file each time is pure
> friction. A later milestone replaces it with proper workspace and project management —
> switching without restarting, recent projects, possibly several open at once.

**Open Project** is in the header for anything else, and is the way back if the default is
missing or malformed. It was deliberately kept rather than replaced, so the ability to open
any file already exists — what is missing is UI for choosing between projects, not the
capability.

Two smaller fixtures in `examples/` cover cases the real file does not.

| File                                | What it is for                                                      |
| ----------------------------------- | ------------------------------------------------------------------- |
| `data/music-brain.json`             | The real thing. 548 nodes, depth 4, 13 domains                      |
| `examples/music-brain-project.json` | Same schema, trimmed. Every node kind the registry knows            |
| `examples/sample-project.json`      | Generic JSON with no `nodeType` at all — the degradation regression |

After any change to `src/shared/model/adapter.ts` or the node kind registry, open all
three: they exercise different paths, and the real file alone will not catch a regression
in the others. The real file uses only four of the thirteen declared node types, which is
why the trimmed fixture exists at all.

`sample-project.json` is deliberately unchanged from milestone 002. Because nothing in it
declares a kind, every node takes the unknown-kind fallback, which makes opening it a
whole-tree proof that the explorer never drops or mangles a node it does not understand.
