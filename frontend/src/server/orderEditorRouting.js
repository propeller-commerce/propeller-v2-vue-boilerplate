import { createHmac, timingSafeEqual } from 'node:crypto'
import { parse, Kind } from 'graphql'

/**
 * Decides whether a proxied GraphQL request may use the order-editor API key.
 * Decided from the parsed document only, never from the client-sent
 * `operationName`: exactly one operation, exactly one top-level field
 * (`__typename` aside), and that field on the allowlist for its type.
 */

// Top-level mutation fields the backend authorizes only with the order-editor key.
export const ORDER_EDITOR_FIELDS = {
  mutation: new Set([
    'orderSetStatus',
    'passwordResetLink',
    'triggerQuoteSendRequest',
    'triggerOrderSendConfirm',
  ]),
}

// Elevated only for the order-editor client with a signed-in session.
export const ORDER_EDITOR_OPT_IN_FIELDS = {
  mutation: new Set(['contactRegister']),
}

export const ORDER_EDITOR_CLIENT_ID = 'order-editor'

// Signed cookie naming the order a guest just placed, so its thank-you page can read it.
export const LAST_ORDER_COOKIE = 'propeller_last_order'
export const LAST_ORDER_MAX_AGE = 60 * 60

const ALL_NAMES = [
  ...Object.values(ORDER_EDITOR_FIELDS),
  ...Object.values(ORDER_EDITOR_OPT_IN_FIELDS),
].flatMap((s) => [...s])

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

// The single operation's single field node, plus the variables declared with a default.
function singleField(query) {
  if (typeof query !== 'string') return null
  let doc
  try {
    doc = parse(query, { noLocation: true, maxTokens: 20000 })
  } catch {
    return null
  }
  const ops = doc.definitions.filter((d) => d.kind === Kind.OPERATION_DEFINITION)
  if (ops.length !== 1) return null
  const selections = ops[0].selectionSet.selections
  // A top-level spread could smuggle extra fields past the single-field check.
  if (selections.some((s) => s.kind !== Kind.FIELD)) return null
  const fields = selections.filter((s) => s.name.value !== '__typename')
  if (fields.length !== 1) return null
  const defaulted = new Set(
    (ops[0].variableDefinitions ?? []).filter((v) => v.defaultValue).map((v) => v.variable.name.value),
  )
  return { operation: ops[0].operation, node: fields[0], defaulted }
}

/** `{ operation, field }` for a single-operation, single-field document, else null. */
export function topLevelField(query) {
  const single = singleField(query)
  return single ? { operation: single.operation, field: single.node.name.value } : null
}

const UNRESOLVED = Symbol('unresolved')

// A variable left to its declared default is treated as unknown.
function argValue({ node, defaulted }, name, variables) {
  const arg = node.arguments?.find((a) => a.name.value === name)
  if (!arg) return undefined
  const value = arg.value
  if (value.kind === Kind.NULL) return null
  if (value.kind === Kind.INT) return value.value
  if (value.kind === Kind.VARIABLE) {
    if (value.name.value in variables) return variables[value.name.value]
    return defaulted.has(value.name.value) ? UNRESOLVED : null
  }
  return UNRESOLVED
}

function orderIdString(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value)
  if (typeof value === 'string' && /^[1-9]\d{0,15}$/.test(value)) return value
  return null
}

// A guest may read only the order id named in its signed last-order cookie.
function anonymousOrderAllowed(single, variables, lastOrderId) {
  if (!lastOrderId) return false
  const known = new Set(['orderId', 'orderUUID'])
  if (single.node.arguments?.some((a) => !known.has(a.name.value))) return false
  const uuid = argValue(single, 'orderUUID', variables)
  if (uuid !== undefined && uuid !== null) return false
  return orderIdString(argValue(single, 'orderId', variables)) === lastOrderId
}

export function shouldUseOrderEditorKey(
  body,
  { clientId, hasSession = false, isAnonymous = false, lastOrderId = null } = {},
) {
  const query = isRecord(body) ? body.query : undefined
  if (typeof query !== 'string') return false
  const guestOrder = isAnonymous && !!lastOrderId && query.includes('order')
  // Cheap pre-filter: skip parsing documents that cannot match.
  if (!guestOrder && !ALL_NAMES.some((n) => query.includes(n))) return false
  const single = singleField(query)
  if (!single) return false
  const field = single.node.name.value
  if (ORDER_EDITOR_FIELDS[single.operation]?.has(field)) return true
  if (single.operation === 'query' && field === 'order') {
    const variables = isRecord(body.variables) ? body.variables : {}
    return guestOrder && anonymousOrderAllowed(single, variables, lastOrderId)
  }
  return (
    clientId === ORDER_EDITOR_CLIENT_ID &&
    hasSession === true &&
    !!ORDER_EDITOR_OPT_IN_FIELDS[single.operation]?.has(field)
  )
}

function hmac(orderId, key) {
  return createHmac('sha256', key).update(`${LAST_ORDER_COOKIE}:${orderId}`).digest('hex')
}

/** Cookie value `orderId.hmac`, keyed with the order-editor API key. */
export function signLastOrder(orderId, key) {
  const id = String(orderId)
  return `${id}.${hmac(id, key)}`
}

/** The order id when the cookie's signature checks out, else null. */
export function verifyLastOrder(cookie, key) {
  if (!cookie || !key) return null
  const match = /^([1-9]\d{0,15})\.([0-9a-f]{64})$/.exec(cookie)
  if (!match) return null
  const expected = Buffer.from(hmac(match[1], key), 'hex')
  const given = Buffer.from(match[2], 'hex')
  return timingSafeEqual(expected, given) ? match[1] : null
}

/** The order id a relayed cartProcess mutation just created, if any. */
export function createdOrderId(body, responseText) {
  if (!isRecord(body)) return null
  const single = singleField(body.query)
  if (!single || single.operation !== 'mutation' || single.node.name.value !== 'cartProcess') return null
  let json
  try {
    json = JSON.parse(responseText)
  } catch {
    return null
  }
  if (!isRecord(json) || !isRecord(json.data)) return null
  const result = json.data[single.node.alias?.value ?? single.node.name.value]
  return isRecord(result) ? orderIdString(result.cartOrderId) : null
}
