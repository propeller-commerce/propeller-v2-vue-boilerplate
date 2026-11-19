import { test } from 'node:test'
import assert from 'node:assert/strict'
import { errorSummary, isSameOrigin, isSameOriginJson, safeEqual } from './httpGuards.js'

const req = (headers) => ({ headers })

test('isSameOrigin: no Origin is a non-browser client and passes', () => {
  assert.equal(isSameOrigin(req({ host: 'shop.test' }), ''), true)
})

test('isSameOrigin: Origin must be the request host, forwarded host or the site URL', () => {
  assert.equal(isSameOrigin(req({ origin: 'http://127.0.0.1:4000', host: '127.0.0.1:4000' }), ''), true)
  assert.equal(isSameOrigin(req({ origin: 'https://shop.test', host: 'localhost:4000', 'x-forwarded-host': 'shop.test' }), ''), true)
  assert.equal(isSameOrigin(req({ origin: 'https://shop.test', host: 'localhost:4000' }), 'https://shop.test'), true)
  assert.equal(isSameOrigin(req({ origin: 'https://SHOP.test', host: 'shop.test' }), ''), true)
})

test('isSameOrigin: another site, a different port or an opaque origin is refused', () => {
  assert.equal(isSameOrigin(req({ origin: 'https://evil.test', host: 'shop.test' }), 'https://shop.test'), false)
  assert.equal(isSameOrigin(req({ origin: 'http://127.0.0.1:9999', host: '127.0.0.1:4000' }), ''), false)
  assert.equal(isSameOrigin(req({ origin: 'null', host: 'shop.test' }), ''), false)
  assert.equal(isSameOrigin(req({ origin: 'https://shop.test.evil.test', host: 'shop.test' }), ''), false)
})

test('isSameOriginJson: also needs a JSON body', () => {
  const ok = { origin: 'https://shop.test', host: 'shop.test' }
  assert.equal(isSameOriginJson(req({ ...ok, 'content-type': 'application/json; charset=utf-8' }), ''), true)
  assert.equal(isSameOriginJson(req({ host: 'shop.test', 'content-type': 'application/json' }), ''), true)
  assert.equal(isSameOriginJson(req({ ...ok, 'content-type': 'text/plain' }), ''), false)
  assert.equal(isSameOriginJson(req({ ...ok, 'content-type': 'application/x-www-form-urlencoded' }), ''), false)
  assert.equal(isSameOriginJson(req({ ...ok }), ''), false)
  assert.equal(
    isSameOriginJson(req({ origin: 'https://evil.test', host: 'shop.test', 'content-type': 'application/json' }), ''),
    false,
  )
})

test('safeEqual compares secrets of any length, never matches an empty secret', () => {
  assert.equal(safeEqual('s3cret', 's3cret'), true)
  assert.equal(safeEqual('s3cret', 's3cret-longer'), false)
  assert.equal(safeEqual('', ''), false)
  assert.equal(safeEqual(undefined, 's3cret'), false)
  assert.equal(safeEqual('s3cret', undefined), false)
})

test('errorSummary keeps codes, drops messages that quote addresses', () => {
  const e = Object.assign(new Error('550 mailbox unavailable: jane@example.com'), {
    code: 'EENVELOPE',
    responseCode: 550,
    command: 'RCPT TO',
    response: '550 <jane@example.com> unknown',
  })
  const s = errorSummary(e)
  assert.deepEqual(s, { name: 'Error', code: 'EENVELOPE', responseCode: 550, command: 'RCPT TO' })
  assert.ok(!JSON.stringify(s).includes('@'))
  assert.deepEqual(errorSummary('boom'), { name: 'string' })
  assert.deepEqual(errorSummary(null), { name: 'null' })
})
