import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createdOrderId,
  shouldUseOrderEditorKey,
  signLastOrder,
  topLevelField,
  verifyLastOrder,
} from './orderEditorRouting.js'

const KEY = 'order-editor-test-key'

const ORDER = `fragment OrderFields on Order { id status }
query order($orderId: Int, $orderUUID: String, $language: String) {
  order(orderId: $orderId, orderUUID: $orderUUID) {
    ...OrderFields
  }
}`

const SET_STATUS = `mutation orderSetStatus($input: OrderSetStatusInput!) {
  orderSetStatus(input: $input) {
    id
  }
}`

const CONTACT_REGISTER = `mutation contactRegister($contactRegisterInput: RegisterContactInput!) {
  contactRegister(input: $contactRegisterInput) {
    ...RegisterContactResponseFields
  }
}
fragment RegisterContactResponseFields on RegisterContactResponse { session { accessToken } }`

const decide = (query, opts = {}) =>
  shouldUseOrderEditorKey({ query, operationName: opts.operationName }, opts)

test('the real order-editor mutations elevate', () => {
  assert.equal(decide(SET_STATUS), true)
  assert.equal(decide('mutation passwordResetLink($input: PasswordRecoveryLinkInput) { passwordResetLink(input: $input) }'), true)
  assert.equal(decide('mutation triggerQuoteSendRequest($input: TriggerQuoteSendRequestEventInput!) { triggerQuoteSendRequest(input: $input) }'), true)
  assert.equal(decide('mutation triggerOrderSendConfirm($input: TriggerOrderSendConfirmEventInput!) { triggerOrderSendConfirm(input: $input) }'), true)
})

test('__typename beside the field does not block elevation', () => {
  assert.equal(decide('mutation { __typename orderSetStatus(input: {}) { id } }'), true)
})

test('operationName is ignored', () => {
  assert.equal(decide('mutation x { orderSetStatus(input: {}) { id } }', { operationName: 'anything' }), true)
  assert.equal(decide('query orderSetStatus { contacts { items { email } } }', { operationName: 'orderSetStatus' }), false)
})

test('a fake or unknown name does not elevate', () => {
  assert.equal(decide('mutation orderSetStatus { contactDelete(id: 1) }'), false)
  assert.equal(decide('mutation { orderSetStatusX(input: {}) { id } }'), false)
})

test('a query selecting an allowlisted mutation name does not elevate', () => {
  assert.equal(decide('query { orderSetStatus { id } }'), false)
})

test('two top-level fields do not elevate', () => {
  assert.equal(decide('mutation { orderSetStatus(input: {}) { id } contactDelete(id: 1) }'), false)
})

test('a top-level fragment spread does not elevate', () => {
  assert.equal(
    decide('mutation { ...F } fragment F on Mutation { orderSetStatus(input: {}) { id } contactDelete(id: 1) }'),
    false,
  )
  assert.equal(decide('mutation { ... on Mutation { orderSetStatus(input: {}) { id } } }'), false)
})

test('two operations do not elevate', () => {
  assert.equal(decide(`${SET_STATUS}\nquery contacts { contacts { items { email } } }`), false)
  assert.equal(decide(`${SET_STATUS}\nmutation b { orderSetStatus(input: {}) { id } }`), false)
})

test('unparseable or missing documents never elevate', () => {
  assert.equal(decide('mutation { orderSetStatus('), false)
  assert.equal(decide(undefined), false)
  assert.equal(shouldUseOrderEditorKey(null), false)
  assert.equal(decide(42), false)
})

test('contactRegister needs the order-editor client id AND a session', () => {
  assert.equal(decide(CONTACT_REGISTER), false)
  assert.equal(decide(CONTACT_REGISTER, { clientId: 'order-editor' }), false)
  assert.equal(decide(CONTACT_REGISTER, { hasSession: true }), false)
  assert.equal(decide(CONTACT_REGISTER, { clientId: 'other', hasSession: true }), false)
  assert.equal(decide(CONTACT_REGISTER, { clientId: 'order-editor', hasSession: true }), true)
})

test('topLevelField reports the single field and the operation type', () => {
  assert.deepEqual(topLevelField(SET_STATUS), { operation: 'mutation', field: 'orderSetStatus' })
  assert.equal(topLevelField('{ a b }'), null)
})

const guest = (query, variables, opts = {}) =>
  shouldUseOrderEditorKey({ query, variables }, { isAnonymous: true, lastOrderId: '123', ...opts })

test('anonymous order query elevates only with a matching signed order id', () => {
  const vars = { orderId: 123, language: 'NL' }
  assert.equal(guest(ORDER, vars, { lastOrderId: null }), false)
  assert.equal(guest(ORDER, vars, { lastOrderId: '999' }), false)
  assert.equal(guest(ORDER, vars), true)
})

test('order query for a signed-in caller stays on the general key', () => {
  assert.equal(guest(ORDER, { orderId: 123 }, { isAnonymous: false }), false)
  assert.equal(shouldUseOrderEditorKey({ query: ORDER, variables: { orderId: 123 } }, { lastOrderId: '123' }), false)
})

test('order query cannot dodge the id check', () => {
  assert.equal(guest('{ order(orderId: 5) { id } }', { orderId: 123 }), false)
  assert.equal(guest('{ order(orderId: 123) { id } }'), true)
  assert.equal(guest(ORDER, { orderId: 123, orderUUID: 'abc' }), false)
  assert.equal(guest('{ order(orderUUID: "abc") { id } }'), false)
  assert.equal(guest('query($o: Int = 123) { order(orderId: $o) { id } }'), false)
  assert.equal(guest('{ order { id } }'), false)
  assert.equal(guest(ORDER, { orderId: '123abc' }), false)
  assert.equal(guest('{ order(orderId: 123) { id } contacts { items { email } } }'), false)
})

test('signed last-order cookie round-trips and rejects tampering', () => {
  const value = signLastOrder(123, KEY)
  assert.match(value, /^123\.[0-9a-f]{64}$/)
  assert.equal(verifyLastOrder(value, KEY), '123')
  assert.equal(verifyLastOrder(value, 'other-key'), null)
  assert.equal(verifyLastOrder(value.replace(/^123/, '124'), KEY), null)
  assert.equal(verifyLastOrder('123', KEY), null)
  assert.equal(verifyLastOrder('123.abc', KEY), null)
  assert.equal(verifyLastOrder(undefined, KEY), null)
  assert.equal(verifyLastOrder(value, ''), null)
})

test('createdOrderId reads cartProcess responses only', () => {
  const query =
    'mutation cartProcess($id: String!, $input: CartProcessInput!) { cartProcess(id: $id, input: $input) { cartOrderId } }'
  const response = JSON.stringify({ data: { cartProcess: { cartOrderId: 77, cart: { cartId: 'x' } } } })
  assert.equal(createdOrderId({ query }, response), '77')
  const aliased = 'mutation { placed: cartProcess(id: "1", input: {}) { cartOrderId } }'
  assert.equal(createdOrderId({ query: aliased }, JSON.stringify({ data: { placed: { cartOrderId: 8 } } })), '8')
  assert.equal(
    createdOrderId({ query: SET_STATUS }, JSON.stringify({ data: { orderSetStatus: { cartOrderId: 9 } } })),
    null,
  )
  assert.equal(createdOrderId({ query }, JSON.stringify({ errors: [{ message: 'x' }] })), null)
  assert.equal(createdOrderId({ query }, 'not json'), null)
  assert.equal(
    createdOrderId({ query }, JSON.stringify({ data: { cartProcess: { cartOrderId: '1; drop' } } })),
    null,
  )
})
