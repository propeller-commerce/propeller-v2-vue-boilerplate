import { ProductSortField, SortOrder } from '@propeller-commerce/propeller-sdk-v2'

const SORT_FIELDS = new Set<string>(Object.values(ProductSortField))
const SORT_ORDERS = new Set<string>(Object.values(SortOrder))

/** The listing options that decide what is asked upstream about prices and sorting. */
export interface ListingQueryOptions {
  sortField?: ProductSortField
  sortOrder?: SortOrder
  priceFilterMin?: number
  priceFilterMax?: number
}

/**
 * The listing options a viewer may send upstream (the SSR category and search
 * fetchers apply this before building the query and its cache key). Sort field
 * and order only from their enums; anything else is dropped, so the fetcher's
 * default applies. For a viewer who may not see prices (a semi-closed or closed
 * shop's guest): no price range and no PRICE sort. The response strip keeps
 * `itemsFound`, so either would let a guest narrow a product down to its exact
 * price (#4).
 */
export function listingOptionsFor<T extends ListingQueryOptions>(opts: T, pricesHiddenForViewer: boolean): T {
  const out: T = { ...opts }
  if (!SORT_FIELDS.has(String(opts.sortField)) || (pricesHiddenForViewer && opts.sortField === ProductSortField.PRICE)) {
    delete out.sortField
  }
  if (!SORT_ORDERS.has(String(opts.sortOrder))) delete out.sortOrder
  if (pricesHiddenForViewer) {
    delete out.priceFilterMin
    delete out.priceFilterMax
  }
  return out
}
