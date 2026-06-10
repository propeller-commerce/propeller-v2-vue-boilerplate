/**
 * SSR catalog seed store.
 *
 * A route's `ssrPrefetch` loader (run by `entry-server.ts`) fetches the shell
 * data — a product, a category + first product page, a search result, a
 * cluster — and stashes it here, keyed by route path. Because it lives in
 * Pinia, the seed serializes into `window.__INITIAL_STATE__` and is present on
 * the client before the first render.
 *
 * Lifecycle of a single navigation:
 *   - Server loader → `setSeed(path, seed)` → seed lives in `seeds[path]`.
 *   - SSR render: view calls `peekSeed(path)` → reads but does NOT delete.
 *     Pinia state then serializes WITH the seed still present.
 *   - Client first render (hydration): view calls `peekSeed(path)` again →
 *     reads the same seed it hydrated from. Server and client agree → no
 *     hydration mismatch.
 *   - After hydration: the view calls `consumeSeed(path)` from `onMounted`,
 *     which clears the entry. A later same-route navigation finds no seed and
 *     falls back to a client fetch — "server seeds first paint, client owns
 *     everything after".
 *
 * Splitting peek/consume keeps the SSR→client tick byte-identical (the seed
 * the server rendered against is the seed the client hydrates against) while
 * preserving the one-shot semantic for downstream navigation.
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

/** Discriminated by the view that consumes it; payload is plain JSON. */
export type CatalogSeed =
  | { kind: 'product'; data: unknown }
  | { kind: 'category'; data: unknown }
  | { kind: 'search'; term: string; data: unknown }
  | { kind: 'cluster'; data: unknown }

export const useSsrCatalogStore = defineStore('ssrCatalog', () => {
  /** Route fullPath → seed. */
  const seeds = ref<Record<string, CatalogSeed>>({})

  /** Loader-side: stash a seed for a route path. */
  function setSeed(path: string, seed: CatalogSeed): void {
    seeds.value[path] = seed
  }

  /**
   * View-side, SSR + hydration tick: read without removing. Both the server
   * render and the client's hydration render get the same value, so the
   * resulting DOM trees match. Returns `null` when there is no seed (a
   * client-side navigation, or after `consumeSeed` cleared the entry).
   */
  function peekSeed(path: string): CatalogSeed | null {
    return seeds.value[path] ?? null
  }

  /**
   * View-side, post-hydration: discard the seed so a later same-route
   * navigation falls back to fetching. Safe to call when there is no entry.
   */
  function consumeSeed(path: string): void {
    if (seeds.value[path]) {
      const next = { ...seeds.value }
      delete next[path]
      seeds.value = next
    }
  }

  return { seeds, setSeed, peekSeed, consumeSeed }
})
