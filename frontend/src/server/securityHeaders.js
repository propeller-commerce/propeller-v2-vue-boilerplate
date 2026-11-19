import { cmsProvider, frameHeaders } from './preview.js'

/**
 * Response headers for every SSR page and API answer (#9), set by one Express
 * middleware ahead of the routes. The CSP mirrors the Next boilerplate's
 * production policy; framing (`frame-ancestors`, `X-Frame-Options`) is exactly
 * `frameHeaders()`: the active CMS editor may frame the shop, otherwise nobody.
 * `'unsafe-inline'` scripts stay allowed (the SSR state script, the Prepr
 * snippet); a nonce-based policy is a separate change.
 */

const VIDEO_FRAMES = 'https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com'

export function contentSecurityPolicy(env = process.env, isProd = env.NODE_ENV === 'production') {
  const recaptcha = !!(env.RECAPTCHA_SECRET_KEY && env.VITE_RECAPTCHA_SITE_KEY)
  const scripts = [
    cmsProvider(env) === 'prepr' && 'https://cdn.tracking.prepr.io',
    (env.VITE_USE_GA4 || '').trim().toLowerCase() === 'true' && 'https://www.googletagmanager.com',
    recaptcha && 'https://www.google.com https://www.gstatic.com',
  ].filter(Boolean)
  return [
    "default-src 'self'",
    `img-src 'self' data: https:${isProd ? '' : ' http:'}`,
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    // Vite's dev server needs eval and its HMR websocket; production needs neither.
    ["script-src 'self' 'unsafe-inline'", !isProd && "'unsafe-eval'", ...scripts].filter(Boolean).join(' '),
    `connect-src 'self' https:${isProd ? '' : ' ws: wss: http:'}`,
    `frame-src 'self' ${VIDEO_FRAMES}${recaptcha ? ' https://www.google.com' : ''}`,
    frameHeaders(env)['Content-Security-Policy'],
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

export function securityHeaders(env = process.env, isProd = env.NODE_ENV === 'production') {
  const frame = frameHeaders(env)
  return {
    'Content-Security-Policy': contentSecurityPolicy(env, isProd),
    ...(frame['X-Frame-Options'] ? { 'X-Frame-Options': frame['X-Frame-Options'] } : {}),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    // Browsers ignore HSTS over plain http, so a local production build is unaffected.
    ...(isProd ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}),
  }
}

/**
 * The CSP for the punchout transfer page, which auto-posts the cart to the
 * buyer's procurement system: the same policy without `form-action`, so the
 * hand-back (and any redirect the ERP answers with) isn't blocked. The return
 * URL itself is validated before the page is built.
 */
export function transferPolicy(env = process.env, isProd = env.NODE_ENV === 'production') {
  return contentSecurityPolicy(env, isProd)
    .split('; ')
    .filter((d) => !d.startsWith('form-action'))
    .join('; ')
}
