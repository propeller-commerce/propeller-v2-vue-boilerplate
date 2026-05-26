import { defineStore } from 'pinia'
import { ref } from 'vue'
import { isBrowser, setCookie } from '@/lib/ssr'

/**
 * VAT-inclusive pricing preference.
 *
 * Stored in a plain (non-httpOnly) cookie so the SSR server can read it on
 * every request and render the right prices in the initial HTML — no client
 * hydration flip needed for users who have the toggle on.
 *
 * Cookie format: `'1'` (gross / VAT-inclusive) or `'0'` (net). Absent → net.
 *
 * The store reads from `document.cookie` in the browser. On the server, the
 * entry-server seeds this store from the request cookies before render, so
 * Pinia serializes the seeded value into `__INITIAL_STATE__` and the client's
 * first render matches the server.
 */
const COOKIE_NAME = 'price_include_tax'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

function readClientCookie(): boolean {
  if (typeof document === 'undefined') return false
  const match = document.cookie.match(/(?:^|;\s*)price_include_tax=([^;]+)/)
  return match?.[1] === '1'
}

export const usePriceStore = defineStore('price', () => {
  // On the client this reads the cookie; on the server it returns false and
  // the entry-server overrides via `seedFromCookie()` before render.
  const includeTax = ref(readClientCookie())

  function setIncludeTax(value: boolean) {
    includeTax.value = value
    if (isBrowser) {
      setCookie(COOKIE_NAME, value ? '1' : '0', COOKIE_MAX_AGE_SECONDS)
      window.dispatchEvent(new CustomEvent('priceToggleChanged', { detail: value }))
    }
  }

  function toggleTax() {
    setIncludeTax(!includeTax.value)
  }

  /**
   * Server-only: seed from the request cookies so SSR + first client render
   * agree. Called by `entry-server.ts` before `renderToString`.
   */
  function seedFromCookie(cookies: Record<string, string>) {
    includeTax.value = cookies[COOKIE_NAME] === '1'
  }

  return { includeTax, setIncludeTax, toggleTax, seedFromCookie }
})
