import { BREAK, Kind, parse, visit } from 'graphql'
import { COST_PRICE_FIELDS } from './hidePrices.js'

/**
 * One parse per proxied document, shared by every guard (#17).
 */

// The SDK's largest document is ~2,500 tokens (graphqlGuards.test.js parses them all).
export const MAX_TOKENS = 20_000

/** The parsed document, or null when `query` isn't a string or doesn't parse. */
export function parseDocument(query) {
  if (typeof query !== 'string') return null
  try {
    return parse(query, { noLocation: true, maxTokens: MAX_TOKENS })
  } catch {
    return null
  }
}

/**
 * The only alias (`alias:field`) the SDK's own documents use; graphqlGuards.test.js
 * checks every SDK document against this list.
 */
export const SDK_ALIASES = new Set(['urlId:categoryId'])
// SDK_ALIASES plus vue-ui's machines query (`machine_<n>: machine(...)`).
const isOwnAlias = (alias, field) =>
  SDK_ALIASES.has(`${alias}:${field}`) || (field === 'machine' && /^machine_\d{1,3}$/.test(alias))

const DISCOUNT_TYPES = new Set(['IDiscount', 'BulkCostPrice', 'BulkPrice', 'Discount'])

/**
 * What the proxy refuses or treats specially, from one visit:
 * - `introspection`: `__schema` / `__type` anywhere (`__typename` is fine). The
 *   storefront never inspects the schema (#13).
 * - `foreignAlias`: any alias the SDK doesn't use. hidePrices works on response
 *   keys, so an alias can move a price to a key it keeps (`p: price`,
 *   `priceData { per: list }`, `priceData: products { per: items { … } }`) (#4).
 * - `costPriceAlias`: an alias on a cost-price field or `discount`, or on any field inside
 *   a discount record. withoutCostPrices works by response key, so an alias could carry a
 *   cost past it, for anyone.
 * - `inlinePriceFilter`: a price filter or PRICE sort written into the document
 *   instead of the variables: `price: {…}` or `price: $v` inside an input object,
 *   a `PRICE` enum literal, or a sort `field: $v`. Counting results per price range
 *   gives the exact price (#4). The SDK always passes these as variables, which the
 *   proxy strips instead (see withoutPriceFilters).
 */
export function inspectDocument(doc) {
  const result = { introspection: false, foreignAlias: false, costPriceAlias: false, inlinePriceFilter: false }
  let inDiscount = 0
  let discountFragment = false
  visit(doc, {
    [Kind.FIELD]: {
      enter(node) {
        const name = node.name.value
        if (name === '__schema' || name === '__type') result.introspection = true
        if (node.alias && !isOwnAlias(node.alias.value, name)) result.foreignAlias = true
        if (node.alias && (COST_PRICE_FIELDS.has(name) || name === 'discount' || inDiscount || discountFragment)) {
          result.costPriceAlias = true
        }
        if (name === 'discount') inDiscount++
      },
      leave(node) {
        if (node.name.value === 'discount') inDiscount--
      },
    },
    [Kind.FRAGMENT_DEFINITION]: {
      enter(node) {
        discountFragment = DISCOUNT_TYPES.has(node.typeCondition.name.value)
      },
      leave() {
        discountFragment = false
      },
    },
    [Kind.OBJECT_FIELD](node) {
      const name = node.name.value
      const kind = node.value.kind
      if (name === 'price' && (kind === Kind.OBJECT || kind === Kind.VARIABLE)) result.inlinePriceFilter = true
      if (name === 'field' && kind === Kind.VARIABLE) result.inlinePriceFilter = true
    },
    [Kind.ENUM](node) {
      if (node.value === 'PRICE') result.inlinePriceFilter = true
    },
  })
  return result
}

const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value)
const isPriceFilter = (key, value) => key === 'price' && isRecord(value)
const isPriceSort = (value) => isRecord(value) && value.field === 'PRICE'

/** Whether variables carry a price filter (`price: { from, to }`) or a sort on PRICE, at any depth. */
export function hasPriceFilter(value) {
  if (Array.isArray(value)) return value.some((v) => isPriceSort(v) || hasPriceFilter(v))
  if (!isRecord(value)) return false
  return Object.entries(value).some(([k, v]) => isPriceFilter(k, v) || isPriceSort(v) || hasPriceFilter(v))
}

/** A copy of variables without price filters and PRICE sorts, for viewers who may not see prices. */
export function withoutPriceFilters(value) {
  if (Array.isArray(value)) return value.filter((v) => !isPriceSort(v)).map(withoutPriceFilters)
  if (!isRecord(value)) return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([k, v]) => !isPriceFilter(k, v) && !isPriceSort(v))
      .map(([k, v]) => [k, withoutPriceFilters(v)]),
  )
}

/**
 * Query fields that read orders or an order's data: the order and its search, its
 * PDFs, revisions, tender, addresses, shipments and payments (upstream schema,
 * checked 2026-11-19; the storefront key answers these for any order). Only the
 * SDK's own `order`, `orders`, `orderGetPDF` and `quoteGetPDF` documents are served,
 * to the order's owner (orderEditorRouting.js mayReadOrder); the others are refused
 * for everyone, at any depth and under any alias. Never cached. Nothing in the shop
 * sends the refused ones (`Order.shipments` inside the SDK's order document is part of
 * the pinned read).
 */
export const ORDER_READ_FIELDS = new Set([
  'order',
  'orders',
  'orderGetPDF',
  'quoteGetPDF',
  'orderRevision',
  'orderRevisions',
  'tender',
  'orderAddress',
  'orderAddresses',
  'addressesByOrderId',
  'shipment',
  'shipments',
  'shipmentItem',
  'shipmentItems',
  'payment',
  'payments',
])

/**
 * Whether the document reads an order: an ORDER_READ_FIELDS field anywhere (any
 * depth, aliased, in a fragment) of a document that is not all mutations. The
 * checkout's own `cartProcess { order }` is a mutation and stays out.
 */
export function selectsOrderRead(doc) {
  const ops = doc.definitions.filter((d) => d.kind === Kind.OPERATION_DEFINITION)
  if (ops.every((op) => op.operation === 'mutation')) return false
  let found = false
  visit(doc, {
    [Kind.FIELD](node) {
      if (!ORDER_READ_FIELDS.has(node.name.value)) return undefined
      found = true
      return BREAK
    },
  })
  return found
}

/**
 * Whether an anonymous response to this document may be cached: queries only
 * (every operation in the document), never `viewer`, the account query, and never
 * an order read.
 */
export function isCacheableQuery(doc) {
  const ops = doc.definitions.filter((d) => d.kind === Kind.OPERATION_DEFINITION)
  return (
    ops.length > 0 &&
    ops.every((op) => op.operation === 'query') &&
    !ops.some((op) => op.selectionSet.selections.some((s) => s.kind === Kind.FIELD && s.name.value === 'viewer')) &&
    !selectsOrderRead(doc)
  )
}
