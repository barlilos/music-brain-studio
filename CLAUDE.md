# Claude instructions

## Launching the app on Windows

Whenever you launch Music Brain Studio for UI verification, visual testing, CDP testing,
screenshots, or Electron interaction, use `pnpm dev:isolated`, never `pnpm dev`.

`pnpm dev` is reserved for the user because it intentionally opens the app on the user's
current desktop.

- Prefer non-interactive verification — typecheck, lint, build, unit-level checks, CDP —
  when opening Electron is not actually necessary.
- If Electron must be opened, use the isolated command.
- Do not manually disable isolation before a UI test.

`pnpm dev:isolated` chooses its virtual desktop dynamically. It follows the Music Brain
Studio VS Code window when that window is on another desktop, otherwise it routes to any
inactive desktop, and it never intentionally opens the app on the user's active desktop.
If it cannot find a safe desktop it refuses to launch rather than interrupting them.
