/**
 * Serialize/deserialize the OrderList filter form to and from URL query params,
 * so a filtered order/quote view can be bookmarked, shared, and restored on
 * reload (and the back button works) — mirroring how the PLP persists its
 * filters. Kept app-side: the package component is router-agnostic and only
 * exposes `initialSearchForm` (seed) + `onSearchApply` (change) seams.
 *
 * URL shape (all optional): ?term=foo&dateFrom=2026-01-01&dateTo=2026-03-31&priceMin=500&priceMax=1000
 */

/** The subset of OrderList's search form these pages expose as filters. */
export interface OrderFilterForm {
  term?: string
  createdAt?: { greaterThan?: string; lessThan?: string }
  price?: { greaterThan?: number; lessThan?: number }
}

/** A route query object (Vue Router's `route.query`) or URLSearchParams. */
type QuerySource = URLSearchParams | Record<string, unknown>

function readParam(source: QuerySource, key: string): string | undefined {
  if (source instanceof URLSearchParams) {
    return source.get(key) ?? undefined
  }
  const raw = source[key]
  if (Array.isArray(raw)) return typeof raw[0] === 'string' ? raw[0] : undefined
  return typeof raw === 'string' ? raw : undefined
}

/** Read the filter form from a route query (or URLSearchParams). */
export function orderFilterFromQuery(source: QuerySource): OrderFilterForm {
  const form: OrderFilterForm = {}

  const term = readParam(source, 'term')
  if (term) form.term = term

  const dateFrom = readParam(source, 'dateFrom')
  const dateTo = readParam(source, 'dateTo')
  if (dateFrom || dateTo) {
    form.createdAt = {
      ...(dateFrom && { greaterThan: `${dateFrom}T00:00:00Z` }),
      ...(dateTo && { lessThan: `${dateTo}T23:59:59Z` }),
    }
  }

  const priceMin = readParam(source, 'priceMin')
  const priceMax = readParam(source, 'priceMax')
  if (priceMin || priceMax) {
    const min = priceMin !== undefined ? Number.parseFloat(priceMin) : NaN
    const max = priceMax !== undefined ? Number.parseFloat(priceMax) : NaN
    form.price = {
      ...(Number.isFinite(min) && { greaterThan: min }),
      ...(Number.isFinite(max) && { lessThan: max }),
    }
  }

  return form
}

/** Serialize the filter form to a plain query object for `router.replace`. */
export function orderFilterToQuery(form: OrderFilterForm): Record<string, string> {
  const query: Record<string, string> = {}

  if (form.term) query.term = form.term

  // Dates are stored as full ISO instants internally; expose the date part.
  const from = form.createdAt?.greaterThan
  const to = form.createdAt?.lessThan
  if (from) query.dateFrom = String(from).split('T')[0]
  if (to) query.dateTo = String(to).split('T')[0]

  const min = form.price?.greaterThan
  const max = form.price?.lessThan
  if (min !== undefined && Number.isFinite(min)) query.priceMin = String(min)
  if (max !== undefined && Number.isFinite(max)) query.priceMax = String(max)

  return query
}
