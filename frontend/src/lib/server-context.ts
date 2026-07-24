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
  /**
   * Prepr personalization headers the server (`server.js`) resolved for this
   * request and forwarded onto the context (Prepr-Customer-Id, Prepr-Segments,
   * Prepr-Visitor-IP, Prepr-Context-*, Prepr-ABTesting). CMS loaders pass these
   * to the provider as `extraHeaders` so personalized/preview content resolves
   * server-side. Empty on non-Prepr providers. Lowercased header names.
   */
  preprHeaders?: Record<string, string>
  /**
   * Cookies a loader / the server wants set on the RESPONSE (the read side is
   * `cookies` above). `server.js`'s `*all` handler applies these via
   * `res.cookie(...)` before sending the HTML. Used to persist a freshly-minted
   * `__prepr_uid` visitor id so the tracking pixel and future renders share it.
   */
  responseCookies?: ResponseCookie[]
}

/** A cookie to set on the SSR response. */
export interface ResponseCookie {
  name: string
  value: string
  options?: {
    path?: string
    maxAge?: number
    sameSite?: 'lax' | 'strict' | 'none'
    httpOnly?: boolean
    secure?: boolean
  }
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
