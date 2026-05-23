/**
 * Route-level SSR data loaders.
 *
 * `entry-server.ts` calls a matched route's `meta.ssrPrefetch` after the
 * router resolves. Each loader here fetches the shell data for one catalog
 * route via the server seam (`src/lib/server.ts`) and stashes it in the
 * `ssrCatalog` Pinia store keyed by route path — from there it serializes
 * into `window.__INITIAL_STATE__` and the matching view picks it up.
 *
 * These run ONLY on the server (the seam reads `process.env`). The Vite SSR
 * build tree-shakes this module out of the client bundle because nothing in
 * the client entry imports it — it is referenced solely through route
 * `meta.ssrPrefetch`, and `meta` values are plain data the client ignores.
 *
 * A loader never throws: a failed fetch leaves no seed, the view's
 * `<ClientOnly>` island fetches client-side, and the page still renders its
 * shell. SEO degrades gracefully to "no server data" rather than a 500.
 */
import type { RouteLocationNormalized } from 'vue-router'
import type { SSRContext } from '@/lib/server-context'
import { useSsrCatalogStore } from '@/stores/ssrCatalog'
import { useAuthStore } from '@/stores/auth'
import {
  getListingInfra,
  getServerInfra,
  fetchProduct,
  fetchCategory,
  fetchSearch,
  fetchCluster,
  type ServerInfra,
  type ListingFetchOptions,
} from '@/lib/server'
import { DEFAULT_LANGUAGE } from '@/lib/config'
import { ProductSortField, SortOrder } from 'propeller-sdk-v2'
import type { ProductTextFilterInput } from 'propeller-sdk-v2'
import { AttributeType } from 'propeller-sdk-v2'

/** Resolve the active language from the route's optional `:lang` param. */
function routeLanguage(route: RouteLocationNormalized): string {
  const lang = (route.params.lang as string | undefined)?.toUpperCase()
  return lang || DEFAULT_LANGUAGE
}

/** Query keys that are listing controls, not attribute filters. */
const RESERVED_QUERY_KEYS = [
  'page',
  'minPrice',
  'maxPrice',
  'offset',
  'sortField',
  'sortOrder',
]

/**
 * Turn a route query into `ProductTextFilterInput[]` — the same parse the
 * catalog views do client-side, so a refreshed filtered URL server-renders
 * the *filtered* first page.
 */
function buildTextFilters(
  query: RouteLocationNormalized['query'],
): ProductTextFilterInput[] {
  const out: ProductTextFilterInput[] = []
  for (const [key, value] of Object.entries(query)) {
    if (RESERVED_QUERY_KEYS.includes(key)) continue
    const raw = Array.isArray(value) ? value[0] : value
    if (typeof raw !== 'string') continue
    let values: string[]
    try {
      const parsed = JSON.parse(raw)
      values = Array.isArray(parsed) ? parsed.map(String) : [String(parsed)]
    } catch {
      values = [raw]
    }
    if (values.length) {
      out.push({ name: key, values, exclude: false, type: AttributeType.TEXT })
    }
  }
  return out
}

/** Read a numeric query param. */
function num(value: unknown): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string' || raw === '') return undefined
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) ? n : undefined
}

/** Build `ListingFetchOptions` from a route's query string. */
function listingOptions(
  route: RouteLocationNormalized,
  defaultSort: ProductSortField,
): ListingFetchOptions {
  return {
    page: num(route.query.page) ?? 1,
    offset: num(route.query.offset) ?? 12,
    sortField: (route.query.sortField as ProductSortField) || defaultSort,
    sortOrder: (route.query.sortOrder as SortOrder) || SortOrder.DESC,
    textFilters: buildTextFilters(route.query),
    priceFilterMin: num(route.query.minPrice),
    priceFilterMax: num(route.query.maxPrice),
  }
}

/**
 * Seed the Pinia `auth` store from the SSR-resolved infra so the server render
 * of the catalog shell (account menu, contact pricing) reflects the logged-in
 * user. The seeded state serializes into `__INITIAL_STATE__` and the client
 * hydrates to it identically.
 */
function seedAuth(infra: ServerInfra, ctx: SSRContext): void {
  if (infra.user) {
    useAuthStore().hydrateFromServer(infra.user, ctx.cookies['access_token'] ?? null)
  }
}

// ── Loaders ──────────────────────────────────────────────────────────────────

/** Product detail page — fetch the product for SEO + above-the-fold. */
export async function prefetchProduct(
  route: RouteLocationNormalized,
  ctx: SSRContext,
): Promise<void> {
  const productId = Number.parseInt(route.params.productId as string, 10)
  if (!Number.isFinite(productId)) return
  const lang = routeLanguage(route)
  const infra = await getServerInfra(ctx.cookies, lang)
  seedAuth(infra, ctx)
  const product = await fetchProduct(infra, productId, lang)
  if (product) {
    useSsrCatalogStore().setSeed(route.fullPath, { kind: 'product', data: product })
  }
}

/** Category page — fetch the category + its (possibly filtered) first page. */
export async function prefetchCategory(
  route: RouteLocationNormalized,
  ctx: SSRContext,
): Promise<void> {
  const categoryId = Number.parseInt(route.params.id as string, 10)
  if (!Number.isFinite(categoryId)) return
  const lang = routeLanguage(route)
  const infra = await getListingInfra(ctx.cookies, lang)
  seedAuth(infra, ctx)
  const category = await fetchCategory(
    infra,
    categoryId,
    listingOptions(route, ProductSortField.CATEGORY_ORDER),
  )
  if (category) {
    useSsrCatalogStore().setSeed(route.fullPath, { kind: 'category', data: category })
  }
}

/** Search page — fetch the first page of results for the URL term. */
export async function prefetchSearch(
  route: RouteLocationNormalized,
  ctx: SSRContext,
): Promise<void> {
  const termParam = route.params.term
  const term = Array.isArray(termParam)
    ? termParam.join('/')
    : (termParam as string) || ''
  const lang = routeLanguage(route)
  const infra = await getListingInfra(ctx.cookies, lang)
  seedAuth(infra, ctx)
  const products = await fetchSearch(
    infra,
    term,
    listingOptions(route, ProductSortField.RELEVANCE),
  )
  if (products) {
    useSsrCatalogStore().setSeed(route.fullPath, {
      kind: 'search',
      term,
      data: products,
    })
  }
}

/** Cluster detail page — fetch the cluster (config-scoped attributes). */
export async function prefetchCluster(
  route: RouteLocationNormalized,
  ctx: SSRContext,
): Promise<void> {
  const clusterId = Number.parseInt(route.params.clusterId as string, 10)
  if (!Number.isFinite(clusterId)) return
  const lang = routeLanguage(route)
  const infra = await getServerInfra(ctx.cookies, lang)
  seedAuth(infra, ctx)
  const cluster = await fetchCluster(infra, clusterId, lang)
  if (cluster) {
    useSsrCatalogStore().setSeed(route.fullPath, { kind: 'cluster', data: cluster })
  }
}
