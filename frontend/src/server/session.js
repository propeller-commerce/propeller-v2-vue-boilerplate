import { createHash } from 'node:crypto'
import { tokenExpiryMs } from './viewer.js'

/**
 * The shopper's session lives in two httpOnly cookies set by the server (V1):
 * browser code never stores or reads a token. The login flows hand the tokens
 * they receive to POST /api/auth/session; the GraphQL proxy and SSR read the
 * access token from the cookie, and the refresh token renews it server-side.
 */

export const ACCESS_COOKIE = 'access_token'
export const REFRESH_COOKIE = 'refresh_token'
export const ACCESS_MAX_AGE = 8 * 60 * 60
export const REFRESH_MAX_AGE = 30 * 24 * 60 * 60

// Renew this long before `exp`, so a request never reaches upstream with a token that expires on the way.
const EXPIRY_MARGIN_MS = 30_000
const MAX_TOKEN_LENGTH = 8192

/**
 * Worth storing as a session: a JWT that parses and has not expired. Shape only;
 * upstream checks the signature on every use, and a same-origin JSON request can
 * only set its own browser's cookie.
 */
export function isSessionToken(token, now = Date.now()) {
  if (typeof token !== 'string' || token.length > MAX_TOKEN_LENGTH || token.split('.').length !== 3) return false
  const exp = tokenExpiryMs(token)
  return Number.isFinite(exp) && exp > now
}

/** The access token is missing or (about to be) expired, so the refresh token should renew it. */
export function needsRenewal(accessToken, now = Date.now()) {
  return !accessToken || tokenExpiryMs(accessToken) - EXPIRY_MARGIN_MS <= now
}

export const REFRESH_MUTATION =
  'mutation exchangeRefreshToken($input: ExchangeRefreshTokenInput!) { exchangeRefreshToken(input: $input) { access_token refresh_token expires_in } }'

/** `exchange(refreshToken) → { accessToken, refreshToken } | null` against the upstream API. */
export function exchangeRefreshFrom(endpoint, apiKey) {
  return async (refreshToken) => {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({ query: REFRESH_MUTATION, variables: { input: { refreshToken } } }),
      signal: AbortSignal.timeout(10_000),
    })
    const json = await res.json().catch(() => null)
    const r = json?.data?.exchangeRefreshToken
    if (!res.ok || !isSessionToken(r?.access_token)) return null
    return {
      accessToken: r.access_token,
      refreshToken: typeof r.refresh_token === 'string' && r.refresh_token ? r.refresh_token : refreshToken,
    }
  }
}

/**
 * `renew(refreshToken) → Promise<{ accessToken, refreshToken } | null>`; never rejects.
 * One exchange per refresh token: concurrent callers share it, and the answer is kept
 * for `reuseMs` so requests that left the browser before its new cookie arrived get the
 * same tokens instead of spending a rotated refresh token. Failures are kept too, so a
 * dead refresh token isn't retried on every request.
 * ponytail: in-memory per process; N instances each exchange once, which upstream allows.
 */
export function createRenewer(exchange, { reuseMs = 30_000, maxEntries = 1000, now = Date.now } = {}) {
  const recent = new Map()
  return function renew(refreshToken) {
    if (typeof refreshToken !== 'string' || !refreshToken || refreshToken.length > MAX_TOKEN_LENGTH) {
      return Promise.resolve(null)
    }
    const key = createHash('sha256').update(refreshToken).digest('hex')
    const hit = recent.get(key)
    if (hit && now() - hit.at < reuseMs) return hit.promise
    const promise = Promise.resolve()
      .then(() => exchange(refreshToken))
      .catch(() => null)
    recent.delete(key)
    recent.set(key, { promise, at: now() })
    while (recent.size > maxEntries) recent.delete(recent.keys().next().value)
    return promise
  }
}

/** A Cookie header with `name` set to `value`, replacing any earlier value. */
export function withCookie(header, name, value) {
  const others = (header || '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part && part.slice(0, part.indexOf('=')).trim() !== name)
  return [...others, `${name}=${encodeURIComponent(value)}`].join('; ')
}
