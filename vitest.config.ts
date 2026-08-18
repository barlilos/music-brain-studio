import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

/**
 * Test configuration.
 *
 * Vitest rather than a separate toolchain because Vite is already a dependency:
 * this file is the whole setup, TypeScript needs no extra transform, and the
 * `@shared` aliases resolve from the same table the application build uses.
 *
 * Kept in step with `electron.vite.config.ts` and the `paths` entries in
 * `tsconfig.node.json` / `tsconfig.web.json` by hand — the three tools resolve
 * imports independently and have no knowledge of each other.
 */
const alias = {
  '@main': resolve('src/main'),
  '@preload': resolve('src/preload'),
  '@renderer': resolve('src/renderer/src'),
  '@shared': resolve('src/shared')
}

export default defineConfig({
  resolve: { alias },
  test: {
    // Co-located with what they test, so a module and its tests move together.
    // The launcher is plain ESM and is tested as such.
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
    // Everything under test is either isomorphic or main-process code. Nothing
    // here renders, so there is no reason to pay for a DOM.
    environment: 'node'
  }
})
