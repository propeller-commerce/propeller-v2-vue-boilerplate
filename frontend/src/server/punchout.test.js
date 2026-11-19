import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.COOKIE_SIGNING_SECRET = 'punchout-test-secret'
const {
  punchoutAfterLogin,
  signCxmlSetup,
  signPendingSession,
  signPunchoutSession,
  validReturnUrl,
  verifyCxmlSetup,
  verifyPunchoutSession,
} = await import('./punchout.js')

const session = { mode: 'oci', returnUrl: 'https://erp.buyer.test/hook?sid=1', session: { CALLER: 'X' } }

test('return URLs: https only, and only allowed hosts when PUNCHOUT_HOOK_HOSTS is set', () => {
  assert.equal(validReturnUrl('https://erp.buyer.test/hook?sid=1', ''), 'https://erp.buyer.test/hook?sid=1')
  for (const bad of ['http://erp.buyer.test/hook', 'javascript:alert(1)', '//erp.buyer.test', '/hook', '', undefined, 'https://u:p@erp.buyer.test/']) {
    assert.equal(validReturnUrl(bad, ''), null, String(bad))
  }
  assert.equal(validReturnUrl('https://erp.buyer.test/x', 'erp.buyer.test, other.test'), 'https://erp.buyer.test/x')
  assert.equal(validReturnUrl('https://ERP.buyer.test/x', 'erp.buyer.test'), 'https://erp.buyer.test/x')
  assert.equal(validReturnUrl('https://attacker.test/x', 'erp.buyer.test'), null)
  assert.equal(validReturnUrl('https://erp.buyer.test.attacker.test/x', 'erp.buyer.test'), null)
})

test('only a successful exchange of the same token promotes the pending session', () => {
  const pendingCookie = signPendingSession('tok-1', session)
  assert.deepEqual(punchoutAfterLogin({ field: 'magicTokenLogin', succeeded: true, token: 'tok-1', pendingCookie }), { promote: session })
  // Another token (the attacker's own, or a normal magic link) ends any punchout instead.
  assert.deepEqual(punchoutAfterLogin({ field: 'magicTokenLogin', succeeded: true, token: 'tok-2', pendingCookie }), { clear: true })
  // A failed exchange clears.
  assert.deepEqual(punchoutAfterLogin({ field: 'magicTokenLogin', succeeded: false, token: 'tok-1', pendingCookie }), { clear: true })
  // No pending cookie, or a forged one.
  assert.deepEqual(punchoutAfterLogin({ field: 'magicTokenLogin', succeeded: true, token: 'tok-1', pendingCookie: undefined }), { clear: true })
  const forged = Buffer.from(JSON.stringify({ h: 'x', s: session })).toString('base64url') + '.9999999999.' + '0'.repeat(64)
  assert.deepEqual(punchoutAfterLogin({ field: 'magicTokenLogin', succeeded: true, token: 'tok-1', pendingCookie: forged }), { clear: true })
})

test('a password login ends the punchout session; other operations leave it alone', () => {
  assert.deepEqual(punchoutAfterLogin({ field: 'login', succeeded: true }), { clear: true })
  assert.equal(punchoutAfterLogin({ field: 'login', succeeded: false }), null)
  assert.equal(punchoutAfterLogin({ field: 'cartAddItem', succeeded: true }), null)
})

test('the active session cookie is signed and re-checks its return URL', () => {
  assert.deepEqual(verifyPunchoutSession(signPunchoutSession(session)), session)
  assert.equal(verifyPunchoutSession(JSON.stringify(session)), null)
  assert.equal(verifyPunchoutSession(signPendingSession('tok-1', session)), null)
  assert.equal(verifyPunchoutSession(signPunchoutSession({ ...session, returnUrl: 'http://erp.buyer.test/' })), null)
})

test('the cXML setup travels signed and bound to its token', () => {
  const setup = { returnUrl: 'https://ariba.test/post', buyerCookie: 'bc', from: 'a', to: 'b', deploymentMode: 'test' }
  const value = signCxmlSetup('tok-9', setup)
  assert.deepEqual(verifyCxmlSetup(value, 'tok-9'), setup)
  assert.equal(verifyCxmlSetup(value, 'tok-other'), null)
  assert.equal(verifyCxmlSetup('garbage', 'tok-9'), null)
})
