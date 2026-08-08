import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Path aliases, shared by all three build targets.
 *
 * These must stay in sync with the `paths` entries in `tsconfig.node.json`
 * and `tsconfig.web.json` — Vite resolves imports at build time, TypeScript
 * resolves them at check time, and they have no knowledge of each other.
 */
const alias = {
  '@main': resolve('src/main'),
  '@preload': resolve('src/preload'),
  '@renderer': resolve('src/renderer/src'),
  '@shared': resolve('src/shared')
}

export default defineConfig({
  // Node.js context. `externalizeDepsPlugin` keeps `dependencies` out of the
  // bundle so native modules and Electron's own APIs resolve at runtime.
  main: {
    resolve: { alias },
    plugins: [externalizeDepsPlugin()]
  },

  // Isolated bridge context, same externalization rules as main.
  preload: {
    resolve: { alias },
    plugins: [externalizeDepsPlugin()]
  },

  // Chromium context. Root defaults to `src/renderer`, entry to its index.html.
  renderer: {
    resolve: { alias },
    plugins: [react(), tailwindcss()]
  }
})
