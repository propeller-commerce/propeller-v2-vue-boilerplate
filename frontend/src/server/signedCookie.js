import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * HMAC-signed cookie values (last order, registration company, …).
 *
 * Key: COOKIE_SIGNING_SECRET. Without it the key is derived from the
 * order-editor API key (one warning at first use), so existing deployments keep
 * working; the API key itself is never the HMAC key. Every value is signed with
 * a purpose label and an expiry, so a cookie minted for one purpose never
 * verifies as another and a captured value dies with its max age.
 *
 * Cookie format: `base64url(value).expirySeconds.hmacHex`.
 */

const DERIVATION_LABEL = 'propeller-cookie-signing:v1'
let warned = false

/** The signing key from the environment, or '' when neither secret is configured. */
export function cookieSigningKey(env = process.env) {
  if (env.COOKIE_SIGNING_SECRET) return env.COOKIE_SIGNING_SECRET
  const apiKey = env.SSR_ORDER_EDITOR_API_KEY
  if (!apiKey) return ''
  if (!warned) {
    warned = true
    console.warn(
      '[security] COOKIE_SIGNING_SECRET is not set; signing cookies with a key derived from ' +
        'SSR_ORDER_EDITOR_API_KEY. Set a dedicated secret (see .env.example).',
    )
  }
  return createHmac('sha256', apiKey).update(DERIVATION_LABEL).digest('hex')
}

function mac(key, purpose, value, exp) {
  return createHmac('sha256', key).update(`${purpose}\n${exp}\n${value}`).digest('hex')
}

/**
 * Sign `value` (any string) for `purpose`, valid for `maxAgeSeconds`.
 * Null when no signing key is configured.
 */
export function signCookie(purpose, value, maxAgeSeconds, { key = cookieSigningKey(), now = Date.now } = {}) {
  if (!key) return null
  const exp = Math.floor(now() / 1000) + maxAgeSeconds
  const encoded = Buffer.from(String(value), 'utf8').toString('base64url')
  return `${encoded}.${exp}.${mac(key, purpose, String(value), exp)}`
}

/** The signed value when signature, purpose and expiry check out, else null. */
export function verifyCookie(purpose, cookie, { key = cookieSigningKey(), now = Date.now } = {}) {
  if (!key || typeof cookie !== 'string') return null
  const match = /^([A-Za-z0-9_-]*)\.(\d{1,12})\.([0-9a-f]{64})$/.exec(cookie)
  if (!match) return null
  const exp = Number(match[2])
  if (exp * 1000 <= now()) return null
  const value = Buffer.from(match[1], 'base64url').toString('utf8')
  const expected = Buffer.from(mac(key, purpose, value, exp), 'hex')
  return timingSafeEqual(expected, Buffer.from(match[3], 'hex')) ? value : null
}
