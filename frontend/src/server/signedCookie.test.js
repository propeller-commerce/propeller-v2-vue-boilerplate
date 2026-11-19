import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cookieSigningKey, signCookie, verifyCookie } from './signedCookie.js'

const opts = { key: 'test-signing-key', now: () => 1_000_000_000_000 }

test('a signed value round-trips, any string included', () => {
  for (const value of ['123', '123.sq', '{"mode":"oci","returnUrl":"https://x.test/a?b=1"}', '']) {
    const cookie = signCookie('last-order', value, 3600, opts)
    assert.match(cookie, /^[A-Za-z0-9_-]*\.\d+\.[0-9a-f]{64}$/)
    assert.equal(verifyCookie('last-order', cookie, opts), value)
  }
})

test('another purpose, key, value or expiry does not verify', () => {
  const cookie = signCookie('last-order', '123', 3600, opts)
  assert.equal(verifyCookie('registration', cookie, opts), null)
  assert.equal(verifyCookie('last-order', cookie, { ...opts, key: 'other' }), null)
  const [, exp, sig] = cookie.split('.')
  const forged = `${Buffer.from('124').toString('base64url')}.${exp}.${sig}`
  assert.equal(verifyCookie('last-order', forged, opts), null)
  const [enc] = cookie.split('.')
  assert.equal(verifyCookie('last-order', `${enc}.${Number(exp) + 9999}.${sig}`, opts), null)
})

test('an expired cookie is refused', () => {
  const cookie = signCookie('last-order', '123', 60, opts)
  assert.equal(verifyCookie('last-order', cookie, { ...opts, now: () => opts.now() + 59_000 }), '123')
  assert.equal(verifyCookie('last-order', cookie, { ...opts, now: () => opts.now() + 60_000 }), null)
})

test('malformed input and a missing key never verify', () => {
  for (const bad of [undefined, null, '', '123', '123.abc', 'MTIz.1.xyz', 42]) {
    assert.equal(verifyCookie('last-order', bad, opts), null, String(bad))
  }
  assert.equal(signCookie('last-order', '1', 60, { ...opts, key: '' }), null)
  assert.equal(verifyCookie('last-order', signCookie('last-order', '1', 60, opts), { ...opts, key: '' }), null)
})

test('the key is the dedicated secret, else derived from (never equal to) the order-editor key', () => {
  assert.equal(cookieSigningKey({ COOKIE_SIGNING_SECRET: 's', SSR_ORDER_EDITOR_API_KEY: 'k' }), 's')
  const derived = cookieSigningKey({ SSR_ORDER_EDITOR_API_KEY: 'k' })
  assert.match(derived, /^[0-9a-f]{64}$/)
  assert.notEqual(derived, 'k')
  assert.equal(cookieSigningKey({ SSR_ORDER_EDITOR_API_KEY: 'k' }), derived)
  assert.equal(cookieSigningKey({}), '')
})
