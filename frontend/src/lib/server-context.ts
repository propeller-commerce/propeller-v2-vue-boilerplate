/**
 * Per-request server context — the small bundle of request-scoped data the
 * Node SSR server hands to `render()`, which then makes it reachable from
 * route loaders and components via `inject('ssrContext')`.
 *
 * Kept in its own module (no Vue, no `server-only` import) so both the server
 * entry and the data seam (`src/lib/server.ts`) can import the type without a
 * dependency cycle.
 */
export interface SSRContext {
  /** Raw `Cookie` header value of the incoming request, or '' if none. */
  cookieHeader: string
  /** Parsed cookies, name → value. */
  cookies: Record<string, string>
  /** Request URL path + query (what the router was pushed with). */
  url: string
  /**
   * HTTP status a route loader wants the server to send, overriding the
   * default (200 for a matched route). A loader sets this to 404 when the
   * matched route can't find its content — e.g. the CMS catch-all resolving
   * to a page that doesn't exist — so the render still produces the branded
   * body but the response carries the right status (SEO: deindex dead URLs).
   */
  status?: number
}

/** Parse a `Cookie` header into a plain name→value map. */
export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const name = part.slice(0, idx).trim()
    const value = part.slice(idx + 1).trim()
    if (name) out[name] = decodeURIComponent(value)
  }
  return out
}
