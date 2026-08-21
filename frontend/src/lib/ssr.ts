/**
 * SSR environment helpers.
 *
 * Under server-side rendering the Vue app runs in Node, where `window`,
 * `document` and `localStorage` do not exist. Touching them at module-eval
 * or store-setup time throws `ReferenceError: window is not defined` and
 * aborts the render.
 *
 * `isBrowser` is the single guard the stores and client-only code branch on.
 * `safeStorage` is a `localStorage`-shaped no-op for the server so call sites
 * stay branch-free — on the server every read returns `null` and every write
 * is dropped, which is exactly the "no persisted state" the server should see.
 */

/** True only in a real browser (client render / post-hydration). */
export const isBrowser = typeof window !== 'undefined'

/**
 * A `localStorage`-compatible facade. In the browser it proxies the real
 * `localStorage`; on the server it is an inert in-memory stub so callers
 * never need a `typeof window` check around every get/set.
 */
export const safeStorage: Pick<
  Storage,
  'getItem' | 'setItem' | 'removeItem' | 'clear'
> = isBrowser
  ? window.localStorage
  : {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
      clear: () => undefined,
    }

/**
 * Write a browser cookie. Used to mirror the access token into a cookie so the
 * SSR server can read it and render personalised (contact-priced) HTML — the
 * token otherwise lives only in `localStorage`, which the server cannot see.
 *
 * Not `httpOnly` (the browser SDK and this code both need to read it) and
 * `SameSite=Lax` so it rides along on top-level navigations to our own origin.
 * No-op on the server.
 */
export function setCookie(name: string, value: string, maxAgeSeconds = 60 * 60 * 24 * 7): void {
  if (!isBrowser) return
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`
}

/** Delete a browser cookie by name. No-op on the server. */
export function deleteCookie(name: string): void {
  if (!isBrowser) return
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`
}
