import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  checkoutFlag,
  createdOrderId,
  createSpentLog,
  isOwnQuotation,
  isSdkDocument,
  mayReadOrder,
  mustRefuseElevation,
  ORDER_LIST_STATUSES,
  SDK_DOCUMENT_HASHES,
  orderEditorReason,
  quoteAcceptOrderId,
  signLastOrder,
  singleField,
  upstreamAuth,
  verifyLastOrder,
} from './orderEditorRouting.js'
import { parseDocument } from './graphqlGuards.js'
import { createViewerLookup } from './viewer.js'
import { documentHash } from './registrationRouting.js'

process.env.COOKIE_SIGNING_SECRET = 'order-editor-routing-test'

const single = (query) => singleField(parseDocument(query))
const reason = (query, variables = {}, ctx = {}) => orderEditorReason(single(query), variables, ctx)

const SET_STATUS = `mutation orderSetStatus($input: OrderSetStatusInput!) {
  orderSetStatus(input: $input) {
    id
  }
}`
const ORDER = `fragment OrderFields on Order { id status }
query order($orderId: Int, $orderUUID: String, $language: String) {
  order(orderId: $orderId, orderUUID: $orderUUID) {
    ...OrderFields
  }
}`
const CONTACT_REGISTER = `mutation contactRegister($contactRegisterInput: RegisterContactInput!) {
  contactRegister(input: $contactRegisterInput) {
    ...RegisterContactResponseFields
  }
}
fragment RegisterContactResponseFields on RegisterContactResponse { session { accessToken } }`

const last = (used = '') => ({ lastOrder: { orderId: 9, used } })
const own = { input: { orderId: 9, status: 'NEW', payStatus: 'OPEN' } }

test('checkout mutations elevate only for the signed last order, guest or logged in', () => {
  assert.equal(reason(SET_STATUS, own, last()), 'checkout')
  assert.equal(reason(SET_STATUS, own, { ...last(), isAnonymous: false }), 'checkout')
  for (const field of ['triggerQuoteSendRequest', 'triggerOrderSendConfirm']) {
    assert.equal(reason(`mutation m($input: X!) { ${field}(input: $input) }`, { input: { orderId: 9 } }, last()), 'checkout', field)
  }
  assert.equal(reason('mutation { orderSetStatus(input: { orderId: 9, status: "NEW" }) { id } }', {}, last()), 'checkout')
})

test('checkout mutations on another order, or without a last order, do not elevate', () => {
  assert.equal(reason(SET_STATUS, own), null)
  assert.equal(reason(SET_STATUS, { input: { ...own.input, orderId: 8 } }, last()), null)
  assert.equal(reason(SET_STATUS, { input: { ...own.input, orderId: '9x' } }, last()), null)
  assert.equal(reason(SET_STATUS, { input: { status: 'NEW' } }, last()), null)
  assert.equal(reason('mutation { orderSetStatus(input: { orderId: 8, status: "NEW" }) { id } }', {}, last()), null)
  assert.equal(reason('mutation($i: Int = 9) { orderSetStatus(input: { orderId: $i, status: "NEW" }) { id } }', {}, last()), null)
})

test('orderSetStatus elevates only with the checkout statuses', () => {
  const run = (input) => reason(SET_STATUS, { input: { orderId: 9, ...input } }, last())
  assert.equal(run({ status: 'NEW', payStatus: 'OPEN' }), 'checkout')
  assert.equal(run({ status: 'REQUEST' }), 'checkout')
  assert.equal(run({ status: 'UNFINISHED', payStatus: 'OPEN' }), 'checkout')
  assert.equal(run({ status: 'CONFIRMED' }), null)
  assert.equal(run({ status: 'NEW', payStatus: 'PAID' }), null)
  assert.equal(run({}), null)
})

test('each checkout mutation is elevated once per order', () => {
  assert.equal(reason(SET_STATUS, own, last('s')), null)
  const quote = 'mutation m($input: X!) { triggerQuoteSendRequest(input: $input) }'
  assert.equal(reason(quote, { input: { orderId: 9 } }, last('s')), 'checkout')
  assert.equal(reason(quote, { input: { orderId: 9 } }, last('sq')), null)
  assert.equal(checkoutFlag(single(SET_STATUS)), 's')
  assert.equal(checkoutFlag(single(quote)), 'q')
  assert.equal(checkoutFlag(single('mutation { triggerOrderSendConfirm(input: {orderId: 1}) }')), 'c')
  assert.equal(checkoutFlag(single(ORDER)), null)
})

test('passwordResetLink never elevates: it returns the reset link to the caller', () => {
  const doc = 'mutation passwordResetLink($input: PasswordRecoveryLinkInput) { passwordResetLink(input: $input) }'
  assert.equal(reason(doc, { input: { email: 'a@b.c' } }, { ...last(), clientId: 'order-editor' }), null)
})

test('operationName, aliases and fake names never elevate', () => {
  assert.equal(reason('query orderSetStatus { contacts { items { email } } }', {}, last()), null)
  assert.equal(reason('mutation orderSetStatus { contactDelete(id: 1) }', {}, last()), null)
  assert.equal(reason('mutation { orderSetStatusX(input: { orderId: 9, status: "NEW" }) { id } }', {}, last()), null)
  assert.equal(reason('query { orderSetStatus(input: { orderId: 9, status: "NEW" }) { id } }', {}, last()), null)
})

test('extra fields, operations or top-level spreads do not elevate', () => {
  assert.equal(reason('mutation { orderSetStatus(input: { orderId: 9, status: "NEW" }) { id } contactDelete(id: 1) }', {}, last()), null)
  assert.equal(reason(`${SET_STATUS}\nquery contacts { contacts { items { email } } }`, own, last()), null)
  assert.equal(reason('mutation { ...F } fragment F on Mutation { orderSetStatus(input: { orderId: 9, status: "NEW" }) { id } }', {}, last()), null)
  assert.equal(reason('mutation { ... on Mutation { orderSetStatus(input: { orderId: 9, status: "NEW" }) { id } } }', {}, last()), null)
  assert.equal(reason('mutation { __typename orderSetStatus(input: { orderId: 9, status: "NEW" }) { id } }', {}, last()), 'checkout')
  assert.equal(orderEditorReason(null, {}, last()), null)
})

// ── Order reads only for their owner ──────────────────────────────────────

const CONTACT = { type: 'Contact', userId: 73, contactId: 73, companyId: 37, companyIds: [37, 36], managerOf: [] }
const CUSTOMER = { type: 'Customer', userId: 71, customerId: 71 }
// What the order-editor key answers: 9, 11, 14 and 15 are the contact's (14, 15 drafts),
// 12 the customer's, 10 someone else's.
const ORDERS = {
  9: { userId: 73, status: 'NEW' },
  10: { userId: 99, status: 'NEW' },
  11: { userId: 73, status: 'QUOTATION' },
  12: { userId: 71, status: 'NEW' },
  13: { userId: null, status: 'NEW' },
  14: { userId: 73, status: 'DRAFT_ORDER' },
  15: { userId: 73, status: 'DRAFT_QUOTATION' },
}
// The statuses each account page lists: orders (useOrders' default), quotations, quote requests.
const PAGE_STATUSES = [['NEW', 'CONFIRMED', 'VALIDATED', 'ORDER'], ['QUOTATION'], ['REQUEST']]

// mayReadOrder with an order-editor lookup that records the ids it read.
async function read(query, variables = {}, { viewer = null, lastOrderId = null, fetchOrder } = {}) {
  const looked = []
  const lookup = fetchOrder ?? (async (id) => ORDERS[id] ?? null)
  const allowed = await mayReadOrder(single(query), variables, {
    viewer,
    lastOrderId,
    fetchOrder: (id) => (looked.push(id), lookup(id)),
  })
  return { allowed, looked }
}
const may = async (...args) => (await read(...args)).allowed

const ORDERS_DOC = 'query orders($input: OrderSearchArguments) { orders(input: $input) { items { id } } }'
const ORDER_PDF = 'query orderGetPDF($orderId: Int!) { orderGetPDF(orderId: $orderId) { base64 } }'
const QUOTE_PDF = 'query quoteGetPDF($quoteId: Int!) { quoteGetPDF(orderId: $quoteId) { base64 } }'

test('a guest reads only the signed last order, by id, without a lookup', async () => {
  assert.deepEqual(await read(ORDER, { orderId: 9, language: 'NL' }, { lastOrderId: 9 }), { allowed: true, looked: [] })
  assert.equal(await may(ORDER, { orderId: '9' }, { lastOrderId: 9 }), true)
  assert.equal(await may('{ order(orderId: 9) { id } }', {}, { lastOrderId: 9 }), true)
  assert.equal(await may(ORDER, { orderId: 8 }, { lastOrderId: 9 }), false, 'another order')
  assert.equal(await may(ORDER, { orderId: 9 }), false, 'no last-order cookie')
  assert.equal(await may(ORDER, { orderId: 9, orderUUID: 'abc' }, { lastOrderId: 9 }), false)
  assert.equal(await may('{ order(orderUUID: "abc") { id } }', {}, { lastOrderId: 9 }), false)
  assert.equal(await may('query($o: Int = 9) { order(orderId: $o) { id } }', {}, { lastOrderId: 9 }), false)
})

test('a guest gets no order list, order PDF or quote PDF', async () => {
  assert.equal(await may(ORDERS_DOC, { input: { userId: [73], status: ['NEW', 'CONFIRMED', 'VALIDATED', 'ORDER'] } }, { lastOrderId: 9 }), false)
  assert.equal(await may(ORDERS_DOC, { input: { page: 1, offset: 5 } }), false)
  assert.equal(await may(ORDER_PDF, { orderId: 9 }, { lastOrderId: 9 }), false, 'the thank-you page shows no PDF')
  assert.equal(await may(QUOTE_PDF, { quoteId: 9 }, { lastOrderId: 9 }), false)
})

test('the verified owner reads order, orderGetPDF and quoteGetPDF after an order-editor lookup', async () => {
  assert.deepEqual(await read(ORDER, { orderId: 9 }, { viewer: CONTACT }), { allowed: true, looked: [9] })
  assert.deepEqual(await read(ORDER_PDF, { orderId: 9 }, { viewer: CONTACT }), { allowed: true, looked: [9] })
  assert.deepEqual(await read(QUOTE_PDF, { quoteId: 11 }, { viewer: CONTACT }), { allowed: true, looked: [11] })
  assert.equal(await may('{ orderGetPDF(orderId: 12, templateId: "x") { base64 } }', {}, { viewer: CUSTOMER }), true)
})

test("another user's order is refused, also with this browser's last-order cookie", async () => {
  assert.deepEqual(await read(ORDER, { orderId: 10 }, { viewer: CONTACT }), { allowed: false, looked: [10] })
  assert.equal(await may(ORDER_PDF, { orderId: 10 }, { viewer: CONTACT }), false)
  assert.equal(await may(QUOTE_PDF, { quoteId: 10 }, { viewer: CONTACT }), false)
  assert.equal(await may(ORDER, { orderId: 9 }, { viewer: CUSTOMER }), false)
  assert.equal(await may(ORDER, { orderId: 13 }, { viewer: CONTACT }), false, 'a guest order has no userId')
  assert.equal(await may(ORDER, { orderId: 10 }, { viewer: CONTACT, lastOrderId: 10 }), false)
  assert.deepEqual(await read(ORDER, { orderUUID: 'abc' }, { viewer: CONTACT }), { allowed: false, looked: [] })
})

test('a failed, erroring or empty owner lookup refuses', async () => {
  const failing = async () => {
    throw new Error('upstream down')
  }
  assert.equal(await may(ORDER, { orderId: 9 }, { viewer: CONTACT, fetchOrder: failing }), false)
  assert.equal(await may(ORDER, { orderId: 9 }, { viewer: CONTACT, fetchOrder: async () => null }), false)
  assert.equal(await may(ORDER, { orderId: 9 }, { viewer: CONTACT, fetchOrder: async () => ({}) }), false)
  assert.equal(await may(ORDER, { orderId: 9 }, { viewer: CONTACT, fetchOrder: async () => ({ userId: 73 }) }), false, 'no status')
})

test("orders only with the viewer's own userId and companies, without a lookup", async () => {
  const own = (input, viewer = CONTACT) => read(ORDERS_DOC, { input: { status: ['NEW', 'CONFIRMED', 'VALIDATED', 'ORDER'], ...input } }, { viewer })
  assert.deepEqual(await own({ userId: [73], companyIds: [37], page: 1 }), { allowed: true, looked: [] })
  assert.equal((await own({ userId: [73] })).allowed, true)
  assert.equal((await own({ userId: 73 })).allowed, true, 'a bare id GraphQL coerces to [73]')
  assert.equal((await own({ userId: [73], companyIds: [37, 36] })).allowed, true)
  assert.equal((await own({ userId: [71] }, CUSTOMER)).allowed, true)
  assert.equal(await may('{ orders(input: { userId: [73], companyIds: [36], status: ["NEW"] }) { itemsFound } }', {}, { viewer: CONTACT }), true)
  assert.equal(await may('query($u: Int) { orders(input: { userId: [$u], status: [QUOTATION] }) { itemsFound } }', { u: 73 }, { viewer: CONTACT }), true)

  assert.equal((await own({ userId: [74] })).allowed, false, 'foreign userId')
  assert.equal((await own({ userId: [73, 74] })).allowed, false)
  assert.equal((await own({ userId: [] })).allowed, false)
  assert.equal((await own({ companyIds: [37] })).allowed, false, 'missing userId')
  assert.equal((await own({})).allowed, false)
  assert.equal(await may(ORDERS_DOC, {}, { viewer: CONTACT }), false, 'missing input')
  assert.equal((await own({ userId: [73], companyIds: [37, 99] })).allowed, false, 'company outside the viewer')
  assert.equal((await own({ userId: [71], companyIds: [37] }, CUSTOMER)).allowed, false, 'customer with companyIds')
  assert.equal((await own({ userId: [71], companyIds: [] }, CUSTOMER)).allowed, false)
  assert.equal(await may('{ orders(input: { userId: [74], status: ["NEW"] }) { itemsFound } }', {}, { viewer: CONTACT }), false)
  assert.equal(await may('query($u: [Int] = [73]) { orders(input: { userId: $u, status: ["NEW"] }) { itemsFound } }', {}, { viewer: CONTACT }), false)
})

test('the owner never reads a draft: the order-editor key skips the visibility rules', async () => {
  assert.deepEqual(await read(ORDER, { orderId: 14 }, { viewer: CONTACT }), { allowed: false, looked: [14] })
  assert.equal(await may(ORDER, { orderId: 15 }, { viewer: CONTACT }), false)
  assert.equal(await may(ORDER_PDF, { orderId: 14 }, { viewer: CONTACT }), false)
  assert.equal(await may(QUOTE_PDF, { quoteId: 15 }, { viewer: CONTACT }), false)
  assert.equal(await may(ORDER, { orderId: 9 }, { viewer: CONTACT, fetchOrder: async () => ({ userId: 73, status: 'DRAFT_SOMETHING' }) }), false)
  assert.equal(await may(ORDER, { orderId: 11 }, { viewer: CONTACT }), true, 'a quotation is no draft')
})

test("orders only with the account pages' statuses: each page's set, never a draft or none", async () => {
  const search = (status) => may(ORDERS_DOC, { input: { userId: [73], status, page: 1, offset: 10 } }, { viewer: CONTACT })
  for (const status of PAGE_STATUSES) assert.equal(await search(status), true, status.join())
  assert.deepEqual([...ORDER_LIST_STATUSES].sort(), PAGE_STATUSES.flat().sort())
  assert.equal(await search('QUOTATION'), true, 'a bare value GraphQL coerces to a list')
  assert.equal(await search(undefined), false, 'no status: every status, drafts included')
  assert.equal(await search(null), false)
  assert.equal(await search([]), false)
  assert.equal(await search(['DRAFT_ORDER']), false)
  assert.equal(await search(['NEW', 'DRAFT_QUOTATION']), false)
  assert.equal(await search(['UNFINISHED']), false)
  assert.equal(await search(['QUOTATION', 'ARCHIVED']), false)
  assert.equal(await may('{ orders(input: { userId: [73], status: ["DRAFT_ORDER"] }) { itemsFound } }', {}, { viewer: CONTACT }), false)
  assert.equal(await may('query($s: [String] = ["NEW"]) { orders(input: { userId: [73], status: $s }) { itemsFound } }', {}, { viewer: CONTACT }), false)
})

test('an order field nested, next to another root field or behind a spread is refused', async () => {
  const owner = { viewer: CONTACT, lastOrderId: 9 }
  assert.equal(await may('{ order(orderId: 9) { id } products { items { productId } } }', {}, owner), false)
  assert.equal(await may('{ viewer { __typename } order(orderId: 9) { id } }', {}, owner), false)
  assert.equal(await may('{ companies { items { order(orderId: 9) { id } } } }', {}, owner), false)
  assert.equal(await may('{ ...F } fragment F on Query { order(orderId: 9) { id } }', {}, owner), false)
  assert.equal(await may('{ ... on Query { order(orderId: 9) { id } } }', {}, owner), false)
  assert.equal(await may(`${ORDER}
query other { products { itemsFound } }`, { orderId: 9 }, owner), false)
  assert.equal(await may('{ __typename order(orderId: 9) { id } }', {}, owner), true)
})

test('order revisions, tenders, order addresses, shipments and payments are refused, even for the owner', async () => {
  const owner = { viewer: CONTACT, lastOrderId: 9 }
  for (const query of [
    '{ addressesByOrderId(orderId: 9) { id } }',
    '{ shipment(id: "1") { id orderId } }',
    '{ shipments(input: { orderIds: [9] }) { itemsFound } }',
    '{ shipmentItem(id: "1") { id } }',
    '{ shipmentItems(input: {}) { itemsFound } }',
    '{ payment(searchBy: { orderId: 9 }) { id amount } }',
    '{ payments(input: {}) { itemsFound } }',
    '{ orderRevisions(input: { page: 1 }) { itemsFound } }',
    '{ orderRevision(orderId: 9, revisionNumber: 1) { revisionNumber } }',
    '{ tender(orderId: 9) { orderId } }',
    '{ orderAddresses(orderId: 9) { id } }',
    '{ orderAddress(orderId: 9, id: 1) { id } }',
  ]) {
    assert.equal(await may(query, {}, owner), false, query)
  }
})

test('an aliased order read follows the same rules', async () => {
  assert.equal(await may('{ x: order(orderId: 9) { id } }', {}, { viewer: CONTACT }), true)
  assert.equal(await may('{ x: order(orderId: 10) { id } }', {}, { viewer: CONTACT }), false)
  assert.equal(await may('{ x: order(orderId: 9) { id } }', {}, { lastOrderId: 9 }), true)
  assert.equal(await may('{ x: order(orderId: 10) { id } }', {}, { lastOrderId: 9 }), false)
  assert.equal(await may('{ mine: orders(input: { userId: [74], status: ["NEW"] }) { itemsFound } }', {}, { viewer: CONTACT }), false)
})

test('a Bearer upstream does not accept is a guest: only the signed last order', async () => {
  // The proxy's viewer lookup (viewer.js): upstream refusing the token yields no viewer.
  const viewer = await createViewerLookup(async () => {
    throw new Error('viewer lookup 401')
  })('forged.jwt.token')
  assert.equal(viewer, null)
  assert.equal(await may(ORDER, { orderId: 9 }, { viewer, lastOrderId: 9 }), true)
  assert.equal(await may(ORDER, { orderId: 10 }, { viewer, lastOrderId: 9 }), false)
  assert.equal(await may(ORDERS_DOC, { input: { userId: [73], status: ['NEW', 'CONFIRMED', 'VALIDATED', 'ORDER'] } }, { viewer }), false)
})

test('order reads and registration go upstream on the order-editor key without the Bearer', () => {
  assert.deepEqual(upstreamAuth('order-read', 'tok'), { orderEditorKey: true, bearer: undefined })
  assert.deepEqual(upstreamAuth('registration', 'tok'), { orderEditorKey: true, bearer: undefined })
  assert.deepEqual(upstreamAuth('checkout', 'tok'), { orderEditorKey: true, bearer: 'tok' })
  assert.deepEqual(upstreamAuth('quote-accept', 'tok'), { orderEditorKey: true, bearer: 'tok' })
  assert.deepEqual(upstreamAuth(null, 'tok'), { orderEditorKey: false, bearer: 'tok' })
  assert.deepEqual(upstreamAuth(null, undefined), { orderEditorKey: false, bearer: undefined })
})

test("quote acceptance only for the viewer's own quotation", () => {
  assert.equal(isOwnQuotation(ORDERS[11], CONTACT), true)
  assert.equal(isOwnQuotation(ORDERS[11], CUSTOMER), false, "another user's quotation")
  assert.equal(isOwnQuotation(ORDERS[9], CONTACT), false, 'not a quotation')
  assert.equal(isOwnQuotation({ status: 'QUOTATION', userId: 99 }, CONTACT), false)
  assert.equal(isOwnQuotation(ORDERS[11], null), false)
  assert.equal(isOwnQuotation(null, CONTACT), false)
})

test('contactRegister needs the order-editor client of a manager of the target company', () => {
  const manager = { type: 'Contact', contactId: 1, companyId: 37, companyIds: [37, 39], managerOf: [37] }
  const vars = (parentId) => ({ contactRegisterInput: { email: 'x@y.test', parentId } })
  const ctx = { clientId: 'order-editor', viewer: manager }
  assert.equal(reason(CONTACT_REGISTER, vars(37), ctx), 'contact-register')
  assert.equal(reason(CONTACT_REGISTER, vars(39), ctx), null, 'member, not manager')
  assert.equal(reason(CONTACT_REGISTER, vars(37), { viewer: manager }), null, 'no client id')
  assert.equal(reason(CONTACT_REGISTER, vars(37), { clientId: 'order-editor' }), null, 'no verified viewer')
  assert.equal(reason(CONTACT_REGISTER, vars(37), { ...ctx, viewer: { type: 'Customer', customerId: 1 } }), null)
  assert.equal(reason(CONTACT_REGISTER, vars(undefined), ctx), null)
})

test('quoteAcceptOrderId matches only the plain quote acceptance', () => {
  assert.equal(quoteAcceptOrderId(single(SET_STATUS), { input: { orderId: 593, status: 'NEW' } }), 593)
  assert.equal(quoteAcceptOrderId(single(SET_STATUS), { input: { orderId: 593, status: 'NEW', payStatus: 'PAID' } }), null)
  assert.equal(quoteAcceptOrderId(single(SET_STATUS), { input: { orderId: 593, status: 'CANCELLED' } }), null)
  assert.equal(quoteAcceptOrderId(single(SET_STATUS), { input: { orderId: 593, status: 'NEW', sendOrderConfirmationEmail: true } }), null)
  assert.equal(quoteAcceptOrderId(single('mutation m($input: X!) { triggerOrderSendConfirm(input: $input) }'), { input: { orderId: 593, status: 'NEW' } }), null)
})

test('the last-order cookie carries the flags, signed, and rejects tampering', () => {
  const fresh = signLastOrder(4711)
  assert.deepEqual(verifyLastOrder(fresh), { orderId: 4711, used: '' })
  const after = signLastOrder(4711, 'sq')
  assert.deepEqual(verifyLastOrder(after), { orderId: 4711, used: 'sq' })
  const [, exp, sig] = after.split('.')
  assert.equal(verifyLastOrder(`${Buffer.from('4711').toString('base64url')}.${exp}.${sig}`), null)
  assert.equal(verifyLastOrder('4711'), null)
  assert.equal(verifyLastOrder(undefined), null)
})

test('createdOrderId reads cartProcess responses only', () => {
  const cartProcess = single('mutation cartProcess($id: String!, $input: CartProcessInput!) { cartProcess(id: $id, input: $input) { cartOrderId } }')
  assert.equal(createdOrderId(cartProcess, { data: { cartProcess: { cartOrderId: 77 } } }), 77)
  assert.equal(createdOrderId(single('mutation { placed: cartProcess(id: "1", input: {}) { cartOrderId } }'), { data: { placed: { cartOrderId: 8 } } }), 8)
  assert.equal(createdOrderId(single(SET_STATUS), { data: { orderSetStatus: { cartOrderId: 9 } } }), null)
  assert.equal(createdOrderId(cartProcess, { errors: [{ message: 'x' }] }), null)
  assert.equal(createdOrderId(cartProcess, undefined), null)
  assert.equal(createdOrderId(cartProcess, { data: { cartProcess: { cartOrderId: '1; drop' } } }), null)
})

test('the spent log remembers checkout mutations per order, bounded and expiring', () => {
  let t = 0
  const log = createSpentLog({ ttlMs: 100, maxEntries: 2, now: () => t })
  assert.equal(log.flags(9), '')
  log.add(9, 's')
  log.add(9, 's')
  log.add(9, 'c')
  assert.equal(log.flags(9), 'sc')
  log.add(10, 's')
  log.add(11, 's')
  assert.equal(log.flags(9), '', 'oldest evicted')
  t = 200
  assert.equal(log.flags(11), '', 'expired')
})

// The installed SDK's own documents, as the browser sends them.
const OPS = new URL('../../node_modules/@propeller-commerce/propeller-sdk-v2/dist/esm/generated/operations/', import.meta.url)
const sdkDocument = async (name) => (await import(new URL(`${name}.js`, OPS).href)).document

test('the SDK checkout documents elevate only for the last order', async () => {
  for (const name of ['orderSetStatus', 'triggerQuoteSendRequest', 'triggerOrderSendConfirm']) {
    const doc = await sdkDocument(name)
    assert.equal(reason(doc, own, last()), 'checkout', name)
    assert.equal(reason(doc, { input: { ...own.input, orderId: 8 } }, last()), null, name)
  }
  assert.equal(reason(await sdkDocument('passwordResetLink'), { input: { email: 'a@b.c' } }, last()), null)
  assert.equal(quoteAcceptOrderId(single(await sdkDocument('orderSetStatus')), { input: { orderId: 5, status: 'NEW' } }), 5)
})

test('the pinned hashes match the installed SDK documents (update them after an SDK upgrade)', async () => {
  for (const [name, hash] of SDK_DOCUMENT_HASHES) {
    assert.equal(documentHash(parseDocument(await sdkDocument(name))), hash, name)
    assert.equal(isSdkDocument(parseDocument(await sdkDocument(name)), name), true, name)
  }
  assert.deepEqual(
    [...SDK_DOCUMENT_HASHES.keys()].sort(),
    ['contactRegister', 'order', 'orderGetPDF', 'orderSetStatus', 'orders', 'quoteGetPDF', 'triggerOrderSendConfirm', 'triggerQuoteSendRequest'],
  )
})

test('only the SDK order documents, unchanged, may run as an order read', async () => {
  const sdkOrder = await sdkDocument('order')
  // Reformatting doesn't matter (the hash is of the printed document); any change of selection does.
  assert.equal(isSdkDocument(parseDocument(sdkOrder.replace(/\n/g, '\n\n')), 'order'), true)
  assert.equal(isSdkDocument(parseDocument(sdkOrder), 'orders'), false, "another field's document")
  for (const query of [
    sdkOrder.replace('order(orderId: $orderId', 'x: order(orderId: $orderId'),
    sdkOrder.replace(/\{\n\s*id\b/, '{ company { contacts { itemsFound } }\n  id'),
    '{ order(orderId: 9) { id } }',
    'query order($orderId: Int) { order(orderId: $orderId) { id userId company { contacts { items { email } } } } }',
  ]) {
    assert.equal(isSdkDocument(parseDocument(query), 'order'), false, query.slice(0, 60))
  }
  assert.equal(isSdkDocument(parseDocument('{ orders(input: { userId: [73] }) { items { id } } }'), 'orders'), false)
  assert.equal(isSdkDocument(parseDocument('{ tender(orderId: 9) { orderId } }'), 'tender'), false)
  assert.equal(isSdkDocument(parseDocument('{ __typename }'), '__proto__'), false)
  assert.equal(isSdkDocument(null, 'order'), false)
})

test('elevated mutations run only as the SDK documents the shop sends; a custom selection is refused', async () => {
  // The checkout (useCheckout: orderSetStatus, triggerQuoteSendRequest), quote acceptance
  // (QuoteActions: orderSetStatus) and the authorization settings (contactRegister) send these.
  for (const name of ['orderSetStatus', 'triggerQuoteSendRequest', 'triggerOrderSendConfirm', 'contactRegister']) {
    const sdk = await sdkDocument(name)
    assert.equal(isSdkDocument(parseDocument(sdk), name), true, name)
    // The same mutation with more selected than the SDK asks for.
    const widened = sdk.replace(/\{\n(\s+)/, '{\n$1__typename\n$1')
    assert.notEqual(widened, sdk, name)
    assert.equal(isSdkDocument(parseDocument(widened), name), false, `${name} widened`)
  }
  for (const [name, query] of [
    ['orderSetStatus', 'mutation { orderSetStatus(input: { orderId: 9, status: "NEW" }) { id company { contacts { items { email } } } } }'],
    ['orderSetStatus', 'mutation orderSetStatus($input: OrderSetStatusInput!) { orderSetStatus(input: $input) { id email } }'],
    ['triggerQuoteSendRequest', 'mutation m($input: X!) { triggerQuoteSendRequest(input: $input) }'],
    ['contactRegister', CONTACT_REGISTER],
  ]) {
    assert.equal(isSdkDocument(parseDocument(query), name), false, query.slice(0, 60))
  }
})

test('checkout mutations run only elevated and as the SDK documents; never on the storefront key', async () => {
  const refuse = (query, why) => mustRefuseElevation(parseDocument(query), single(query), why)
  const setStatus = await sdkDocument('orderSetStatus')
  const quoteRequest = await sdkDocument('triggerQuoteSendRequest')
  // The checkout and quote acceptance, as the SDK sends them.
  assert.equal(refuse(setStatus, 'checkout'), false)
  assert.equal(refuse(setStatus, 'quote-accept'), false)
  assert.equal(refuse(quoteRequest, 'checkout'), false)
  assert.equal(refuse(await sdkDocument('contactRegister'), 'contact-register'), false)
  // The same documents without elevation (another order, a spent step): refused, not sent on the storefront key.
  assert.equal(refuse(setStatus, null), true)
  assert.equal(refuse(quoteRequest, null), true)
  assert.equal(refuse(await sdkDocument('triggerOrderSendConfirm'), null), true)
  // A custom selection, elevated or not.
  const custom = 'mutation m($input: OrderSetStatusInput!) { orderSetStatus(input: $input) { id company { contacts { items { email } } } } }'
  assert.equal(refuse(custom, 'checkout'), true)
  assert.equal(refuse(custom, null), true)
  // Hidden next to another field, aliased or in a fragment: never elevated, still refused.
  assert.equal(refuse('mutation { cartStart { cartId } x: orderSetStatus(input: { orderId: 9, status: "NEW" }) { id } }', null), true)
  assert.equal(refuse('mutation { ...M } fragment M on Mutation { triggerQuoteSendRequest(input: { orderId: 9 }) }', null), true)
  // Public self-registration's contactRegister and everything else keep the storefront key.
  assert.equal(refuse(await sdkDocument('contactRegister'), null), false)
  assert.equal(refuse(await sdkDocument('cartProcess'), null), false)
  assert.equal(refuse('{ products { itemsFound } }', null), false)
  // Order reads must be the SDK's documents too; registration pins its own.
  assert.equal(refuse(await sdkDocument('order'), 'order-read'), false)
  assert.equal(refuse('{ order(orderId: 9) { id } }', 'order-read'), true)
  assert.equal(refuse(await sdkDocument('companyCreate'), 'registration'), false)
})

test('the SDK order documents are served to their owner only', async () => {
  const order = await sdkDocument('order')
  assert.equal(await may(order, { orderId: 9 }, { lastOrderId: 9 }), true)
  assert.equal(await may(order, { orderId: 10 }, { lastOrderId: 9 }), false)
  assert.equal(await may(order, { orderId: 9 }, { viewer: CONTACT }), true)
  assert.equal(await may(order, { orderId: 10 }, { viewer: CONTACT }), false)
  assert.equal(await may(order, { orderId: 14 }, { viewer: CONTACT }), false, 'draft')
  const orders = await sdkDocument('orders')
  assert.equal(await may(orders, { input: { userId: [73], companyIds: [37], status: ['NEW', 'CONFIRMED', 'VALIDATED', 'ORDER'], page: 1, offset: 10 } }, { viewer: CONTACT }), true)
  assert.equal(await may(orders, { input: { userId: [73], companyIds: [37], page: 1, offset: 10 } }, { viewer: CONTACT }), false, 'no status')
  assert.equal(await may(orders, { input: { userId: [99], status: ['NEW', 'CONFIRMED', 'VALIDATED', 'ORDER'], page: 1, offset: 10 } }, { viewer: CONTACT }), false)
  assert.equal(await may(await sdkDocument('orderGetPDF'), { orderId: 9 }, { viewer: CONTACT }), true)
  assert.equal(await may(await sdkDocument('orderGetPDF'), { orderId: 10 }, { viewer: CONTACT }), false)
  assert.equal(await may(await sdkDocument('quoteGetPDF'), { quoteId: 11 }, { viewer: CONTACT }), true)
  assert.equal(await may(await sdkDocument('quoteGetPDF'), { quoteId: 10 }, { viewer: CONTACT }), false)
})

test('the SDK contactRegister, cartProcess and viewer documents route as intended', async () => {
  const manager = { type: 'Contact', contactId: 1, companyIds: [37], managerOf: [37] }
  assert.equal(
    reason(await sdkDocument('contactRegister'), { contactRegisterInput: { parentId: 37 } }, { clientId: 'order-editor', viewer: manager }),
    'contact-register',
  )
  for (const name of ['cartProcess', 'viewer']) {
    assert.equal(reason(await sdkDocument(name), {}, { ...last(), clientId: 'order-editor', viewer: manager }), null, name)
  }
})

test('parallel requests with the same last-order cookie: only one reserves the checkout mutation', async () => {
  const log = createSpentLog()
  // The proxy's awaits between reading the flags and spending one (viewer lookups).
  const slowLookup = () => new Promise((resolve) => setTimeout(resolve, 5))
  const request = async () => {
    const elevated = reason(SET_STATUS, own, { lastOrder: { orderId: 9, used: log.flags(9) } }) === 'checkout'
    await slowLookup()
    return elevated && log.reserve(9, checkoutFlag(single(SET_STATUS)))
  }
  const results = await Promise.all(Array.from({ length: 5 }, request))
  assert.equal(results.filter(Boolean).length, 1)
  assert.equal(log.flags(9), 's')
  // A failed upstream call releases it for a retry; then it is spent again.
  log.release(9, 's')
  assert.equal(log.reserve(9, 's'), true)
  assert.equal(log.reserve(9, 's'), false)
})
