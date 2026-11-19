/**
 * Removes price data from GraphQL responses, for visitors a semi-closed or closed
 * shop must not show prices to. Used by the SSR data layer (src/lib/server.ts, via
 * src/lib/catalog/hidePrices.ts) and by the /api/graphql proxy in server.js, so
 * prices never reach the page or the browser's network tab.
 *
 * Plain JS so server.js can import it without a build step.
 */

const NULLED = new Set([
  'price',
  'minPrice',
  'maxPrice',
  // Cart and order amounts.
  'priceNet',
  'priceTotal',
  'priceTotalNet',
  'totalPrice',
  'totalPriceNet',
  'customerPrice',
  'originalPrice',
  'originalGross',
  'originalNet',
  'costPrice',
  'sum',
  'sumNet',
  'totalSum',
  'totalSumNet',
  'subTotal',
  'subTotalNet',
  'totalNet',
  'totalGross',
  'gross',
  'net',
  'tax',
  'discount',
  'discountNet',
  'discountValue',
  // Search results, discounts, margins and costs (checked against the SDK types in hidePrices.test.ts).
  'effectivePrice',
  'discountGross',
  'discountPercentage',
  'discountPercentageSum',
  'customerDiscountPercentage',
  'totalDiscountPercentage',
  'totalDiscountPercentageSum',
  'subTotalGross',
  'totalTax',
  'shippingCost',
  'marginAmount',
  'marginPercentage',
  'saleMarginAmount',
  'saleMarginAmountSum',
  'saleMarginPercentage',
  'saleMarginPercentageSum',
  'attributedSaleDiscount',
  'attributedSaleDiscountSum',
  'attributedSaleMargin',
  'attributedSaleMarginSum',
])
// Amounts when numeric (tax levels, payments); `total` is also the cart totals object, which is recursed into.
const NULLED_IF_NUMBER = new Set(['total', 'amount', 'cost'])
const EMPTIED = new Set(['bulkPrices', 'surcharges', 'costPrices'])
/** Every response key hidePrices clears; an alias on one of these fields would get around it. */
export const PRICE_FIELDS = new Set([...NULLED, ...NULLED_IF_NUMBER, ...EMPTIED, 'priceData'])
// priceData keys that only configure display, not amounts: enums (strings) and `per` (a
// scalar). Kept only in that shape, so an alias can't park an amount or a whole object
// under one of these names (#4).
const PRICE_DATA_ENUMS = new Set(['display', 'bulkPriceDiscountType', 'defaultTaxCode'])

function keptPriceData(priceData) {
  if (Array.isArray(priceData)) return null
  const out = {}
  for (const [key, child] of Object.entries(priceData)) {
    const scalar = child === null || typeof child === 'string' || (key === 'per' && typeof child === 'number')
    if ((key === 'per' || PRICE_DATA_ENUMS.has(key)) && scalar) out[key] = child
  }
  return out
}

function strip(value) {
  if (Array.isArray(value)) return value.map(strip)
  if (!value || typeof value !== 'object') return value
  const out = {}
  for (const [key, child] of Object.entries(value)) {
    if (NULLED.has(key) || (NULLED_IF_NUMBER.has(key) && typeof child === 'number')) out[key] = null
    else if (EMPTIED.has(key)) out[key] = []
    else if (key === 'priceData' && child && typeof child === 'object') out[key] = keptPriceData(child)
    else out[key] = strip(child)
  }
  return out
}

/** A copy of `data` with every price field cleared. */
export function hidePrices(data) {
  return strip(data)
}

/**
 * The merchant's cost price: never for a visitor or buyer, signed in or not, in any portal
 * mode. The storefront key answers them, and the SDK's product, listing, cart and order
 * documents select them; nothing in the shop displays them. `cost` is ProductPrice.cost
 * (`price.cost`, `bulkPrices[].cost`): the same number as `costPrices[0].value` for every
 * product checked, and the only field of that name in the schema (2026-11-19).
 */
export const COST_PRICE_FIELDS = new Set(['costPrice', 'costPrices', 'cost'])

/** A copy of `data` without any COST_PRICE_FIELDS key, at any depth. */
export function withoutCostPrices(data) {
  if (Array.isArray(data)) return data.map(withoutCostPrices)
  if (!data || typeof data !== 'object') return data
  return Object.fromEntries(
    Object.entries(data)
      .filter(([key]) => !COST_PRICE_FIELDS.has(key))
      .map(([key, child]) => [key, withoutCostPrices(child)]),
  )
}

/**
 * What a visitor may get from a Propeller answer, for the /api/graphql proxy and the SSR
 * fetchers alike: never the cost price; no prices at all when `pricesHiddenFromViewer`
 * (pricesHidden).
 */
export function forVisitor(data, pricesHiddenFromViewer) {
  const out = withoutCostPrices(data)
  return pricesHiddenFromViewer ? hidePrices(out) : out
}

/**
 * Whether prices are hidden from this viewer: in a `semi-closed` or `closed` shop,
 * from anyone who isn't a signed-in Contact or Customer. `open` shops show prices.
 */
export function pricesHidden(portalMode, signedIn) {
  const mode = String(portalMode ?? '').trim().toLowerCase()
  return (mode === 'semi-closed' || mode === 'semiclosed' || mode === 'closed') && !signedIn
}
