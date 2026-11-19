import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRateLimiter, clientIp, FORM_RATE_LIMITS } from './rateLimit.js'

const WINDOW = 10 * 60 * 1000

function clock(start = 1_000_000) {
  const c = { t: start, now: () => c.t }
  return c
}

test('form limits match the spec', () => {
  assert.deepEqual(FORM_RATE_LIMITS.contact, { limit: 5, windowMs: WINDOW })
  assert.deepEqual(FORM_RATE_LIMITS['price-request'], { limit: 10, windowMs: WINDOW })
})

test('allows up to the limit, then refuses with a retry-after in seconds', () => {
  const c = clock()
  const rl = createRateLimiter({ now: c.now })
  for (let i = 0; i < 5; i++) assert.equal(rl.hit('contact:1.1.1.1', 5, WINDOW).ok, true)
  c.t += 60_000
  const r = rl.hit('contact:1.1.1.1', 5, WINDOW)
  assert.equal(r.ok, false)
  assert.equal(r.retryAfter, 540)
})

test('the window expiring resets the counter', () => {
  const c = clock()
  const rl = createRateLimiter({ now: c.now })
  for (let i = 0; i < 5; i++) rl.hit('contact:1.1.1.1', 5, WINDOW)
  assert.equal(rl.hit('contact:1.1.1.1', 5, WINDOW).ok, false)
  c.t += WINDOW
  assert.equal(rl.hit('contact:1.1.1.1', 5, WINDOW).ok, true)
})

test('separate IPs and routes keep separate counters', () => {
  const rl = createRateLimiter({ now: clock().now })
  for (let i = 0; i < 5; i++) rl.hit('contact:1.1.1.1', 5, WINDOW)
  assert.equal(rl.hit('contact:1.1.1.1', 5, WINDOW).ok, false)
  assert.equal(rl.hit('contact:2.2.2.2', 5, WINDOW).ok, true)
  assert.equal(rl.hit('price-request:1.1.1.1', 10, WINDOW).ok, true)
})

test('expired entries are evicted', () => {
  const c = clock()
  const rl = createRateLimiter({ now: c.now })
  rl.hit('contact:1.1.1.1', 5, WINDOW)
  rl.hit('contact:2.2.2.2', 5, WINDOW)
  assert.equal(rl.size(), 2)
  c.t += WINDOW + 1
  rl.hit('contact:3.3.3.3', 5, WINDOW)
  assert.equal(rl.size(), 1)
})

test('clientIp takes the hop our proxy added, never a client-sent one (#6)', () => {
  const req = (xff, extra = {}) => ({ headers: { 'x-forwarded-for': xff, ...extra }, socket: { remoteAddress: '127.0.0.1' } })
  // nginx appends the real address on the right; anything left of it is client-supplied.
  assert.equal(clientIp(req('6.6.6.6, 9.9.9.9'), 1), '9.9.9.9')
  assert.equal(clientIp(req('1.1.1.1, 2.2.2.2, 9.9.9.9'), 1), '9.9.9.9')
  // CDN + nginx: two trusted hops.
  assert.equal(clientIp(req('6.6.6.6, 9.9.9.9, 10.0.0.1'), 2), '9.9.9.9')
  assert.equal(clientIp(req('9.9.9.9'), 2), '9.9.9.9')
  // x-real-ip is never trusted.
  assert.equal(clientIp({ headers: { 'x-real-ip': '6.6.6.6' }, socket: { remoteAddress: '8.8.8.8' } }, 1), '8.8.8.8')
  // No proxy (0 hops): the socket, whatever x-forwarded-for says.
  assert.equal(clientIp(req('6.6.6.6'), 0), '127.0.0.1')
  assert.equal(clientIp({ headers: {}, socket: { remoteAddress: '8.8.8.8' } }, 1), '8.8.8.8')
  assert.equal(clientIp({}), 'unknown')
  // A nonsense setting falls back to one hop.
  assert.equal(clientIp(req('6.6.6.6, 9.9.9.9'), -3), '9.9.9.9')
})

test('clientIp reads TRUSTED_PROXY_HOPS at call time (default 1)', () => {
  const req = { headers: { 'x-forwarded-for': '6.6.6.6, 9.9.9.9, 10.0.0.1' }, socket: {} }
  const saved = process.env.TRUSTED_PROXY_HOPS
  try {
    delete process.env.TRUSTED_PROXY_HOPS
    assert.equal(clientIp(req), '10.0.0.1')
    process.env.TRUSTED_PROXY_HOPS = '2'
    assert.equal(clientIp(req), '9.9.9.9')
  } finally {
    if (saved === undefined) delete process.env.TRUSTED_PROXY_HOPS
    else process.env.TRUSTED_PROXY_HOPS = saved
  }
})
