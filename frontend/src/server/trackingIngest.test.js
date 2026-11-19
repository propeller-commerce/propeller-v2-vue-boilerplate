import { test } from 'node:test'
import assert from 'node:assert/strict'
import { identityFor } from './trackingIngest.js'

const contact = { type: 'Contact', contactId: 73, companyId: 37, companyIds: [37, 36], managerOf: [] }

test('identity comes from the verified viewer, never from the body (#16)', () => {
  assert.deepEqual(identityFor(null, 37), { userMode: 'anonymous', contactId: null, customerId: null, companyId: null })
  assert.deepEqual(identityFor({ type: 'Customer', customerId: 5 }, 37), {
    userMode: 'b2c',
    contactId: null,
    customerId: 5,
    companyId: null,
  })
  assert.deepEqual(identityFor(contact, undefined), { userMode: 'b2b', contactId: 73, customerId: null, companyId: 37 })
})

test('a contact may report a company it belongs to, no other', () => {
  assert.equal(identityFor(contact, 36).companyId, 36)
  assert.equal(identityFor(contact, '36').companyId, 36)
  assert.equal(identityFor(contact, 999).companyId, 37)
  assert.equal(identityFor(contact, 'x').companyId, 37)
})
