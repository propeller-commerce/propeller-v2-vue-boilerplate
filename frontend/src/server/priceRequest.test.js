import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createPriceRequestHandler } from './priceRequest.js'
import { createRateLimiter } from './rateLimit.js'

let prev
beforeEach(() => {
  prev = process.env.PRICE_REQUEST_TO_EMAIL
  process.env.PRICE_REQUEST_TO_EMAIL = 'shop@example.com'
})
afterEach(() => {
  if (prev === undefined) delete process.env.PRICE_REQUEST_TO_EMAIL
  else process.env.PRICE_REQUEST_TO_EMAIL = prev
})

function call(body, deps = {}) {
  const sent = []
  const handler = createPriceRequestHandler({
    getMail: () => ({ send: async (m) => { sent.push(m) } }),
    limiter: createRateLimiter(),
    verifyCaptcha: async () => 'disabled',
    ...deps,
  })
  const out = { status: 200, json: null, headers: {} }
  const res = {
    status(s) { out.status = s; return this },
    set(k, v) { out.headers[k] = v; return this },
    json(j) { out.json = j; return this },
  }
  return handler({ body, headers: {}, socket: {} }, res).then(() => ({ ...out, sent }))
}

const valid = { items: [{ code: 'A1', name: 'Widget', quantity: 2 }], email: 'ann@example.com' }

test('valid request mails the shop and the shopper', async () => {
  const r = await call(valid)
  assert.equal(r.status, 200)
  assert.deepEqual(r.json, { ok: true })
  assert.equal(r.sent.length, 2)
})

test('a filled honeypot answers like success and sends nothing', async () => {
  const origInfo = console.info
  console.info = () => {}
  try {
    const r = await call({ ...valid, website: 'x' })
    assert.equal(r.status, 200)
    assert.deepEqual(r.json, { ok: true })
    assert.equal(r.sent.length, 0)
  } finally {
    console.info = origInfo
  }
})

test('the eleventh request in the window answers 429 with Retry-After', async () => {
  const limiter = createRateLimiter()
  for (let i = 0; i < 10; i++) await call({}, { limiter })
  const r = await call(valid, { limiter })
  assert.equal(r.status, 429)
  assert.deepEqual(r.json, { error: 'rate_limited' })
  assert.equal(r.headers['Retry-After'], '600')
  assert.equal(r.sent.length, 0)
})

test('captcha is checked with the price_request action; unavailable answers 503', async () => {
  let action
  const r = await call(valid, { verifyCaptcha: async (a) => { action = a.action; return 'unavailable' } })
  assert.equal(action, 'price_request')
  assert.equal(r.status, 503)
  assert.deepEqual(r.json, { error: 'captcha_unavailable' })
  assert.equal(r.sent.length, 0)
})
