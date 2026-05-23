/**
 * Server-side SDK helpers — for use from the SSR route loaders only.
 *
 * The Vue mirror of `propeller-next/lib/server.ts`. It is consumer-owned (not
 * in the `propeller-v2-vue-ui` package) because the upstream endpoint, the
 * auth cookie name and the API-key env contract are all application-specific.
 * The package contributes only `createServices` + `toPlain` (from its
 * `/shared` entry); this module composes them with propeller-vue's env.
 *
 * What it does:
 *  - Builds a fresh `GraphQLClient` per request that talks **directly** to the
 *    upstream Propeller API (`securityMode: 'direct'`) with the server-only
 *    API key. The browser-facing `/api/graphql` proxy is a public-surface
 *    shield for clients — paying a same-server hop per SSR render is wasteful.
 *  - Reads the JWT from the `access_token` cookie carried on the request for
 *    authenticated, contact-priced renders. Anonymous renders skip it and
 *    stay cacheable.
 *  - Exposes thin `fetchProduct` / `fetchCategory` / `fetchSearch` /
 *    `fetchCluster` helpers whose SDK inputs mirror the client composables
 *    (`useProductSearch`, `useProductInfo`) so the server's first paint
 *    matches what the client grid would have fetched.
 *
 * Import only from `entry-server.ts` / route `ssrPrefetch` loaders. It is not
 * `'use client'`-poisoned (Vue has no such concept) but it reads `process.env`
 * and must never run in the browser.
 */
import {
  GraphQLClient,
  type GraphQLClientConfig,
  type Contact,
  type Customer,
  type Product,
  type Category,
  type Cluster,
  type ProductsResponse,
  type CategoryProductSearchInput,
  type ProductSortInput,
  type SearchFieldsInput,
  type FilterAvailableAttributeInput,
  type ProductTextFilterInput,
  type ProductPriceFilterInput,
  type ClusterConfigSetting,
  ProductStatus,
  ProductSortField,
  SortOrder,
  ProductSearchableField,
} from 'propeller-sdk-v2'
import { createServices, toPlain, type Services } from 'propeller-v2-vue-ui/shared'
import {
  imageSearchFilters,
  imageSearchFiltersGrid,
  imageVariantFiltersMedium,
  imageVariantFiltersLarge,
  baseCategoryId as configBaseCategoryId,
  DEFAULT_LANGUAGE,
} from './config'

/** Statuses the storefront grid shows — mirrors the client `useProductSearch`. */
const STOREFRONT_STATUSES: ProductStatus[] = [
  ProductStatus.A,
  ProductStatus.P,
  ProductStatus.T,
  ProductStatus.S,
]

/**
 * Boosted search-field config — identical to the client `useProductSearch`
 * term path so server-rendered search results rank the same as client ones.
 */
const SEARCH_FIELDS: SearchFieldsInput[] = [
  {
    fieldNames: [
      ProductSearchableField.NAME,
      ProductSearchableField.KEYWORDS,
      ProductSearchableField.SKU,
      ProductSearchableField.CUSTOM_KEYWORDS,
    ],
    boost: 5,
  },
  {
    fieldNames: [
      ProductSearchableField.DESCRIPTION,
      ProductSearchableField.MANUFACTURER,
      ProductSearchableField.MANUFACTURER_CODE,
      ProductSearchableField.EAN_CODE,
      ProductSearchableField.BAR_CODE,
      ProductSearchableField.CLUSTER_ID,
      ProductSearchableField.CUSTOM_KEYWORDS,
      ProductSearchableField.PRODUCT_ID,
      ProductSearchableField.SHORT_DESCRIPTION,
      ProductSearchableField.SUPPLIER,
      ProductSearchableField.SUPPLIER_CODE,
    ],
    boost: 1,
  },
]

/** Backend computes the attribute filter facets only when this is supplied. */
const FILTER_AVAILABLE_ATTRIBUTE_INPUT: FilterAvailableAttributeInput = {
  isSearchable: true,
}

// ── Environment (server-only) ────────────────────────────────────────────────
// The SSR_* vars are the canonical server-side names. We fall back to the
// upstream URL embedded in VITE_GRAPHQL_PROXY_TARGET so an unchanged .env still
// works for local development.
//
// These are read *lazily* (per call), not captured into module-level consts.
// `server.js` loads the .env files into `process.env` before it starts, but
// Vite may transform / evaluate this module at a point where a module-level
// `const` would snapshot an empty value. A getter sidesteps that entirely.

function env(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name]
    if (value) return value
  }
  return ''
}

// ── Client factory ───────────────────────────────────────────────────────────

export interface CreateServerClientOptions {
  /** Override the access-token resolver (tests, anonymous infra). */
  getAccessToken?: () => string | undefined
  endpoint?: string
  apiKey?: string
}

/**
 * Build a fresh `GraphQLClient` for one SSR request. Each call returns a NEW
 * client — the access-token resolver closes over this request's cookies, so
 * sharing a client between requests would leak one user's token to another.
 */
export function createServerClient(
  opts: CreateServerClientOptions = {},
): GraphQLClient {
  const endpoint =
    opts.endpoint ??
    env('SSR_GRAPHQL_ENDPOINT', 'SSR_GRAPHQL_PROXY_TARGET', 'VITE_GRAPHQL_PROXY_TARGET')
  if (!endpoint) {
    console.warn(
      '[lib/server] No upstream endpoint configured. Set SSR_GRAPHQL_ENDPOINT ' +
        '(or VITE_GRAPHQL_PROXY_TARGET) for SSR data fetching.',
    )
  }
  const config: GraphQLClientConfig = {
    endpoint,
    apiKey: opts.apiKey ?? env('SSR_API_KEY', 'VITE_API_KEY'),
    orderEditorApiKey: env('SSR_ORDER_EDITOR_API_KEY', 'VITE_ORDER_EDITOR_API_KEY'),
    securityMode: 'direct',
    timeout: 30000,
    getAccessToken: opts.getAccessToken,
  }
  return new GraphQLClient(config)
}

// ── Per-request infra (mirrors the PropellerProvider value object) ───────────

export interface ServerInfra {
  client: GraphQLClient
  services: Services
  /** The authenticated user when the request carries a valid auth cookie. */
  user: Contact | Customer | null
  language: string
  currency: string
  /** Tax-inclusive pricing — the server defaults to net prices. */
  includeTax: boolean
}

/**
 * Resolve the per-request infra bundle for an **authenticated** render.
 * Reads the `access_token` cookie and hydrates `user` via `getViewer`. If the
 * token is missing or expired the page renders anonymously and the client
 * reconciles on its first action.
 */
export async function getServerInfra(
  cookies: Record<string, string>,
  language: string = DEFAULT_LANGUAGE,
): Promise<ServerInfra> {
  const token = cookies['access_token']
  const client = createServerClient({ getAccessToken: () => token })
  const services = createServices(client)

  let user: Contact | Customer | null = null
  if (token) {
    try {
      const viewer = await services.user.getViewer({})
      user = (viewer ? toPlain(viewer) : null) as Contact | Customer | null
    } catch {
      user = null
    }
  }

  return { client, services, user, language, currency: '€', includeTax: false }
}

/**
 * Resolve the per-request infra for an **anonymous** render. Never reads the
 * auth cookie, never calls `getViewer` — `user` is always `null`. The route
 * stays cacheable because it never depends on a per-user cookie.
 */
export function getAnonymousInfra(
  language: string = DEFAULT_LANGUAGE,
): ServerInfra {
  const client = createServerClient({ getAccessToken: () => undefined })
  const services = createServices(client)
  return { client, services, user: null, language, currency: '€', includeTax: false }
}

/**
 * Pick the right infra for a listing page: anonymous (cacheable) when there is
 * no auth cookie, authenticated (personalised) when there is.
 */
export function getListingInfra(
  cookies: Record<string, string>,
  language: string = DEFAULT_LANGUAGE,
): Promise<ServerInfra> | ServerInfra {
  return cookies['access_token']
    ? getServerInfra(cookies, language)
    : getAnonymousInfra(language)
}

// ── Listing fetch options ────────────────────────────────────────────────────

export interface ListingFetchOptions {
  /** 1-based page. Defaults to 1. */
  page?: number
  /** Items per page. Defaults to 12 (the storefront grid default). */
  offset?: number
  sortField?: ProductSortField
  sortOrder?: SortOrder
  textFilters?: ProductTextFilterInput[]
  priceFilterMin?: number
  priceFilterMax?: number
  language?: string
}

/** Build the optional `textFilters` / `price` slice of the search input. */
function buildFilterInput(
  opts: ListingFetchOptions,
): Partial<CategoryProductSearchInput> {
  const slice: Partial<CategoryProductSearchInput> = {}
  if (opts.textFilters?.length) slice.textFilters = opts.textFilters
  if (opts.priceFilterMin !== undefined || opts.priceFilterMax !== undefined) {
    const price: ProductPriceFilterInput = {
      from: opts.priceFilterMin ?? 0,
      to: opts.priceFilterMax ?? 999999,
    }
    slice.price = price
  }
  return slice
}

/**
 * Stable, content-only key fragment for a listing's filter slice. Sort attribute
 * names + their value arrays so two calls with the same filters (regardless of
 * input order) hit the same cache entry. Price bounds are appended explicitly.
 */
function stableListingKey(opts: ListingFetchOptions): string {
  const filters = (opts.textFilters ?? [])
    .map((f) => ({
      // The SDK types `name` as optional; treat missing as the empty string so
      // the sort and resulting JSON stay deterministic across calls.
      name: f.name ?? '',
      values: [...(f.values ?? [])].sort(),
      exclude: !!f.exclude,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return JSON.stringify({
    f: filters,
    pMin: opts.priceFilterMin ?? null,
    pMax: opts.priceFilterMax ?? null,
  })
}

/** Resolve the `userId` the SDK search input expects from the infra user. */
function resolveUserId(user: Contact | Customer | null): number | undefined {
  if (!user) return undefined
  if ('contactId' in user) return (user as Contact).contactId
  if ('customerId' in user) return (user as Customer).customerId
  return undefined
}

// ── Anonymous-only SSR response cache ────────────────────────────────────────
//
// Mirrors propeller-next's `export const revalidate = 300` posture — anonymous
// catalog renders are byte-identical across visitors and may be served from
// memory for up to 5 minutes. Authenticated renders are skipped entirely (the
// `infra.user` check at the wrapper level): contact-specific pricing must
// never be cross-served.
//
// Why hand-rolled and not a library: it is ~40 lines, has no peer deps, and
// the cache key shape needs to know the SDK input domain anyway. A library
// would add a build dep for no real win.
//
// Eviction: a `Map` preserves insertion order, so re-inserting a key on read
// moves it to the end and the oldest entry sits at `keys().next()`. When the
// store exceeds `SSR_CACHE_MAX_ENTRIES` we drop the head. True LRU in O(1).
//
// Scope: one cache per Node process. PM2 in prod usually runs SSR with a
// single instance; if scaled out, each worker keeps its own — fine for a
// 5-minute TTL on catalog data. Process restart clears it (acceptable).
//
// Negative results (`null`) are cached for a shorter window so a 404'd ID
// can't hammer the upstream, but recover quickly once a slug is fixed.

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

const SSR_CACHE_TTL_MS = 24 * 60 * 60 * 1000  // 24 h — anonymous SSR data is essentially static
const SSR_CACHE_NEG_TTL_MS = 60 * 1000        // 60 s — `null` results recover quickly if a slug is fixed
const SSR_CACHE_MAX_ENTRIES = 500             // ~500 unique catalog URLs is generous

const ssrCache = new Map<string, CacheEntry<unknown>>()

/** Read a cache entry, honouring TTL. Touches LRU order on a hit. */
function cacheGet<T>(key: string): T | undefined {
  const hit = ssrCache.get(key)
  if (!hit) return undefined
  if (hit.expiresAt < Date.now()) {
    ssrCache.delete(key)
    return undefined
  }
  // Re-insert to move the entry to the end (most-recently-used).
  ssrCache.delete(key)
  ssrCache.set(key, hit)
  return hit.value as T
}

/** Write a cache entry with the appropriate TTL, evicting the LRU head if full. */
function cacheSet<T>(key: string, value: T): void {
  const ttl = value === null ? SSR_CACHE_NEG_TTL_MS : SSR_CACHE_TTL_MS
  ssrCache.set(key, { value, expiresAt: Date.now() + ttl })
  if (ssrCache.size > SSR_CACHE_MAX_ENTRIES) {
    const oldest = ssrCache.keys().next().value
    if (oldest !== undefined) ssrCache.delete(oldest)
  }
}

/**
 * Memoise an anonymous fetch by `key`. When `infra.user` is set the cache is
 * bypassed entirely — authenticated renders are dynamic, never cached. Errors
 * are not cached; only successful resolutions (including `null` "not found").
 */
async function withAnonymousCache<T>(
  infra: ServerInfra,
  key: string,
  load: () => Promise<T>,
): Promise<T> {
  if (infra.user) return load()
  const cached = cacheGet<T>(key)
  if (cached !== undefined) return cached
  const fresh = await load()
  cacheSet(key, fresh)
  return fresh
}

// ── Thin fetch helpers ───────────────────────────────────────────────────────

/**
 * Fetch a single product by ID with the gallery-sized image variant.
 * Returns `null` when the product genuinely doesn't exist; throws otherwise.
 */
export async function fetchProduct(
  infra: ServerInfra,
  productId: number,
  language?: string,
): Promise<Product | null> {
  const lang = language ?? infra.language
  const cacheKey = `product:${productId}:${lang}`
  return withAnonymousCache<Product | null>(infra, cacheKey, async () => {
    try {
      const result = await infra.services.product.getProduct({
        productId,
        language: lang,
        imageSearchFilters,
        imageVariantFilters: imageVariantFiltersLarge,
      })
      return result ? (toPlain(result) as Product) : null
    } catch (e) {
      if (e instanceof Error && /not found|null for non-nullable/i.test(e.message)) {
        return null
      }
      throw e
    }
  })
}

/**
 * Fetch a single category WITH its first page of products — the shape the
 * category page needs to server-render real product cards. The
 * `categoryProductSearchInput` mirrors the client `useProductSearch` listing
 * path. Returns `null` when the category doesn't exist.
 */
export async function fetchCategory(
  infra: ServerInfra,
  categoryId: number,
  opts: ListingFetchOptions = {},
): Promise<Category | null> {
  const lang = opts.language ?? infra.language
  const sortField = opts.sortField ?? ProductSortField.CATEGORY_ORDER
  const sortOrder = opts.sortOrder ?? SortOrder.DESC
  const page = opts.page ?? 1
  const offset = opts.offset ?? 12
  const sortInputs: ProductSortInput[] = [{ field: sortField, order: sortOrder }]
  const userId = resolveUserId(infra.user)

  const categoryProductSearchInput: CategoryProductSearchInput = {
    language: lang,
    page,
    offset,
    statuses: STOREFRONT_STATUSES,
    hidden: false,
    sortInputs,
    ...buildFilterInput(opts),
    ...(userId !== undefined && { userId }),
  }

  const cacheKey = `category:${categoryId}:${lang}:${sortField}:${sortOrder}:${page}:${offset}:${stableListingKey(opts)}`
  return withAnonymousCache<Category | null>(infra, cacheKey, async () => {
    try {
      const result = await infra.services.category.getCategory({
        categoryId,
        language: lang,
        categoryProductSearchInput,
        filterAvailableAttributeInput: FILTER_AVAILABLE_ATTRIBUTE_INPUT,
        imageSearchFilters: imageSearchFiltersGrid,
        imageVariantFilters: imageVariantFiltersMedium,
      })
      return result ? (toPlain(result) as Category) : null
    } catch (e) {
      if (e instanceof Error && /not found|null for non-nullable/i.test(e.message)) {
        return null
      }
      throw e
    }
  })
}

/**
 * Server-side product search — the first page of results for a search term.
 * Mirrors the client `useProductSearch` term path: it queries the base
 * category with a boosted `term` + `searchFields`. `baseCategoryId` defaults
 * to the project's configured base category.
 */
export async function fetchSearch(
  infra: ServerInfra,
  term: string,
  opts: ListingFetchOptions = {},
  baseCategoryId: number = configBaseCategoryId,
): Promise<ProductsResponse | null> {
  const lang = opts.language ?? infra.language
  const sortField = opts.sortField ?? ProductSortField.RELEVANCE
  const sortOrder = opts.sortOrder ?? SortOrder.DESC
  const page = opts.page ?? 1
  const offset = opts.offset ?? 12
  const sortInputs: ProductSortInput[] = [{ field: sortField, order: sortOrder }]
  const userId = resolveUserId(infra.user)

  const categoryProductSearchInput: CategoryProductSearchInput = {
    language: lang,
    page,
    offset,
    statuses: STOREFRONT_STATUSES,
    hidden: false,
    ...(term && { term, searchFields: SEARCH_FIELDS }),
    sortInputs,
    ...buildFilterInput(opts),
    ...(userId !== undefined && { userId }),
  }

  const cacheKey = `search:${baseCategoryId}:${lang}:${term}:${sortField}:${sortOrder}:${page}:${offset}:${stableListingKey(opts)}`
  return withAnonymousCache<ProductsResponse | null>(infra, cacheKey, async () => {
    try {
      const result = await infra.services.category.getCategory({
        categoryId: baseCategoryId,
        language: lang,
        categoryProductSearchInput,
        filterAvailableAttributeInput: FILTER_AVAILABLE_ATTRIBUTE_INPUT,
        imageSearchFilters: imageSearchFiltersGrid,
        imageVariantFilters: imageVariantFiltersMedium,
      })
      const products = result?.products as ProductsResponse | undefined
      return products ? (toPlain(products) as ProductsResponse) : null
    } catch (e) {
      if (e instanceof Error && /not found|null for non-nullable/i.test(e.message)) {
        return null
      }
      throw e
    }
  })
}

/**
 * Fetch a single cluster for the cluster detail page. Mirrors the two-step
 * fetch the client `useProductInfo` performs: `getClusterConfig` to discover
 * the configurator attribute names, then `getCluster` scoped to those names.
 * Returns `null` when the cluster doesn't exist.
 */
export async function fetchCluster(
  infra: ServerInfra,
  clusterId: number,
  language?: string,
): Promise<Cluster | null> {
  const lang = language ?? infra.language
  const cacheKey = `cluster:${clusterId}:${lang}`
  return withAnonymousCache<Cluster | null>(infra, cacheKey, async () => {
    try {
      const clusterConfig = await infra.services.cluster.getClusterConfig(clusterId)
      const attributeNames: string[] = (clusterConfig?.config?.settings ?? []).map(
        (setting: ClusterConfigSetting) => setting.name,
      )

      const result = await infra.services.cluster.getCluster({
        clusterId,
        language: lang,
        imageSearchFilters: imageSearchFiltersGrid,
        imageVariantFilters: imageVariantFiltersLarge,
        ...(attributeNames.length > 0 && {
          attributeResultSearchInput: {
            attributeDescription: { names: attributeNames },
          },
        }),
      })
      return result ? (toPlain(result) as Cluster) : null
    } catch (e) {
      if (e instanceof Error && /not found|null for non-nullable/i.test(e.message)) {
        return null
      }
      throw e
    }
  })
}

