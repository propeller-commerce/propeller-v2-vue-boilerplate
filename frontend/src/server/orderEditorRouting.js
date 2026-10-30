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

const ALL_NAMES = [
  ...Object.values(ORDER_EDITOR_FIELDS),
  ...Object.values(ORDER_EDITOR_OPT_IN_FIELDS),
].flatMap((s) => [...s])

/** `{ operation, field }` for a single-operation, single-field document, else null. */
export function topLevelField(query) {
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
  return { operation: ops[0].operation, field: fields[0].name.value }
}

export function shouldUseOrderEditorKey(body, { clientId, hasSession = false } = {}) {
  const query = body && typeof body === 'object' ? body.query : undefined
  if (typeof query !== 'string') return false
  // Cheap pre-filter: skip parsing documents that cannot match.
  if (!ALL_NAMES.some((n) => query.includes(n))) return false
  const top = topLevelField(query)
  if (!top) return false
  if (ORDER_EDITOR_FIELDS[top.operation]?.has(top.field)) return true
  return (
    clientId === ORDER_EDITOR_CLIENT_ID &&
    hasSession === true &&
    !!ORDER_EDITOR_OPT_IN_FIELDS[top.operation]?.has(top.field)
  )
}
