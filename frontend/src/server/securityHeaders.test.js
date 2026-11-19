import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contentSecurityPolicy, securityHeaders, transferPolicy } from './securityHeaders.js'
import { frameHeaders } from './preview.js'

const directives = (csp) => Object.fromEntries(csp.split('; ').map((d) => [d.split(' ')[0], d]))

test('production CSP mirrors the Next policy', () => {
  const d = directives(contentSecurityPolicy({}, true))
  assert.equal(d['default-src'], "default-src 'self'")
  assert.equal(d['script-src'], "script-src 'self' 'unsafe-inline'")
  assert.equal(d['connect-src'], "connect-src 'self' https:")
  assert.equal(d['img-src'], "img-src 'self' data: https:")
  assert.equal(d['base-uri'], "base-uri 'self'")
  assert.equal(d['form-action'], "form-action 'self'")
  assert.match(d['frame-src'], /youtube\.com .*player\.vimeo\.com/)
  assert.ok(!contentSecurityPolicy({}, true).includes('unsafe-eval'))
})

test('framing is exactly frameHeaders(): DENY by default, the CMS editor when enabled', () => {
  for (const env of [{}, { CMS_PROVIDER: 'prepr' }, { CMS_PROVIDER: 'strapi', STRAPI_PREVIEW_SECRET: 'x' }]) {
    const h = securityHeaders(env, true)
    const frame = frameHeaders(env)
    assert.equal(directives(h['Content-Security-Policy'])['frame-ancestors'], frame['Content-Security-Policy'])
    assert.equal(h['X-Frame-Options'], frame['X-Frame-Options'])
  }
  assert.equal(securityHeaders({}, true)['X-Frame-Options'], 'DENY')
})

test('third-party scripts only when their feature is on', () => {
  const on = contentSecurityPolicy(
    { CMS_PROVIDER: 'prepr', VITE_USE_GA4: 'true', RECAPTCHA_SECRET_KEY: 's', VITE_RECAPTCHA_SITE_KEY: 'k' },
    true,
  )
  const d = directives(on)
  for (const host of ['https://cdn.tracking.prepr.io', 'https://www.googletagmanager.com', 'https://www.gstatic.com']) {
    assert.ok(d['script-src'].includes(host), host)
  }
  assert.ok(d['frame-src'].includes('https://www.google.com'))
  assert.ok(!directives(contentSecurityPolicy({ RECAPTCHA_SECRET_KEY: 's' }, true))['script-src'].includes('google'))
})

test('dev allows Vite (eval, HMR websocket); HSTS only in production', () => {
  const d = directives(contentSecurityPolicy({}, false))
  assert.ok(d['script-src'].includes("'unsafe-eval'"))
  assert.ok(d['connect-src'].includes('ws:'))
  assert.equal(securityHeaders({}, false)['Strict-Transport-Security'], undefined)
  assert.match(securityHeaders({}, true)['Strict-Transport-Security'], /max-age=31536000/)
  assert.equal(securityHeaders({}, true)['X-Content-Type-Options'], 'nosniff')
  assert.equal(securityHeaders({}, true)['Referrer-Policy'], 'strict-origin-when-cross-origin')
})

test('the punchout transfer page drops form-action only', () => {
  const full = directives(contentSecurityPolicy({}, true))
  const transfer = directives(transferPolicy({}, true))
  assert.equal(transfer['form-action'], undefined)
  delete full['form-action']
  assert.deepEqual(transfer, full)
})
