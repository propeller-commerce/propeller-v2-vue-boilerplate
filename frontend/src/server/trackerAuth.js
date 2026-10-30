import crypto from 'node:crypto'

/**
 * HTTP Basic gate for the /tracker dashboard and every /api/tracker* route.
 * Any username; the password must equal TRACKER_ACCESS_SECRET. Unset secret
 * means the dashboard does not exist (404), so a fresh deploy fails closed.
 */

export const TRACKER_REALM = 'Basic realm="tracker", charset="UTF-8"'

// Page with optional locale prefix, or any /api/tracker* path.
const PAGE_RE = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?tracker(?:\/|$)/i
const API_RE = /^\/api\/tracker/i

export function isTrackerPath(rawPath) {
  let p = String(rawPath || '')
  try {
    p = decodeURIComponent(p)
  } catch {
    // Undecodable: match on the raw form.
  }
  p = p.replace(/\/{2,}/g, '/')
  return PAGE_RE.test(p) || API_RE.test(p)
}

const digest = (s) => crypto.createHash('sha256').update(s, 'utf8').digest()

function safeEqual(a, b) {
  return crypto.timingSafeEqual(digest(a), digest(b))
}

/** Returns `{ status }`: 200 allowed, 401 challenge, 404 not configured. */
export function checkTrackerAuth(header, secret) {
  if (!secret) return { status: 404 }
  if (typeof header !== 'string') return { status: 401 }
  const m = /^Basic\s+([A-Za-z0-9+/=_-]+)\s*$/i.exec(header)
  if (!m) return { status: 401 }
  const decoded = Buffer.from(m[1], 'base64').toString('utf8')
  const colon = decoded.indexOf(':')
  if (colon === -1) return { status: 401 }
  return { status: safeEqual(decoded.slice(colon + 1), secret) ? 200 : 401 }
}

export function trackerGate(req, res, next) {
  if (!isTrackerPath(req.path)) return next()
  const { status } = checkTrackerAuth(req.headers.authorization, process.env.TRACKER_ACCESS_SECRET)
  if (status === 200) return next()
  res.status(status).set('Cache-Control', 'no-store')
  if (status === 401) res.set('WWW-Authenticate', TRACKER_REALM)
  res.end(status === 401 ? 'Unauthorized' : 'Not found')
}
