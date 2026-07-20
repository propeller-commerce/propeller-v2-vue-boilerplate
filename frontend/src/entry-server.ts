/**
 * Server entry — runs in Node, renders the app to an HTML string per request.
 *
 * The Node server (`server.js`) imports `render()`, calls it with the request
 * URL + cookies, and splices the result into `index.html`.
 *
 * Flow:
 *   1. Build a fresh app/router/pinia (per-request isolation).
 *   2. Push the requested URL and wait for the router to resolve it.
 *   3. Run any matched route's `ssrPrefetch` loader (catalog routes use this
 *      to fetch the shell data — see Phase 3 / `src/lib/server.ts`). Loaders
 *      seed Pinia, so their result rides along in `__INITIAL_STATE__`.
 *   4. `renderToString` the app, collect <head> tags, serialize Pinia state.
 */
import { renderToString } from 'vue/server-renderer'
import { renderSSRHead } from '@unhead/vue/server'
import type { RouteLocationNormalized } from 'vue-router'
import type { SSRContext } from './lib/server-context'
import { createApp } from './app'
import {
  prefetchProduct,
  prefetchCategory,
  prefetchSearch,
  prefetchCluster,
  prefetchCmsPage,
} from './router/ssrPrefetch'
import { fetchMenu, getAnonymousInfra, getServerInfra } from './lib/server'
import { useMenuStore } from './stores/menu'
import { usePriceStore } from './stores/price'
import { useAuthStore } from './stores/auth'
import { useCompanyStore } from './stores/company'
import { baseCategoryId as configBaseCategoryId } from './lib/config'

/**
 * Re-exported so `server.js`'s `/api/revalidate` route can bust the
 * parsed-object SSR cache alongside its own raw-response LRU. Both layers
 * need to be in sync — a single revalidation request hits both via this
 * one entry point. Returns the number of entries evicted from the SSR
 * cache (the raw-response cache's count is reported separately by
 * `server.js`).
 */
export { invalidateCache, clearCache } from './lib/server'

/**
 * Maps a route's `meta.ssrKey` to its server prefetch loader. Keeping this
 * mapping in the *server* entry (not in route `meta`) is what keeps the
 * loaders — and the `process.env`-reading server seam they pull in — out of
 * the client bundle entirely.
 */
const SSR_LOADERS: Record<
  string,
  (route: RouteLocationNormalized, ctx: SSRContext) => Promise<void>
> = {
  product: prefetchProduct,
  category: prefetchCategory,
  search: prefetchSearch,
  cluster: prefetchCluster,
  cms: prefetchCmsPage,
}

export interface RenderResult {
  /** Inner HTML for `<div id="app">`. */
  html: string
  /** Serialized Pinia state for `window.__INITIAL_STATE__`. */
  initialState: string
  /** Rendered <head> fragments (title, meta, link). */
  headTags: string
  htmlAttrs: string
  bodyAttrs: string
  /** Set when a route guard redirected (e.g. auth gate) — server should 302. */
  redirect?: string
  /** HTTP status the server should send (404 for unmatched, etc.). */
  status: number
}

export async function render(
  url: string,
  ssrContext: SSRContext,
): Promise<RenderResult> {
  const { app, router, pinia, head } = createApp()

  // Make request-scoped data (cookies, server GraphQL client) reachable from
  // route loaders and `App.vue` via inject.
  app.provide('ssrContext', ssrContext)

  // Seed the VAT preference store from the request cookie so SSR renders the
  // right gross/net prices and the hydration snapshot matches.
  usePriceStore(pinia).seedFromCookie(ssrContext.cookies)

  // Seed the auth store from the `access_token` cookie BEFORE routing, so the
  // router's `requiresAuth` guard sees the logged-in user. Without this the
  // server starts anonymous (it can't read localStorage) and every `/account/*`
  // refresh 302-redirects a logged-in user to /login. `getServerInfra` resolves
  // the viewer via `getViewer` (cookie → Bearer) and `toPlain`s it; an absent
  // or expired cookie yields `user: null`, so genuinely anonymous requests
  // still redirect correctly. `hydrateFromServer` writes only the in-memory
  // refs (no storage/cookie), which then serialize into `__INITIAL_STATE__` so
  // the client hydrates authenticated too — no flash, no client-side redirect.
  const authToken = ssrContext.cookies['access_token']
  if (authToken) {
    try {
      const infra = await getServerInfra(ssrContext.cookies)
      if (infra.user) {
        useAuthStore(pinia).hydrateFromServer(infra.user, authToken)
        // Seed the active company from the contact's default company so the
        // dashboard (which reads addresses + company info off `activeCompany`,
        // not off `user.company`) renders them on a refresh. The client
        // re-reads localStorage on hydration, so an explicit company switch
        // still wins over this default.
        const company = (infra.user as { company?: unknown }).company
        if (company) useCompanyStore(pinia).hydrateFromServer(company as never)
      }
    } catch (err) {
      // A viewer-resolution failure must not abort the render — fall through
      // anonymous; the guard will redirect, and the client reconciles from
      // localStorage on hydration if a valid session exists.
      console.error('[ssr] auth seed failed:', err)
    }
  }

  await router.push(url)
  await router.isReady()

  const resolved = router.currentRoute.value

  // A guard redirected (auth gate). Tell the server to 302 — don't render.
  if (resolved.redirectedFrom && resolved.fullPath !== url) {
    return {
      html: '',
      initialState: '{}',
      headTags: '',
      htmlAttrs: '',
      bodyAttrs: '',
      redirect: resolved.fullPath,
      status: 302,
    }
  }

  // Default: 404 only when nothing matched. A loader may override this below
  // (via `ssrContext.status`) — e.g. the CMS catch-all matches every path but
  // resolves to a not-found page, so it promotes a matched 200 to a 404.
  const defaultStatus = resolved.matched.length === 0 ? 404 : 200

  // Always-on layout-level prefetches: the menu (rendered in `AppHeader`
  // on every page). Runs in parallel with the route-specific loaders below
  // — the menu fetch is anonymous and independent of the matched route, so
  // overlapping its latency with the page data is a free win. Failure is
  // swallowed: the package's `<Menu>` falls back to its client-side
  // `useMenu` fetch when no tree is supplied, so the page still renders.
  const menuPrefetch = (async () => {
    try {
      const tree = await fetchMenu(getAnonymousInfra(), configBaseCategoryId)
      useMenuStore().setTree(tree)
    } catch (err) {
      console.error('[ssr] menu prefetch failed:', err)
    }
  })()

  // Run route-level SSR data loaders. A route opts in with `meta.ssrKey`,
  // which selects a loader from `SSR_LOADERS`; the loader seeds a Pinia store
  // so the fetched data serializes into `__INITIAL_STATE__` for the client.
  for (const record of resolved.matched) {
    const ssrKey = record.meta?.ssrKey as string | undefined
    const loader = ssrKey ? SSR_LOADERS[ssrKey] : undefined
    if (loader) {
      try {
        await loader(resolved, ssrContext)
      } catch (err) {
        // A failed prefetch must not abort the render — the client grid
        // re-fetches. Log and fall through to an (emptier) shell.
        console.error(`[ssr] prefetch failed for ${resolved.fullPath}:`, err)
      }
    }
  }

  // Make sure the menu finished before we serialise Pinia state. It started
  // in parallel above, so this `await` typically resolves immediately.
  await menuPrefetch

  const html = await renderToString(app)
  const payload = await renderSSRHead(head)

  return {
    html,
    initialState: JSON.stringify(pinia.state.value),
    headTags: payload.headTags,
    htmlAttrs: payload.htmlAttrs,
    bodyAttrs: payload.bodyAttrs,
    // A loader-set status (e.g. the CMS catch-all's 404) wins over the default.
    status: ssrContext.status ?? defaultStatus,
  }
}
