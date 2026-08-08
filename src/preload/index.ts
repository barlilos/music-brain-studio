/**
 * Preload script — the sole channel between the renderer and the main process.
 *
 * It runs before the renderer's page loads, in a context isolated from both the
 * page and from Node. Because the window is created with `contextIsolation: true`
 * and `sandbox: true`, this file is the only place a renderer-facing API can be
 * created, and it can only be created explicitly.
 *
 * No API is exposed yet: the application has no IPC surface at this stage.
 *
 * When one is needed, the pattern is:
 *   1. Declare the API's shape as a type in `src/shared/types`, so the main and
 *      renderer sides are checked against one definition rather than two.
 *   2. Publish it here with `contextBridge.exposeInMainWorld('<namespace>', ...)`,
 *      forwarding to `ipcRenderer.invoke` — never expose `ipcRenderer` itself.
 *   3. Augment the renderer's `Window` interface so `window.<namespace>` is typed.
 */

export {}
