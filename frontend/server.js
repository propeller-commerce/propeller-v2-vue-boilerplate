/**
 * Node SSR server for propeller-vue.
 *
 * Replaces the previous `vite preview` (static-only) start command. It:
 *   - DEV  : runs Vite in middleware mode (HMR, on-the-fly transforms) and
 *            loads `src/entry-server.ts` fresh per request.
 *   - PROD : serves the built client assets from `dist/client/` and loads the
 *            pre-built `dist/server/entry-server.js`.
 *   - Both : proxies `/api/graphql` to the upstream
 *            Propeller API with the `apikey` header injected server-side —
 *            the same shield the old Vite dev proxy provided, now in prod too.
 *
 * The SSR data layer (`src/lib/server.ts`) talks to the upstream API directly
 * (not via this proxy) for render-time fetches; this proxy is the public
 * surface the *browser* SDK calls post-hydration.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import express from 'express'
import {
  getMollieProvider,
  isMollieEnabled,
  isOnAccountMethod,
} from './src/server/mollie.js'
import { getMspProvider, isMspEnabled, mspApiKey } from './src/server/msp.js'
import { verifyWebhookSignature } from '@propeller-commerce/propeller-v2-msp'
import {
  chargeFor,
  handleMspNotification,
  ownedOrder,
  PAYMENT_ORDER_QUERY,
  paymentRedirectUrl,
  paymentSiteUrl,
} from './src/server/payments.js'
import { priceRequestHandler } from './src/server/priceRequest.js'
import { contactHandler } from './src/server/contact.js'
import { clientIp, createRateLimiter, formLimiter, FORM_RATE_LIMITS } from './src/server/rateLimit.js'
import { trackerGate } from './src/server/trackerAuth.js'
import {
  argument,
  checkoutFlag,
  createdOrderId,
  createSpentLog,
  idOf,
  isOwnQuotation,
  contactRegisterParentId,
  isOwnOrder,
  isSdkDocument,
  LAST_ORDER_COOKIE,
  LAST_ORDER_MAX_AGE,
  mayReadOrder,
  mustRefuseElevation,
  ORDER_EDITOR_CLIENT_ID,
  orderEditorReason,
  quoteAcceptOrderId,
  signLastOrder,
  singleField,
  upstreamAuth,
  verifyLastOrder,
} from './src/server/orderEditorRouting.js'
import {
  hasPriceFilter,
  inspectDocument,
  isCacheableQuery,
  parseDocument,
  selectsOrderRead,
  withoutPriceFilters,
} from './src/server/graphqlGuards.js'
import { forVisitor, pricesHidden } from './src/server/hidePrices.js'
import {
  COMPANY_CREATE_FIELD,
  companyCreateVariables,
  CONTACT_FLAG,
  createdCompanyId,
  mayRegisterContact,
  registeredContact,
  REGISTRATION_COOKIE,
  REGISTRATION_MAX_AGE,
  registrationLimited,
  registrationStep,
  selectsContactRegister,
  selectsField,
  signRegistration,
  verifyRegistration,
} from './src/server/registrationRouting.js'
import { createViewerLookup, fetchViewerFrom } from './src/server/viewer.js'
import { errorSummary, isSameOrigin, isSameOriginJson, safeEqual } from './src/server/httpGuards.js'
import {
  ACCESS_COOKIE,
  ACCESS_MAX_AGE,
  createRenewer,
  exchangeRefreshFrom,
  isSessionToken,
  needsRenewal,
  REFRESH_COOKIE,
  REFRESH_MAX_AGE,
  withCookie,
} from './src/server/session.js'
import { ingestBatch, visitorCookie, VISITOR_COOKIE } from './src/server/trackingIngest.js'
import { isTrackingConfigured, classifyDbError, STATUS_HINTS, todayLocal, addDays } from './src/server/tracking.js'
import { METRICS, MAX_LIMIT, MAX_RANGE_DAYS } from './src/server/trackingQueries.js'
import { CartService } from '@propeller-commerce/propeller-sdk-v2'
import {
  parseSetupRequest,
  buildSetupResponse,
  buildErrorResponse,
  buildStartUrl,
  buildAutoPostForm,
  buildDebugPage,
  buildOciFields,
  buildOrderCxml,
  mapOciParams,
} from '@propeller-commerce/propeller-v2-punchout'
import {
  isPunchoutEnabled,
  isPunchoutDebug,
  resolveCxmlBuyer,
  createPunchoutMagicToken,
  createAuthedClient,
  PUNCHOUT_CONFIG,
  CART_IMAGE_FILTERS,
  PUNCHOUT_COOKIE,
  PUNCHOUT_FLAG_COOKIE,
  PUNCHOUT_MAX_AGE,
  PUNCHOUT_PENDING_COOKIE,
  PUNCHOUT_PENDING_MAX_AGE,
  punchoutAfterLogin,
  signCxmlSetup,
  signPendingSession,
  signPunchoutSession,
  validReturnUrl,
  verifyCxmlSetup,
  verifyPunchoutSession,
} from './src/server/punchout.js'
import {
  isPreprEnabled,
  resolvePreprRequest,
  preprUidCookie,
} from './src/server/cms.js'
import {
  resolvePreviewRequest,
  resolvePreviewExit,
  isCmsPreviewActive,
  STRAPI_PREVIEW_COOKIE,
} from './src/server/preview.js'
import { securityHeaders, transferPolicy } from './src/server/securityHeaders.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Load `.env` / `.env.local` into `process.env`.
 *
 * Vite injects `.env` values into the *client* bundle as `import.meta.env.*`,
 * but the Node server reads `process.env` — a different namespace Vite never
 * touches. Without this the SSR data seam has no upstream endpoint or API key.
 * `.env.local` overrides `.env`; existing real `process.env` entries (CI env
 * vars) always win over the files.
 */
function loadEnvFile(file) {
  const full = path.resolve(__dirname, file)
  if (!fs.existsSync(full)) return
  for (const line of fs.readFileSync(full, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key && process.env[key] === undefined) process.env[key] = value
  }
}
loadEnvFile('.env.local')
loadEnvFile('.env')

const isProd = process.env.NODE_ENV === 'production'
const PORT = Number(process.env.PORT) || 5173
const HOST = process.env.HOST || '127.0.0.1'

// Upstream + keys. Keys are server-only: never give them a VITE_ prefix.
const UPSTREAM =
  process.env.SSR_GRAPHQL_PROXY_TARGET ||
  process.env.VITE_GRAPHQL_PROXY_TARGET ||
  'https://api.staging.helice.cloud/v2/graphql'
const API_KEY = process.env.SSR_API_KEY || ''
const ORDER_EDITOR_API_KEY = process.env.SSR_ORDER_EDITOR_API_KEY || ''

// Semi-closed and closed shops (#4): /api/graphql answers carry prices only for a
// verified Contact or Customer. The same var the client bundle is built with.
const PRICE_GATE = pricesHidden(process.env.VITE_PORTAL_MODE, false)

/**
 * The verified viewer behind a Bearer (src/server/viewer.js), for every privilege
 * decision: `await verifiedViewer(token)` → `{ type: 'Contact', contactId, companyId,
 * companyIds, managerOf }` | `{ type: 'Customer', customerId }` | null. Never rejects;
 * cached per sha256(token). A token that merely parses as a JWT proves nothing.
 */
const verifiedViewer = createViewerLookup(fetchViewerFrom(UPSTREAM, API_KEY))

/**
 * The request's Bearer: the httpOnly `access_token` cookie, else the Authorization
 * header. Blank (`access_token=%09`) counts as none.
 */
function requestBearer(req) {
  const cookieToken = parseCookies(req.headers.cookie || '')[ACCESS_COOKIE]?.trim()
  const auth = req.headers['authorization']
  const header = Array.isArray(auth) ? auth[0] : auth
  const headerToken = header?.startsWith('Bearer ') ? header.slice(7).trim() : ''
  return cookieToken || headerToken || undefined
}

/** Options for a server-only cookie (signed values: last order, registration, …). */
function privateCookieOptions(req, maxAgeSeconds) {
  return { httpOnly: true, secure: isProd || req.secure, sameSite: 'lax', path: '/', maxAge: maxAgeSeconds * 1000 }
}

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

// ── Session cookies (V1) ────────────────────────────────────────────────────
//
// The login flows hand their tokens to POST /api/auth/session, which keeps them in
// httpOnly cookies; browser code never stores or reads a token. `renewSession` runs
// before every route: an access token that is missing or about to expire is renewed
// from the refresh cookie, set on the response and swapped into this request's
// Cookie header, so the proxy, SSR and every other route see the fresh one.

const renewTokens = createRenewer(exchangeRefreshFrom(UPSTREAM, API_KEY))

function setSessionCookies(req, res, { accessToken, refreshToken }) {
  res.cookie(ACCESS_COOKIE, accessToken, privateCookieOptions(req, ACCESS_MAX_AGE))
  if (refreshToken) res.cookie(REFRESH_COOKIE, refreshToken, privateCookieOptions(req, REFRESH_MAX_AGE))
}

async function renewSession(req, res, next) {
  // The session routes set or drop the cookies themselves.
  if (req.path === '/api/auth/session') return next()
  const cookies = parseCookies(req.headers.cookie || '')
  if (!cookies[REFRESH_COOKIE] || !needsRenewal(cookies[ACCESS_COOKIE])) return next()
  const fresh = await renewTokens(cookies[REFRESH_COOKIE])
  if (fresh) {
    setSessionCookies(req, res, fresh)
    req.headers.cookie = withCookie(req.headers.cookie, ACCESS_COOKIE, fresh.accessToken)
  }
  next()
}

// ── Proxy hardening: per-IP rate limit + body cap ───────────────────────────
//
// `/api/graphql` injects an API key server-side, so an
// unthrottled proxy is an open, unauthenticated relay to the upstream GraphQL
// API — anyone who can reach the site can drive it at any rate. These are the
// Vue mirror of propeller-next's app/api/graphql/route.ts limits; they don't
// replace upstream validation, they stop the trivial DoS / scrape.
//
// In-memory buckets = one limiter per Node process. PM2 typically runs SSR
// single-instance; behind N instances each enforces its own slice, so the
// effective ceiling is N × the limit. Move to Redis or a CDN edge limit if you
// scale out.
// Channel the events belong to. Mirrors VITE_CHANNEL_ID, which the client
// reads -- kept unprefixed here because server code never sees import.meta.env.
const TRACKING_CHANNEL_ID = parseInt(process.env.CHANNEL_ID || process.env.VITE_CHANNEL_ID || '1', 10)

const RATE_LIMIT_WINDOW_MS = 60_000 // 1 min rolling window
// Deliberately generous: a real shopper fires 4–8 GraphQL calls per page
// navigation (menu, search, cart, price toggle, grid, PDP tabs), so a brisk
// session crosses 60/min easily. This is a bot/scraper shield, not a
// user-behavior shield. Same numbers as the Next boilerplate.
const RATE_LIMIT_AUTH = 300 // per-IP, authenticated
const RATE_LIMIT_ANON = 150 // per-IP, anonymous
const MAX_BODY_BYTES = 100 * 1024 // 100 KB — accommodates large bulk queries

/** ip → array of request timestamps inside the current window. */
const rateLimitBuckets = new Map()

/**
 * Structural JWT check — 3 segments, decodable JSON payload, `exp` in the
 * future. The signature is NOT verified: upstream is the authority on token
 * validity and re-checks every call. This exists only so the higher auth
 * rate-limit tier keys off a token that at least parses, rather than raw
 * cookie presence — which any HTTP client can forge with `access_token=x`
 * to claim the auth ceiling. (Mirrors propeller-next's lib/jwt.ts; the fix
 * was asked for on the Next side, applied here from the start.)
 */
function looksLikeValidJwt(token) {
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 3) return false
  let payload
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))
  } catch {
    return false
  }
  if (!payload || typeof payload !== 'object') return false
  // `exp` is seconds since epoch. No exp claim → can't prove expiry, treat as
  // plausible (upstream still rejects it if it isn't).
  if (typeof payload.exp === 'number') return payload.exp * 1000 > Date.now()
  return true
}

function isRateLimited(ip, limit) {
  const now = Date.now()
  const cutoff = now - RATE_LIMIT_WINDOW_MS
  const fresh = (rateLimitBuckets.get(ip) ?? []).filter((t) => t > cutoff)
  if (fresh.length >= limit) {
    rateLimitBuckets.set(ip, fresh)
    return true
  }
  fresh.push(now)
  rateLimitBuckets.set(ip, fresh)
  // ponytail: sweep only when the map gets big. Unlike Next's per-request
  // lambdas this process lives for weeks, so never pruning would leak one
  // array per IP ever seen. Bump the threshold if you front a large NAT.
  if (rateLimitBuckets.size > 10_000) {
    for (const [key, stamps] of rateLimitBuckets) {
      if (!stamps.some((t) => t > cutoff)) rateLimitBuckets.delete(key)
    }
  }
  return false
}

/**
 * Express middleware — mounted on the key-injecting proxy. The auth tier is
 * gated on a structurally valid, non-expired JWT (see looksLikeValidJwt), so
 * presenting any `access_token` cookie value doesn't buy the higher ceiling.
 */
function rateLimitProxy(req, res, next) {
  const token = parseCookies(req.headers.cookie || '')[ACCESS_COOKIE]
  const limit = looksLikeValidJwt(token) ? RATE_LIMIT_AUTH : RATE_LIMIT_ANON
  if (isRateLimited(clientIp(req), limit)) {
    res.set('Retry-After', String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)))
    refuse(res, 429, 'rate limit exceeded')
    return
  }
  next()
}

/**
 * A refused proxy request: always a JSON GraphQL error, never text, so the SDK and
 * the storefront suite can read `errors[0].extensions.code`. Messages stay generic.
 */
function refuse(res, status, message) {
  res.status(status).json({ errors: [{ message, extensions: { code: 'FORBIDDEN' } }] })
}

// ── Anonymous GraphQL response cache ────────────────────────────────────────
//
// In-memory LRU keyed by the request body. The `/api/graphql` handler below
// consults this for anonymous `query` operations (no Authorization header,
// no `mutation` / `subscription`) and serves the upstream response from here
// on a hit. Mutations and authenticated requests bypass entirely.
//
// One cache per Node process. PM2 typically runs SSR with a single instance;
// horizontal scaling would warm each worker independently — fine for 24 h
// TTL on catalog data.

const GQL_CACHE_TTL_MS = 24 * 60 * 60 * 1000  // 24 h
const GQL_CACHE_MAX_ENTRIES = 1000

/**
 * Primary cache: SHA-256(request body) → entry. Entry shape:
 *   { status, contentType, body: Buffer, expiresAt, tags: Set<string> }
 *
 * `tags` is populated from the `x-propeller-cache-tags` request header that
 * `lib/server.ts` attaches on anonymous catalog reads. Empty for callers
 * that don't send the header — those entries are still cached (TTL only)
 * but can't be busted surgically.
 */
const gqlCache = new Map()

/**
 * Secondary index: tag → Set<key>. Keeps the inverse mapping so
 * `gqlCacheInvalidateTag('product:42')` is O(entries-for-that-tag), not
 * O(every-cache-entry). Maintained in lock-step with the primary cache:
 * `gqlCacheSet` adds, `gqlCacheDeleteKey` removes.
 */
const gqlTagToKeys = new Map()

function gqlCacheGet(key) {
  const hit = gqlCache.get(key)
  if (!hit) return undefined
  if (hit.expiresAt < Date.now()) {
    gqlCacheDeleteKey(key)
    return undefined
  }
  // LRU touch: re-insert to move to the most-recently-used end.
  gqlCache.delete(key)
  gqlCache.set(key, hit)
  return hit
}

/**
 * Remove a single key from both the primary cache and the tag index.
 * Centralised so eviction paths (TTL miss, LRU overflow, tag bust) all
 * keep the two structures in sync — leaking dangling tag entries is the
 * easy way to grow `gqlTagToKeys` without bound.
 */
function gqlCacheDeleteKey(key) {
  const entry = gqlCache.get(key)
  if (!entry) return
  gqlCache.delete(key)
  if (entry.tags) {
    for (const tag of entry.tags) {
      const keys = gqlTagToKeys.get(tag)
      if (!keys) continue
      keys.delete(key)
      if (keys.size === 0) gqlTagToKeys.delete(tag)
    }
  }
}

function gqlCacheSet(key, entry) {
  // Replace any previous entry for the same key — keeps the tag index
  // consistent if the same operation is re-cached with a different tag set.
  if (gqlCache.has(key)) gqlCacheDeleteKey(key)

  const tags = entry.tags instanceof Set ? entry.tags : new Set(entry.tags || [])
  gqlCache.set(key, { ...entry, tags, expiresAt: Date.now() + GQL_CACHE_TTL_MS })

  for (const tag of tags) {
    let keys = gqlTagToKeys.get(tag)
    if (!keys) {
      keys = new Set()
      gqlTagToKeys.set(tag, keys)
    }
    keys.add(key)
  }

  if (gqlCache.size > GQL_CACHE_MAX_ENTRIES) {
    const oldest = gqlCache.keys().next().value
    if (oldest !== undefined) gqlCacheDeleteKey(oldest)
  }
}

/**
 * Surgical invalidation entry point — called by `/api/revalidate` once it
 * has validated the shared-secret header. Returns the number of cache
 * entries removed (zero is a valid result: the tag may simply not have any
 * live entries pinned to it).
 */
function gqlCacheInvalidateTag(tag) {
  const keys = gqlTagToKeys.get(tag)
  if (!keys || keys.size === 0) return 0
  // Snapshot first — `gqlCacheDeleteKey` mutates the set we're iterating.
  const victims = [...keys]
  for (const key of victims) gqlCacheDeleteKey(key)
  return victims.length
}

/**
 * Nuclear option — drop every entry from both the primary cache and the
 * tag index. Used by `POST /api/revalidate` with `{"tag":"*"}` when a tag
 * scoped to a single entity isn't enough (e.g. after a bulk catalog import,
 * or for tagless legacy entries that pre-date the tag scheme).
 */
function gqlCacheClearAll() {
  const count = gqlCache.size
  gqlCache.clear()
  gqlTagToKeys.clear()
  return count
}

/**
 * Parse the `x-propeller-cache-tags` request header into a Set of tag
 * strings. Format: comma-separated, whitespace-trimmed, empty values
 * dropped. Anything malformed produces an empty Set — the request is
 * cacheable, just not tag-bustable.
 */
function parseCacheTagsHeader(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') return new Set()
  const out = new Set()
  for (const part of headerValue.split(',')) {
    const trimmed = part.trim()
    if (trimmed) out.add(trimmed)
  }
  return out
}

/** SHA-256 hex digest of the forwarded body — stable cache key per operation+variables. */
function gqlCacheKey(body) {
  return crypto.createHash('sha256').update(body).digest('hex')
}

// Checkout mutations already run elevated, per order (see createSpentLog).
const spentCheckout = createSpentLog()

const uniqueFlags = (flags) => [...new Set(flags)].join('')

/**
 * Express handler for POST /api/graphql with anonymous-query response cache.
 * Forwards via `fetch` so we can capture the response body for caching.
 */
function graphqlCachedHandler() {
  return (req, res) => {
    // Collect the raw body manually. Capped: this buffers in memory, so without a
    // ceiling a single client can make the process allocate without bound.
    const chunks = []
    let received = 0
    let aborted = false
    const declared = Number(req.headers['content-length'])
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      refuse(res, 413, 'payload too large')
      req.destroy()
      return
    }
    req.on('data', (c) => {
      if (aborted) return
      received += c.length
      if (received > MAX_BODY_BYTES) {
        aborted = true
        refuse(res, 413, 'payload too large')
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => {
      if (aborted) return
      proxyGraphql(req, res, Buffer.concat(chunks)).catch((err) => {
        // Generic in production: error text can carry upstream URLs and details (#15).
        console.error('[gql-proxy] error:', isProd ? err?.name || 'Error' : err)
        if (!res.headersSent) refuse(res, 500, 'GraphQL request failed')
      })
    })
    req.on('error', (err) => {
      console.error('[gql-proxy] request error:', isProd ? err?.name || 'Error' : err)
      if (!res.headersSent) refuse(res, 400, 'Bad request')
    })
  }
}

async function proxyGraphql(req, res, rawBody) {
  // Only `{ query, variables, operationName }` goes upstream (#3): a persisted-query
  // hash (`extensions`) or any other key would run a document no guard here has seen.
  let parsed
  try {
    parsed = JSON.parse(rawBody.toString('utf-8'))
  } catch {
    return refuse(res, 400, 'Invalid JSON body')
  }
  if (!isRecord(parsed) || typeof parsed.query !== 'string') return refuse(res, 400, 'query must be a string')
  if (parsed.variables != null && !isRecord(parsed.variables)) return refuse(res, 400, 'variables must be an object')
  // Parsed once; every guard below shares this AST (#17).
  const doc = parseDocument(parsed.query)
  if (!doc) return refuse(res, 400, 'Invalid GraphQL document')
  const body = {
    query: parsed.query,
    variables: parsed.variables ?? undefined,
    operationName: typeof parsed.operationName === 'string' ? parsed.operationName : undefined,
  }

  const guards = inspectDocument(doc)
  // The storefront never inspects the schema (#13).
  if (guards.introspection) return refuse(res, 403, 'Introspection is not allowed')
  // Cost prices are removed by response key below; an alias would rename one past that.
  if (guards.costPriceAlias) return refuse(res, 403, 'Aliases on cost prices are not allowed')

  // Auth: the browser sends no Authorization header; the Bearer is the httpOnly
  // `access_token` cookie (POST /api/auth/session, renewed by renewSession). An explicit
  // header still works for non-browser clients.
  const cookies = parseCookies(req.headers.cookie || '')
  const bearer = requestBearer(req)
  // Looked up at most once per request, only when a decision needs it.
  let viewerPending
  const viewer = () => (viewerPending ??= verifiedViewer(bearer))

  // Price gate (#4): the lookup runs alongside the upstream call. Documents that could
  // reveal prices despite the stripping wait for it: any alias the SDK doesn't use
  // (hidePrices works on response keys, so an alias can move a price under a key it
  // keeps) and inline price filters are refused, before the cache; price filters and
  // PRICE sorts in the variables are removed (the shop's own listings send them
  // there, so they keep working for guests).
  if (PRICE_GATE) {
    viewer()
    if (guards.foreignAlias || guards.inlinePriceFilter || hasPriceFilter(body.variables)) {
      if (!(await viewer())) {
        if (guards.foreignAlias || guards.inlinePriceFilter) {
          return refuse(res, 403, 'Aliases, price filters and price sorts are not allowed here')
        }
        body.variables = withoutPriceFilters(body.variables)
      }
    }
  }

  // Order reads only for their owner (mayReadOrder): the verified viewer who placed the
  // order, or a guest reading the order this browser just placed, and only as the SDK's
  // own documents (isSdkDocument). Whatever the storefront key may read, they run on the
  // order-editor key without the Bearer; anything else is refused.
  const single = singleField(doc)
  const orderRead = selectsOrderRead(doc)
  if (orderRead) {
    const allowed =
      !!ORDER_EDITOR_API_KEY &&
      isSdkDocument(doc, single?.node.name.value) &&
      (await mayReadOrder(single, body.variables, {
        viewer: await viewer(),
        lastOrderId: verifyLastOrder(cookies[LAST_ORDER_COOKIE])?.orderId ?? null,
        fetchOrder: editorOrder,
      }))
    if (!allowed) return refuse(res, 403, 'Forbidden: this order is not available')
  }

  // Order-editor key also for the checkout's own mutations on the order this browser
  // just placed, a manager adding a contact and a viewer accepting its own quote
  // (src/server/orderEditorRouting.js).
  const clientIdHeader = req.headers['x-client-id']
  const clientId = Array.isArray(clientIdHeader) ? clientIdHeader[0] : clientIdHeader
  let reason = null
  let lastOrder = null
  // Self-registration (#12): the SDK's own companyCreate (anonymous, rate-limited,
  // registration fields only) and companyAddressCreate for the company this browser
  // just created. Sent without the Bearer, so only the order-editor key decides.
  const registration = ORDER_EDITOR_API_KEY ? verifyRegistration(cookies[REGISTRATION_COOKIE]) : null
  const regStep = ORDER_EDITOR_API_KEY
    ? registrationStep(doc, single, body.variables, { isAnonymous: !bearer, registration })
    : null
  // A company is created only by that step, never by another document on the storefront key.
  if (regStep?.kind !== 'company' && selectsField(doc, COMPANY_CREATE_FIELD)) {
    return refuse(res, 403, 'Forbidden: company registration is not allowed here')
  }
  if (regStep?.kind === 'company') {
    const retryAfter = registrationLimited(clientIp(req))
    if (retryAfter) {
      res.set('Retry-After', String(retryAfter))
      return refuse(res, 429, 'Too many registrations, try again later')
    }
    body.variables = companyCreateVariables(body.variables)
  }
  // Self-registration's contact step: the SDK's own contactRegister, anonymous, into the company
  // this browser just created, once. It needs the order-editor key, like the company and address steps.
  const contactStep =
    !!ORDER_EDITOR_API_KEY &&
    isSdkDocument(doc, 'contactRegister') &&
    mayRegisterContact(contactRegisterParentId(single, body.variables), { isAnonymous: !bearer, registration })
  if (orderRead) {
    reason = 'order-read'
  } else if (regStep || contactStep) {
    reason = 'registration'
  } else if (ORDER_EDITOR_API_KEY && single) {
    const state = verifyLastOrder(cookies[LAST_ORDER_COOKIE])
    // Cookie flags plus the server's own record, which a replayed older cookie can't undo.
    lastOrder = state && { orderId: state.orderId, used: uniqueFlags(state.used + spentCheckout.flags(state.orderId)) }
    const isContactRegister = single.node.name.value === 'contactRegister' && clientId === ORDER_EDITOR_CLIENT_ID
    reason = orderEditorReason(single, body.variables, {
      clientId,
      lastOrder,
      viewer: isContactRegister ? await viewer() : null,
    })
    const quoteId = reason ? null : quoteAcceptOrderId(single, body.variables)
    if (quoteId && (await viewer()) && isOwnQuotation(await editorOrder(quoteId), await viewer())) reason = 'quote-accept'
  }
  // Elevated requests run only as the SDK's own documents (the caller doesn't choose what
  // the order-editor key selects), and the checkout mutations only elevated: refused, never
  // sent on the storefront key instead (mustRefuseElevation).
  if (mustRefuseElevation(doc, single, reason)) return refuse(res, 403, 'Forbidden: this request is not allowed')
  // contactRegister runs only elevated: a manager's call or this browser's own self-registration.
  if (!reason && selectsContactRegister(doc)) return refuse(res, 403, 'Forbidden: contact registration is not allowed here')
  const auth = upstreamAuth(reason, bearer)

  // Only anonymous catalog queries are cacheable. An authenticated request is
  // personalised; caching it would leak one user's data to the next.
  const cacheable = !bearer && !auth.orderEditorKey && isCacheableQuery(doc)
  const forwardBody = JSON.stringify(body)
  const key = cacheable ? gqlCacheKey(forwardBody) : null
  if (cacheable) {
    const hit = gqlCacheGet(key)
    if (hit) {
      res.status(hit.status)
      if (hit.contentType) res.set('Content-Type', hit.contentType)
      res.set('X-Cache', 'HIT')
      res.end(hit.body)
      return
    }
  }

  // Tags for surgical invalidation (`lib/server.ts` attaches them); never forwarded.
  const tagsHeader = req.headers['x-propeller-cache-tags']
  const cacheTags = parseCacheTagsHeader(Array.isArray(tagsHeader) ? tagsHeader[0] : tagsHeader)

  // Spend the checkout mutation for this order before the call. The flags read above can be
  // stale by now (viewer lookups awaited since), so reserve() checks and spends in one
  // synchronous step with no await before the upstream call: of N parallel requests with the
  // same last-order cookie only one gets the key. A failed call releases it below.
  const reserved = reason === 'checkout' ? checkoutFlag(single) : null
  if (reserved && !spentCheckout.reserve(lastOrder.orderId, reserved)) {
    return refuse(res, 403, 'This checkout step already ran for this order')
  }

  let upstreamResp
  try {
    upstreamResp = await fetch(UPSTREAM, {
      method: 'POST',
      headers: {
        apikey: auth.orderEditorKey ? ORDER_EDITOR_API_KEY : API_KEY,
        'Content-Type': 'application/json',
        ...(auth.bearer ? { Authorization: `Bearer ${auth.bearer}` } : {}),
      },
      body: forwardBody,
    })
  } catch (err) {
    if (reserved) spentCheckout.release(lastOrder.orderId, reserved)
    console.error('[gql-proxy] upstream error:', isProd ? err?.name || 'Error' : err)
    res.status(502).json({ errors: [{ message: 'Upstream GraphQL request failed', extensions: { code: 'BAD_GATEWAY' } }] })
    return
  }
  let text = await upstreamResp.text()
  const contentType = upstreamResp.headers.get('content-type') || 'application/json'
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = undefined
  }
  const succeeded = upstreamResp.ok && isRecord(json) && !(Array.isArray(json.errors) && json.errors.length)
  if (reserved && !succeeded) spentCheckout.release(lastOrder.orderId, reserved)

  // What a visitor may get (forVisitor): never the merchant's cost price, for anyone in any
  // portal mode, and no prices at all where the price gate (#4) applies. Before the cache, so
  // a HIT is shaped too. An order read or a gated answer that isn't JSON can't be: 502.
  const gated = PRICE_GATE && !(await viewer())
  if (json !== undefined) {
    json = forVisitor(json, gated)
    text = JSON.stringify(json)
  } else if (gated || reason === 'order-read') {
    res.status(502).json({ errors: [{ message: 'Upstream GraphQL request failed', extensions: { code: 'BAD_GATEWAY' } }] })
    return
  }

  if (ORDER_EDITOR_API_KEY && upstreamResp.ok) {
    // Remember the order this browser just placed, for its checkout steps and thank-you page.
    const newOrderId = createdOrderId(single, json)
    // A checkout mutation that ran elevated is spent for this order: server log (reserved
    // above) and cookie.
    const spent = !newOrderId && succeeded ? reserved : null
    const lastOrderValue = newOrderId
      ? signLastOrder(newOrderId)
      : spent
        ? signLastOrder(lastOrder.orderId, uniqueFlags(lastOrder.used + spent))
        : null
    if (lastOrderValue) res.cookie(LAST_ORDER_COOKIE, lastOrderValue, privateCookieOptions(req, LAST_ORDER_MAX_AGE))
  }

  // Remember the company this browser just registered, and which of its addresses exist.
  if (regStep && succeeded) {
    const newCompanyId = regStep.kind === 'company' ? createdCompanyId(json) : null
    const regValue = newCompanyId
      ? signRegistration(newCompanyId)
      : regStep.kind === 'address'
        ? signRegistration(regStep.companyId, registration.used + regStep.flag)
        : null
    if (regValue) res.cookie(REGISTRATION_COOKIE, regValue, privateCookieOptions(req, REGISTRATION_MAX_AGE))
  }
  if (contactStep && registeredContact(json)) {
    res.cookie(REGISTRATION_COOKIE, signRegistration(registration.companyId, registration.used + CONTACT_FLAG), privateCookieOptions(req, REGISTRATION_MAX_AGE))
  }

  // PunchOut (#20): only upstream accepting the magic token /api/punchout/enter was
  // called with activates the session; any other login, or a failed one, ends it.
  if (isPunchoutEnabled() && single?.operation === 'mutation') {
    const field = single.node.name.value
    const result = isRecord(json?.data) ? json.data[single.node.alias?.value ?? field] : null
    const outcome = punchoutAfterLogin({
      field,
      succeeded: succeeded && isRecord(result),
      token: argument(single, 'id', body.variables),
      pendingCookie: cookies[PUNCHOUT_PENDING_COOKIE],
    })
    if (outcome?.promote) {
      const signed = signPunchoutSession(outcome.promote)
      if (signed) {
        res.cookie(PUNCHOUT_COOKIE, signed, privateCookieOptions(req, PUNCHOUT_MAX_AGE))
        // Readable on purpose: the cart page shows the transfer button when it is set.
        res.cookie(PUNCHOUT_FLAG_COOKIE, outcome.promote.mode, { ...privateCookieOptions(req, PUNCHOUT_MAX_AGE), httpOnly: false })
      }
      res.clearCookie(PUNCHOUT_PENDING_COOKIE, { path: '/' })
    } else if (outcome?.clear) {
      for (const name of [PUNCHOUT_COOKIE, PUNCHOUT_FLAG_COOKIE, PUNCHOUT_PENDING_COOKIE]) res.clearCookie(name, { path: '/' })
    }
  }

  // Cache only clean 2xx responses: no transient upstream errors pinned for 24 h.
  if (cacheable && succeeded) {
    gqlCacheSet(key, { status: upstreamResp.status, contentType, body: Buffer.from(text), tags: cacheTags })
  }

  res.status(upstreamResp.status)
  res.set('Content-Type', contentType)
  res.set('X-Cache', cacheable ? 'MISS' : 'BYPASS')
  res.end(text)
}

// ── PSP payments (#19) ──────────────────────────────────────────────────────

async function readOrder(orderId, headers) {
  try {
    const res = await fetch(UPSTREAM, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ query: PAYMENT_ORDER_QUERY, variables: { orderId } }),
      signal: AbortSignal.timeout(10_000),
    })
    const json = await res.json()
    return res.ok ? (json?.data?.order ?? null) : null
  } catch {
    return null
  }
}

/** Any order, read with the order-editor key: owner checks (proxy order reads, quote acceptance, payment routes) and the PSP webhooks. */
const editorOrder = (orderId) => (ORDER_EDITOR_API_KEY ? readOrder(orderId, { apikey: ORDER_EDITOR_API_KEY }) : Promise.resolve(null))

// Unsigned MSP notifications per IP and per order (src/server/payments.js); its own map, so a
// flood of made-up keys can't evict the form limits.
const mspWebhookLimiter = createRateLimiter()

/** The order behind a payment request, for its owner only (payments.js ownedOrder), else null. */
function requestOrder(req, orderId) {
  return ownedOrder(orderId, {
    lastOrderId: verifyLastOrder(parseCookies(req.headers.cookie || '')[LAST_ORDER_COOKIE])?.orderId,
    getViewer: () => verifiedViewer(requestBearer(req)),
    fetchOrder: editorOrder,
  })
}

/** Where the PSP sends the payer back (payments.js paymentSiteUrl); null in production without VITE_SITE_URL. */
function siteOrigin(req) {
  return paymentSiteUrl(process.env.VITE_SITE_URL, `${req.protocol}://${req.get('host')}`, isProd)
}

/**
 * POST /api/<psp>/create-payment. The browser names the order and the method; the
 * rest comes from the server (#19): the order must belong to the caller and be
 * UNFINISHED, the amount and currency are its total incl. VAT as upstream has it,
 * the return URL is on this site, the user id is the verified viewer's.
 */
function createPaymentRoute({ slug, isEnabled, getProvider }) {
  return async (req, res) => {
    if (!isEnabled()) {
      res.status(503).json({ error: `${slug} not configured` })
      return
    }
    if (!isSameOriginJson(req)) {
      res.status(403).json({ error: 'cross-origin request refused' })
      return
    }
    // The return URL must not come from the request's Host header in production.
    const site = siteOrigin(req)
    if (!site) {
      console.error(`[${slug}] create-payment refused: VITE_SITE_URL is not set`)
      res.status(503).json({ error: 'payments are not available' })
      return
    }
    const b = isRecord(req.body) ? req.body : {}
    const orderId = idOf(b.orderId)
    if (!orderId || typeof b.method !== 'string' || !b.method) {
      res.status(400).json({ error: 'missing or invalid fields' })
      return
    }
    // Defense in depth: on-account methods must never reach the PSP.
    if (isOnAccountMethod(b.method)) {
      res.status(400).json({ error: 'on-account method does not use a PSP' })
      return
    }
    const order = await requestOrder(req, orderId)
    const charge = chargeFor(order, process.env.VITE_CURRENCY_CODE || 'EUR')
    if (charge.error) {
      res.status(order ? 409 : 403).json({ error: charge.error })
      return
    }
    // The viewer's id only when they placed the order (a cookie-authorised guest order has none).
    const viewer = await verifiedViewer(requestBearer(req))
    const userId = isOwnOrder(order, viewer) ? viewer.userId : undefined
    try {
      const result = await getProvider().createPayment({
        orderId,
        amount: charge.amount,
        currency: charge.currency,
        method: b.method,
        description: `Order ${orderId}`,
        redirectUrl: paymentRedirectUrl(site, b.redirectUrl, orderId, slug),
        ...(userId ? { userId } : {}),
      })
      res.json({ ok: true, ...result })
    } catch (e) {
      console.error(`[${slug}] create-payment failed:`, errorSummary(e))
      res.status(500).json({ error: 'payment creation failed' })
    }
  }
}

async function createServer() {
  const app = express()
  app.disable('x-powered-by')

  // CSP, framing, nosniff, referrer policy and HSTS on every response, SSR and API (#9).
  const SECURITY_HEADERS = securityHeaders(process.env, isProd)
  app.use((req, res, next) => {
    res.set(SECURITY_HEADERS)
    next()
  })

  // Basic-auth gate for /tracker and /api/tracker*; first so nothing else serves them.
  app.use(trackerGate)

  app.use(renewSession)

  // ── /api/auth/session — the httpOnly session cookies (V1, #8) ──────────────
  //
  // POST { accessToken, refreshToken? } right after a login, registration or magic
  // login: the tokens go into httpOnly, SameSite=Lax cookies (Secure in production).
  // Same-origin JSON only, so another site can't log a visitor into its account.
  app.post('/api/auth/session', express.json({ limit: '16kb' }), (req, res) => {
    if (!isSameOriginJson(req)) return refuse(res, 403, 'Cross-origin request refused')
    const { accessToken, refreshToken } = isRecord(req.body) ? req.body : {}
    if (!isSessionToken(accessToken)) return refuse(res, 400, 'Invalid access token')
    const refresh = typeof refreshToken === 'string' && refreshToken.length <= 8192 ? refreshToken : undefined
    setSessionCookies(req, res, { accessToken, refreshToken: refresh })
    res.status(204).end()
  })

  // DELETE: logout. Also clears what the session left in this browser: the last order it
  // placed (which unlocks that order's thank-you page and payment), the company it just
  // registered and the punchout session (#20), so the next person on a shared browser
  // inherits none of it. `?keep=punchout-pending` (magic-login, right before its token
  // exchange) spares only the pending punchout entry that exchange activates.
  app.delete('/api/auth/session', (req, res) => {
    if (!isSameOrigin(req)) return refuse(res, 403, 'Cross-origin request refused')
    const names = [ACCESS_COOKIE, REFRESH_COOKIE, LAST_ORDER_COOKIE, REGISTRATION_COOKIE, PUNCHOUT_COOKIE, PUNCHOUT_FLAG_COOKIE]
    if (req.query.keep !== 'punchout-pending') names.push(PUNCHOUT_PENDING_COOKIE)
    for (const name of names) res.clearCookie(name, { path: '/' })
    res.status(204).end()
  })

  // ── /api/revalidate — surgical cache invalidation ─────────────────────────
  //
  // POST with `X-Revalidate-Secret: $REVALIDATE_SECRET` and JSON body
  // `{ "tag": "product:42" }`. Walks the tag→keys index in the in-memory
  // GraphQL cache and removes every entry that was inserted with that tag.
  //
  // Tag values must come from `lib/server.ts`'s `tagFor()` helper. The
  // catalog fetch helpers attach them via the `X-Propeller-Cache-Tags`
  // request header on every anonymous read — see the comment in
  // `graphqlCachedHandler` above for where they're parsed back out.
  //
  // Fails closed if `REVALIDATE_SECRET` isn't set — never expose this
  // endpoint without the secret. A public revalidation hook is a trivial
  // DoS amplifier (every call forces the next render to re-fetch).
  app.post('/api/revalidate', express.json({ limit: '8kb' }), async (req, res) => {
    const expected = process.env.REVALIDATE_SECRET
    if (!expected) {
      res.status(503).json({ error: 'revalidation endpoint not configured' })
      return
    }
    const provided = req.headers['x-revalidate-secret']
    const providedStr = Array.isArray(provided) ? provided[0] : provided
    if (!safeEqual(providedStr, expected)) {
      res.status(401).json({ error: 'unauthorized' })
      return
    }
    const tag = req.body && typeof req.body.tag === 'string' ? req.body.tag : null
    if (!tag) {
      res.status(400).json({ error: 'missing tag' })
      return
    }
    // Bust BOTH cache layers in lock-step:
    //   - server.js's raw-response LRU (HTTP-level, indexed by tag).
    //   - lib/server.ts's parsed-object SSR cache (object-level, indexed
    //     by tag via the `invalidateCache` export re-exposed by
    //     entry-server). A revalidation that hits only one layer is a
    //     consistency bug — the second layer would serve stale data on
    //     the next render.
    //
    // The wildcard `*` is a nuclear wipe — drops every entry from both
    // layers regardless of tag. Same shared-secret gate, no extra surface.
    const isWildcard = tag === '*'
    let ssrInvalidated = 0
    try {
      const mod = isProd
        ? await import('./dist/server/entry-server.js')
        : await vite.ssrLoadModule('/src/entry-server.ts')
      if (isWildcard && typeof mod.clearCache === 'function') {
        ssrInvalidated = mod.clearCache()
      } else if (typeof mod.invalidateCache === 'function') {
        ssrInvalidated = mod.invalidateCache(tag)
      }
    } catch (err) {
      console.error('[revalidate] SSR cache invalidation failed:', err)
      // Don't abort — the HTTP-level bust below is still useful.
    }
    const proxyInvalidated = isWildcard
      ? gqlCacheClearAll()
      : gqlCacheInvalidateTag(tag)
    res.json({
      ok: true,
      tag,
      invalidated: { proxy: proxyInvalidated, ssr: ssrInvalidated },
    })
  })

  // ── /api/preview + /api/cms-revalidate — CMS endpoints ───────────────────
  //
  // Preview serves Prepr, or Strapi when STRAPI_PREVIEW_SECRET is set; the
  // revalidate webhook is Prepr-only. Otherwise they 404, so a shop without a
  // CMS preview exposes no CMS surface. Registered BEFORE the `*all` SSR
  // catch-all. (Next mirror: app/api/preview, app/api/cms-revalidate.)

  // Enter (or, for Strapi's Published tab, leave) draft mode: verify the secret,
  // set the preview cookie the SSR loaders read and redirect to the page with the
  // previewed locale (and Prepr's segment/AB switches). Preview URLs:
  //   Prepr:  /api/preview?secret=<PREPR_PREVIEW_SECRET>&slug=/{slug}&locale={locale}
  //   Strapi: built by the Strapi app's config/admin.ts from its PREVIEW_SECRET
  app.get('/api/preview', (req, res) => {
    const r = resolvePreviewRequest(req.query)
    sendPreviewResult(req, res, r)
  })

  // Exit draft mode: clear the cookie and return to the page (or home).
  app.get('/api/preview/exit', (req, res) => {
    sendPreviewResult(req, res, resolvePreviewExit(req.query))
  })

  // Prepr publish webhook → bust the CMS cache. Mirrors /api/revalidate but for
  // the `cms` tag family (cms, cms:page:<slug>, cms:article:<slug>). Same
  // shared-secret gate. Body: { slug, type } or { tag } (or {} → full CMS wipe).
  app.post('/api/cms-revalidate', express.json({ limit: '8kb' }), async (req, res) => {
    if (!isPreprEnabled()) {
      res.status(404).json({ error: 'not found' })
      return
    }
    const expected = process.env.REVALIDATE_SECRET
    if (!expected) {
      res.status(503).json({ error: 'revalidation endpoint not configured' })
      return
    }
    const provided = req.headers['x-revalidate-secret']
    const providedStr = Array.isArray(provided) ? provided[0] : provided
    if (!safeEqual(providedStr, expected)) {
      res.status(401).json({ error: 'unauthorized' })
      return
    }
    const body = req.body && typeof req.body === 'object' ? req.body : {}
    const slug = typeof body.slug === 'string' ? body.slug : undefined
    const type = typeof body.type === 'string' ? body.type : undefined
    const explicitTag = typeof body.tag === 'string' ? body.tag : undefined
    let tags
    if (explicitTag) {
      tags = [explicitTag === '*' ? 'cms' : explicitTag]
    } else if (slug && type === 'article') {
      tags = [`cms:article:${slug}`, 'cms']
    } else if (slug) {
      tags = [`cms:page:${slug}`, 'cms']
    } else {
      tags = ['cms']
    }
    let ssrInvalidated = 0
    try {
      const mod = isProd
        ? await import('./dist/server/entry-server.js')
        : await vite.ssrLoadModule('/src/entry-server.ts')
      if (typeof mod.invalidateCache === 'function') {
        for (const tag of tags) ssrInvalidated += mod.invalidateCache(tag)
      }
    } catch (err) {
      console.error('[cms-revalidate] SSR cache invalidation failed:', err)
    }
    let proxyInvalidated = 0
    for (const tag of tags) proxyInvalidated += gqlCacheInvalidateTag(tag)
    res.json({ ok: true, tags, invalidated: { proxy: proxyInvalidated, ssr: ssrInvalidated } })
  })

  // ── /api/mollie/* — Mollie PSP host endpoints ─────────────────────────────
  //
  // The Mollie package is server-side + framework-agnostic; these three routes
  // are the host HTTP layer (the Next mirror is app/api/mollie/*). They must be
  // registered BEFORE the `*all` SSR catch-all below. Body parsers are scoped
  // per-route so they never intercept the `/api/graphql` proxy body. The Mollie
  // provider talks DIRECTLY to upstream (not via the proxy above), carrying the
  // order-editor key itself — see src/server/mollie.js.

  // POST /api/mollie/create-payment — start a payment for a placed order (#19, see createPaymentRoute).
  app.post(
    '/api/mollie/create-payment',
    express.json({ limit: '8kb' }),
    createPaymentRoute({ slug: 'mollie', isEnabled: isMollieEnabled, getProvider: getMollieProvider }),
  )

  // GET /api/mollie/payment-status?paymentId=tr_xxx — live status for return page.
  // Read-only; does not touch Propeller. A non-ok body means "unknown" so the
  // caller can retry. Only for the order's owner (#19); anyone else gets the
  // same answer as an unknown payment.
  app.get('/api/mollie/payment-status', async (req, res) => {
    if (!isMollieEnabled()) {
      res.status(503).json({ error: 'mollie not configured' })
      return
    }
    const paymentId = String(req.query.paymentId || '').trim()
    if (!/^tr_[A-Za-z0-9]{1,64}$/.test(paymentId)) {
      res.status(400).json({ ok: false, error: 'missing paymentId' })
      return
    }
    try {
      const result = await getMollieProvider().getPaymentStatus(paymentId)
      // The order id is in the Mollie payment's metadata: check ownership after the lookup.
      if (!result.ok || !(await requestOrder(req, result.orderId))) {
        if (!result.ok) console.warn('[mollie] payment-status not ok:', result.error)
        res.json({ ok: false, paymentId, error: 'status lookup failed' })
        return
      }
      res.json(result) // { ok, paymentId, status, settled, orderId }
    } catch (e) {
      console.error('[mollie] payment-status failed:', errorSummary(e))
      res.json({ ok: false, paymentId, error: 'status lookup failed' })
    }
  })

  // POST /api/mollie/webhook — Mollie posts form-encoded `id=tr_xxx`. The
  // provider re-fetches from Mollie (body never trusted beyond the id),
  // classifies, and updates Propeller. ALWAYS 200 so Mollie never retry-storms.
  app.post(
    '/api/mollie/webhook',
    express.urlencoded({ extended: false, limit: '8kb' }),
    async (req, res) => {
      if (!isMollieEnabled()) {
        res.status(200).end()
        return
      }
      const id = req.body && req.body.id ? String(req.body.id) : ''
      try {
        const result = await getMollieProvider().handleWebhook(id)
        if (!result.ok) {
          console.warn(
            '[mollie] webhook not processed:',
            result.error,
            'payment:',
            id,
          )
        }
      } catch (e) {
        console.error('[mollie] webhook handler error:', errorSummary(e))
      }
      res.status(200).end() // unconditional ack
    },
  )

  // ── /api/msp/* — MultiSafepay PSP host endpoints ──────────────────────────
  //
  // The MultiSafepay sibling of the Mollie routes above (the Next mirror is
  // app/api/msp/*). Same create-payment / payment-status shape; the webhook
  // differs — MSP puts the id in the QUERY string (`?transactionid=<orderId>`)
  // and calls via POST or GET, so that route takes no body parser. The provider
  // talks directly to upstream with the order-editor key — see src/server/msp.js.

  // POST /api/msp/create-payment — start a payment for a placed order (#19, see createPaymentRoute).
  app.post(
    '/api/msp/create-payment',
    express.json({ limit: '8kb' }),
    createPaymentRoute({ slug: 'multisafepay', isEnabled: isMspEnabled, getProvider: getMspProvider }),
  )

  // GET /api/msp/payment-status?paymentId=<orderId> — live status for the return
  // page. MSP keys transactions by order id, so paymentId IS the order id
  // (orderId accepted as an alias). Read-only; a non-ok body means "unknown".
  // Only for the order's owner (#19): the browser that placed it or its account.
  app.get('/api/msp/payment-status', async (req, res) => {
    if (!isMspEnabled()) {
      res.status(503).json({ error: 'multisafepay not configured' })
      return
    }
    const paymentId = String(
      req.query.paymentId || req.query.orderId || '',
    ).trim()
    if (!paymentId) {
      res.status(400).json({ error: 'missing paymentId' })
      return
    }
    if (!(await requestOrder(req, paymentId))) {
      res.status(403).json({ ok: false, paymentId, error: 'order not found' })
      return
    }
    try {
      const result = await getMspProvider().getPaymentStatus(paymentId)
      if (!result.ok) {
        console.warn('[msp] payment-status not ok:', result.error)
        res.json({ ok: false, paymentId, error: 'status lookup failed' })
        return
      }
      res.json(result) // { ok, paymentId, status, settled, orderId }
    } catch (e) {
      console.error('[msp] payment-status failed:', errorSummary(e))
      res.json({ ok: false, paymentId, error: 'status lookup failed' })
    }
  })

  // POST|GET /api/msp/webhook — MSP calls with `?transactionid=<orderId>`. The
  // provider re-fetches from MSP, classifies, and updates Propeller. Answers 200
  // ("OK") so MSP never retry-storms, except as handleMspNotification says:
  //
  // POST notifications carry an `Auth` signature over the raw body, made with the
  // site API key (#19); one that doesn't verify, or whose signed body names
  // another order, is refused. GET notifications (orders created by package
  // <= 0.1.3) carry none: limited per IP and per order, and processed only while
  // the order is still UNFINISHED, so a forged GET can't re-mail a paid order,
  // clear its cart or reset its back-office status.
  const mspWebhookHandler = async (req, res) => {
    if (!isMspEnabled()) {
      res.status(200).send('OK')
      return
    }
    const id = String(req.query.transactionid || req.query.orderId || '').trim()
    const body = req.method === 'POST' && typeof req.body === 'string' ? req.body : ''
    try {
      const answer = await handleMspNotification(
        {
          method: req.method,
          id,
          ip: clientIp(req),
          signed: req.method === 'POST' && verifyWebhookSignature(body, req.get('auth') || '', mspApiKey()),
          body,
        },
        { limiter: mspWebhookLimiter, fetchOrder: editorOrder, provider: getMspProvider },
      )
      res.status(answer.status).send(answer.body)
    } catch (e) {
      console.error('[msp] webhook handler error:', errorSummary(e))
      res.status(200).send('OK') // the provider already swallows; this guards the wiring
    }
  }
  // Raw body: the signature covers the exact bytes MSP sent.
  app.post('/api/msp/webhook', express.text({ type: () => true, limit: '256kb' }), mspWebhookHandler)
  app.get('/api/msp/webhook', mspWebhookHandler)

  // ── /api/punchout/* — OCI + cXML PunchOut host endpoints ──────────────────
  //
  // The Vue mirror of propeller-next's app/api/punchout/*. Wire-format logic is
  // in @propeller-commerce/propeller-v2-punchout (pure); the app-specific glue
  // is in src/server/punchout.js. Sits on top of the magic-token login flow.

  // POST /api/punchout/cxml/setup — inbound cXML PunchOutSetupRequest.
  app.post(
    '/api/punchout/cxml/setup',
    express.text({ type: () => true, limit: '512kb' }),
    async (req, res) => {
      const sendXml = (body, status) =>
        res.status(status).type('application/xml; charset=utf-8').send(body)
      if (!isPunchoutEnabled()) return sendXml(buildErrorResponse(403, 'PunchOut disabled'), 403)
      let parsed
      try {
        parsed = parseSetupRequest(typeof req.body === 'string' ? req.body : '')
      } catch {
        return sendXml(buildErrorResponse(400, 'Malformed cXML'), 400)
      }
      const buyer = await resolveCxmlBuyer(parsed.sharedSecret || '')
      if (!buyer) {
        return sendXml(buildErrorResponse(401, 'Invalid credentials'), 401)
      }
      let mtoken
      try {
        mtoken = await createPunchoutMagicToken(buyer.contactId)
      } catch (err) {
        console.error('[punchout] token mint failed:', errorSummary(err))
        return sendXml(buildErrorResponse(500, 'Could not start punchout session'), 500)
      }
      // The BrowserFormPost URL and buyer details come from this authenticated request
      // and travel to /enter signed and bound to the token (#20), never as plain query
      // parameters someone could swap.
      const returnUrl = validReturnUrl(parsed.browserFormPostUrl)
      if (!returnUrl) return sendXml(buildErrorResponse(400, 'BrowserFormPost URL not allowed'), 400)
      const cx = signCxmlSetup(mtoken, {
        returnUrl,
        buyerCookie: parsed.buyerCookie || undefined,
        from: parsed.fromIdentity || undefined,
        to: parsed.toIdentity || undefined,
        deploymentMode: parsed.deploymentMode || 'test',
      })
      if (!cx) return sendXml(buildErrorResponse(500, 'Could not start punchout session'), 500)
      const origin = `${req.protocol}://${req.get('host')}`
      const startUrl = buildStartUrl(`${origin}/api/punchout/enter`, { mode: 'cxml', mtoken, redirect: '/cart', cx })
      return sendXml(buildSetupResponse({ startUrl }), 200)
    },
  )

  // GET /api/punchout/enter — store a *pending* session bound to this token and
  // hand over to magic-login (#20). Nothing is active until upstream accepts the
  // magicTokenLogin for this same token (see punchoutAfterLogin in the proxy).
  app.get('/api/punchout/enter', (req, res) => {
    if (!isPunchoutEnabled()) return res.status(404).send('PunchOut disabled')
    const q = req.query
    const mtoken = typeof q.mtoken === 'string' ? q.mtoken : ''
    if (!mtoken) return res.status(400).send('Missing mtoken')

    const mode = q.mode === 'cxml' ? 'cxml' : 'oci'
    let session
    if (mode === 'cxml') {
      const setup = verifyCxmlSetup(q.cx, mtoken)
      if (!setup) return res.status(400).send('Invalid punchout session')
      session = { mode, target: PUNCHOUT_CONFIG.transferTarget, session: {}, ...setup }
    } else {
      const hook = [q.HOOK_URL, q.hook_url, q.returnUrl].find((v) => typeof v === 'string' && v)
      session = { mode, returnUrl: hook, target: PUNCHOUT_CONFIG.transferTarget, session: mapOciParams(q) }
    }
    session.returnUrl = validReturnUrl(session.returnUrl)
    if (!session.returnUrl) return res.status(400).send('Return URL not allowed')

    const pending = signPendingSession(mtoken, session)
    if (!pending) return res.status(503).send('PunchOut not configured')
    res.cookie(PUNCHOUT_PENDING_COOKIE, pending, privateCookieOptions(req, PUNCHOUT_PENDING_MAX_AGE))
    // A new entry ends any earlier punchout session in this browser.
    res.clearCookie(PUNCHOUT_COOKIE, { path: '/' })
    res.clearCookie(PUNCHOUT_FLAG_COOKIE, { path: '/' })
    const redirect = typeof q.redirect === 'string' && q.redirect ? q.redirect : '/cart'
    const target = `/magic-login?mtoken=${encodeURIComponent(mtoken)}&redirect=${encodeURIComponent(redirect)}`
    res.redirect(302, target)
  })

  // POST /api/punchout/transfer — build the OCI/cXML payload, hand the cart back.
  app.post('/api/punchout/transfer', express.urlencoded({ extended: false, limit: '16kb' }), async (req, res) => {
    if (!isPunchoutEnabled()) return res.status(404).send('PunchOut disabled')
    if (!isSameOrigin(req)) return res.status(403).send('Cross-origin request refused')
    const cookies = parseCookies(req.headers.cookie || '')
    // Signed by the proxy after the token exchange; its return URL is re-checked
    // here, before the cart is read or deleted, so a disallowed URL keeps the cart (#20).
    const session = verifyPunchoutSession(cookies[PUNCHOUT_COOKIE])
    if (!session) return res.status(400).send('No punchout session')

    const cartId = String(req.body?.cartId || '')
    if (!cartId) return res.status(400).send('Missing cartId')

    const client = createAuthedClient(requestBearer(req))
    const cartService = new CartService(client)
    let cart
    try {
      cart = await cartService.getCart({
        cartId,
        language: PUNCHOUT_CONFIG.language,
        imageSearchFilters: CART_IMAGE_FILTERS.imageSearchFilters,
        imageVariantFilters: CART_IMAGE_FILTERS.imageVariantFilters,
      })
    } catch (err) {
      console.error('[punchout] cart load failed:', errorSummary(err))
      return res.status(502).send('Could not load cart')
    }

    const ctx = {
      language: PUNCHOUT_CONFIG.language,
      currency: PUNCHOUT_CONFIG.currency,
      session: session.session,
      buyerCookie: session.buyerCookie,
      from: session.from,
      to: session.to,
      deploymentMode: session.deploymentMode,
    }

    const debug = isPunchoutDebug()
    let html
    if (session.mode === 'cxml') {
      const orderXml = buildOrderCxml(cart, ctx, PUNCHOUT_CONFIG.cxmlMapping)
      html = debug
        ? buildDebugPage({ mode: 'cxml', returnUrl: session.returnUrl, xml: orderXml, target: session.target })
        : buildAutoPostForm(session.returnUrl, { 'cxml-urlencoded': orderXml }, {
            target: session.target,
            submitLabel: 'Transfer cart to procurement',
          })
    } else {
      const fields = buildOciFields(cart, ctx, PUNCHOUT_CONFIG.ociMapping)
      html = debug
        ? buildDebugPage({ mode: 'oci', returnUrl: session.returnUrl, fields, target: session.target })
        : buildAutoPostForm(session.returnUrl, fields, {
            target: session.target,
            submitLabel: 'Transfer cart to procurement',
          })
    }

    // In debug mode keep the cart + session so the preview is re-runnable. In a
    // real transfer, delete the shop cart (items live in the ERP now) and clear
    // the punchout cookies.
    if (!debug) {
      try {
        await cartService.deleteCart({ id: cartId })
      } catch {
        /* non-fatal: the ERP already has the payload */
      }
      res.clearCookie(PUNCHOUT_COOKIE, { path: '/' })
      res.clearCookie(PUNCHOUT_FLAG_COOKIE, { path: '/' })
    }
    // This page auto-posts the cart to the buyer's procurement system, so no form-action limit.
    res.set('Content-Security-Policy', transferPolicy(process.env, isProd))
    res.status(200).type('text/html; charset=utf-8').send(html)
  })

  // ── /api/graphql proxy with anonymous-query response cache ────────────────
  //
  // Replaces the old `http-proxy-middleware` pass-through so we can intercept
  // the GraphQL request body, derive a cache key from it, and short-circuit
  // anonymous repeat-queries without touching the upstream. Mutations always
  // forward (data-changing), authenticated requests always forward (may be
  // personalised). For everything else — anonymous `query` operations — the
  // response is cached for 24 h and served from memory on the next hit.
  //
  // Why a hand-rolled handler and not the proxy library: the library streams
  // the response and doesn't expose a clean hook to capture the body, which
  // we need to store. With `fetch` we get the response as a buffer for free.
  app.use('/api/graphql', rateLimitProxy)

  // Quoted-price products are collected client-side and sent from here, so
  // SMTP credentials stay server-side.
  app.post('/api/price-request', express.json({ limit: '64kb' }), priceRequestHandler)

  // CMS contact-form block; recipient is CONTACT_TO_EMAIL only.
  app.post('/api/contact', express.json({ limit: '16kb' }), contactHandler)

  app.post('/api/graphql', graphqlCachedHandler())

  /** @type {import('vite').ViteDevServer | undefined} */
  let vite
  let templateProd = ''
  let renderProd

  // ── Dev-only FOUC fix ─────────────────────────────────────────────────────
  // In dev, Vite serves CSS as JS modules that only execute after the entry
  // script runs — i.e. *after* the SSR HTML has already painted. That's a
  // classic flash-of-unstyled-content: the header logo briefly renders at its
  // default natural size, the cart sidebar at its un-translated default
  // position, etc.
  //
  // The cleanest dev fix is to inline the package's pre-built stylesheet
  // directly into <head> on every SSR response. It's the heaviest of the two
  // (it contains all the catalog/cart/checkout component styles) so killing
  // its FOUC kills 95% of the visible flash. The Tailwind entry
  // (`src/style.css`) loads via Vite's JS-module path as before; in practice
  // it's mostly CSS variables and a few component classes, so the residual
  // flash from that alone isn't visible.
  //
  // In prod, `vite build` emits a hashed CSS bundle and `index.html` already
  // links it directly — no FOUC, no inlining needed.
  let devInlineStyles = ''
  if (!isProd) {
    try {
      const cssPath = path.resolve(
        __dirname,
        'node_modules/@propeller-commerce/propeller-v2-vue-ui/dist/styles.css',
      )
      if (fs.existsSync(cssPath)) {
        devInlineStyles = fs.readFileSync(cssPath, 'utf-8')
        console.log(`[ssr] inlined ${devInlineStyles.length} bytes of package CSS into <head>`)
      } else {
        console.warn(`[ssr] package CSS not found at ${cssPath}; FOUC mitigation disabled`)
      }
    } catch (err) {
      console.warn('[ssr] failed to read package CSS:', err)
      // Falling back to the JS-imported CSS path is fine — just means a brief
      // FOUC. Don't kill the dev server over it.
    }
  }

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite')
    // Vite enforces a Host-header allowlist on its dev server (even in
    // middleware mode). A public dev tunnel (cloudflared / ngrok) sends its own
    // hostname, which Vite rejects with "This host (...) is not allowed" — and
    // Mollie needs a public tunnel to reach the webhook in dev. Allow the common
    // tunnel providers' wildcard subdomains, plus anything in DEV_ALLOWED_HOSTS
    // (comma-separated) for other tunnels. Dev-only — never reached in prod.
    const allowedHosts = [
      '.trycloudflare.com',
      '.ngrok-free.app',
      '.ngrok.io',
      '.loca.lt',
      ...(process.env.DEV_ALLOWED_HOSTS || '')
        .split(',')
        .map((h) => h.trim())
        .filter(Boolean),
    ]
    vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts },
      appType: 'custom',
    })
    app.use(vite.middlewares)
  } else {
    app.use(
      express.static(path.resolve(__dirname, 'dist/client'), {
        index: false,
      }),
    )
    templateProd = fs.readFileSync(
      path.resolve(__dirname, 'dist/client/index.html'),
      'utf-8',
    )
    renderProd = (await import('./dist/server/entry-server.js')).render
  }

  // ── Behaviour tracking ──────────────────────────────────────────
  // Registered before the SSR catch-all, with per-route body parsers so they
  // never intercept the /api/graphql proxy body.
  //
  // `text/plain` is accepted deliberately: navigator.sendBeacon() sends that
  // content type, and it is the only transport that survives the PSP redirect
  // and tab close. Parsing JSON only would yield an empty body and a silent
  // 202 with zero rows -- which looks exactly like success.
  app.post(
    '/api/track',
    express.text({ type: ['application/json', 'text/plain'], limit: '128kb' }),
    async (req, res) => {
      // Per IP (#16): every accepted batch is a database write.
      const hit = formLimiter.hit(`track:${clientIp(req)}`, FORM_RATE_LIMITS.track.limit, FORM_RATE_LIMITS.track.windowMs)
      if (!hit.ok) {
        res.status(429).set('Retry-After', String(hit.retryAfter)).end()
        return
      }
      try {
        const cookies = parseCookies(req.headers.cookie || '')
        const result = await ingestBatch({
          rawBody: typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}),
          cookieVisitorId: cookies[VISITOR_COOKIE],
          channelId: TRACKING_CHANNEL_ID,
          // Who the events belong to comes from the session, not the body (#16).
          viewer: isTrackingConfigured() ? await verifiedViewer(requestBearer(req)) : null,
        })
        // Minted here rather than during SSR: a Set-Cookie on an HTML response
        // makes that response uncacheable at a CDN.
        if (result.minted && result.visitorId) {
          res.setHeader('Set-Cookie', visitorCookie(result.visitorId))
        }
      } catch (e) {
        console.error('[track] ingest failed:', errorSummary(e))
      }
      // 202 regardless: the caller is a fire-and-forget beacon, and a storefront
      // must not care whether analytics is configured or healthy.
      res.status(202).end()
    }
  )

  // Dashboard metrics. `metric` selects a static named query from an allowlist --
  // it is never interpolated into SQL. from/to/limit are validated and bound.
  app.get('/api/tracker', async (req, res) => {
    const metric = String(req.query.metric || '')
    const runner = METRICS[metric]
    if (!runner) {
      res.status(400).json({ error: 'unknown metric', allowed: Object.keys(METRICS) })
      return
    }
    const today = todayLocal()
    const from = String(req.query.from || today)
    const to = String(req.query.to || today)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      res.status(400).json({ error: 'from/to must be YYYY-MM-DD' })
      return
    }
    const span = Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000)
    if (!Number.isFinite(span) || span < 0) {
      res.status(400).json({ error: 'to must not precede from' })
      return
    }
    // Answered before running anything: with no database every metric would
    // return an empty array with a 200, and a dashboard full of honest zeros is
    // indistinguishable from a quiet day.
    if (!isTrackingConfigured()) {
      res.status(503).json({
        error: 'analytics database not configured',
        status: 'not_configured',
        hint: STATUS_HINTS.not_configured,
        metric,
      })
      return
    }
    // Capped so a hand-edited or bookmarked URL cannot ask for a decade.
    const safeTo = span > MAX_RANGE_DAYS ? addDays(from, MAX_RANGE_DAYS) : to
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), MAX_LIMIT)
    try {
      const data = await runner({ from, to: safeTo, limit, channelId: TRACKING_CHANNEL_ID })
      res.setHeader('Cache-Control', 'no-store')
      res.json({ metric, from, to: safeTo, data })
    } catch (e) {
      // A setup problem is not a server fault: 503 with the fix attached, so the
      // dashboard can say "run tracking:init" instead of relaying ER_NO_SUCH_TABLE.
      // The driver's message (hosts, SQL) stays in the log, as codes only (#15).
      const status = classifyDbError(e)
      if (status) {
        res.status(503).json({ error: 'analytics database unavailable', status, hint: STATUS_HINTS[status], metric })
        return
      }
      console.error('[tracker] query failed:', errorSummary(e))
      res.status(500).json({ error: 'query failed', metric })
    }
  })

  // ── SSR catch-all ─────────────────────────────────────────────────────────
  app.use('*all', async (req, res) => {
    const url = req.originalUrl
    try {
      let template
      let render
      if (!isProd) {
        template = fs.readFileSync(
          path.resolve(__dirname, 'index.html'),
          'utf-8',
        )
        template = await vite.transformIndexHtml(url, template)
        render = (await vite.ssrLoadModule('/src/entry-server.ts')).render
      } else {
        template = templateProd
        render = renderProd
      }

      const cookieHeader = req.headers.cookie || ''
      // Prepr personalization bridge (no-op unless CMS_PROVIDER=prepr): resolve
      // the visitor id + Prepr-* headers and forward them to the render so CMS
      // loaders can fetch personalized/preview content server-side.
      const prepr = resolvePreprRequest(req)
      const cookies = parseCookies(cookieHeader)
      // A blank session cookie is no session: SSR then renders as a guest.
      if (!cookies[ACCESS_COOKIE]?.trim()) delete cookies[ACCESS_COOKIE]
      const cmsPreview = isCmsPreviewActive(cookies)
      const ssrContext = {
        cookieHeader,
        cookies,
        url,
        preprHeaders: prepr.headers,
        cmsPreview,
      }

      const result = await render(url, ssrContext)

      if (result.redirect) {
        res.redirect(302, result.redirect)
        return
      }

      // Persist a freshly-minted __prepr_uid so the pixel + future renders share
      // it, plus any cookies a loader asked to set on the response.
      const responseCookies = [
        ...(prepr.isNew && prepr.uid ? [preprUidCookie(prepr.uid)] : []),
        ...(result.responseCookies || []),
      ]
      for (const c of responseCookies) {
        res.cookie(c.name, c.value, c.options || {})
      }

      const stateScript = `<script>window.__INITIAL_STATE__=${serializeState(
        result.initialState,
      )}</script>`

      const devStyleTag = devInlineStyles
        ? `<style data-ssr-inline>${devInlineStyles}</style>`
        : ''

      const html = template
        .replace('<!--ssr-html-attrs-->', result.htmlAttrs || '')
        .replace('<!--ssr-body-attrs-->', result.bodyAttrs || '')
        .replace('<!--ssr-head-->', `${devStyleTag}${result.headTags || ''}`)
        .replace('<!--ssr-outlet-->', result.html)
        .replace('<!--ssr-state-->', stateScript)

      res
        .status(result.status)
        .set('Content-Type', 'text/html; charset=utf-8')
      // Drafts must never land in a shared or CDN cache.
      if (cmsPreview) res.set('Cache-Control', 'private, no-store')
      res.end(html)
    } catch (err) {
      // Let Vite rewrite the stack to original source in dev.
      if (vite) vite.ssrFixStacktrace(err)
      console.error('[ssr] render error:', err)
      res.status(500).end('Internal Server Error')
    }
  })

  return app
}

/** Apply a preview decision: status body, or cookie + redirect. */
function sendPreviewResult(req, res, r) {
  if (r.status !== 302) {
    res.status(r.status).end(r.body)
    return
  }
  const { name, value, clear } = r.cookie
  // Strapi's admin frames the storefront cross-site, which needs SameSite=None.
  const secure = req.protocol === 'https' || /^https\b/.test(req.get('x-forwarded-proto') || '')
  const options = name === STRAPI_PREVIEW_COOKIE
    ? { path: '/', httpOnly: true, sameSite: secure ? 'none' : 'lax', secure }
    : { path: '/', httpOnly: true, sameSite: 'lax' }
  if (clear) res.clearCookie(name, options)
  else res.cookie(name, value, options)
  res.redirect(302, r.location)
}

/** Parse a Cookie header into a name→value map. */
function parseCookies(header) {
  const out = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const name = part.slice(0, idx).trim()
    if (name) out[name] = decodeURIComponent(part.slice(idx + 1).trim())
  }
  return out
}

/**
 * Make a JSON string safe to embed inside a <script> tag. Without this, a `<`
 * in the data (e.g. an HTML product description) could close the tag early —
 * an XSS vector and a parse break.
 */
function serializeState(json) {
  // U+2028 / U+2029 are valid in JSON strings but are line terminators in
  // JavaScript source — embedded raw they break the inline <script>. Escape
  // them via RegExp built from \u sequences (a literal char here would itself
  // break this file).
  const LS = new RegExp('\\u2028', 'g')
  const PS = new RegExp('\\u2029', 'g')
  return json
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(LS, '\u2028')
    .replace(PS, '\u2029')
}

createServer().then((app) => {
  app.listen(PORT, HOST, () => {
    console.log(
      `[ssr] propeller-vue listening on http://${HOST}:${PORT} (${
        isProd ? 'production' : 'development'
      })`,
    )
  })
})
