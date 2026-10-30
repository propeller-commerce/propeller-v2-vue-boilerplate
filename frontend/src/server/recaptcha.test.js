import { test } from 'node:test'
import assert from 'node:assert/strict'
import { recaptchaConfig, verifyRecaptcha } from './recaptcha.js'

const env = { RECAPTCHA_SECRET_KEY: 'secret', VITE_RECAPTCHA_SITE_KEY: 'site' }

function okFetch(data, calls = []) {
  return async (url, init) => {
    calls.push({ url, init })
    return { ok: true, status: 200, json: async () => data }
  }
}

const verify = (opts) =>
  verifyRecaptcha({ token: 'tok', action: 'contact', remoteIp: '1.2.3.4', env, ...opts })

test('enabled only when both keys are set; min score defaults to 0.5', () => {
  assert.equal(recaptchaConfig({}).enabled, false)
  assert.equal(recaptchaConfig({ RECAPTCHA_SECRET_KEY: 's' }).enabled, false)
  assert.equal(recaptchaConfig({ VITE_RECAPTCHA_SITE_KEY: 's' }).enabled, false)
  assert.equal(recaptchaConfig(env).enabled, true)
  assert.equal(recaptchaConfig(env).minScore, 0.5)
  assert.equal(recaptchaConfig({ ...env, RECAPTCHA_MIN_SCORE: '0.7' }).minScore, 0.7)
  assert.equal(recaptchaConfig({ ...env, RECAPTCHA_MIN_SCORE: 'x' }).minScore, 0.5)
})

test('disabled: ignores the token and never calls Google', async () => {
  let called = false
  const r = await verify({ env: {}, token: undefined, fetchImpl: async () => { called = true } })
  assert.equal(r, 'disabled')
  assert.equal(called, false)
})

test('a good token posts form-encoded secret, response and remoteip', async () => {
  const calls = []
  const r = await verify({ fetchImpl: okFetch({ success: true, score: 0.9, action: 'contact' }, calls) })
  assert.equal(r, 'ok')
  assert.equal(calls[0].url, 'https://www.google.com/recaptcha/api/siteverify')
  assert.equal(calls[0].init.method, 'POST')
  const params = new URLSearchParams(String(calls[0].init.body))
  assert.equal(params.get('secret'), 'secret')
  assert.equal(params.get('response'), 'tok')
  assert.equal(params.get('remoteip'), '1.2.3.4')
  assert.ok(calls[0].init.signal)
})

test('missing token fails without calling Google', async () => {
  let called = false
  const r = await verify({ token: '', fetchImpl: async () => { called = true } })
  assert.equal(r, 'failed')
  assert.equal(await verify({ token: 42, fetchImpl: async () => { called = true } }), 'failed')
  assert.equal(called, false)
})

test('success false, low score or wrong action fail', async () => {
  assert.equal(await verify({ fetchImpl: okFetch({ success: false }) }), 'failed')
  assert.equal(await verify({ fetchImpl: okFetch({ success: true, score: 0.3, action: 'contact' }) }), 'failed')
  assert.equal(await verify({ fetchImpl: okFetch({ success: true, action: 'contact' }) }), 'failed')
  assert.equal(await verify({ fetchImpl: okFetch({ success: true, score: 0.9, action: 'price_request' }) }), 'failed')
  assert.equal(
    await verify({ action: 'price_request', fetchImpl: okFetch({ success: true, score: 0.9, action: 'price_request' }) }),
    'ok',
  )
})

test('score equal to the minimum passes', async () => {
  assert.equal(await verify({ fetchImpl: okFetch({ success: true, score: 0.5, action: 'contact' }) }), 'ok')
})

test('network error, non-2xx or bad JSON is unavailable', async () => {
  assert.equal(await verify({ fetchImpl: async () => { throw new Error('ECONNREFUSED') } }), 'unavailable')
  assert.equal(await verify({ fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) }) }), 'unavailable')
  assert.equal(
    await verify({ fetchImpl: async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('x') } }) }),
    'unavailable',
  )
})

test('a hanging request is aborted after the timeout', async () => {
  const hang = (_url, init) =>
    new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)))
  assert.equal(await verify({ fetchImpl: hang, timeoutMs: 20 }), 'unavailable')
})
