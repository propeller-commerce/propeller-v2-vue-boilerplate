import { FORM_RATE_LIMITS, clientIp, formLimiter } from './rateLimit.js'
import { verifyRecaptcha } from './recaptcha.js'

// Rate limit, honeypot, reCAPTCHA; false means the response is already sent.
export async function guardForm(
  req,
  res,
  { route, action, limiter = formLimiter, verifyCaptcha = verifyRecaptcha },
) {
  const ip = clientIp(req)
  const { limit, windowMs } = FORM_RATE_LIMITS[route]
  const hit = limiter.hit(`${route}:${ip}`, limit, windowMs)
  if (!hit.ok) {
    res.status(429).set('Retry-After', String(hit.retryAfter)).json({ error: 'rate_limited' })
    return false
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {}
  if (typeof body.website === 'string' && body.website.length > 0) {
    console.info(`[api/${route}] honeypot filled, request dropped`)
    res.json({ ok: true })
    return false
  }

  const captcha = await verifyCaptcha({ token: body.recaptchaToken, action, remoteIp: ip })
  if (captcha === 'failed') {
    res.status(400).json({ error: 'captcha_failed' })
    return false
  }
  if (captcha === 'unavailable') {
    res.status(503).json({ error: 'captcha_unavailable' })
    return false
  }
  return true
}
