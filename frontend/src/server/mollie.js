/**
 * Server-side Mollie provider wiring (Node / Express).
 *
 * The Vue mirror of `propeller-next/lib/mollie.ts`. Hosts a single
 * `MollieProvider` for the app's payment flow. The wiring is
 * application-specific: we build the Propeller SDK client from propeller-vue's
 * server env contract (the same `direct`-mode client used by `src/lib/server.ts`
 * for SSR, with the order-editor key the webhook needs) and read the Mollie keys
 * + mode from env.
 *
 * Authored as plain `.js` ESM so `server.js` can `import` it directly — unlike
 * `src/*.ts` modules, `server.js`'s own static imports are NOT run through
 * Vite's transform, so they can't use TypeScript or `import.meta.env`.
 *
 * Used by the three `/api/mollie/*` Express routes in `server.js`:
 *   - create-payment  — start a payment at checkout.
 *   - payment-status  — live status lookup for the return page (read-only).
 *   - webhook         — reconcile order/payment state from Mollie.
 *
 * Server-only. Never imported by a client component.
 */

import { MollieProvider } from '@propeller-commerce/propeller-v2-mollie'
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
const MOLLIE_ORDER_EDITOR_MUTATIONS = [
  // SDK defaults (must be repeated — this option replaces, not extends):
  'orderSetStatus',
  'passwordResetLink',
  'triggerQuoteSendRequest',
  'triggerOrderSendConfirm',
  // Payment mutations the Mollie flow issues, gated the same way:
  'paymentCreate',
  'paymentUpdate',
]

/**
 * Build the Propeller SDK client the Mollie flow uses. Server-to-server
 * (`direct` mode) with the order-editor key — and with the payment mutations
 * added to the order-editor set so they authenticate with that key. No bearer
 * token: these run as the server, not a logged-in user.
 *
 * Reads the same `SSR_*` vars `server.js` uses for its proxy keys, falling back
 * to the legacy `VITE_*` names so an unchanged `.env` still works.
 */
function createMollieGraphqlClient() {
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
    orderEditorMutations: MOLLIE_ORDER_EDITOR_MUTATIONS,
  })
}

/**
 * Whether Mollie is the active payment provider. Gated so a shop without Mollie
 * keys keeps the previous "place order → straight to thank-you" behaviour. Set
 * `PAYMENT_PROVIDER=mollie` (server) to turn it on.
 */
export function isMollieEnabled() {
  return (process.env.PAYMENT_PROVIDER || '').trim().toLowerCase() === 'mollie'
}

/** Public origin of this site, used to build the webhook URL. */
function siteOrigin() {
  return (process.env.VITE_SITE_URL || '').replace(/\/$/, '')
}

/**
 * Absolute URL Mollie POSTs webhooks to. Must be publicly reachable over HTTPS
 * (Mollie can't reach localhost/LAN IPs).
 *
 * Prefers an explicit `MOLLIE_WEBHOOK_URL` override so the webhook can point at a
 * tunnel (ngrok / cloudflared) while the shopper-facing redirect stays on the
 * normal `VITE_SITE_URL`. If the override is just an origin (no path), append
 * `/api/mollie/webhook`; if it already includes the path, use it as-is. Falls
 * back to `VITE_SITE_URL` + the route path.
 */
export function mollieWebhookUrl() {
  const override = (process.env.MOLLIE_WEBHOOK_URL || '').trim()
  if (override) {
    return /\/api\/mollie\/webhook\/?$/.test(override)
      ? override
      : `${override.replace(/\/$/, '')}/api/mollie/webhook`
  }
  return `${siteOrigin()}/api/mollie/webhook`
}

/**
 * Whether a payment-method code settles "on account" (no PSP). Server-side
 * mirror of `src/lib/payments.ts` (which is client-only). Reads
 * `ON_ACCOUNT_PAYMENTS`; defaults to `REKENING,ON_ACCOUNT`. Used as a
 * defense-in-depth guard in the create-payment route.
 */
export function isOnAccountMethod(method) {
  if (!method) return false
  const raw = process.env.ON_ACCOUNT_PAYMENTS || ''
  const list = raw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
  const codes = list.length > 0 ? list : ['REKENING', 'ON_ACCOUNT']
  return codes.includes(method.trim().toUpperCase())
}

let _provider = null

/**
 * The shared `MollieProvider`. A module-level singleton is fine — one server
 * process, and the client is a thin HTTP wrapper. Its mutations run with the
 * server `SSR_API_KEY` / `…_ORDER_EDITOR_API_KEY`, so no bearer token.
 *
 * Caller should guard with `isMollieEnabled()` first.
 */
export function getMollieProvider() {
  if (_provider) return _provider
  const liveApiKey = process.env.MOLLIE_LIVE_KEY || ''
  const testApiKey = process.env.MOLLIE_TEST_KEY || ''
  const testMode =
    (process.env.MOLLIE_TEST_MODE || 'true').trim().toLowerCase() === 'true'

  _provider = new MollieProvider(
    { liveApiKey, testApiKey, testMode },
    {
      // `direct`-mode client whose order-editor set includes
      // paymentCreate/paymentUpdate, so all of Mollie's mutations use the
      // order-editor key.
      client: createMollieGraphqlClient(),
      webhookUrl: mollieWebhookUrl(),
    },
  )
  return _provider
}
