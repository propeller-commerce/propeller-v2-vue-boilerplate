import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  awaitsPayment,
  chargeFor,
  handleMspNotification,
  ownedOrder,
  paymentRedirectUrl,
  paymentSiteUrl,
  signedOrderId,
  toCentsHalfUp,
  UNSIGNED_PER_IP,
  UNSIGNED_PER_ORDER,
} from './payments.js'
import { createRateLimiter } from './rateLimit.js'

test('toCentsHalfUp rounds the decimal value half-up', () => {
  assert.equal(toCentsHalfUp(161.172), 16117)
  assert.equal(toCentsHalfUp(13.3947), 1339)
  assert.equal(toCentsHalfUp(1.005), 101)
  assert.equal(toCentsHalfUp(0.125), 13)
  assert.equal(toCentsHalfUp('9.90'), 990)
  assert.equal(toCentsHalfUp(0), 0)
  for (const bad of [-1, NaN, Infinity, 'x', null, undefined, {}]) assert.equal(toCentsHalfUp(bad), null)
})

const order = { id: 7, status: 'UNFINISHED', currency: 'EUR', total: { net: 161.172 } }

test('the charge is the order total incl. VAT from upstream, in its currency', () => {
  assert.deepEqual(chargeFor(order), { amount: 161.17, currency: 'EUR' })
  assert.deepEqual(chargeFor({ ...order, currency: 'GBP' }), { amount: 161.17, currency: 'GBP' })
  assert.deepEqual(chargeFor({ ...order, currency: '' }, 'USD'), { amount: 161.17, currency: 'USD' })
})

test('only an unpaid PSP order with a positive total can be paid', () => {
  assert.ok(chargeFor(null).error)
  for (const status of ['NEW', 'REQUEST', 'QUOTATION', 'PAID', undefined]) assert.ok(chargeFor({ ...order, status }).error, status)
  assert.ok(chargeFor({ ...order, total: { net: 0 } }).error)
  assert.ok(chargeFor({ ...order, total: {} }).error)
})

test('the return URL is always this site’s thank-you page for the order', () => {
  const site = 'https://shop.test/'
  assert.equal(paymentRedirectUrl(site, 'https://shop.test/checkout/thank-you/7?psp=mollie', 7, 'mollie'), 'https://shop.test/checkout/thank-you/7?psp=mollie')
  assert.equal(paymentRedirectUrl(site, 'https://shop.test/en/checkout/thank-you/7?psp=x', 7, 'multisafepay'), 'https://shop.test/en/checkout/thank-you/7?psp=multisafepay')
  for (const asked of ['https://evil.test/checkout/thank-you/7', '//evil.test/x', '/checkout/thank-you/8', '/en/../admin', undefined, 42]) {
    const url = paymentRedirectUrl(site, asked, 7, 'mollie')
    assert.ok(url.startsWith('https://shop.test/'), url)
    assert.ok(/^(https:\/\/shop\.test)(\/en)?\/checkout\/thank-you\/7\?psp=mollie$/.test(url), url)
  }
})

// ── PSP notifications (final review #1): replays of unsigned or misbound notifications ──

function fakeMsp(statusByOrder) {
  const calls = { handleWebhook: [], fetchOrder: [] }
  const deps = {
    limiter: createRateLimiter(),
    fetchOrder: async (orderId) => {
      calls.fetchOrder.push(orderId)
      return statusByOrder[orderId] ? { status: statusByOrder[orderId] } : null
    },
    provider: () => ({
      handleWebhook: async (id) => {
        calls.handleWebhook.push(id)
        return { ok: true }
      },
    }),
  }
  return { deps, calls }
}
const get = (id, ip = '203.0.113.7') => ({ method: 'GET', id, ip, signed: false, body: '' })
const post = (id, bodyOrderId, signed = true) => ({
  method: 'POST',
  id,
  ip: '203.0.113.7',
  signed,
  body: JSON.stringify({ order_id: bodyOrderId, transaction_id: 99887766, status: 'completed' }),
})

test('MSP GET for an order still awaiting payment is processed', async () => {
  const { deps, calls } = fakeMsp({ 4711: 'UNFINISHED' })
  assert.deepEqual(await handleMspNotification(get('4711'), deps), { status: 200, body: 'OK' })
  assert.deepEqual(calls.handleWebhook, ['4711'])
})

test('MSP GET for a paid, unknown or unparsable order is acknowledged and never processed', async () => {
  const { deps, calls } = fakeMsp({ 4711: 'NEW', 4712: 'REQUEST' })
  for (const id of ['4711', '4712', '999', 'abc', '']) {
    assert.deepEqual(await handleMspNotification(get(id), deps), { status: 200, body: 'OK' })
  }
  assert.deepEqual(calls.handleWebhook, [])
  assert.deepEqual(calls.fetchOrder, [4711, 4712, 999])
  const failing = fakeMsp({})
  failing.deps.fetchOrder = async () => {
    throw new Error('upstream down')
  }
  await handleMspNotification(get('4711'), failing.deps)
  assert.deepEqual(failing.calls.handleWebhook, [])
})

test('MSP POST: unsigned refused; signed processed only for the order its body names', async () => {
  const { deps, calls } = fakeMsp({ 4711: 'NEW', 4712: 'UNFINISHED' })
  assert.deepEqual(await handleMspNotification(post('4711', '4711', false), deps), { status: 403, body: 'Invalid signature' })
  // A captured notification for order 4711 replayed with another order id in the query string.
  assert.deepEqual(await handleMspNotification(post('4712', '4711'), deps), { status: 403, body: 'Order mismatch' })
  for (const body of ['', 'not json', '{}', '{"order_id":null}']) {
    assert.equal((await handleMspNotification({ ...post('4712', '4712'), body }, deps)).status, 403, body)
  }
  assert.deepEqual(calls.handleWebhook, [])
  // Signed and bound: processed whatever the order status (refunds, chargebacks).
  assert.equal((await handleMspNotification(post('4711', 4711), deps)).status, 200)
  assert.deepEqual(calls.handleWebhook, ['4711'])
  assert.equal(signedOrderId('{"order_id":" 4711 "}'), '4711')
})

test('MSP GETs are limited per client IP whatever ids they name, and per order', async () => {
  const { deps, calls } = fakeMsp({ 4711: 'UNFINISHED' })
  for (let i = 1; i <= UNSIGNED_PER_IP.limit; i++) {
    assert.equal((await handleMspNotification(get(String(i + 10000)), deps)).status, 200)
  }
  assert.deepEqual(await handleMspNotification(get('4711'), deps), { status: 429, body: 'Too many notifications' })
  assert.equal(calls.fetchOrder.length, UNSIGNED_PER_IP.limit, 'a limited request costs no order lookup')
  // Spread over many addresses, one order is still processed at most UNSIGNED_PER_ORDER times.
  for (let i = 0; i < UNSIGNED_PER_ORDER.limit + 3; i++) await handleMspNotification(get('4711', `198.51.100.${i}`), deps)
  assert.equal(calls.handleWebhook.length, UNSIGNED_PER_ORDER.limit)
  // Signed POSTs are never limited.
  assert.equal((await handleMspNotification(post('4711', '4711'), deps)).status, 200)
})

test('the PSP return site is VITE_SITE_URL; the Host header only in development', () => {
  assert.equal(paymentSiteUrl('https://shop.example', 'http://evil.example', true), 'https://shop.example')
  assert.equal(paymentSiteUrl('https://shop.example', 'http://localhost:4000', false), 'https://shop.example')
  assert.equal(paymentSiteUrl('', 'http://evil.example', true), null, 'production without VITE_SITE_URL')
  assert.equal(paymentSiteUrl(undefined, 'http://evil.example', true), null)
  assert.equal(paymentSiteUrl(undefined, 'http://localhost:4000', false), 'http://localhost:4000')
})

test("payment routes get an order only for its owner, read with the order-editor key", async () => {
  // What the order-editor key answers: 9 is contact 73's, 10 someone else's.
  const ORDERS = { 9: { id: 9, userId: 73, status: 'UNFINISHED' }, 10: { id: 10, userId: 99, status: 'UNFINISHED' } }
  const contact = { type: 'Contact', userId: 73 }
  const run = async (orderId, { lastOrderId = null, viewer = null, fetchOrder } = {}) => {
    const looked = []
    const viewerAsked = []
    const order = await ownedOrder(orderId, {
      lastOrderId,
      getViewer: async () => (viewerAsked.push(1), viewer),
      fetchOrder: async (id) => (looked.push(id), fetchOrder ? fetchOrder(id) : (ORDERS[id] ?? null)),
    })
    return { id: order?.id ?? null, looked, viewerAsked: viewerAsked.length }
  }
  assert.deepEqual(await run(9, { viewer: contact }), { id: 9, looked: [9], viewerAsked: 1 }, 'own order')
  assert.deepEqual(await run(10, { viewer: contact }), { id: null, looked: [10], viewerAsked: 1 }, "another user's order")
  assert.deepEqual(await run(10, { lastOrderId: 10 }), { id: 10, looked: [10], viewerAsked: 0 }, 'the order this browser placed')
  assert.deepEqual(await run(10), { id: null, looked: [], viewerAsked: 1 }, 'no viewer: no lookup')
  assert.deepEqual(await run(10, { lastOrderId: 9 }), { id: null, looked: [], viewerAsked: 1 })
  assert.equal((await run(9, { viewer: contact, fetchOrder: async () => null })).id, null, 'failed lookup')
  assert.equal((await run(9, { viewer: { type: 'Customer', userId: 99 } })).id, null)
  assert.deepEqual(await run('9x', { viewer: contact }), { id: null, looked: [], viewerAsked: 0 })
})

test('awaitsPayment: only an UNFINISHED order; a bad id costs no lookup', async () => {
  assert.equal(await awaitsPayment('4711', async () => ({ status: 'UNFINISHED' })), true)
  assert.equal(await awaitsPayment(4711, async () => ({ status: 'NEW' })), false)
  let looked = false
  assert.equal(await awaitsPayment('47 11', async () => ((looked = true), { status: 'UNFINISHED' })), false)
  assert.equal(looked, false)
})
