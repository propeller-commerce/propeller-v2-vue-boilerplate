/**
 * Listing-page URL query-param parsing — shared by the category and search
 * views (SSR + CSR variants). Extracted from the four views that each carried
 * an identical copy of this logic, so the fix below lives in one place.
 *
 * URL encoding contract (matches the rest of the app):
 *   - Attribute filters: `?BRAND=["acme","globex"]` — the value is a
 *     JSON.stringify'd string array.
 *   - Reserved keys: `page`, `minPrice`, `maxPrice`, `offset`, `sortField`,
 *     `sortOrder` — handled explicitly, never a filter.
 */

import { ProductSortField, SortOrder } from '@propeller-commerce/propeller-sdk-v2';

/** Reserved query keys — handled explicitly, never treated as a filter. */
export const RESERVED_QUERY_KEYS = [
  'page',
  'minPrice',
  'maxPrice',
  'offset',
  'sortField',
  'sortOrder',
] as const;

/**
 * Marketing / tracking query params that ad, email and social platforms append
 * to landing URLs. They are NOT facet filters and must be ignored, or the
 * listing filters on a non-existent attribute and returns zero products (every
 * paid/email/social click would land on an empty page). Matched by exact key or
 * by the `utm_` prefix. This is a defensive belt on top of the structural check
 * in parseFiltersFromQuery (a real facet value is always a JSON array); either
 * alone fixes the bug.
 */
const TRACKING_KEYS = new Set([
  'gclid', // Google Ads auto-tagging
  'fbclid', // Facebook / Meta
  'msclkid', // Microsoft Ads
  'mc_cid', // Mailchimp campaign id
  'mc_eid', // Mailchimp recipient id
]);

function isTrackingKey(key: string): boolean {
  return TRACKING_KEYS.has(key) || key.toLowerCase().startsWith('utm_');
}

/**
 * Parse a route query into the `{ [attributeName]: selectedValues }` filter map.
 * Ignores reserved keys, tracking params, and any param whose value is not a
 * JSON-stringified array (i.e. not produced by this app's own filter encoding).
 */
export function parseFiltersFromQuery(
  query: Record<string, any>,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(query)) {
    if ((RESERVED_QUERY_KEYS as readonly string[]).includes(key)) continue;
    // Ignore marketing/tracking params (gclid, utm_*, fbclid, …). Without this
    // an ad/email/social click filtered on a bogus attribute → zero products.
    if (isTrackingKey(key)) continue;
    const raw = Array.isArray(value) ? value[0] : value;
    if (typeof raw !== 'string') continue;
    // A real facet param's value is ALWAYS a JSON-stringified string array —
    // that is how the app encodes filters. Anything that doesn't parse to an
    // array wasn't produced by this app (a stray/unknown param), so drop it
    // rather than manufacture a filter that matches nothing. This is the core
    // fix: the old `catch { result[key] = [raw] }` turned every unknown scalar
    // param into an empty-listing filter.
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!Array.isArray(parsed)) continue;
    const values = parsed.map(String).filter((v) => v.length > 0);
    if (values.length > 0) result[key] = values;
  }
  return result;
}

/** The parsed, typed listing state derived from a route query. */
export interface ListingParams {
  page: number;
  offset: number;
  sortField: ProductSortField;
  sortOrder: SortOrder;
  minPrice: number | undefined;
  maxPrice: number | undefined;
  filters: Record<string, string[]>;
}

/** Read a single scalar query value (first occurrence), or undefined when empty. */
function readScalarQuery(query: Record<string, any>, key: string): string | undefined {
  const v = query[key];
  const raw = Array.isArray(v) ? v[0] : v;
  return typeof raw === 'string' && raw !== '' ? raw : undefined;
}

/**
 * Parse a route query into typed listing state — the fuller sibling of
 * `parseFiltersFromQuery`, adding page/offset/sort/price. Mirrors
 * propeller-next/lib/listingParams.ts so the machines view URL shape matches.
 */
export function parseListingParams(
  query: Record<string, any>,
  defaultSortField: ProductSortField,
): ListingParams {
  const filters = parseFiltersFromQuery(query);
  const minRaw = readScalarQuery(query, 'minPrice');
  const maxRaw = readScalarQuery(query, 'maxPrice');
  return {
    page: Math.max(1, parseInt(readScalarQuery(query, 'page') || '1', 10) || 1),
    offset: parseInt(readScalarQuery(query, 'offset') || '12', 10) || 12,
    sortField: (readScalarQuery(query, 'sortField') as ProductSortField) || defaultSortField,
    sortOrder: (readScalarQuery(query, 'sortOrder') as SortOrder) || SortOrder.DESC,
    minPrice: minRaw ? parseFloat(minRaw) : undefined,
    maxPrice: maxRaw ? parseFloat(maxRaw) : undefined,
    filters,
  };
}

/**
 * Encode listing state back into a URL query string — the inverse of
 * `parseListingParams`, omitting anything at its default so URLs stay clean.
 * Accepts the widened `sortField`/`sortOrder` string unions so both
 * `ListingParams` (category) and `MachineListingState` (machines) can be encoded.
 */
export function buildListingSearchParams(
  listing: {
    page: number;
    offset: number;
    sortField: ProductSortField | string;
    sortOrder: SortOrder | string;
    filters: Record<string, string[]>;
    minPrice?: number;
    maxPrice?: number;
    term?: string;
  },
  opts: {
    defaultSortField: ProductSortField | string;
    defaultSortOrder?: SortOrder | string;
    defaultOffset?: number;
  },
): string {
  const { defaultSortField, defaultSortOrder = SortOrder.DESC, defaultOffset = 12 } = opts;
  const sp = new URLSearchParams();
  if (listing.page > 1) sp.set('page', String(listing.page));
  for (const [key, values] of Object.entries(listing.filters)) {
    if (values.length > 0) sp.set(key, JSON.stringify(values));
  }
  if (listing.minPrice !== undefined) sp.set('minPrice', String(listing.minPrice));
  if (listing.maxPrice !== undefined) sp.set('maxPrice', String(listing.maxPrice));
  if (listing.offset !== defaultOffset) sp.set('offset', String(listing.offset));
  if (listing.sortField !== defaultSortField) sp.set('sortField', String(listing.sortField));
  if (listing.sortOrder !== defaultSortOrder) sp.set('sortOrder', String(listing.sortOrder));
  if (listing.term) sp.set('term', listing.term);
  return sp.toString();
}
