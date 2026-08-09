/**
 * Types for the APIs the preload script publishes on `window`.
 *
 * This lives under `src/renderer` rather than next to the preload script because
 * `tsconfig.web.json` does not include `src/preload` — the renderer is compiled
 * without any knowledge of that file, and only sees what is declared here. The
 * shape itself comes from `@shared/types`, so the two sides cannot drift.
 */

import type { ProjectApi } from '@shared/types'

declare global {
  interface Window {
    /** Published by the preload script under `PROJECT_API_NAMESPACE`. */
    projectApi: ProjectApi
  }
}
