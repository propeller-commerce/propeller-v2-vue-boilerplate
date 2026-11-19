import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createViewerLookup, toViewer } from './viewer.js'

const contact = {
  __typename: 'Contact',
  contactId: 73,
  company: { companyId: 37 },
  companies: { items: [{ companyId: 36 }, { companyId: 37 }] },
  purchaseAuthorizationConfigs: {
    items: [
      { purchaseRole: 'AUTHORIZATION_MANAGER', company: { companyId: 37 } },
      { purchaseRole: 'PURCHASER', company: { companyId: 36 } },
    ],
  },
}

test('toViewer keeps signed-in contacts and customers, nothing else', () => {
  assert.deepEqual(toViewer(contact), {
    type: 'Contact',
    userId: 73,
    contactId: 73,
    companyId: 37,
    companyIds: [37, 36],
    managerOf: [37],
  })
  assert.deepEqual(toViewer({ __typename: 'Customer', customerId: 5 }), { type: 'Customer', userId: 5, customerId: 5 })
  assert.equal(toViewer({ __typename: 'User' }), null)
  assert.equal(toViewer({ __typename: 'Contact' }), null)
  assert.equal(toViewer(null), null)
})

test('no token is anonymous and costs no lookup', async () => {
  let calls = 0
  const lookup = createViewerLookup(async () => (calls++, contact))
  assert.equal(await lookup(undefined), null)
  assert.equal(await lookup(''), null)
  // A blank token (`access_token=%09`) is no token either (#4).
  assert.equal(await lookup('\t'), null)
  assert.equal(await lookup('  \n'), null)
  assert.equal(calls, 0)
})

test('the answer is cached per token until the ttl passes', async () => {
  let t = 0
  let calls = 0
  const lookup = createViewerLookup(async () => (calls++, contact), { ttlMs: 1000, now: () => t })
  assert.equal((await lookup('tok')).contactId, 73)
  await lookup('tok')
  assert.equal(calls, 1)
  await lookup('other')
  assert.equal(calls, 2)
  t = 1001
  await lookup('tok')
  assert.equal(calls, 3)
})

test('the cache never outlives the token exp claim', async () => {
  let t = 0
  let calls = 0
  const exp = Buffer.from(JSON.stringify({ exp: 10 })).toString('base64url')
  const token = `h.${exp}.s`
  const lookup = createViewerLookup(async () => (calls++, contact), { ttlMs: 60_000, now: () => t })
  await lookup(token)
  t = 9_000
  await lookup(token)
  assert.equal(calls, 1)
  t = 10_000
  await lookup(token)
  assert.equal(calls, 2)
})

test('a failed lookup is anonymous and not cached (fail closed)', async () => {
  let fail = true
  let calls = 0
  const lookup = createViewerLookup(async () => {
    calls++
    if (fail) throw new Error('upstream down')
    return contact
  })
  assert.equal(await lookup('tok'), null)
  fail = false
  assert.equal((await lookup('tok')).type, 'Contact')
  assert.equal(calls, 2)
})

test('an anonymous viewer (expired token) is cached as null', async () => {
  let calls = 0
  const lookup = createViewerLookup(async () => (calls++, { __typename: 'User' }))
  assert.equal(await lookup('tok'), null)
  assert.equal(await lookup('tok'), null)
  assert.equal(calls, 1)
})

test('parallel requests for one token share a single lookup', async () => {
  let calls = 0
  let release = () => {}
  const lookup = createViewerLookup(() => {
    calls++
    return new Promise((resolve) => {
      release = () => resolve(contact)
    })
  })
  const pending = Array.from({ length: 8 }, () => lookup('tok'))
  release()
  const results = await Promise.all(pending)
  assert.equal(calls, 1)
  assert.ok(results.every((v) => v?.contactId === 73))
})

test('the cache stays bounded', async () => {
  const lookup = createViewerLookup(async () => contact, { maxEntries: 2 })
  await lookup('a')
  await lookup('b')
  await lookup('c')
  assert.equal(lookup.size(), 2)
})
