// reCAPTCHA v3 verification; opt-in, fails closed when Google is unreachable.

const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify'
const MAX_TOKEN = 4000

export function recaptchaConfig(env = process.env) {
  const secret = env.RECAPTCHA_SECRET_KEY || ''
  const siteKey = env.VITE_RECAPTCHA_SITE_KEY || ''
  const min = Number.parseFloat(env.RECAPTCHA_MIN_SCORE ?? '')
  return {
    enabled: !!(secret && siteKey),
    secret,
    minScore: Number.isFinite(min) ? min : 0.5,
  }
}

/** @returns {Promise<'disabled' | 'ok' | 'failed' | 'unavailable'>} */
export async function verifyRecaptcha({
  token,
  action,
  remoteIp,
  env = process.env,
  fetchImpl = globalThis.fetch,
  timeoutMs = 5000,
}) {
  const cfg = recaptchaConfig(env)
  if (!cfg.enabled) return 'disabled'
  if (typeof token !== 'string' || !token || token.length > MAX_TOKEN) return 'failed'

  const body = new URLSearchParams({ secret: cfg.secret, response: token })
  if (remoteIp && remoteIp !== 'unknown') body.set('remoteip', remoteIp)

  let data
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetchImpl(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: ctrl.signal,
    })
    if (!res.ok) {
      console.error(`[recaptcha] siteverify answered ${res.status}`)
      return 'unavailable'
    }
    data = await res.json()
  } catch (e) {
    console.error('[recaptcha] siteverify unreachable:', e?.name || e)
    return 'unavailable'
  } finally {
    clearTimeout(timer)
  }

  if (!data || data.success !== true) return 'failed'
  if (typeof data.score !== 'number' || data.score < cfg.minScore) return 'failed'
  if (data.action !== action) return 'failed'
  return 'ok'
}
