import { test } from 'node:test'
import assert from 'node:assert/strict'
import { guardForm } from './formGuard.js'
import { createRateLimiter } from './rateLimit.js'

function mockRes() {
  const out = { status: 200, json: null, headers: {} }
  const res = {
    status(s) { out.status = s; return this },
    set(k, v) { out.headers[k] = v; return this },
    json(j) { out.json = j; return this },
  }
  return { res, out }
}

const req = (body, ip = '1.1.1.1') => ({ body, headers: { 'x-forwarded-for': ip }, socket: {} })

async function run(body, opts = {}) {
  const { res, out } = mockRes()
  const proceed = await guardForm(req(body, opts.ip), res, {
    route: 'contact',
    action: 'contact',
    limiter: opts.limiter ?? createRateLimiter(),
    verifyCaptcha: opts.verifyCaptcha ?? (async () => 'ok'),
  })
  return { proceed, out }
}

test('over the limit answers 429 rate_limited with Retry-After, even for invalid bodies', async () => {
  const limiter = createRateLimiter()
  for (let i = 0; i < 5; i++) assert.equal((await run(null, { limiter })).proceed, true)
  const r = await run(null, { limiter })
  assert.equal(r.proceed, false)
  assert.equal(r.out.status, 429)
  assert.deepEqual(r.out.json, { error: 'rate_limited' })
  assert.equal(r.out.headers['Retry-After'], '600')
})

test('a filled honeypot looks like success and stops before the captcha', async () => {
  let captchaCalled = false
  const origInfo = console.info
  const logged = []
  console.info = (...a) => logged.push(a)
  try {
    const r = await run({ website: 'http://spam.example' }, {
      verifyCaptcha: async () => { captchaCalled = true; return 'ok' },
    })
    assert.equal(r.proceed, false)
    assert.equal(r.out.status, 200)
    assert.deepEqual(r.out.json, { ok: true })
    assert.equal(captchaCalled, false)
    assert.equal(logged.length, 1)
  } finally {
    console.info = origInfo
  }
})

test('an empty honeypot proceeds', async () => {
  assert.equal((await run({ website: '' })).proceed, true)
})

test('captcha failure answers 400, unavailable answers 503, disabled proceeds', async () => {
  const failed = await run({}, { verifyCaptcha: async () => 'failed' })
  assert.equal(failed.proceed, false)
  assert.equal(failed.out.status, 400)
  assert.deepEqual(failed.out.json, { error: 'captcha_failed' })
  const down = await run({}, { verifyCaptcha: async () => 'unavailable' })
  assert.equal(down.out.status, 503)
  assert.deepEqual(down.out.json, { error: 'captcha_unavailable' })
  assert.equal((await run({}, { verifyCaptcha: async () => 'disabled' })).proceed, true)
})

test('the captcha gets the token, the action and the client ip', async () => {
  let seen
  await run({ recaptchaToken: 'tok' }, { ip: '7.7.7.7', verifyCaptcha: async (a) => { seen = a; return 'ok' } })
  assert.deepEqual(seen, { token: 'tok', action: 'contact', remoteIp: '7.7.7.7' })
})
