/**
 * Server-side MultiSafepay provider wiring (Node / Express).
 *
 * The Vue mirror of `propeller-next/lib/msp.ts` and the MultiSafepay sibling of
 * `src/server/mollie.js`. Hosts a single `MspProvider` for the app's payment
 * flow. The wiring is application-specific: we build the Propeller SDK client
 * from propeller-vue's server env contract (the same `direct`-mode client used
 * by `src/lib/server.ts` for SSR, with the order-editor key the webhook needs)
 * and read the MultiSafepay keys + mode from env.
 *
 * Authored as plain `.js` ESM so `server.js` can `import` it directly — unlike
 * `src/*.ts` modules, `server.js`'s own static imports are NOT run through
 * Vite's transform, so they can't use TypeScript or `import.meta.env`.
 *
 * Used by the three `/api/msp/*` Express routes in `server.js`:
 *   - create-payment  — start a payment at checkout.
 *   - payment-status  — live status lookup for the return page (read-only).
 *   - webhook         — reconcile order/payment state from MultiSafepay.
 *
 * `isOnAccountMethod` is provider-agnostic and lives in `./mollie.js`; the MSP
 * create-payment route reuses that export rather than duplicating it.
 *
 * Server-only. Never imported by a client component.
 */

import { MspProvider } from '@propeller-commerce/propeller-v2-msp'
import { GraphQLClient } from '@propeller-commerce/propeller-sdk-v2'

/**
 * Mutations the backend gates behind the order-editor API key. In `direct` mode
 * the SDK routes these to `orderEditorApiKey` instead of `apiKey`.
 *
 * The SDK's built-in list (orderSetStatus, passwordResetLink,
 * triggerQuoteSendRequest, triggerOrderSendConfirm) does NOT include the payment
 * mutations, but our backend requires the order-editor key for them too —
 * otherwise `paymentCreate`/`paymentUpdate` 403 with "Forbidden resource".
 * `orderEditorMutations` REPLACES the default list, so we include the defaults
 * plus the payment mutations.
 */
const MSP_ORDER_EDITOR_MUTATIONS = [
  // SDK defaults (must be repeated — this option replaces, not extends):
  'orderSetStatus',
  'passwordResetLink',
  'triggerQuoteSendRequest',
  'triggerOrderSendConfirm',
  // Payment mutations the MultiSafepay flow issues, gated the same way:
  'paymentCreate',
  'paymentUpdate',
]

/**
 * Build the Propeller SDK client the MultiSafepay flow uses. Server-to-server
 * (`direct` mode) with the order-editor key — and with the payment mutations
 * added to the order-editor set so they authenticate with that key. No bearer
 * token: these run as the server, not a logged-in user.
 *
 * Reads the same `SSR_*` vars `server.js` uses for its proxy keys, falling back
 * to the legacy `VITE_*` names so an unchanged `.env` still works.
 */
function createMspGraphqlClient() {
  return new GraphQLClient({
    endpoint:
      process.env.SSR_GRAPHQL_ENDPOINT ||
      process.env.VITE_GRAPHQL_PROXY_TARGET ||
      '',
    apiKey: process.env.SSR_API_KEY || process.env.VITE_API_KEY || '',
    orderEditorApiKey:
      process.env.SSR_ORDER_EDITOR_API_KEY ||
      process.env.VITE_ORDER_EDITOR_API_KEY ||
      '',
    securityMode: 'direct',
    timeout: 30000,
    orderEditorMutations: MSP_ORDER_EDITOR_MUTATIONS,
  })
}

/**
 * Whether MultiSafepay is the active payment provider. Gated so a shop without
 * MSP keys keeps the previous "place order → straight to thank-you" behaviour.
 * Set `PAYMENT_PROVIDER=multisafepay` (server) to turn it on. Only one PSP is
 * active at a time (this and `isMollieEnabled` are mutually exclusive).
 */
export function isMspEnabled() {
  return (
    (process.env.PAYMENT_PROVIDER || '').trim().toLowerCase() === 'multisafepay'
  )
}

/** Public origin of this site, used to build the webhook URL. */
function siteOrigin() {
  return (process.env.VITE_SITE_URL || '').replace(/\/$/, '')
}

/**
 * Absolute URL MultiSafepay POSTs notifications to. Must be publicly reachable
 * over HTTPS (MultiSafepay can't reach localhost/LAN IPs).
 *
 * Prefers an explicit `MSP_WEBHOOK_URL` override so the webhook can point at a
 * tunnel (cloudflared / ngrok) while the shopper-facing redirect stays on the
 * normal `VITE_SITE_URL`. If the override is just an origin (no path), append
 * `/api/msp/webhook`; if it already includes the path, use it as-is. Falls back
 * to `VITE_SITE_URL` + the route path.
 */
export function mspWebhookUrl() {
  const override = (process.env.MSP_WEBHOOK_URL || '').trim()
  if (override) {
    return /\/api\/msp\/webhook\/?$/.test(override)
      ? override
      : `${override.replace(/\/$/, '')}/api/msp/webhook`
  }
  return `${siteOrigin()}/api/msp/webhook`
}

let _provider = null

/**
 * The shared `MspProvider`. A module-level singleton is fine — one server
 * process, and the client is a thin HTTP wrapper. Its mutations run with the
 * server `SSR_API_KEY` / `…_ORDER_EDITOR_API_KEY`, so no bearer token.
 *
 * Caller should guard with `isMspEnabled()` first.
 */
export function getMspProvider() {
  if (_provider) return _provider
  const liveApiKey = process.env.MSP_LIVE_KEY || ''
  const testApiKey = process.env.MSP_TEST_KEY || ''
  const testMode =
    (process.env.MSP_TEST_MODE || 'true').trim().toLowerCase() === 'true'
  const locale = (process.env.MSP_LOCALE || '').trim()

  _provider = new MspProvider(
    { liveApiKey, testApiKey, testMode, ...(locale ? { locale } : {}) },
    {
      // `direct`-mode client whose order-editor set includes
      // paymentCreate/paymentUpdate, so all of MultiSafepay's mutations use the
      // order-editor key.
      client: createMspGraphqlClient(),
      webhookUrl: mspWebhookUrl(),
    },
  )
  return _provider
}
