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
import { createServices, toPlain, type Services, type MenuCategory } from 'propeller-v2-vue-ui/shared'
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

// ── Cache control: tags + header convention ─────────────────────────────────
//
// The Node SSR proxy in `server.js` runs a SHA-256-keyed LRU over anonymous
// `/api/graphql` POSTs. Tag-based invalidation works by attaching tags via a
// request header at SDK call time; the proxy parses the header, indexes the
// cache entry by tag, and `POST /api/revalidate` busts entries by tag. This
// module is the source of truth for the tag *naming* — never inline tag
// strings elsewhere, always call `tagFor()`.
//
// The header name is server-internal: never forwarded to the upstream API
// (the proxy strips it implicitly by only forwarding `apikey`, `Content-Type`,
// `Authorization`).

/**
 * HTTP header the SDK uses to ship per-call cache tags to the local SSR
 * proxy (`server.js`'s `/api/graphql` handler). Comma-separated string of
 * tag values. Server-only convention — never sent to the upstream API.
 */
export const CACHE_TAGS_HEADER = 'X-Propeller-Cache-Tags'

/**
 * Umbrella tag for every anonymous catalog read. A single
 * `revalidateTag(TAG_CATALOG)` busts the whole catalog at once. Use
 * surgically (nightly refresh, schema migrations); per-entity tags below
 * are the right tool for routine invalidation.
 */
export const TAG_CATALOG = 'catalog'

type CacheableEntity = 'product' | 'category' | 'cluster' | 'menu' | 'search'

/**
 * Build a Next.js-style cache tag for a cacheable entity. Single source of
 * truth for tag shape — `/api/revalidate` only accepts tags this helper
 * produces. Mirrors `propeller-next/lib/server.ts` `tagFor()`.
 */
export function tagFor(entity: CacheableEntity, id?: number | string): string {
  return id === undefined ? entity : `${entity}:${id}`
}

/**
 * Serialise a tag set into the header value `server.js`'s
 * `parseCacheTagsHeader` expects: comma-joined, whitespace-trimmed.
 */
function tagsHeaderValue(tags: readonly string[]): string {
  return tags.join(',')
}

// ── Client factory ───────────────────────────────────────────────────────────

export interface CreateServerClientOptions {
  /** Override the access-token resolver (tests, anonymous infra). */
  getAccessToken?: () => string | undefined
  endpoint?: string
  apiKey?: string
  /**
   * When set, every GraphQL POST issued by this client carries the
   * `X-Propeller-Cache-Tags` header so the SSR proxy in `server.js` can
   * index the cache entry under each tag and surgically invalidate later.
   *
   * Only set for anonymous infra — authenticated calls don't go through
   * the cache at all (the proxy's `cacheable` gate checks `Authorization`).
   * A static client-level tag set means every operation issued from this
   * infra carries the same umbrella + entity-class tags; per-entity-id
   * tags (e.g. `product:42`) are attached at the fetch-helper level via
   * `withCacheTags()` below.
   */
  cacheTags?: readonly string[]
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
    // When the host provided baseline cache tags (anonymous infra), attach
    // them to every request via a static header. Per-entity tags (e.g.
    // `product:42`) are layered on by the fetch helpers via `withCacheTags`.
    ...(opts.cacheTags?.length && {
      headers: { [CACHE_TAGS_HEADER]: tagsHeaderValue(opts.cacheTags) },
    }),
  }
  return new GraphQLClient(config)
}

/**
 * Build a one-shot child client that carries an additional per-call tag set.
 *
 * The SDK exposes `headers` on the client config, but only at construction
 * time — there's no per-operation header override. To attach per-entity tags
 * (e.g. `product:42`) on top of the infra's baseline tags, we mint a new
 * client whose `headers` merges the two. Cheap (the client is a thin wrapper
 * around `fetch`) and keeps the SSR side from having to invent its own
 * GraphQL transport.
 *
 * Returns the original `infra.client` when the infra isn't cacheable —
 * authenticated renders bypass the proxy cache entirely and don't need the
 * header overhead.
 */
function withCacheTags(infra: ServerInfra, extraTags: readonly string[]): GraphQLClient {
  if (!infra.cacheable || extraTags.length === 0) return infra.client
  const merged = [...(infra.cacheTags ?? []), ...extraTags]
  return createServerClient({
    getAccessToken: () => undefined, // cacheable === anonymous, by definition
    cacheTags: merged,
  })
}

/**
 * Convenience wrapper: returns a `Services` bag bound to a client that
 * carries the merged tag set. The fetch helpers below call this once and
 * issue all their service calls through the result.
 */
function withCacheTagsServices(infra: ServerInfra, extraTags: readonly string[]): Services {
  if (!infra.cacheable || extraTags.length === 0) return infra.services
  return createServices(withCacheTags(infra, extraTags))
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
  /**
   * Whether GraphQL POSTs issued through this infra should attach cache
   * tags. True for `getAnonymousInfra()`, false for `getServerInfra()`
   * (authenticated). The fetch helpers branch on this flag to decide
   * whether to mint a tagged client via `withCacheTags`.
   */
  cacheable: boolean
  /**
   * Baseline tags every operation issued from this infra carries. Per-entity
   * tags (e.g. `product:42`) are added on top inside the fetch helpers.
   * `undefined` when `cacheable` is false.
   */
  cacheTags?: readonly string[]
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

  return {
    client,
    services,
    user,
    language,
    currency: '€',
    includeTax: cookies['price_include_tax'] === '1',
    cacheable: false, // authenticated render — bypasses the SSR proxy cache
  }
}

/**
 * Resolve the per-request infra for an **anonymous** render. Never reads ANY
 * cookies, never calls `getViewer` — `user` is always `null`, prices always
 * net. The route stays cacheable because it never depends on a per-user
 * cookie. Every GraphQL POST carries the `[TAG_CATALOG]` baseline tag header
 * so the server-side proxy LRU can later be busted by tag.
 *
 * Routes that render prices AND need the VAT toggle to take effect server-
 * side should use `getAnonymousInfraWithTax()` instead — that one reads the
 * `price_include_tax` cookie and is therefore non-cacheable.
 */
export function getAnonymousInfra(
  language: string = DEFAULT_LANGUAGE,
): ServerInfra {
  const cacheTags = [TAG_CATALOG] as const
  const client = createServerClient({
    getAccessToken: () => undefined,
    cacheTags,
  })
  const services = createServices(client)
  return {
    client,
    services,
    user: null,
    language,
    currency: '€',
    includeTax: false,
    cacheable: true,
    cacheTags,
  }
}

/**
 * Anonymous infra variant that honours the VAT toggle cookie. Reading the
 * cookie opts the route out of the cacheable path — use this for routes that
 * render prices in the initial HTML and need the gross/net toggle to take
 * effect server-side.
 */
export function getAnonymousInfraWithTax(
  cookies: Record<string, string>,
  language: string = DEFAULT_LANGUAGE,
): ServerInfra {
  const client = createServerClient({ getAccessToken: () => undefined })
  const services = createServices(client)
  return {
    client,
    services,
    user: null,
    language,
    currency: '€',
    includeTax: cookies['price_include_tax'] === '1',
    cacheable: false,
  }
}

/**
 * Pick the right infra for a listing page that renders prices: authenticated
 * (personalised + tax-aware, dynamic) when logged in; anonymous-with-tax
 * (no auth, tax cookie, dynamic) when logged out. Both branches read the tax
 * cookie, so this is always dynamic — pages that don't show prices should
 * call `getAnonymousInfra()` directly to stay cacheable.
 */
export function getListingInfra(
  cookies: Record<string, string>,
  language: string = DEFAULT_LANGUAGE,
): Promise<ServerInfra> | ServerInfra {
  return cookies['access_token']
    ? getServerInfra(cookies, language)
    : getAnonymousInfraWithTax(cookies, language)
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
  /** Tag set the entry was inserted with. Used by `invalidateCache(tag)`. */
  tags: Set<string>
}

const SSR_CACHE_TTL_MS = 24 * 60 * 60 * 1000  // 24 h — anonymous SSR data is essentially static
const SSR_CACHE_NEG_TTL_MS = 60 * 1000        // 60 s — `null` results recover quickly if a slug is fixed
const SSR_CACHE_MAX_ENTRIES = 500             // ~500 unique catalog URLs is generous

const ssrCache = new Map<string, CacheEntry<unknown>>()

/**
 * Secondary index: tag → Set<key>. Mirror of `server.js`'s `gqlTagToKeys`,
 * scoped to this parsed-object SSR cache. Maintained in lock-step with
 * `ssrCache` so `invalidateCache(tag)` is O(entries-for-tag), not O(all).
 */
const ssrTagToKeys = new Map<string, Set<string>>()

/** Remove a single key from both `ssrCache` and `ssrTagToKeys`. */
function cacheDeleteKey(key: string): void {
  const entry = ssrCache.get(key)
  if (!entry) return
  ssrCache.delete(key)
  for (const tag of entry.tags) {
    const keys = ssrTagToKeys.get(tag)
    if (!keys) continue
    keys.delete(key)
    if (keys.size === 0) ssrTagToKeys.delete(tag)
  }
}

/** Read a cache entry, honouring TTL. Touches LRU order on a hit. */
function cacheGet<T>(key: string): T | undefined {
  const hit = ssrCache.get(key)
  if (!hit) return undefined
  if (hit.expiresAt < Date.now()) {
    cacheDeleteKey(key)
    return undefined
  }
  // Re-insert to move the entry to the end (most-recently-used).
  ssrCache.delete(key)
  ssrCache.set(key, hit)
  return hit.value as T
}

/** Write a cache entry with the appropriate TTL, evicting the LRU head if full. */
function cacheSet<T>(key: string, value: T, tags: readonly string[] = []): void {
  // Replace any prior entry first so the tag index stays consistent.
  if (ssrCache.has(key)) cacheDeleteKey(key)
  const ttl = value === null ? SSR_CACHE_NEG_TTL_MS : SSR_CACHE_TTL_MS
  const tagSet = new Set(tags)
  ssrCache.set(key, { value, expiresAt: Date.now() + ttl, tags: tagSet })
  for (const tag of tagSet) {
    let keys = ssrTagToKeys.get(tag)
    if (!keys) {
      keys = new Set<string>()
      ssrTagToKeys.set(tag, keys)
    }
    keys.add(key)
  }
  if (ssrCache.size > SSR_CACHE_MAX_ENTRIES) {
    const oldest = ssrCache.keys().next().value
    if (oldest !== undefined) cacheDeleteKey(oldest)
  }
}

/**
 * Memoise an anonymous fetch by `key`. When `infra.user` is set the cache is
 * bypassed entirely — authenticated renders are dynamic, never cached. Errors
 * are not cached; only successful resolutions (including `null` "not found").
 *
 * `tags` is merged with the infra baseline tags and recorded on the entry so
 * `invalidateCache(tag)` can bust matching entries surgically. Defaults to
 * the infra baseline alone if no per-call tags are provided.
 */
async function withAnonymousCache<T>(
  infra: ServerInfra,
  key: string,
  tags: readonly string[],
  load: () => Promise<T>,
): Promise<T> {
  if (infra.user) return load()
  const cached = cacheGet<T>(key)
  if (cached !== undefined) return cached
  const fresh = await load()
  const allTags = [...(infra.cacheTags ?? []), ...tags]
  cacheSet(key, fresh, allTags)
  return fresh
}

/**
 * Invalidate every SSR-cache entry tagged with `tag`. Exported so the Node
 * server (`server.js`'s `/api/revalidate` route) can bust the parsed-object
 * cache alongside its own raw-response LRU. Returns the number of evicted
 * entries (zero is a valid outcome).
 */
export function invalidateCache(tag: string): number {
  const keys = ssrTagToKeys.get(tag)
  if (!keys || keys.size === 0) return 0
  const victims = [...keys]
  for (const key of victims) cacheDeleteKey(key)
  return victims.length
}

/**
 * Nuclear wipe — drop every entry from the SSR cache and its tag index.
 * Paired with the proxy LRU's `gqlCacheClearAll` by the `/api/revalidate`
 * route when called with `{"tag":"*"}`. Returns the number of evicted
 * entries.
 */
export function clearCache(): number {
  const count = ssrCache.size
  ssrCache.clear()
  ssrTagToKeys.clear()
  return count
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
  // Per-entity tag attached on top of the infra baseline (`catalog`). The
  // proxy LRU indexes the response under both `product` (class bust) and
  // `product:${id}` (surgical bust).
  const tags = [tagFor('product'), tagFor('product', productId)]
  const services = withCacheTagsServices(infra, tags)
  return withAnonymousCache<Product | null>(infra, cacheKey, tags, async () => {
    try {
      const result = await services.product.getProduct({
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
  const tags = [tagFor('category'), tagFor('category', categoryId)]
  const services = withCacheTagsServices(infra, tags)
  return withAnonymousCache<Category | null>(infra, cacheKey, tags, async () => {
    try {
      const result = await services.category.getCategory({
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
  // Search isn't tagged per-term — long-tail terms would explode the tag
  // namespace. Cardinality is controlled by the TTL; class-level
  // `tagFor('search')` busts all search-result entries at once.
  const tags = [tagFor('search')]
  const services = withCacheTagsServices(infra, tags)
  return withAnonymousCache<ProductsResponse | null>(infra, cacheKey, tags, async () => {
    try {
      const result = await services.category.getCategory({
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
  const tags = [tagFor('cluster'), tagFor('cluster', clusterId)]
  const services = withCacheTagsServices(infra, tags)
  return withAnonymousCache<Cluster | null>(infra, cacheKey, tags, async () => {
    try {
      const clusterConfig = await services.cluster.getClusterConfig(clusterId)
      const attributeNames: string[] = (clusterConfig?.config?.settings ?? []).map(
        (setting: ClusterConfigSetting) => setting.name,
      )

      const result = await services.cluster.getCluster({
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

// ── Menu (category tree) ────────────────────────────────────────────────────

/**
 * Default depth of the menu tree. Matches `useMenu`'s default (3) so the
 * server-fetched tree and the legacy client-fetched tree have the same shape.
 */
const MENU_DEPTH_DEFAULT = 3

/**
 * Raw shape returned by the recursive `categories { ... }` GraphQL query —
 * mirrors the package's `useMenu` `MenuCategoryRaw`. Mapped down to the
 * serialisable `MenuCategory` shape `<Menu :tree="...">` consumes before
 * returning, so the Pinia → `__INITIAL_STATE__` → hydration round-trip
 * carries plain data (no nested LocalizedString arrays).
 */
interface RawMenuCategory {
  categoryId: number
  hidden?: boolean | string
  name?: Array<{ value: string; language: string }>
  slug?: Array<{ value: string; language?: string }>
  categories?: RawMenuCategory[]
}

function isMenuCategoryHidden(raw: RawMenuCategory): boolean {
  return raw.hidden === true || raw.hidden === 'Y'
}

function buildMenuCategoriesFragment(depth: number): string {
  if (depth === 0) return ''
  return `
    categories {
      categoryId
      hidden
      name(language: $language) { value language }
      slug(language: $language) { value }
      ${buildMenuCategoriesFragment(depth - 1)}
    }
  `
}

function mapRawMenuCategory(raw: RawMenuCategory, language: string): MenuCategory {
  const nameEntry = raw.name?.find((n) => n.language === language) ?? raw.name?.[0]
  const slugEntry = raw.slug?.[0]
  return {
    categoryId: raw.categoryId,
    name: nameEntry?.value ?? '',
    slug: slugEntry?.value ?? '',
    children: (raw.categories ?? [])
      .filter((child) => !isMenuCategoryHidden(child))
      .map((child) => mapRawMenuCategory(child, language)),
  }
}

/**
 * Server-side menu fetch — returns the `MenuCategory[]` tree
 * `<Menu :tree="...">` consumes. Calls the same recursive GraphQL query
 * the client `useMenu` composable uses, but via `client.execute` so cache
 * tags can be attached and the response lands in `server.js`'s
 * `/api/graphql` proxy LRU under the `menu` tag.
 *
 * Returns an empty array on failure rather than throwing — the menu is
 * non-critical chrome and a transient backend error shouldn't break the
 * whole render. `<Menu>` shows its empty state in that case (and the
 * client falls back to `useMenu` on next interaction).
 */
export async function fetchMenu(
  infra: ServerInfra,
  rootCategoryId: number,
  language?: string,
  depth: number = MENU_DEPTH_DEFAULT,
): Promise<MenuCategory[]> {
  const lang = language ?? infra.language
  const cacheKey = `menu:${rootCategoryId}:${lang}:${depth}`
  const tags = [tagFor('menu')]
  return withAnonymousCache<MenuCategory[]>(infra, cacheKey, tags, async () => {
    const client = withCacheTags(infra, tags)
    // Cache-key keying note: variable order locked (categoryId, language).
    // See the note on `fetchProduct`.
    const query = `
      query Menu($categoryId: Float, $language: String) {
        category(categoryId: $categoryId) {
          categoryId
          hidden
          name(language: $language) { value language }
          slug(language: $language) { value }
          ${buildMenuCategoriesFragment(depth)}
        }
      }
    `
    try {
      const result = await client.execute<{ category: RawMenuCategory | null }>({
        query,
        variables: { categoryId: rootCategoryId, language: lang },
        operationName: 'Menu',
      })
      const root = result.data?.category ?? null
      if (!root) return []
      return (root.categories ?? [])
        .filter((cat) => !isMenuCategoryHidden(cat))
        .map((cat) => mapRawMenuCategory(cat, lang))
    } catch {
      return []
    }
  })
}

