import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  companyCreateVariables,
  createdCompanyId,
  documentHash,
  REGISTRATION_DOCUMENT_HASHES,
  registrationLimited,
  registrationStep,
  signRegistration,
  verifyRegistration,
} from './registrationRouting.js'
import { parseDocument } from './graphqlGuards.js'
import { singleField, verifyLastOrder } from './orderEditorRouting.js'
import { createRateLimiter } from './rateLimit.js'

process.env.COOKIE_SIGNING_SECRET = 'registration-routing-test'

const OPS = new URL('../../node_modules/@propeller-commerce/propeller-sdk-v2/dist/esm/generated/operations/', import.meta.url)
const sdkDocument = async (name) => (await import(new URL(`${name}.js`, OPS).href)).document
const COMPANY_CREATE = await sdkDocument('companyCreate')
const ADDRESS_CREATE = await sdkDocument('companyAddressCreate')

const step = (query, variables = {}, ctx = {}) => {
  const doc = parseDocument(query)
  return registrationStep(doc, singleField(doc), variables, { isAnonymous: true, registration: null, ...ctx })
}

test('the allowlisted hashes match the installed SDK documents (update them after an SDK upgrade)', () => {
  assert.equal(documentHash(parseDocument(COMPANY_CREATE)), REGISTRATION_DOCUMENT_HASHES.companyCreate)
  assert.equal(documentHash(parseDocument(ADDRESS_CREATE)), REGISTRATION_DOCUMENT_HASHES.companyAddressCreate)
  // Whitespace does not matter, content does.
  assert.equal(documentHash(parseDocument(`  ${COMPANY_CREATE.replace(/\n/g, '\n\n')}`)), REGISTRATION_DOCUMENT_HASHES.companyCreate)
  assert.notEqual(documentHash(parseDocument(COMPANY_CREATE.replace('companyId\n', 'companyId\n  debtorId\n'))), REGISTRATION_DOCUMENT_HASHES.companyCreate)
})

test('companyCreate is elevated only for an anonymous caller sending the SDK document', () => {
  assert.deepEqual(step(COMPANY_CREATE), { kind: 'company' })
  assert.equal(step(COMPANY_CREATE, {}, { isAnonymous: false }), null)
  // Any other selection, even of the same field, is not elevated.
  assert.equal(step('mutation m($input: CreateCompanyInput!) { companyCreate(input: $input) { companyId contacts { items { email } } } }'), null)
})

test('companyAddressCreate is elevated only for the company this browser just created, once per type', () => {
  const registration = { companyId: 77, used: '' }
  const vars = (companyId, type) => ({ input: { companyId, type, street: 'x' } })
  assert.deepEqual(step(ADDRESS_CREATE, vars(77, 'invoice'), { registration }), { kind: 'address', companyId: 77, flag: 'i' })
  assert.deepEqual(step(ADDRESS_CREATE, vars(77, 'delivery'), { registration }), { kind: 'address', companyId: 77, flag: 'd' })
  // The register response's session makes the caller non-anonymous; that is fine for addresses.
  assert.ok(step(ADDRESS_CREATE, vars(77, 'invoice'), { registration, isAnonymous: false }))
  assert.equal(step(ADDRESS_CREATE, vars(78, 'invoice'), { registration }), null)
  assert.equal(step(ADDRESS_CREATE, vars('77', 'invoice'), { registration }), null)
  assert.equal(step(ADDRESS_CREATE, vars(77, 'home'), { registration }), null)
  assert.equal(step(ADDRESS_CREATE, vars(77, 'invoice')), null)
  assert.equal(step(ADDRESS_CREATE, vars(77, 'invoice'), { registration: { companyId: 77, used: 'i' } }), null)
  assert.ok(step(ADDRESS_CREATE, vars(77, 'delivery'), { registration: { companyId: 77, used: 'i' } }))
})

test('other documents never elevate', () => {
  assert.equal(step('mutation { contactDelete(id: 1) }'), null)
  assert.equal(step('mutation { companyCreate(input: { name: "x" }) { companyId } }'), null)
})

test('an elevated companyCreate keeps only the registration fields', () => {
  const vars = { input: { name: 'A', email: 'a@x.test', taxNumber: 'NL1', cocNumber: '1', phone: '0', debtorId: 'D1', parentId: 5 }, contactSearchArguments: { page: 1 } }
  assert.deepEqual(companyCreateVariables(vars), {
    input: { name: 'A', email: 'a@x.test', taxNumber: 'NL1', cocNumber: '1', phone: '0' },
    contactSearchArguments: { page: 1 },
  })
  assert.deepEqual(companyCreateVariables(null), { input: {} })
})

test('companyCreate is limited per IP and in total', () => {
  const perIp = createRateLimiter()
  const total = createRateLimiter()
  for (let i = 0; i < 5; i++) assert.equal(registrationLimited('1.1.1.1', { perIp, total }), 0)
  assert.ok(registrationLimited('1.1.1.1', { perIp, total }) > 0)
  for (let i = 0; i < 25; i++) assert.equal(registrationLimited(`2.2.2.${i}`, { perIp, total }), 0)
  assert.ok(registrationLimited('3.3.3.3', { perIp, total }) > 0, 'total cap')
})

test('createdCompanyId reads the new id from a companyCreate response only', () => {
  assert.equal(createdCompanyId({ data: { companyCreate: { companyId: 77 } } }), 77)
  assert.equal(createdCompanyId({ data: { companyCreate: { companyId: '77' } } }), null)
  assert.equal(createdCompanyId({ data: { companyCreate: null } }), null)
  assert.equal(createdCompanyId(undefined), null)
})

test('the registration cookie round-trips, rejects tampering and is not a last-order cookie', () => {
  assert.deepEqual(verifyRegistration(signRegistration(77)), { companyId: 77, used: '' })
  assert.deepEqual(verifyRegistration(signRegistration(77, 'i')), { companyId: 77, used: 'i' })
  const [, exp, sig] = signRegistration(77).split('.')
  assert.equal(verifyRegistration(`${Buffer.from('78').toString('base64url')}.${exp}.${sig}`), null)
  assert.equal(verifyRegistration(undefined), null)
  assert.equal(verifyLastOrder(signRegistration(77)), null)
})
