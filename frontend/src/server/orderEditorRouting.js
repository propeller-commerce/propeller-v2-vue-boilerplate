import { BREAK, Kind, visit } from 'graphql'
import { signCookie, verifyCookie } from './signedCookie.js'
import { documentHash } from './registrationRouting.js'

/**
 * Decides whether a proxied GraphQL request may use the order-editor API key.
 * Decided from the parsed document only, never from the client-sent
 * `operationName`: exactly one operation, exactly one top-level field
 * (`__typename` aside), and that field allowed for this caller.
 */

// Checkout mutations the backend authorizes only with the order-editor key. Elevated only
// for the order this browser just placed (signed last-order cookie), once each per order.
// passwordResetLink is never elevated: it returns the reset link to the caller.
export const ORDER_EDITOR_FIELDS = {
  mutation: new Set(['orderSetStatus', 'triggerQuoteSendRequest', 'triggerOrderSendConfirm']),
}
const MUTATION_FLAG = { orderSetStatus: 's', triggerQuoteSendRequest: 'q', triggerOrderSendConfirm: 'c' }

// Elevated only for the order-editor client of a verified authorization manager of the
// company the contact is created in (open question 1, option a).
export const ORDER_EDITOR_OPT_IN_FIELDS = {
  mutation: new Set(['contactRegister']),
}

export const ORDER_EDITOR_CLIENT_ID = 'order-editor'

// Signed cookie naming the order this browser just placed (guest or logged in).
export const LAST_ORDER_COOKIE = 'propeller_last_order'
export const LAST_ORDER_MAX_AGE = 60 * 60
const LAST_ORDER_PURPOSE = 'last-order'

// The checkout's own orderSetStatus values: NEW (order), REQUEST (quote request),
// UNFINISHED (PSP order, finalized by the payment webhook); payment OPEN or absent.
const CHECKOUT_STATUSES = new Set(['NEW', 'REQUEST', 'UNFINISHED'])
const CHECKOUT_PAY_STATUSES = new Set([undefined, null, 'OPEN'])

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/** The single operation's single field: `{ operation, node, defaulted }`, else null. */
export function singleField(doc) {
  if (!doc) return null
  const ops = doc.definitions.filter((d) => d.kind === Kind.OPERATION_DEFINITION)
  if (ops.length !== 1) return null
  const selections = ops[0].selectionSet.selections
  // A top-level spread could smuggle extra fields past the single-field check.
  if (selections.some((s) => s.kind !== Kind.FIELD)) return null
  const fields = selections.filter((s) => s.name.value !== '__typename')
  if (fields.length !== 1) return null
  // Variables declared with a default: left out, their value is unknown here.
  const defaulted = new Set(
    (ops[0].variableDefinitions ?? []).filter((v) => v.defaultValue).map((v) => v.variable.name.value),
  )
  return { operation: ops[0].operation, node: fields[0], defaulted }
}

const UNKNOWN = Symbol('unknown')

// A literal or a supplied variable (an omitted one is null), lists and input objects resolved
// the same way. A variable left to its declared default or anything else is UNKNOWN, so it
// never matches an id or an allowed value.
function valueOf(node, variables, defaulted) {
  switch (node.kind) {
    case Kind.VARIABLE:
      if (Object.hasOwn(variables, node.name.value)) return variables[node.name.value]
      return defaulted.has(node.name.value) ? UNKNOWN : null
    case Kind.INT:
      return Number(node.value)
    case Kind.STRING:
    case Kind.ENUM:
    case Kind.BOOLEAN:
      return node.value
    case Kind.NULL:
      return null
    case Kind.OBJECT:
      return Object.fromEntries(node.fields.map((f) => [f.name.value, valueOf(f.value, variables, defaulted)]))
    case Kind.LIST:
      return node.values.map((v) => valueOf(v, variables, defaulted))
    default:
      return UNKNOWN
  }
}

/** The value of a top-level argument (literal or supplied variable), undefined when absent. */
export function argument(single, name, variables) {
  const arg = single.node.arguments?.find((a) => a.name.value === name)
  return arg ? valueOf(arg.value, isRecord(variables) ? variables : {}, single.defaulted) : undefined
}

/** A positive integer id from a number or a digit string, else null. */
export function idOf(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value
  if (typeof value === 'string' && /^[1-9]\d{0,15}$/.test(value)) return Number(value)
  return null
}

function inputOf(single, variables) {
  const input = argument(single, 'input', variables)
  return isRecord(input) ? input : null
}

/** `input.parentId` of a single contactRegister mutation, else null. */
export function contactRegisterParentId(single, variables) {
  if (single?.operation !== 'mutation' || single.node.name.value !== 'contactRegister') return null
  return idOf(inputOf(single, variables)?.parentId)
}

/**
 * Why this request may use the order-editor key, or null:
 *   'checkout'         an allowlisted checkout mutation on the signed last order, not yet run
 *   'contact-register' the order-editor client of a manager of `input.parentId`
 * Order reads are decided by mayReadOrder.
 *
 * ctx: { clientId, lastOrder: { orderId, used } | null, viewer } where `used` holds
 * the flags of the checkout mutations already run (cookie + spent log) and `viewer`
 * is the verified viewer (viewer.js), only needed for contactRegister.
 */
export function orderEditorReason(single, variables, { clientId, lastOrder = null, viewer = null } = {}) {
  if (!single) return null
  const field = single.node.name.value
  if (ORDER_EDITOR_FIELDS[single.operation]?.has(field)) {
    if (!lastOrder || lastOrder.used.includes(MUTATION_FLAG[field])) return null
    const input = inputOf(single, variables)
    if (!input || idOf(input.orderId) !== lastOrder.orderId) return null
    if (field === 'orderSetStatus') {
      if (!CHECKOUT_STATUSES.has(input.status) || !CHECKOUT_PAY_STATUSES.has(input.payStatus)) return null
    }
    return 'checkout'
  }
  if (ORDER_EDITOR_OPT_IN_FIELDS[single.operation]?.has(field) && clientId === ORDER_EDITOR_CLIENT_ID) {
    const parentId = idOf(inputOf(single, variables)?.parentId)
    return viewer?.type === 'Contact' && parentId !== null && viewer.managerOf.includes(parentId)
      ? 'contact-register'
      : null
  }
  return null
}

/**
 * The order id when the document is a quote acceptance: `orderSetStatus` with exactly
 * `{ orderId, status: NEW }` (the package QuoteActions call). The proxy elevates it only
 * for the verified viewer's own QUOTATION (isOwnQuotation).
 */
export function quoteAcceptOrderId(single, variables) {
  if (!single || single.operation !== 'mutation' || single.node.name.value !== 'orderSetStatus') return null
  const input = inputOf(single, variables)
  if (!input || input.status !== 'NEW') return null
  if (Object.keys(input).some((k) => k !== 'orderId' && k !== 'status')) return null
  return idOf(input.orderId)
}

// ── Order reads: only for their owner ──────────────────────────────────────
//
// The storefront key may answer `order` / `orders` for any id, so the proxy decides who
// reads an order: a document that selects an order-read field (graphqlGuards.js
// selectsOrderRead) runs only when it is the SDK's own document for its root field
// (isSdkDocument) and mayReadOrder authorizes it, and then goes upstream with the
// order-editor key and without the Bearer.

// sha256 of print(parse(document)) of the installed SDK's own document for each root field
// that runs on the order-editor key: the owner-checked order reads and the elevated
// mutations (checkout, quote acceptance, contactRegister). The shop sends exactly these
// (the SDK's services send their generated documents verbatim; registration pins its own
// in registrationRouting.js). The caller must not choose what the order-editor key
// selects: upstream resolves e.g. `order { company { contacts { ... } } }` or the same
// under `orderSetStatus(...)` there. The test fails after an SDK upgrade that changes
// them, until these are updated.
export const SDK_DOCUMENT_HASHES = new Map(
  Object.entries({
    order: '77fa18953b2fb00d852f3590b6f37f52e0fbe1b5fda3769666ab8bf818fa8d67',
    orders: '6d98254c16406c4bcf45c843ff50d0acf17e8205d221c52c50b75041cc387bbd',
    orderGetPDF: '0ba45ae37e76772ee44907fbcf5bc75ec0367053f5ad3859a58d65c5e27fdd2b',
    quoteGetPDF: 'b668082802f84663e95c1beab0d3d3246b52cbcac88d3b389d84ebfeb803d1e3',
    orderSetStatus: '7c84383485efcd2ea7f81d4965794ebee5284decfec084f22034b2ee0d8f4ec4',
    triggerQuoteSendRequest: '34f4860120011946647baa8b540dbc95e7cd08468523bc6aa15efae54d3189f4',
    triggerOrderSendConfirm: '379c5f6817ecd10f6bd1cd0fc6b8cae0a4730e677e5821a9406433f867a5fcd7',
    contactRegister: '7abc947729c6e1d20cb1049c380569402add63473ad54a6cb84e0fbfc2413137',
  }),
)

/** Whether the parsed document is the SDK's own document for root field `field`, unchanged. */
export function isSdkDocument(doc, field) {
  return !!doc && SDK_DOCUMENT_HASHES.has(field) && SDK_DOCUMENT_HASHES.get(field) === documentHash(doc)
}

// Reasons whose document must be the SDK's own for its root field (registration pins its
// documents in registrationRouting.js).
const PINNED_REASONS = new Set(['order-read', 'checkout', 'contact-register', 'quote-accept'])

/** Whether the document selects a checkout mutation (ORDER_EDITOR_FIELDS) anywhere, aliased or in a fragment. */
function selectsCheckoutMutation(doc) {
  let found = false
  visit(doc, {
    [Kind.FIELD](node) {
      if (!ORDER_EDITOR_FIELDS.mutation.has(node.name.value)) return undefined
      found = true
      return BREAK
    },
  })
  return found
}

/**
 * Whether the proxy must refuse a request it would forward with elevation `reason` (or
 * null): an elevated document that isn't the SDK's own for its root field (the caller
 * would choose what the order-editor key selects), and any document with a checkout
 * mutation that isn't elevated for this browser's own order or the viewer's own
 * quotation. Those never run on the storefront key instead.
 */
export function mustRefuseElevation(doc, single, reason) {
  if (PINNED_REASONS.has(reason) && !isSdkDocument(doc, single?.node.name.value)) return true
  return selectsCheckoutMutation(doc) && reason !== 'checkout' && reason !== 'quote-accept'
}

const OWNER_READ_FIELDS = new Set(['order', 'orderGetPDF', 'quoteGetPDF'])
const listOf = (value) => (value === undefined || value === null ? null : Array.isArray(value) ? value : [value])

// What the account pages list: orders (useOrders' default NEW, CONFIRMED, VALIDATED, ORDER),
// quotations and quote requests. The order-editor key skips Propeller's visibility rules,
// so a search must name these and nothing else: no DRAFT_ORDER / DRAFT_QUOTATION.
export const ORDER_LIST_STATUSES = new Set(['NEW', 'CONFIRMED', 'VALIDATED', 'ORDER', 'QUOTATION', 'REQUEST'])

/** Whether `order` (read with the order-editor key: `{ userId, ... }`) was placed by the verified viewer. */
export function isOwnOrder(order, viewer) {
  return !!viewer && idOf(order?.userId) === viewer.userId
}

// A draft (DRAFT_ORDER, DRAFT_QUOTATION, ...) is hidden from its owner too; no status, no read.
const isShownToOwner = (order) => typeof order?.status === 'string' && !order.status.startsWith('DRAFT')

/** Whether `order` (read with the order-editor key) is a QUOTATION the verified viewer placed. */
export function isOwnQuotation(order, viewer) {
  return order?.status === 'QUOTATION' && isOwnOrder(order, viewer)
}

// `orders` pinned to the viewer: userId exactly [viewer.userId] (or the bare id GraphQL
// coerces to that list), statuses only ORDER_LIST_STATUSES, companyIds, when given, only a
// contact's own companies.
function isOwnOrderSearch(input, viewer) {
  if (!isRecord(input)) return false
  const userIds = listOf(input.userId)
  if (userIds?.length !== 1 || idOf(userIds[0]) !== viewer.userId) return false
  const statuses = listOf(input.status)
  if (!statuses?.length || !statuses.every((s) => ORDER_LIST_STATUSES.has(s))) return false
  const companyIds = listOf(input.companyIds)
  if (!companyIds) return true
  return viewer.type === 'Contact' && companyIds.every((id) => viewer.companyIds.includes(idOf(id)))
}

/** 'allow', 'refuse' or `{ ownerOf: orderId }` (allowed when that order is the viewer's). */
function orderReadAccess(single, variables, viewer, lastOrderId) {
  if (single?.operation !== 'query') return 'refuse'
  const field = single.node.name.value
  if (field === 'orders') return viewer && isOwnOrderSearch(argument(single, 'input', variables), viewer) ? 'allow' : 'refuse'
  if (!OWNER_READ_FIELDS.has(field)) return 'refuse'
  // ponytail: no owner lookup by UUID, so a read by UUID is refused; the storefront reads by id.
  const uuid = argument(single, 'orderUUID', variables)
  if (uuid !== undefined && uuid !== null) return 'refuse'
  const orderId = idOf(argument(single, 'orderId', variables))
  if (!orderId) return 'refuse'
  if (viewer) return { ownerOf: orderId }
  // A guest: only the thank-you page's read of the order this browser just placed (it shows no PDF).
  return field === 'order' && orderId === lastOrderId ? 'allow' : 'refuse'
}

/**
 * Whether a document that reads an order may run. It must be a single root `order`,
 * `orderGetPDF`, `quoteGetPDF` or `orders` (aliases follow the same rules), and:
 *   - a verified viewer: `orders` with the viewer's own userId (and companies) and the
 *     account pages' statuses; the others by orderId, when the order-editor lookup shows
 *     the viewer placed it and it is no draft.
 *   - anyone else (no viewer, or a Bearer upstream did not accept): only `order` of
 *     the signed last order, by id.
 * `fetchOrder(orderId)` reads the order with the order-editor key (`{ userId, status, ... }`
 * or null); a failed lookup refuses. Anything else refuses.
 */
export async function mayReadOrder(single, variables, { viewer = null, lastOrderId = null, fetchOrder }) {
  const access = orderReadAccess(single, variables, viewer, lastOrderId)
  if (access === 'allow') return true
  if (access === 'refuse') return false
  try {
    const order = await fetchOrder(access.ownerOf)
    return isOwnOrder(order, viewer) && isShownToOwner(order)
  } catch {
    return false
  }
}

// The order-editor key alone decides these: the Bearer is not sent with them.
const WITHOUT_BEARER = new Set(['order-read', 'registration'])

/** Upstream credentials for a proxied request with this elevation reason (or null): `{ orderEditorKey, bearer }`. */
export function upstreamAuth(reason, bearer) {
  return { orderEditorKey: reason !== null, bearer: WITHOUT_BEARER.has(reason) ? undefined : bearer }
}

/** The flag a checkout mutation adds to the last-order state once it ran elevated. */
export function checkoutFlag(single) {
  return single?.operation === 'mutation' ? (MUTATION_FLAG[single.node.name.value] ?? null) : null
}

/** Signed cookie value for the last order and the checkout flags already used. */
export function signLastOrder(orderId, used = '') {
  return signCookie(LAST_ORDER_PURPOSE, used ? `${orderId}.${used}` : String(orderId), LAST_ORDER_MAX_AGE)
}

/** `{ orderId, used }` from a valid last-order cookie, else null. */
export function verifyLastOrder(cookie) {
  const value = verifyCookie(LAST_ORDER_PURPOSE, cookie)
  const match = value === null ? null : /^([1-9]\d{0,15})(?:\.([sqc]{1,3}))?$/.exec(value)
  return match ? { orderId: Number(match[1]), used: match[2] ?? '' } : null
}

/** The order id a relayed cartProcess mutation just created, if any. */
export function createdOrderId(single, json) {
  if (!single || single.operation !== 'mutation' || single.node.name.value !== 'cartProcess') return null
  const result = isRecord(json?.data) ? json.data[single.node.alias?.value ?? 'cartProcess'] : null
  return isRecord(result) && typeof result.cartOrderId === 'number' ? idOf(result.cartOrderId) : null
}

/**
 * Server-side record of the checkout mutations already run per order. The cookie's flags
 * alone can be undone by replaying an older cookie; this can't (per process, kept as long
 * as a last-order cookie lives).
 * ponytail: in-memory per process; a restart forgets it, and N instances each keep their
 * own. Move to a shared store if the shop runs several instances.
 */
export function createSpentLog({ ttlMs = LAST_ORDER_MAX_AGE * 1000, maxEntries = 10_000, now = Date.now } = {}) {
  const entries = new Map()
  return {
    flags(orderId) {
      const entry = entries.get(orderId)
      return entry && now() - entry.at <= ttlMs ? entry.flags : ''
    },
    add(orderId, flag) {
      const flags = this.flags(orderId)
      entries.delete(orderId)
      if (entries.size >= maxEntries) entries.delete(entries.keys().next().value)
      entries.set(orderId, { flags: flags.includes(flag) ? flags : flags + flag, at: now() })
    },
    /**
     * Spend `flag` unless it is spent already, in one synchronous step: false when
     * another request got there first. Call it after the request's last await,
     * right before the upstream call, so parallel requests can't all pass.
     */
    reserve(orderId, flag) {
      if (this.flags(orderId).includes(flag)) return false
      this.add(orderId, flag)
      return true
    },
    /** Undo a reservation whose upstream call failed. */
    release(orderId, flag) {
      const entry = entries.get(orderId)
      if (entry) entry.flags = entry.flags.replace(flag, '')
    },
  }
}
