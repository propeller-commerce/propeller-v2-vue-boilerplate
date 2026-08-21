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
   * root isn't that number.
   */
  const baseCategoryId = ref<number | null>(null)

  /**
   * The channel's anonymous user, resolved server-side and serialized with the
   * rest of this store. Logged-out listing queries scope to it, so the client
   * refetch asks the same question the SSR seed did.
   */
  const anonymousUserId = ref<number | null>(null)

  function setTree(next: MenuCategory[]): void {
    tree.value = next
  }

  /** Drop the SSR tree so `<Menu>` refetches — e.g. after a language switch. */
  function clearTree(): void {
    tree.value = null
  }

  function setBaseCategoryId(next: number): void {
    baseCategoryId.value = next
  }

  function setAnonymousUserId(next: number | undefined): void {
    anonymousUserId.value = next ?? null
  }

  // `baseCategoryId` deliberately survives `clearTree()`: the root doesn't
  // change with the language, and the refetch that follows a switch needs it.
  return {
    tree,
    baseCategoryId,
    anonymousUserId,
    setTree,
    clearTree,
    setBaseCategoryId,
    setAnonymousUserId,
  }
})
