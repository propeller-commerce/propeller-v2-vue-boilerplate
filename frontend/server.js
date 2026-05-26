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
    // for the upstream forward.
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', async () => {
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
      const useOrderKey =
        !!operationName && ORDER_EDITOR_MUTATIONS.has(operationName) && !!ORDER_EDITOR_API_KEY
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
        'node_modules/propeller-v2-vue-ui/dist/styles.css',
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
    vite = await createViteServer({
      server: { middlewareMode: true },
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
      const ssrContext = {
        cookieHeader,
        cookies: parseCookies(cookieHeader),
        url,
      }

      const result = await render(url, ssrContext)

      if (result.redirect) {
        res.redirect(302, result.redirect)
        return
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
        .set({ 'Content-Type': 'text/html' })
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
