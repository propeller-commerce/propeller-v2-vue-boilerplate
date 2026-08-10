/**
 * Menu tree store.
 *
 * Server-seeded, persistent. `entry-server.ts` calls `setTree` once per
 * render (after the route loader has run) with the result of
 * `fetchMenu(getAnonymousInfra(), BASE_CATEGORY_ID)`; the value rides along
 * in `window.__INITIAL_STATE__` via Pinia. `AppHeader.vue` reads from
 * `tree` and passes it to `<Menu :tree="...">` so the package component
 * skips its internal `useMenu` fetch — anonymous menu HTML lands in the
 * initial response with no client-side roundtrip on hydration.
 *
 * Unlike `useSsrCatalogStore`, this store does NOT discard its value after
 * hydration. The menu is layout-level chrome on every page, so the same
 * tree is the correct seed for every client-side navigation too — no need
 * to re-fetch.
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { MenuCategory } from '@propeller-commerce/propeller-v2-vue-ui/shared'

export const useMenuStore = defineStore('menu', () => {
  /** Pre-fetched category tree. `null` until the SSR prefetch runs. */
  const tree = ref<MenuCategory[] | null>(null)

  /**
   * The catalog root the server resolved (`VITE_BASE_CATEGORY_ID` when set,
   * else the channel's `catalogRootId`). Seeded alongside the tree so the
   * client fallback path — `<Menu>`'s own `useMenu` fetch, used whenever the
   * SSR prefetch failed — asks for the SAME category the server would, rather
   * than a hardcoded id from config that is wrong on any shop whose catalog
   * root isn't that number (PWP-913).
   */
  const baseCategoryId = ref<number | null>(null)

  function setTree(next: MenuCategory[]): void {
    tree.value = next
  }

  function setBaseCategoryId(next: number): void {
    baseCategoryId.value = next
  }

  return { tree, baseCategoryId, setTree, setBaseCategoryId }
})
