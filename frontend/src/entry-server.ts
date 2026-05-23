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
} from './router/ssrPrefetch'

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

  const status = resolved.matched.length === 0 ? 404 : 200

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

  const html = await renderToString(app)
  const payload = await renderSSRHead(head)

  return {
    html,
    initialState: JSON.stringify(pinia.state.value),
    headTags: payload.headTags,
    htmlAttrs: payload.htmlAttrs,
    bodyAttrs: payload.bodyAttrs,
    status,
  }
}
