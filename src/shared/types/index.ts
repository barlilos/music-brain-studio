/**
 * Type definitions shared by the main, preload and renderer contexts.
 *
 * Everything here must be isomorphic — no Node types, no DOM types. This is the
 * one folder all three build targets are allowed to import from, so anything
 * context-specific placed here would break one of them.
 */

/** Pixel dimensions of an application window. */
export interface WindowSize {
  width: number
  height: number
}
