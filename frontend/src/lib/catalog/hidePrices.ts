/**
 * Removes price data from catalog responses, for visitors a semi-closed or closed
 * shop must not show prices to. One implementation, shared with the /api/graphql
 * proxy in server.js, which imports it unbuilt.
 */
export {
  COST_PRICE_FIELDS,
  forVisitor,
  hidePrices,
  PRICE_FIELDS,
  pricesHidden,
  withoutCostPrices,
} from '../../server/hidePrices.js'
