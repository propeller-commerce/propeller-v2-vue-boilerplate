/**
 * CMS preview decisions for `/api/preview` (Prepr and Strapi), kept pure so
 * they can be unit-tested. `server.js` applies the returned status, cookie and
 * redirect; the SSR handler uses `isStrapiPreviewActive` and `frameHeaders`.
 *
 * Server-only. Never imported by a client component.
 */

import crypto from 'node:crypto'

export const PREPR_PREVIEW_COOKIE = 'prepr_preview'
export const STRAPI_PREVIEW_COOKIE = 'strapi_preview'

const HOME_SLUGS = ['home', 'home-personalized', 'index', 'home-generic']
const DEFAULT_STRAPI_URL = 'http://localhost:1337'

/** Active CMS provider, lowercased (`none` when unset). */
export function cmsProvider(env = process.env) {
  return (env.CMS_PROVIDER || env.VITE_CMS_PROVIDER || 'none').trim().toLowerCase()
}

/** Strapi is the active CMS and `STRAPI_PREVIEW_SECRET` is set. */
export function isStrapiPreviewEnabled(env = process.env) {
  return cmsProvider(env) === 'strapi' && !!env.STRAPI_PREVIEW_SECRET
}

/** Cookie value derived from the secret, so a hand-set cookie cannot unlock drafts. */
export function strapiPreviewToken(secret) {
  return crypto.createHmac('sha256', String(secret)).update('strapi-preview').digest('hex')
}

/** True when the request carries a valid Strapi preview cookie. */
export function isStrapiPreviewActive(cookies, env = process.env) {
  if (!isStrapiPreviewEnabled(env)) return false
  return safeEqual(cookies?.[STRAPI_PREVIEW_COOKIE] || '', strapiPreviewToken(env.STRAPI_PREVIEW_SECRET))
}

/** Preview state for SSR: each provider honours only its own cookie. */
export function isCmsPreviewActive(cookies, env = process.env) {
  const provider = cmsProvider(env)
  if (provider === 'prepr') return cookies?.[PREPR_PREVIEW_COOKIE] === '1'
  return isStrapiPreviewActive(cookies, env)
}

/** Origin of the Strapi app (the admin that frames the storefront). */
export function strapiOrigin(env = process.env) {
  try {
    return new URL(env.NEXT_PUBLIC_STRAPI_API_URL || env.STRAPI_API_URL || DEFAULT_STRAPI_URL).origin
  } catch {
    return ''
  }
}

/** Framing headers: the active CMS editor may frame the storefront, otherwise nobody. */
export function frameHeaders(env = process.env) {
  // X-Frame-Options can't allow a CMS origin, so a CMS editor gets CSP alone.
  if (cmsProvider(env) === 'prepr') return { 'Content-Security-Policy': "frame-ancestors 'self' https://*.prepr.io" }
  const origin = isStrapiPreviewEnabled(env) ? strapiOrigin(env) : ''
  if (origin) return { 'Content-Security-Policy': `frame-ancestors 'self' ${origin}` }
  return { 'Content-Security-Policy': "frame-ancestors 'none'", 'X-Frame-Options': 'DENY' }
}

/**
 * Decide the `/api/preview` response.
 * Returns `{ status, body }` or `{ status: 302, location, cookie: { name, value, clear } }`.
 */
export function resolvePreviewRequest(query, env = process.env) {
  const provider = cmsProvider(env)
  const prepr = provider === 'prepr'
  const secret = prepr ? env.PREPR_PREVIEW_SECRET || 'prepr-preview' : env.STRAPI_PREVIEW_SECRET
  if (!prepr && !isStrapiPreviewEnabled(env)) return { status: 404, body: 'Not found' }
  if (!safeEqual(str(query.secret), secret)) return { status: 401, body: 'Invalid preview secret' }

  const base = previewBase(str(query.slug) || str(query.redirect) || '/')
  if (!base) return { status: 400, body: 'Invalid slug' }

  const params = new URLSearchParams()
  const rawLocale = str(query.locale) || str(query.lang)
  if (rawLocale) params.set('preview_lang', rawLocale.split('-')[0].toUpperCase())
  if (prepr) {
    for (const key of ['prepr_preview_segment', 'prepr_preview_ab']) {
      if (str(query[key])) params.set(key, str(query[key]))
    }
  }
  const qs = params.toString()
  const location = qs ? `${base}${base.includes('?') ? '&' : '?'}${qs}` : base

  const cookie = prepr
    ? { name: PREPR_PREVIEW_COOKIE, value: '1', clear: false }
    : str(query.status) === 'published'
      ? { name: STRAPI_PREVIEW_COOKIE, value: '', clear: true }
      : { name: STRAPI_PREVIEW_COOKIE, value: strapiPreviewToken(secret), clear: false }
  return { status: 302, location, cookie }
}

/** Decide the `/api/preview/exit` response. */
export function resolvePreviewExit(query, env = process.env) {
  const provider = cmsProvider(env)
  if (provider !== 'prepr' && !isStrapiPreviewEnabled(env)) return { status: 404, body: 'Not found' }
  const raw = str(query.redirect) || '/'
  const location = unsafeSlug(raw) ? '/' : raw.startsWith('/') ? raw : `/${raw}`
  const name = provider === 'prepr' ? PREPR_PREVIEW_COOKIE : STRAPI_PREVIEW_COOKIE
  return { status: 302, location, cookie: { name, value: '', clear: true } }
}

// Same-origin path for a CMS slug; null for anything that could leave the site.
function previewBase(slug) {
  if (unsafeSlug(slug)) return null
  const bare = slug.replace(/^\/+/, '').toLowerCase()
  if (bare === '' || HOME_SLUGS.includes(bare)) return '/'
  return slug.startsWith('/') ? slug : `/${slug}`
}

function unsafeSlug(slug) {
  return /^[/\\]{2}/.test(slug) || /^[a-z][a-z0-9+.-]*:/i.test(slug)
}

function safeEqual(a, b) {
  if (typeof b !== 'string' || !b) return false
  const ha = crypto.createHash('sha256').update(String(a)).digest()
  const hb = crypto.createHash('sha256').update(b).digest()
  return crypto.timingSafeEqual(ha, hb)
}

function str(v) {
  if (Array.isArray(v)) return typeof v[0] === 'string' ? v[0] : ''
  return typeof v === 'string' ? v : ''
}
