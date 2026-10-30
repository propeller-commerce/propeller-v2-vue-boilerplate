import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shouldUseOrderEditorKey, topLevelField } from './orderEditorRouting.js'

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
