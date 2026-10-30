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

test('clientIp prefers the first x-forwarded-for entry, then the socket', () => {
  assert.equal(clientIp({ headers: { 'x-forwarded-for': '9.9.9.9, 10.0.0.1' }, socket: {} }), '9.9.9.9')
  assert.equal(clientIp({ headers: {}, socket: { remoteAddress: '8.8.8.8' } }), '8.8.8.8')
  assert.equal(clientIp({}), 'unknown')
})
