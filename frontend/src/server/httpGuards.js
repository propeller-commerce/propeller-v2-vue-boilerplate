import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Small request guards shared by the server routes: same-origin checks for
 * cookie-authenticated POSTs (#8), a constant-time compare for secrets (#16) and
 * a log-safe error summary (#15).
 */

const first = (value) => (Array.isArray(value) ? value[0] : value) || ''

function hostOf(url) {
  try {
    return new URL(url).host.toLowerCase()
  } catch {
    return null
  }
}

/**
 * A request whose Origin, when sent, is this shop: the request's own Host or
 * x-forwarded-host, or the configured site URL (for a proxy that forwards
 * `Host: localhost`). Browsers send Origin on every cross-site POST; a request
 * without one is a non-browser client, which can't carry a visitor's cookies.
 */
export function isSameOrigin(req, siteUrl = process.env.VITE_SITE_URL) {
  const origin = first(req.headers.origin)
  if (!origin) return true
  const originHost = hostOf(origin)
  if (!originHost) return false
  const allowed = [
    first(req.headers['x-forwarded-host']).split(',')[0].trim().toLowerCase(),
    first(req.headers.host).trim().toLowerCase(),
    siteUrl ? hostOf(siteUrl) : null,
  ].filter(Boolean)
  return allowed.includes(originHost)
}

/**
 * A JSON request from the shop itself. A cross-site form can't send
 * `application/json` without a CORS preflight, which this server never answers.
 */
export function isSameOriginJson(req, siteUrl) {
  const type = first(req.headers['content-type']).split(';')[0].trim().toLowerCase()
  return type === 'application/json' && isSameOrigin(req, siteUrl)
}

/** Constant-time string compare (on fixed-length digests) for secrets from headers and query strings. */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !b) return false
  const ha = createHash('sha256').update(a, 'utf8').digest()
  const hb = createHash('sha256').update(b, 'utf8').digest()
  return timingSafeEqual(ha, hb)
}

/**
 * What to log about a mail or upstream failure: the error type and codes only.
 * SMTP messages and responses quote recipient addresses, which must not reach
 * the logs.
 */
export function errorSummary(e) {
  if (e === null) return { name: 'null' }
  if (!(e instanceof Error)) return { name: typeof e }
  const out = { name: e.name }
  for (const key of ['code', 'responseCode', 'command', 'status', 'statusCode']) {
    const v = e[key]
    if (typeof v === 'string' || typeof v === 'number') out[key] = v
  }
  return out
}
