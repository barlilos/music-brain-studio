# Music Brain Studio

Desktop application for managing a hierarchical JSON knowledge base for music projects,
research, tasks and creative workflows.

> **Status: early.** The app can open a project file and browse it as a hierarchy of Music
> Brain concepts — domains, areas, projects and tasks — rather than as raw JSON. There is no
> editing, saving, search or state management yet.

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
| `dev`                   | Dev server + Electron, with hot reload            |
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

| Channel        | Renderer call              | Does                                            |
| -------------- | -------------------------- | ----------------------------------------------- |
| `project:open` | `window.projectApi.open()` | Prompts for a file, reads it, parses it as JSON |

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

No router, state management, persistence layer, test runner, or CSP. Application state is
two `useState` calls in `src/renderer/src/App.tsx`, which is enough for one open project
and no editing.

The project document is still arbitrary JSON rather than a typed model. `ProjectDocument`
in `src/shared/types` is the single alias that changes when it becomes one — see
[milestone 002](docs/milestones/002-open-and-display-project.md) for why the IPC contract
is written so that swap does not reach it.

## Example projects

Two fixtures live in `examples/`, and both should be opened after any change to
`src/shared/model/adapter.ts` — they exercise opposite paths through it.

| File                       | What it is for                                                      |
| -------------------------- | ------------------------------------------------------------------- |
| `music-brain-project.json` | The real schema, trimmed. Every node kind the registry knows        |
| `sample-project.json`      | Generic JSON with no `nodeType` at all — the degradation regression |

The second is deliberately unchanged from milestone 002. Because nothing in it declares a
kind, every node takes the unknown-kind fallback, which makes opening it a whole-tree proof
that the explorer never drops or mangles a node it does not understand.
