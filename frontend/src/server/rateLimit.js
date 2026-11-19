// In-memory fixed-window limiter; counters are per server instance.

const TEN_MINUTES = 10 * 60 * 1000
const SWEEP_EVERY_MS = 60 * 1000

export const FORM_RATE_LIMITS = {
  contact: { limit: 5, windowMs: TEN_MINUTES },
  'price-request': { limit: 10, windowMs: TEN_MINUTES },
  // Analytics beacons: generous, a page sends a few.
  track: { limit: 120, windowMs: 60 * 1000 },
}

// Shop-branded confirmations one address can receive, whatever IP asks (#10).
export const CONFIRMATION_DAILY_CAP = { limit: 3, windowMs: 24 * 60 * 60 * 1000 }

export function createRateLimiter({ now = Date.now } = {}) {
  const buckets = new Map()
  let nextSweep = 0

  function sweep(t) {
    if (t < nextSweep) return
    nextSweep = t + SWEEP_EVERY_MS
    for (const [key, b] of buckets) if (b.resetAt <= t) buckets.delete(key)
  }

  return {
    hit(key, limit, windowMs) {
      const t = now()
      sweep(t)
      let b = buckets.get(key)
      if (!b || b.resetAt <= t) {
        b = { count: 0, resetAt: t + windowMs }
        buckets.set(key, b)
      }
      if (b.count >= limit) {
        return { ok: false, retryAfter: Math.max(1, Math.ceil((b.resetAt - t) / 1000)) }
      }
      b.count++
      return { ok: true }
    },
    size: () => buckets.size,
  }
}

/**
 * The client address for rate limits and reCAPTCHA (#6): the x-forwarded-for entry
 * our own reverse proxy added, `TRUSTED_PROXY_HOPS` from the right (default 1:
 * nginx; add one per CDN / load balancer in front). Entries further left are
 * whatever the client sent. 0 hops = no proxy: the socket address. x-real-ip is
 * never read: without our proxy in front a client sets it. Only the reverse
 * proxy may reach the app port.
 */
export function clientIp(req, trustedHops = Number(process.env.TRUSTED_PROXY_HOPS?.trim() || 1)) {
  const hopsTrusted = Number.isInteger(trustedHops) && trustedHops >= 0 ? trustedHops : 1
  const xff = req?.headers?.['x-forwarded-for']
  const hops = (Array.isArray(xff) ? xff.join(',') : xff || '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean)
  if (hopsTrusted > 0 && hops.length) return hops[Math.max(0, hops.length - hopsTrusted)]
  return req?.socket?.remoteAddress || 'unknown'
}

export const formLimiter = createRateLimiter()
