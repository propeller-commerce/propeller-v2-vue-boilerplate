// In-memory fixed-window limiter; counters are per server instance.

const TEN_MINUTES = 10 * 60 * 1000
const SWEEP_EVERY_MS = 60 * 1000

export const FORM_RATE_LIMITS = {
  contact: { limit: 5, windowMs: TEN_MINUTES },
  'price-request': { limit: 10, windowMs: TEN_MINUTES },
}

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

// Best-effort client IP; x-forwarded-for comes from the reverse proxy and can be spoofed.
export function clientIp(req) {
  const headers = req?.headers || {}
  const xff = headers['x-forwarded-for']
  const xffStr = Array.isArray(xff) ? xff[0] : xff
  if (xffStr) return xffStr.split(',')[0].trim()
  const xri = headers['x-real-ip']
  if (xri) return Array.isArray(xri) ? xri[0] : xri
  return req?.socket?.remoteAddress || 'unknown'
}

export const formLimiter = createRateLimiter()
