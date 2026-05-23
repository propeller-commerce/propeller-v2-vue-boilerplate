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
const gqlCache = new Map() // key → { status, contentType, body: Buffer, expiresAt }

function gqlCacheGet(key) {
  const hit = gqlCache.get(key)
  if (!hit) return undefined
  if (hit.expiresAt < Date.now()) {
    gqlCache.delete(key)
    return undefined
  }
  // LRU touch: re-insert to move to the most-recently-used end.
  gqlCache.delete(key)
  gqlCache.set(key, hit)
  return hit
}

function gqlCacheSet(key, entry) {
  gqlCache.set(key, { ...entry, expiresAt: Date.now() + GQL_CACHE_TTL_MS })
  if (gqlCache.size > GQL_CACHE_MAX_ENTRIES) {
    const oldest = gqlCache.keys().next().value
    if (oldest !== undefined) gqlCache.delete(oldest)
  }
}

/**
 * Peek the first non-whitespace, non-comment keyword in a GraphQL document to
 * decide whether it's a query, mutation, or subscription. An anonymous query
 * shorthand (`{ ... }`) is treated as a query. Anything we can't parse is
 * treated as `mutation` so we err on the side of *not* caching.
 */
function gqlOperationType(query) {
  if (typeof query !== 'string') return 'mutation'
  // Strip leading whitespace + line comments.
  let i = 0
  while (i < query.length) {
    const ch = query[i]
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++
      continue
    }
    if (ch === '#') {
      while (i < query.length && query[i] !== '\n') i++
      continue
    }
    break
  }
  if (query[i] === '{') return 'query' // shorthand
  const head = query.slice(i, i + 12).toLowerCase()
  if (head.startsWith('query')) return 'query'
  if (head.startsWith('mutation')) return 'mutation'
  if (head.startsWith('subscription')) return 'subscription'
  return 'mutation'
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

      // Try to parse the body so we can read the GraphQL op type. If parsing
      // fails for any reason, fall through to the bypass path — better to
      // forward an unparseable request than to cache or reject it.
      let parsed = null
      try { parsed = JSON.parse(rawBody.toString('utf-8')) } catch {}
      const opType = parsed ? gqlOperationType(parsed.query) : 'mutation'

      const cacheable = !authHeader && opType === 'query'
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

      // Forward to upstream with the API key injected server-side. Mirrors
      // the old http-proxy-middleware behaviour: apikey header + content-type,
      // pass through Authorization when present.
      try {
        const upstreamResp = await fetch(UPSTREAM, {
          method: 'POST',
          headers: {
            'apikey': API_KEY,
            'Content-Type': 'application/json',
            ...(authHeader ? { Authorization: authHeader } : {}),
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
            gqlCacheSet(key, { status: upstreamResp.status, contentType, body: respBuf })
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
