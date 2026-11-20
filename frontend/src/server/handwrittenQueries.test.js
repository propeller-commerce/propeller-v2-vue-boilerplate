import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildSchema, parse, validate } from 'graphql'
import { PAYMENT_ORDER_QUERY } from './payments.js'
import { REFRESH_MUTATION } from './session.js'
import { VIEWER_QUERY } from './viewer.js'

// Refresh with scripts/update-propeller-schema.mjs when the API schema changes.
const schema = buildSchema(readFileSync(new URL('./__fixtures__/propeller-schema.graphql', import.meta.url), 'utf8'))
const errors = (query) => validate(schema, parse(query)).map((e) => e.message)

test('hand-written queries are valid against the Propeller schema', () => {
  for (const [name, query] of Object.entries({ VIEWER_QUERY, PAYMENT_ORDER_QUERY, REFRESH_MUTATION })) {
    assert.deepEqual(errors(query), [], name)
  }
})

test('the schema check catches a field the API does not have', () => {
  assert.notDeepEqual(errors('query q($orderId: Int) { order(orderId: $orderId) { orderId } }'), [])
})
