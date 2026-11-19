import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRenewer, isSessionToken, needsRenewal, withCookie } from './session.js'

const NOW = 1_800_000_000_000
const jwt = (payload) =>
  ['e30', Buffer.from(JSON.stringify(payload)).toString('base64url'), 'sig'].join('.')

test('isSessionToken: an unexpired JWT only', () => {
  assert.equal(isSessionToken(jwt({ exp: NOW / 1000 + 3600 }), NOW), true)
  assert.equal(isSessionToken(jwt({ exp: NOW / 1000 - 1 }), NOW), false)
  assert.equal(isSessionToken(jwt({ sub: 'x' }), NOW), false)
  assert.equal(isSessionToken('not-a-token', NOW), false)
  assert.equal(isSessionToken('a.b', NOW), false)
  assert.equal(isSessionToken(undefined, NOW), false)
  assert.equal(isSessionToken(`${jwt({ exp: NOW / 1000 + 3600 })}${'x'.repeat(9000)}`, NOW), false)
})

test('needsRenewal: missing, expired or about to expire', () => {
  assert.equal(needsRenewal(undefined, NOW), true)
  assert.equal(needsRenewal(jwt({ exp: NOW / 1000 - 10 }), NOW), true)
  assert.equal(needsRenewal(jwt({ exp: NOW / 1000 + 10 }), NOW), true)
  assert.equal(needsRenewal(jwt({ exp: NOW / 1000 + 3600 }), NOW), false)
  // Not a JWT: nothing to renew from its expiry (upstream decides).
  assert.equal(needsRenewal('opaque', NOW), false)
})

test('createRenewer: one exchange per refresh token, shared and briefly remembered', async () => {
  let calls = 0
  let t = NOW
  const renew = createRenewer(
    async (rt) => {
      calls++
      return rt === 'good' ? { accessToken: 'new-access', refreshToken: 'new-refresh' } : null
    },
    { reuseMs: 30_000, now: () => t },
  )
  const [a, b] = await Promise.all([renew('good'), renew('good')])
  assert.deepEqual(a, { accessToken: 'new-access', refreshToken: 'new-refresh' })
  assert.equal(a, b)
  assert.equal(calls, 1)
  // A late request still carrying the old cookie gets the same answer.
  t += 10_000
  assert.equal(await renew('good'), a)
  assert.equal(calls, 1)
  // After the reuse window it exchanges again.
  t += 30_000
  await renew('good')
  assert.equal(calls, 2)
  // A rejected token resolves null and is not retried inside the window.
  assert.equal(await renew('dead'), null)
  assert.equal(await renew('dead'), null)
  assert.equal(calls, 3)
})

test('createRenewer never rejects and ignores empty input', async () => {
  const renew = createRenewer(async () => {
    throw new Error('network')
  })
  assert.equal(await renew('x'), null)
  assert.equal(await renew(''), null)
  assert.equal(await renew(undefined), null)
})

test('createRenewer keeps at most maxEntries answers', async () => {
  let calls = 0
  const renew = createRenewer(async () => (calls++, null), { maxEntries: 2 })
  await renew('a')
  await renew('b')
  await renew('c')
  await renew('a')
  assert.equal(calls, 4)
})

test('withCookie replaces the named cookie and keeps the others', () => {
  assert.equal(withCookie('a=1; access_token=old; b=2', 'access_token', 'new'), 'a=1; b=2; access_token=new')
  assert.equal(withCookie('', 'access_token', 'new'), 'access_token=new')
  assert.equal(withCookie(undefined, 'x', 'a b'), 'x=a%20b')
  assert.equal(withCookie('access_token_extra=1', 'access_token', 'n'), 'access_token_extra=1; access_token=n')
})
