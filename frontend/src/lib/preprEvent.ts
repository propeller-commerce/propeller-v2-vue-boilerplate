/**
 * True when Prepr is the active CMS on the CLIENT. Gates all Prepr client-side
 * wiring (tracking events, PreprTrack, segments sync, preview bar). `server.js`
 * gates the server side separately on `CMS_PROVIDER`. Keep `VITE_CMS_PROVIDER`
 * in sync with `CMS_PROVIDER`. Inlined at build time, so on a non-Prepr build
 * these gates fold to `false` and the wiring is dead-code-eliminated.
 */
export const PREPR_ENABLED =
  ((import.meta.env.VITE_CMS_PROVIDER as string | undefined) || '').trim().toLowerCase() === 'prepr'

/**
 * Fire a Prepr data-collection event through the tracking pixel (`window.prepr`,
 * initialised in the app root).
 *
 * Used for CONVERSION events (e.g. QuoteRequest, AddToCart). Prepr correlates
 * these to the adaptive-content variants the visitor was shown (via the shared
 * `__prepr_uid` / Prepr-Customer-Id), so they appear as conversions on the
 * personalized components. No-ops when Prepr isn't the CMS, on the server,
 * before the pixel has initialised, or on any error.
 */
export function trackPreprEvent(event: string, props?: Record<string, unknown>): void {
  if (!PREPR_ENABLED) return
  try {
    if (typeof window === 'undefined') return
    const prepr = (window as unknown as { prepr?: (...args: unknown[]) => void }).prepr
    if (typeof prepr !== 'function') return
    if (props) prepr('event', event, props)
    else prepr('event', event)
  } catch {
    /* ignore — analytics must not affect the user flow */
  }
}
