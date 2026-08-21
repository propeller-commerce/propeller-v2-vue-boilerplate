/**
 * Node SSR server for propeller-vue.
 *
 * Replaces the previous `vite preview` (static-only) start command. It:
 *   - DEV  : runs Vite in middleware mode (HMR, on-the-fly transforms) and
 *            loads `src/entry-server.ts` fresh per request.
 *   - PROD : serves the built client assets from `dist/client/` and loads the
 *            pre-built `dist/server/entry-server.js`.
 *   - Both : proxies `/api/graphql` and `/api/order-editor` to the upstream
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
import { createProxyMiddleware } from 'http-proxy-middleware'
import {
  getMollieProvider,
  isMollieEnabled,
  isOnAccountMethod,
} from './src/server/mollie.js'
import { getMspProvider, isMspEnabled } from './src/server/msp.js'
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
} from './src/server/punchout.js'
import {
  isPreprEnabled,
  resolvePreprRequest,
  preprUidCookie,
  previewSecret,
} from './src/server/cms.js'

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

// Upstream + keys. The SSR_* vars are the canonical server-side names; we fall
// back to the legacy VITE_* vars so an unchanged .env still works.
const UPSTREAM =
  process.env.SSR_GRAPHQL_PROXY_TARGET ||
  process.env.VITE_GRAPHQL_PROXY_TARGET ||
  'https://api.staging.helice.cloud/v2/graphql'
const API_KEY = process.env.SSR_API_KEY || process.env.VITE_API_KEY || ''
const ORDER_EDITOR_API_KEY =
  process.env.SSR_ORDER_EDITOR_API_KEY ||
  process.env.VITE_ORDER_EDITOR_API_KEY ||
  ''

const upstreamUrl = new URL(UPSTREAM)

// Propeller mutations the backend authorizes ONLY against the dedicated
// "order editor" API key. Sending them with the general key returns the
// GraphQL error "Forbidden resource". The browser SDK posts everything to
// /api/graphql (proxy mode, no key in the body), so this server must pick the
// right key per operation — mirrors the nextDemo proxy + the SDK's own
// DEFAULT_ORDER_EDITOR_MUTATIONS. Keep in sync if the SDK list changes.
const ORDER_EDITOR_MUTATIONS = new Set([
  'orderSetStatus',
  'passwordResetLink',
  'triggerQuoteSendRequest',
  'triggerOrderSendConfirm',
])

// Operations that route to the order key ONLY when the caller identifies as the
// order-editor client. `contactRegister` is used by BOTH public self-registration
// (general key) AND authorization-settings "add contact" (order key) — the
// operationName is identical, so the caller signals intent via the SDK's
// `clientId` (sent as the `X-Client-ID` header in proxy mode) and the proxy
// routes accordingly. The header is server-internal: not forwarded upstream.
const ORDER_EDITOR_OPT_IN_MUTATIONS = new Set(['contactRegister'])
const ORDER_EDITOR_CLIENT_ID = 'order-editor'

// ── Proxy hardening: per-IP rate limit + body cap ───────────────────────────
//
// `/api/graphql` and `/api/order-editor` inject an API key server-side, so an
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
 * PWP-862 asked for, applied here from the start.)
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
 * Best-effort client IP. `x-forwarded-for` is set by the reverse proxy in
 * front of this server; a client can spoof it, so the worst case is an
 * attacker spreading their own budget across forged IPs — still bounded by
 * upstream, and the honest single-IP flood (the reported case) is stopped.
 */
function clientIp(req) {
  const xff = req.headers['x-forwarded-for']
  const xffStr = Array.isArray(xff) ? xff[0] : xff
  if (xffStr) return xffStr.split(',')[0].trim()
  const xri = req.headers['x-real-ip']
  if (xri) return Array.isArray(xri) ? xri[0] : xri
  return req.socket?.remoteAddress || 'unknown'
}

/**
 * Express middleware — mounted on BOTH key-injecting proxies. The auth tier is
 * gated on a structurally valid, non-expired JWT (see looksLikeValidJwt), so
 * presenting any `access_token` cookie value doesn't buy the higher ceiling.
 */
function rateLimitProxy(req, res, next) {
  const token = parseCookies(req.headers.cookie || '')['access_token']
  const limit = looksLikeValidJwt(token) ? RATE_LIMIT_AUTH : RATE_LIMIT_ANON
  if (isRateLimited(clientIp(req), limit)) {
    res
      .status(429)
      .set('Retry-After', String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)))
      .json({ errors: [{ message: 'rate limit exceeded' }] })
    return
  }
  next()
}

/**
 * Resolve a GraphQL operation name for API-key routing. Prefer the explicit
 * `operationName` the SDK sends in the body; fall back to the first
 * `query NAME` / `mutation NAME` in the document (mirrors the SDK's
 * `extractOperationName`), stripping leading `#` comment lines first.
 */
function gqlOperationName(parsed) {
  if (parsed && typeof parsed.operationName === 'string' && parsed.operationName) {
    return parsed.operationName
  }
  if (parsed && typeof parsed.query === 'string') {
    const stripped = parsed.query.replace(/^\s*#.*$/gm, '').trimStart()
    const match = stripped.match(/^(?:query|mutation)\s+(\w+)/)
    if (match) return match[1]
  }
  return undefined
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

/**
 * Determine the operation type of a GraphQL document. The SDK's generated
 * documents lead with `fragment` definitions and put the actual operation
 * at the end, so we scan for the first top-level `query` / `mutation` /
 * `subscription` keyword anywhere in the document. Anything we can't match
 * is treated as `mutation` so we err on the side of *not* caching.
 */
function gqlOperationType(query) {
  if (typeof query !== 'string') return 'mutation'
  const match = query.match(/\b(query|mutation|subscription)\b/)
  return match ? match[1] : 'mutation'
}

/** SHA-256 hex digest of the request body — stable cache key per operation+variables. */
function gqlCacheKey(rawBody) {
  return crypto.createHash('sha256').update(rawBody).digest('hex')
}

/**
 * Express handler for POST /api/graphql with anonymous-query response cache.
 * Forwards via `fetch` so we can capture the response body for caching.
 */
function graphqlCachedHandler() {
  return async (req, res) => {
    // Collect the raw body manually — we need it both for the cache key and
    // for the upstream forward. Capped: this buffers in memory, so without a
    // ceiling a single client can make the process allocate without bound.
    const chunks = []
    let received = 0
    let aborted = false
    const declared = Number(req.headers['content-length'])
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      res.status(413).json({ errors: [{ message: 'payload too large' }] })
      req.destroy()
      return
    }
    req.on('data', (c) => {
      if (aborted) return
      received += c.length
      if (received > MAX_BODY_BYTES) {
        aborted = true
        res.status(413).json({ errors: [{ message: 'payload too large' }] })
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', async () => {
      if (aborted) return
      const rawBody = Buffer.concat(chunks)
      const auth = req.headers['authorization']
      const authHeader = Array.isArray(auth) ? auth[0] : auth

      // Auth precedence (mirrors the nextDemo proxy):
      //   1. `access_token` cookie — the source of truth. The browser sets it
      //      same-origin on login (see `setCookie` in lib/ssr.ts) and it rides
      //      along on this same-origin POST, so we can authenticate upstream
      //      from it server-side instead of trusting the client to attach a
      //      header. Without this, a `viewer`/account query that reaches the
      //      proxy without the header resolves to the bare API key's default
      //      account — the "dummy user" — and (being header-less) gets cached
      //      and served to everyone.
      //   2. Client `Authorization` header — fallback for the brief window
      //      during login before the cookie lands.
      const cookieToken = parseCookies(req.headers.cookie || '')['access_token']
      const headerBearer = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7)
        : undefined
      const upstreamBearer = cookieToken || headerBearer
      // A request is authenticated if EITHER carries a token. Used below to
      // forward the Bearer and to keep personalised responses out of the cache.
      const isAuthenticated = !!upstreamBearer

      // Pull surgical-invalidation tags off the request. The SDK doesn't
      // know about these — `lib/server.ts` attaches them via the static
      // `headers` slot on the GraphQLClient config when `cacheable` infra
      // is in use. The header is server-internal: the upstream API doesn't
      // see it (we don't forward it) and the browser shouldn't send it.
      const tagsHeader = req.headers['x-propeller-cache-tags']
      const cacheTags = parseCacheTagsHeader(
        Array.isArray(tagsHeader) ? tagsHeader[0] : tagsHeader,
      )

      // Try to parse the body so we can read the GraphQL op type. If parsing
      // fails for any reason, fall through to the bypass path — better to
      // forward an unparseable request than to cache or reject it.
      let parsed = null
      try { parsed = JSON.parse(rawBody.toString('utf-8')) } catch {}
      const opType = parsed ? gqlOperationType(parsed.query) : 'mutation'

      // Route order-editor mutations to the dedicated key (else upstream
      // returns "Forbidden resource"). Falls back to the general key when the
      // order key isn't configured — surfacing the same error rather than a
      // silent mismatch.
      const operationName = gqlOperationName(parsed)
      // The order-editor client (authorization-settings "add contact") sets the
      // SDK `clientId`, sent as `X-Client-ID`. Public self-registration uses the
      // default client (no clientId) and stays on the general key.
      const clientIdHeader = req.headers['x-client-id']
      const orderEditorOptIn =
        (Array.isArray(clientIdHeader) ? clientIdHeader[0] : clientIdHeader) === ORDER_EDITOR_CLIENT_ID
      const useOrderKey =
        !!ORDER_EDITOR_API_KEY &&
        !!operationName &&
        (ORDER_EDITOR_MUTATIONS.has(operationName) ||
          (orderEditorOptIn && ORDER_EDITOR_OPT_IN_MUTATIONS.has(operationName)))
      const apiKey = useOrderKey ? ORDER_EDITOR_API_KEY : API_KEY

      // Only anonymous catalog queries are cacheable. An authenticated request
      // (cookie or header) is personalised — caching it would leak one user's
      // data to the next, and a header-less `viewer` would pin the dummy
      // account for everyone. `viewer` is excluded explicitly too: it's the
      // account-identity query, never anonymous-cacheable even if it somehow
      // arrives without a token.
      const cacheable =
        !isAuthenticated && opType === 'query' && operationName !== 'viewer'
      const key = cacheable ? gqlCacheKey(rawBody) : null

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

      // Forward to upstream with the API key injected server-side, plus the
      // Bearer resolved above (cookie wins over the client header). Sending the
      // cookie token here is what makes `viewer` and other account queries
      // resolve to the real user instead of the bare-API-key default.
      try {
        const upstreamResp = await fetch(UPSTREAM, {
          method: 'POST',
          headers: {
            'apikey': apiKey,
            'Content-Type': 'application/json',
            ...(upstreamBearer ? { Authorization: `Bearer ${upstreamBearer}` } : {}),
          },
          body: rawBody,
        })
        const respBuf = Buffer.from(await upstreamResp.arrayBuffer())
        const contentType = upstreamResp.headers.get('content-type') || 'application/json'

        // Only cache 2xx responses — a 4xx/5xx might be a transient upstream
        // error and we don't want to pin it for 24 h.
        if (cacheable && upstreamResp.status >= 200 && upstreamResp.status < 300) {
          // Don't cache a response that contains GraphQL errors — those
          // typically come back as `{ "errors": [...] }` even with HTTP 200.
          let hasErrors = false
          try {
            const parsedResp = JSON.parse(respBuf.toString('utf-8'))
            hasErrors = Array.isArray(parsedResp?.errors) && parsedResp.errors.length > 0
          } catch {}
          if (!hasErrors) {
            gqlCacheSet(key, {
              status: upstreamResp.status,
              contentType,
              body: respBuf,
              tags: cacheTags,
            })
          }
        }

        res.status(upstreamResp.status)
        res.set('Content-Type', contentType)
        if (cacheable) res.set('X-Cache', 'MISS')
        else res.set('X-Cache', 'BYPASS')
        res.end(respBuf)
      } catch (err) {
        console.error('[gql-proxy] upstream error:', err)
        res.status(502).set('Content-Type', 'application/json').end(
          JSON.stringify({ errors: [{ message: 'Upstream GraphQL request failed' }] }),
        )
      }
    })
    req.on('error', (err) => {
      console.error('[gql-proxy] request error:', err)
      res.status(400).end()
    })
  }
}

async function createServer() {
  const app = express()

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
    if (!providedStr || providedStr !== expected) {
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

  // ── /api/preview + /api/cms-revalidate — Prepr CMS endpoints ──────────────
  //
  // All gated on Prepr being the active CMS (isPreprEnabled). For Strapi/none
  // they 404, so a non-Prepr shop exposes no CMS surface. Registered BEFORE the
  // `*all` SSR catch-all. (Next mirror: app/api/preview, app/api/cms-revalidate.)

  // Enter draft mode: verify the secret, set a `prepr_preview` cookie the SSR
  // loaders read (to fetch draft content via the preview token), and redirect to
  // the page — carrying the segment/AB/locale switches so the previewed variant
  // resolves. Prepr's preview URL:
  //   /api/preview?secret=<PREPR_PREVIEW_SECRET>&slug=/{slug}&locale={locale}
  app.get('/api/preview', (req, res) => {
    if (!isPreprEnabled()) {
      res.status(404).end('Not found')
      return
    }
    if ((req.query.secret || '') !== previewSecret()) {
      res.status(401).end('Invalid preview secret')
      return
    }
    const slug = String(req.query.slug || req.query.redirect || '/')
    // The home page is served at `/`, not the CMS catch-all.
    const HOME = ['home', 'home-personalized', 'index', 'home-generic']
    const bare = slug.replace(/^\/+/, '').toLowerCase()
    const base = bare === '' || HOME.includes(bare)
      ? '/'
      : slug.startsWith('/') ? slug : `/${slug}`
    res.cookie('prepr_preview', '1', { path: '/', httpOnly: false, sameSite: 'lax' })
    const params = new URLSearchParams()
    const rawLocale = req.query.locale || req.query.lang
    if (rawLocale) params.set('preview_lang', String(rawLocale).split('-')[0].toUpperCase())
    for (const key of ['prepr_preview_segment', 'prepr_preview_ab']) {
      if (req.query[key]) params.set(key, String(req.query[key]))
    }
    const qs = params.toString()
    res.redirect(302, qs ? `${base}${base.includes('?') ? '&' : '?'}${qs}` : base)
  })

  // Exit draft mode: clear the cookie and return to the page (or home).
  app.get('/api/preview/exit', (req, res) => {
    if (!isPreprEnabled()) {
      res.status(404).end('Not found')
      return
    }
    res.clearCookie('prepr_preview', { path: '/' })
    const slug = String(req.query.redirect || '/')
    res.redirect(302, slug.startsWith('/') ? slug : `/${slug}`)
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
    if (!providedStr || providedStr !== expected) {
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

  // POST /api/mollie/create-payment — start a payment for a placed order.
  app.post(
    '/api/mollie/create-payment',
    express.json({ limit: '8kb' }),
    async (req, res) => {
      if (!isMollieEnabled()) {
        res.status(503).json({ error: 'mollie not configured' })
        return
      }
      const b = req.body || {}
      const valid =
        typeof b.orderId === 'number' &&
        (typeof b.amount === 'number' || typeof b.amount === 'string') &&
        typeof b.currency === 'string' &&
        typeof b.method === 'string' &&
        typeof b.description === 'string' &&
        typeof b.redirectUrl === 'string'
      if (!valid) {
        res.status(400).json({ error: 'missing or invalid fields' })
        return
      }
      // Defense in depth: on-account methods must never reach the PSP. The
      // client already skips Mollie for these, but guard server-side too.
      if (isOnAccountMethod(b.method)) {
        res.status(400).json({ error: 'on-account method does not use a PSP' })
        return
      }
      try {
        const result = await getMollieProvider().createPayment({
          orderId: b.orderId,
          amount: b.amount,
          currency: b.currency,
          method: b.method,
          description: b.description,
          redirectUrl: b.redirectUrl,
          ...(b.userId !== undefined ? { userId: b.userId } : {}),
          ...(b.anonymousId !== undefined ? { anonymousId: b.anonymousId } : {}),
        })
        res.json({ ok: true, ...result })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'payment creation failed'
        console.error('[mollie] create-payment failed:', message)
        res.status(500).json({ error: 'payment creation failed' })
      }
    },
  )

  // GET /api/mollie/payment-status?paymentId=tr_xxx — live status for return page.
  // Read-only; does not touch Propeller. A non-ok body means "unknown" so the
  // caller can retry.
  app.get('/api/mollie/payment-status', async (req, res) => {
    if (!isMollieEnabled()) {
      res.status(503).json({ error: 'mollie not configured' })
      return
    }
    const paymentId = String(req.query.paymentId || '').trim()
    if (!paymentId) {
      res.status(400).json({ error: 'missing paymentId' })
      return
    }
    try {
      const result = await getMollieProvider().getPaymentStatus(paymentId)
      res.json(result) // { ok, paymentId, status?, settled?, orderId?, error? }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'status lookup failed'
      console.error('[mollie] payment-status failed:', message)
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
        console.error(
          '[mollie] webhook handler error:',
          e instanceof Error ? e.message : e,
        )
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

  // POST /api/msp/create-payment — start a payment for a placed order.
  app.post(
    '/api/msp/create-payment',
    express.json({ limit: '8kb' }),
    async (req, res) => {
      if (!isMspEnabled()) {
        res.status(503).json({ error: 'multisafepay not configured' })
        return
      }
      const b = req.body || {}
      const valid =
        typeof b.orderId === 'number' &&
        (typeof b.amount === 'number' || typeof b.amount === 'string') &&
        typeof b.currency === 'string' &&
        typeof b.method === 'string' &&
        typeof b.description === 'string' &&
        typeof b.redirectUrl === 'string'
      if (!valid) {
        res.status(400).json({ error: 'missing or invalid fields' })
        return
      }
      // Defense in depth: on-account methods must never reach the PSP. The
      // shared helper is provider-agnostic and lives in mollie.js.
      if (isOnAccountMethod(b.method)) {
        res.status(400).json({ error: 'on-account method does not use a PSP' })
        return
      }
      try {
        const result = await getMspProvider().createPayment({
          orderId: b.orderId,
          amount: b.amount,
          currency: b.currency,
          method: b.method,
          description: b.description,
          redirectUrl: b.redirectUrl,
          ...(b.userId !== undefined ? { userId: b.userId } : {}),
          ...(b.anonymousId !== undefined ? { anonymousId: b.anonymousId } : {}),
        })
        res.json({ ok: true, ...result })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'payment creation failed'
        console.error('[msp] create-payment failed:', message)
        res.status(500).json({ error: 'payment creation failed' })
      }
    },
  )

  // GET /api/msp/payment-status?paymentId=<orderId> — live status for the return
  // page. MSP keys transactions by order id, so paymentId IS the order id
  // (orderId accepted as an alias). Read-only; a non-ok body means "unknown".
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
    try {
      const result = await getMspProvider().getPaymentStatus(paymentId)
      res.json(result) // { ok, paymentId, status?, settled?, orderId?, error? }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'status lookup failed'
      console.error('[msp] payment-status failed:', message)
      res.json({ ok: false, paymentId, error: 'status lookup failed' })
    }
  })

  // POST|GET /api/msp/webhook — MSP calls with `?transactionid=<orderId>` (the id
  // is in the query, never a form body → no body parser). The provider re-fetches
  // from MSP, classifies, and updates Propeller. ALWAYS 200 ("OK") so MSP never
  // retry-storms.
  const mspWebhookHandler = async (req, res) => {
    if (!isMspEnabled()) {
      res.status(200).send('OK')
      return
    }
    const id = String(req.query.transactionid || req.query.orderId || '').trim()
    try {
      const result = await getMspProvider().handleWebhook(id)
      if (!result.ok) {
        console.warn('[msp] webhook not processed:', result.error, 'order:', id)
      }
    } catch (e) {
      console.error(
        '[msp] webhook handler error:',
        e instanceof Error ? e.message : e,
      )
    }
    res.status(200).send('OK') // unconditional ack
  }
  app.post('/api/msp/webhook', mspWebhookHandler)
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
        console.error('[punchout] token mint failed:', err?.message || err)
        return sendXml(buildErrorResponse(500, 'Could not start punchout session'), 500)
      }
      const origin = `${req.protocol}://${req.get('host')}`
      const startUrl = buildStartUrl(`${origin}/api/punchout/enter`, {
        mode: 'cxml',
        mtoken,
        redirect: '/cart',
        HOOK_URL: parsed.browserFormPostUrl,
        buyer_cookie: parsed.buyerCookie,
        cxml_from: parsed.fromIdentity,
        cxml_to: parsed.toIdentity,
        deployment_mode: parsed.deploymentMode,
      })
      return sendXml(buildSetupResponse({ startUrl }), 200)
    },
  )

  // GET /api/punchout/enter — capture the session cookie, redirect to magic-login.
  app.get('/api/punchout/enter', (req, res) => {
    if (!isPunchoutEnabled()) return res.status(404).send('PunchOut disabled')
    const q = req.query
    const mtoken = String(q.mtoken || '')
    if (!mtoken) return res.status(400).send('Missing mtoken')

    const mode = q.mode === 'cxml' ? 'cxml' : 'oci'
    const returnUrl = String(q.HOOK_URL || q.hook_url || q.returnUrl || '')
    const session =
      mode === 'oci'
        ? { mode, returnUrl, target: PUNCHOUT_CONFIG.transferTarget, session: mapOciParams(q) }
        : {
            mode,
            returnUrl,
            target: PUNCHOUT_CONFIG.transferTarget,
            session: {},
            buyerCookie: q.buyer_cookie ? String(q.buyer_cookie) : undefined,
            from: q.cxml_from ? String(q.cxml_from) : undefined,
            to: q.cxml_to ? String(q.cxml_to) : undefined,
            deploymentMode: String(q.deployment_mode || 'test'),
          }

    const redirect = String(q.redirect || '/cart')
    const cookieOpts = { path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production' }
    res.cookie(PUNCHOUT_COOKIE, JSON.stringify(session), { ...cookieOpts, httpOnly: true, maxAge: 3600_000 })
    res.cookie(PUNCHOUT_FLAG_COOKIE, mode, { ...cookieOpts, httpOnly: false, maxAge: 3600_000 })
    const target = `/magic-login?mtoken=${encodeURIComponent(mtoken)}&redirect=${encodeURIComponent(redirect)}`
    res.redirect(302, target)
  })

  // POST /api/punchout/transfer — build the OCI/cXML payload, hand the cart back.
  app.post('/api/punchout/transfer', express.urlencoded({ extended: false, limit: '16kb' }), async (req, res) => {
    const cookies = parseCookies(req.headers.cookie || '')
    const rawSession = cookies[PUNCHOUT_COOKIE]
    if (!rawSession) return res.status(400).send('No punchout session')
    let session
    try {
      session = JSON.parse(rawSession)
    } catch {
      return res.status(400).send('Bad punchout session')
    }
    if (!session.returnUrl) return res.status(400).send('No return URL')

    const cartId = String(req.body?.cartId || '')
    if (!cartId) return res.status(400).send('Missing cartId')

    const client = createAuthedClient(cookies['access_token'])
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
      console.error('[punchout] cart load failed:', err?.message || err)
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
  // Rate limit BOTH key-injecting proxies. `/api/order-editor` carries the
  // more privileged key, so leaving it unthrottled while guarding
  // `/api/graphql` would just move the open relay one path over.
  app.use(['/api/graphql', '/api/order-editor'], rateLimitProxy)

  app.post('/api/graphql', graphqlCachedHandler())
  app.use(
    '/api/order-editor',
    createProxyMiddleware({
      target: upstreamUrl.origin,
      changeOrigin: true,
      pathRewrite: { '^/api/order-editor': '' },
      on: {
        proxyReq: (proxyReq, req) => {
          proxyReq.setHeader('apikey', ORDER_EDITOR_API_KEY)
          proxyReq.setHeader('Content-Type', 'application/json')
          const auth = req.headers['authorization']
          if (auth) {
            proxyReq.setHeader(
              'Authorization',
              Array.isArray(auth) ? auth[0] : auth,
            )
          }
        },
      },
    }),
  )

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

  // ── Behaviour tracking (PWP-910) ──────────────────────────────────────────
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
      try {
        const cookies = parseCookies(req.headers.cookie || '')
        const result = await ingestBatch({
          rawBody: typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}),
          cookieVisitorId: cookies[VISITOR_COOKIE],
          channelId: TRACKING_CHANNEL_ID,
        })
        // Minted here rather than during SSR: a Set-Cookie on an HTML response
        // makes that response uncacheable at a CDN.
        if (result.minted && result.visitorId) {
          res.setHeader('Set-Cookie', visitorCookie(result.visitorId))
        }
      } catch (e) {
        console.error('[track] ingest failed:', e instanceof Error ? e.message : e)
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
      const message = e instanceof Error ? e.message : 'query failed'
      // A setup problem is not a server fault: 503 with the fix attached, so the
      // dashboard can say "run tracking:init" instead of relaying ER_NO_SUCH_TABLE.
      const status = classifyDbError(e)
      if (status) {
        res.status(503).json({ error: message, status, hint: STATUS_HINTS[status], metric })
        return
      }
      console.error('[tracker] query failed:', message)
      res.status(500).json({ error: message, metric })
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
      const ssrContext = {
        cookieHeader,
        cookies: parseCookies(cookieHeader),
        url,
        preprHeaders: prepr.headers,
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
        .set({ 'Content-Type': 'text/html; charset=utf-8' })
        .end(html)
    } catch (err) {
      // Let Vite rewrite the stack to original source in dev.
      if (vite) vite.ssrFixStacktrace(err)
      console.error('[ssr] render error:', err)
      res.status(500).end('Internal Server Error')
    }
  })

  return app
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
