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

test('prepr path keeps its secret and segment passthrough', () => {
  const env = { CMS_PROVIDER: 'prepr', PREPR_PREVIEW_SECRET: 'pp' }
  const r = resolvePreviewRequest(
    { secret: 'pp', slug: 'home-personalized', locale: 'en-US', prepr_preview_segment: 'seg' },
    env,
  )
  assert.equal(r.status, 302)
  assert.equal(r.location, '/?preview_lang=EN&prepr_preview_segment=seg')
  assert.equal(r.cookie.name, 'prepr_preview')
  assert.equal(r.cookie.value, '1')
  assert.equal(resolvePreviewRequest({ secret: 'x', slug: '/' }, env).status, 401)
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
  const prepr = { CMS_PROVIDER: 'prepr' }
  assert.equal(isCmsPreviewActive({ prepr_preview: '1' }, prepr), true)
  assert.equal(isCmsPreviewActive({ [STRAPI_PREVIEW_COOKIE]: token }, prepr), false)
  assert.equal(isCmsPreviewActive({ prepr_preview: '1' }, { CMS_PROVIDER: 'none' }), false)
})
