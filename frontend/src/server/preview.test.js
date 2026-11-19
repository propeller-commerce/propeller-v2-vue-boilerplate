import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  STRAPI_PREVIEW_COOKIE,
  isStrapiPreviewEnabled,
  isStrapiPreviewActive,
  isCmsPreviewActive,
  resolvePreviewRequest,
  resolvePreviewExit,
  frameHeaders,
  previewBase,
  strapiPreviewToken,
} from './preview.js'

const strapiEnv = {
  CMS_PROVIDER: 'strapi',
  STRAPI_PREVIEW_SECRET: 's3cret',
  STRAPI_API_URL: 'https://cms.example.com/some/path',
}

test('strapi active + right secret enables preview and redirects to the page', () => {
  const r = resolvePreviewRequest({ secret: 's3cret', slug: '/about', status: 'draft' }, strapiEnv)
  assert.equal(r.status, 302)
  assert.equal(r.location, '/about')
  assert.equal(r.cookie.name, STRAPI_PREVIEW_COOKIE)
  assert.equal(r.cookie.value, strapiPreviewToken('s3cret'))
  assert.notEqual(r.cookie.value, 's3cret')
  assert.equal(r.cookie.clear, false)
})

test('strapi preview without status defaults to draft', () => {
  const r = resolvePreviewRequest({ secret: 's3cret', slug: '/blog/hello' }, strapiEnv)
  assert.equal(r.status, 302)
  assert.equal(r.location, '/blog/hello')
  assert.equal(r.cookie.clear, false)
})

test('home slug and bare slugs map to storefront paths', () => {
  assert.equal(resolvePreviewRequest({ secret: 's3cret', slug: '/' }, strapiEnv).location, '/')
  assert.equal(resolvePreviewRequest({ secret: 's3cret', slug: 'home' }, strapiEnv).location, '/')
  assert.equal(resolvePreviewRequest({ secret: 's3cret', slug: 'about' }, strapiEnv).location, '/about')
})

test('status=published turns preview off and still redirects', () => {
  const r = resolvePreviewRequest({ secret: 's3cret', slug: '/about', status: 'published' }, strapiEnv)
  assert.equal(r.status, 302)
  assert.equal(r.location, '/about')
  assert.equal(r.cookie.name, STRAPI_PREVIEW_COOKIE)
  assert.equal(r.cookie.clear, true)
})

test('wrong or missing secret answers 401', () => {
  assert.equal(resolvePreviewRequest({ secret: 'nope', slug: '/' }, strapiEnv).status, 401)
  assert.equal(resolvePreviewRequest({ slug: '/' }, strapiEnv).status, 401)
  assert.equal(resolvePreviewRequest({ secret: 's3cret-longer', slug: '/' }, strapiEnv).status, 401)
})

test('strapi inactive or secret unset is not available', () => {
  const q = { secret: 's3cret', slug: '/' }
  assert.equal(resolvePreviewRequest(q, { ...strapiEnv, CMS_PROVIDER: 'none' }).status, 404)
  assert.equal(resolvePreviewRequest(q, { ...strapiEnv, CMS_PROVIDER: undefined }).status, 404)
  assert.equal(resolvePreviewRequest(q, { ...strapiEnv, STRAPI_PREVIEW_SECRET: '' }).status, 404)
  assert.equal(resolvePreviewRequest(q, { CMS_PROVIDER: 'strapi' }).status, 404)
  assert.equal(isStrapiPreviewEnabled({ CMS_PROVIDER: 'strapi' }), false)
  assert.equal(isStrapiPreviewEnabled(strapiEnv), true)
})

test('protocol-relative slugs are rejected', () => {
  for (const slug of ['//evil.com', '//evil.com/x', '/\\evil.com', '\\\\evil.com']) {
    const r = resolvePreviewRequest({ secret: 's3cret', slug }, strapiEnv)
    assert.equal(r.status, 400, slug)
    assert.equal(r.location, undefined)
  }
})

test('a leading tab or newline cannot smuggle a protocol-relative URL (#16)', () => {
  for (const slug of ['\t//evil.com', '\n//evil.com', '/\t/evil.com', '\r\n/\\evil.com', '\u0000//evil.com']) {
    assert.equal(previewBase(slug), null, JSON.stringify(slug))
    assert.equal(resolvePreviewRequest({ secret: 's3cret', slug }, strapiEnv).status, 400, JSON.stringify(slug))
    assert.equal(resolvePreviewExit({ redirect: slug }, strapiEnv).location, '/', JSON.stringify(slug))
  }
  assert.equal(previewBase('/ab\tout'), '/about')
})

test('a single leading backslash cannot become /\\host on either route (#14)', () => {
  for (const slug of ['\\evil.test', '\t\\evil.test', '/\\evil.test', '\\/evil.test', '\n\\evil.test/x']) {
    assert.equal(previewBase(slug), null, JSON.stringify(slug))
    assert.equal(resolvePreviewRequest({ secret: 's3cret', slug }, strapiEnv).status, 400, JSON.stringify(slug))
    assert.equal(resolvePreviewExit({ redirect: slug }, strapiEnv).location, '/', JSON.stringify(slug))
  }
  // Ordinary slugs keep working.
  assert.equal(resolvePreviewExit({ redirect: 'about' }, strapiEnv).location, '/about')
  assert.equal(resolvePreviewExit({ redirect: '/en/about?x=1' }, strapiEnv).location, '/en/about?x=1')
  assert.equal(resolvePreviewExit({}, strapiEnv).location, '/')
})

test('absolute URLs never become an off-site redirect', () => {
  const r = resolvePreviewRequest({ secret: 's3cret', slug: 'https://evil.com' }, strapiEnv)
  assert.ok(r.status === 400 || (r.location && r.location.startsWith('/') && !r.location.startsWith('//')))
})

test('strapi locale is normalised to the storefront short code', () => {
  const nl = resolvePreviewRequest({ secret: 's3cret', slug: '/about', locale: 'nl' }, strapiEnv)
  assert.equal(nl.location, '/about?preview_lang=NL')
  const en = resolvePreviewRequest({ secret: 's3cret', slug: '/', locale: 'en-US' }, strapiEnv)
  assert.equal(en.location, '/?preview_lang=EN')
})

const preprEnv = { CMS_PROVIDER: 'prepr', PREPR_PREVIEW_SECRET: 'pp', COOKIE_SIGNING_SECRET: 'cookie-key' }

test('prepr path keeps its secret and segment passthrough', () => {
  const r = resolvePreviewRequest(
    { secret: 'pp', slug: 'home-personalized', locale: 'en-US', prepr_preview_segment: 'seg' },
    preprEnv,
  )
  assert.equal(r.status, 302)
  assert.equal(r.location, '/?preview_lang=EN&prepr_preview_segment=seg')
  assert.equal(r.cookie.name, 'prepr_preview')
  assert.notEqual(r.cookie.value, '1')
  assert.equal(isCmsPreviewActive({ prepr_preview: r.cookie.value }, preprEnv), true)
  assert.equal(resolvePreviewRequest({ secret: 'x', slug: '/' }, preprEnv).status, 401)
})

test('prepr preview fails closed without its secret; no default value (V2)', () => {
  const noSecret = { CMS_PROVIDER: 'prepr', COOKIE_SIGNING_SECRET: 'cookie-key' }
  assert.equal(resolvePreviewRequest({ secret: 'prepr-preview', slug: '/' }, noSecret).status, 404)
  assert.equal(resolvePreviewRequest({ secret: '', slug: '/' }, noSecret).status, 404)
  // A cookie signed while the secret was set stops working once it is removed.
  const { cookie } = resolvePreviewRequest({ secret: 'pp', slug: '/' }, preprEnv)
  assert.equal(isCmsPreviewActive({ prepr_preview: cookie.value }, noSecret), false)
  // Without any signing key nothing can be signed: 503, not an unsigned cookie.
  assert.equal(resolvePreviewRequest({ secret: 'pp', slug: '/' }, { CMS_PROVIDER: 'prepr', PREPR_PREVIEW_SECRET: 'pp' }).status, 503)
})

test('a hand-set or foreign prepr_preview cookie unlocks nothing (V2)', () => {
  assert.equal(isCmsPreviewActive({ prepr_preview: '1' }, preprEnv), false)
  const { cookie } = resolvePreviewRequest({ secret: 'pp', slug: '/' }, preprEnv)
  assert.equal(isCmsPreviewActive({ prepr_preview: cookie.value }, { ...preprEnv, COOKIE_SIGNING_SECRET: 'other-key' }), false)
  assert.equal(isCmsPreviewActive({ prepr_preview: cookie.value.replace(/.$/, (c) => (c === '0' ? '1' : '0')) }, preprEnv), false)
})

test('exit clears the active provider cookie', () => {
  const s = resolvePreviewExit({ redirect: '/about' }, strapiEnv)
  assert.equal(s.status, 302)
  assert.equal(s.location, '/about')
  assert.equal(s.cookie.name, STRAPI_PREVIEW_COOKIE)
  assert.equal(s.cookie.clear, true)
  assert.equal(resolvePreviewExit({ redirect: '//evil.com' }, strapiEnv).location, '/')
  assert.equal(resolvePreviewExit({}, { CMS_PROVIDER: 'none' }).status, 404)
})

test('preview cookie only counts when it carries the derived token', () => {
  const token = strapiPreviewToken('s3cret')
  assert.equal(isStrapiPreviewActive({ [STRAPI_PREVIEW_COOKIE]: token }, strapiEnv), true)
  assert.equal(isStrapiPreviewActive({ [STRAPI_PREVIEW_COOKIE]: '1' }, strapiEnv), false)
  assert.equal(isStrapiPreviewActive({}, strapiEnv), false)
  assert.equal(
    isStrapiPreviewActive({ [STRAPI_PREVIEW_COOKIE]: token }, { ...strapiEnv, CMS_PROVIDER: 'prepr' }),
    false,
  )
})

const DENY = { 'Content-Security-Policy': "frame-ancestors 'none'", 'X-Frame-Options': 'DENY' }

test('frame-ancestors allows the Strapi origin only when the secret is set', () => {
  const on = frameHeaders(strapiEnv)
  assert.equal(on['Content-Security-Policy'], "frame-ancestors 'self' https://cms.example.com")
  assert.equal(on['X-Frame-Options'], undefined)
  assert.deepEqual(frameHeaders({ ...strapiEnv, STRAPI_PREVIEW_SECRET: '' }), DENY)
  const local = frameHeaders({ CMS_PROVIDER: 'strapi', STRAPI_PREVIEW_SECRET: 'x' })
  assert.equal(local['Content-Security-Policy'], "frame-ancestors 'self' http://localhost:1337")
})

test('Prepr may frame the shop for its editor preview', () => {
  assert.deepEqual(frameHeaders({ CMS_PROVIDER: 'prepr' }), {
    'Content-Security-Policy': "frame-ancestors 'self' https://*.prepr.io",
  })
})

test('nobody may frame the shop by default', () => {
  assert.deepEqual(frameHeaders({ CMS_PROVIDER: 'none' }), DENY)
  assert.deepEqual(frameHeaders({}), DENY)
})

test('each provider honours only its own preview cookie', () => {
  const token = strapiPreviewToken('s3cret')
  assert.equal(isCmsPreviewActive({ prepr_preview: '1' }, strapiEnv), false)
  assert.equal(isCmsPreviewActive({ [STRAPI_PREVIEW_COOKIE]: token }, strapiEnv), true)
  const signed = resolvePreviewRequest({ secret: 'pp', slug: '/' }, preprEnv).cookie.value
  assert.equal(isCmsPreviewActive({ prepr_preview: signed }, preprEnv), true)
  assert.equal(isCmsPreviewActive({ [STRAPI_PREVIEW_COOKIE]: token }, preprEnv), false)
  assert.equal(isCmsPreviewActive({ prepr_preview: signed }, { CMS_PROVIDER: 'none' }), false)
})
