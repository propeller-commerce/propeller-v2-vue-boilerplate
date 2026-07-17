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
