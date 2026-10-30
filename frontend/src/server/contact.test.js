import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { createContactHandler } from './contact.js'
import { createRateLimiter } from './rateLimit.js'

let prev
beforeEach(() => {
  prev = process.env.CONTACT_TO_EMAIL
  process.env.CONTACT_TO_EMAIL = 'shop@example.com'
})
afterEach(() => {
  if (prev === undefined) delete process.env.CONTACT_TO_EMAIL
  else process.env.CONTACT_TO_EMAIL = prev
})

function call(body, deps = {}) {
  const sent = []
  const handler = createContactHandler({
    getMail: () => ({ send: async (m) => { sent.push(m) } }),
    limiter: createRateLimiter(),
    verifyCaptcha: async () => 'disabled',
    ...deps,
  })
  const out = { status: 200, json: null }
  const res = {
    status(s) { out.status = s; return this },
    set() { return this },
    json(j) { out.json = j; return this },
  }
  return handler({ body, headers: {}, socket: {} }, res).then(() => ({ ...out, sent }))
}

const valid = { name: 'Ann', email: 'ann@example.com', message: 'Hello there' }

test('valid submission sends one mail to the configured recipient', async () => {
  const r = await call(valid)
  assert.equal(r.status, 200)
  assert.deepEqual(r.json, { ok: true })
  assert.equal(r.sent.length, 1)
  assert.deepEqual(r.sent[0].to, ['shop@example.com'])
  assert.equal(r.sent[0].replyTo, 'ann@example.com')
  assert.match(r.sent[0].text, /Hello there/)
})

test('recipient never comes from the request', async () => {
  const r = await call({ ...valid, to: 'evil@example.com', recipient: 'evil@example.com' })
  assert.deepEqual(r.sent[0].to, ['shop@example.com'])
  assert.ok(!JSON.stringify(r.sent[0].to).includes('evil'))
})

test('invalid input answers 400 and sends nothing', async () => {
  for (const body of [
    null,
    'text',
    { ...valid, email: 'nope' },
    { ...valid, email: '' },
    { ...valid, name: '' },
    { ...valid, message: '   ' },
    { ...valid, message: 'x'.repeat(5001) },
  ]) {
    const r = await call(body)
    assert.equal(r.status, 400, JSON.stringify(body)?.slice(0, 60))
    assert.equal(r.sent.length, 0)
  }
})

test('unset recipient answers 503 and sends nothing', async () => {
  delete process.env.CONTACT_TO_EMAIL
  const r = await call(valid)
  assert.equal(r.status, 503)
  assert.equal(r.sent.length, 0)
})

test('a failing mail provider answers 502', async () => {
  const handler = createContactHandler({
    getMail: () => ({ send: async () => { throw new Error('smtp down') } }),
    limiter: createRateLimiter(),
    verifyCaptcha: async () => 'disabled',
  })
  const out = {}
  const res = { status(s) { out.status = s; return this }, json() { return this } }
  const origError = console.error
  console.error = () => {}
  try {
    await handler({ body: valid }, res)
  } finally {
    console.error = origError
  }
  assert.equal(out.status, 502)
})

test('newlines in the name do not reach the subject', async () => {
  const r = await call({ ...valid, name: 'Ann\r\nBcc: x@example.com' })
  assert.ok(!/[\r\n]/.test(r.sent[0].subject))
})

test('a filled honeypot answers like success and sends nothing', async () => {
  const origInfo = console.info
  console.info = () => {}
  try {
    const r = await call({ ...valid, website: 'http://spam.example' })
    assert.equal(r.status, 200)
    assert.deepEqual(r.json, { ok: true })
    assert.equal(r.sent.length, 0)
  } finally {
    console.info = origInfo
  }
})

test('the sixth request in the window answers 429, before validation', async () => {
  const limiter = createRateLimiter()
  for (let i = 0; i < 5; i++) await call({}, { limiter })
  const r = await call(valid, { limiter })
  assert.equal(r.status, 429)
  assert.deepEqual(r.json, { error: 'rate_limited' })
  assert.equal(r.sent.length, 0)
})

test('a failed captcha answers 400 and sends nothing', async () => {
  const r = await call(valid, { verifyCaptcha: async () => 'failed' })
  assert.equal(r.status, 400)
  assert.deepEqual(r.json, { error: 'captcha_failed' })
  assert.equal(r.sent.length, 0)
})

test('the captcha is checked with the contact action', async () => {
  let action
  await call({ ...valid, recaptchaToken: 'tok' }, { verifyCaptcha: async (a) => { action = a.action; return 'ok' } })
  assert.equal(action, 'contact')
})
