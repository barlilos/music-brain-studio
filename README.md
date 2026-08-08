# Music Brain Studio

Desktop application for managing a hierarchical JSON knowledge base for music projects,
research, tasks and creative workflows.

> **Status: foundation only.** The app opens a window showing its name. There is no
> knowledge base, editor, tree, search or state management yet.

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

No router, state management, persistence layer, IPC surface, test runner, or CSP. The
preload script is wired and sandboxed but exposes no API — see the comment in
`src/preload/index.ts` for the intended pattern when the first IPC call is added.
