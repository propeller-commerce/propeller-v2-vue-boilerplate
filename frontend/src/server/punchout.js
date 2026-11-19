/**
 * Server-side PunchOut wiring (OCI + cXML) — Node / Express.
 *
 * The Vue mirror of `propeller-next/lib/punchout.ts`. The wire-format parsing /
 * building and the cart→ERP field mapping live in the pure, SDK-free
 * `@propeller-commerce/propeller-v2-punchout` package; this module owns the
 * app-specific glue: the enable flag, the admin SDK client that mints magic
 * tokens, the cXML buyer-credential lookup, an authed client for the cart
 * fetch, and the non-secret config block (the mapping-override point).
 *
 * Plain `.js` ESM so `server.js` can `import` it directly (its static imports
 * aren't run through Vite — no TS, no `import.meta.env`). Config that the next
 * app keeps in `data/config.ts` lives here instead, because `server.js` can't
 * import the TS config.
 *
 * Server-only. Never imported by a client component.
 */

import { createHash } from 'node:crypto'
import { GraphQLClient, MagicTokenService, AttributeService } from '@propeller-commerce/propeller-sdk-v2'
import { validateSharedSecret } from '@propeller-commerce/propeller-v2-punchout'
import { signCookie, verifyCookie } from './signedCookie.js'

// ── Session cookies (#20) ───────────────────────────────────────────────────
//
// `/api/punchout/enter` never activates a session by itself: it stores a signed,
// short-lived *pending* session bound to sha256(mtoken). The GraphQL proxy promotes
// it to the signed `punchout` cookie (plus the readable flag the cart page checks)
// only when upstream accepts a magicTokenLogin for that same token. Any other
// login, a failed magic login and logout end the punchout session.

export const PUNCHOUT_COOKIE = 'punchout'
export const PUNCHOUT_FLAG_COOKIE = 'punchout_active'
export const PUNCHOUT_PENDING_COOKIE = 'punchout_pending'
export const PUNCHOUT_MAX_AGE = 60 * 60
export const PUNCHOUT_PENDING_MAX_AGE = 10 * 60

const tokenHash = (mtoken) => createHash('sha256').update(String(mtoken)).digest('hex')

function parseSigned(purpose, value) {
  const raw = verifyCookie(purpose, value)
  if (raw === null) return null
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

/**
 * The URL the cart is handed back to, when allowed: https only, and when
 * `PUNCHOUT_HOOK_HOSTS` (comma-separated hostnames) is set, one of those hosts.
 */
export function validReturnUrl(raw, allowedHosts = process.env.PUNCHOUT_HOOK_HOSTS) {
  let url
  try {
    url = new URL(String(raw ?? ''))
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.username || url.password) return null
  const hosts = String(allowedHosts || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
  if (hosts.length && !hosts.includes(url.hostname.toLowerCase())) return null
  return url.href
}

/** Signed pending-session cookie value for the token `enter` was called with (null without a signing key). */
export function signPendingSession(mtoken, session) {
  return signCookie('punchout-pending', JSON.stringify({ h: tokenHash(mtoken), s: session }), PUNCHOUT_PENDING_MAX_AGE)
}

/** Signed active-session cookie value. */
export function signPunchoutSession(session) {
  return signCookie('punchout', JSON.stringify(session), PUNCHOUT_MAX_AGE)
}

/** The active session from a valid cookie, with a return URL that is still allowed; else null. */
export function verifyPunchoutSession(cookie) {
  const session = parseSigned('punchout', cookie)
  return session && validReturnUrl(session.returnUrl) ? session : null
}

/**
 * The cXML BrowserFormPost and buyer details from the shared-secret-authenticated
 * setup, signed for the token it minted, carried to `enter` in the start URL.
 */
export function signCxmlSetup(mtoken, setup) {
  return signCookie('punchout-cxml', JSON.stringify({ h: tokenHash(mtoken), ...setup }), PUNCHOUT_TOKEN_TTL_MS / 1000)
}

/** The signed cXML setup for this token, else null. */
export function verifyCxmlSetup(value, mtoken) {
  const setup = parseSigned('punchout-cxml', value)
  if (!setup || setup.h !== tokenHash(mtoken)) return null
  const { h: _h, ...rest } = setup
  return rest
}

/**
 * What a login through the proxy means for the punchout cookies:
 *   `{ promote: session }` a magicTokenLogin that upstream accepted for the very token
 *                          the pending cookie was issued for;
 *   `{ clear: true }`      any other magic login, a failed one, or a password login;
 *   null                   not a login.
 */
export function punchoutAfterLogin({ field, succeeded, token, pendingCookie }) {
  if (field === 'login') return succeeded ? { clear: true } : null
  if (field !== 'magicTokenLogin') return null
  const pending = parseSigned('punchout-pending', pendingCookie)
  if (succeeded && pending && typeof token === 'string' && token && pending.h === tokenHash(token)) {
    return validReturnUrl(pending.s?.returnUrl) ? { promote: pending.s } : { clear: true }
  }
  return { clear: true }
}

/** Contact track attribute holding the cXML shared secret (backend side). */
const CXML_SHARED_SECRET_ATTR = 'CXML_SHARED_SECRET'

/**
 * Non-secret punchout config — the override point mirroring next's
 * `config.punchout`. `ociMapping` / `cxmlMapping` deep-merge over the package
 * defaults (`DEFAULT_OCI_MAPPING` / `DEFAULT_CXML_MAPPING`); see the package
 * README for the rule shape. Secrets + enable flag come from env.
 */
export const PUNCHOUT_CONFIG = {
  currency: process.env.PUNCHOUT_CURRENCY || 'EUR',
  transferTarget: process.env.PUNCHOUT_TRANSFER_TARGET || '_self',
  language: process.env.VITE_DEFAULT_LANGUAGE || process.env.SSR_DEFAULT_LANGUAGE || 'NL',
  ociMapping: {},
  cxmlMapping: {},
}

/**
 * Debug mode — the transfer route renders a readable OCI/cXML preview page (the
 * plugin's `oci_results`/`cxml_results` sink) instead of auto-POSTing to the
 * ERP, and leaves the cart intact so it's re-testable.
 */
export function isPunchoutDebug() {
  return (process.env.PUNCHOUT_DEBUG || '').trim().toLowerCase() === 'true'
}

/** Image filters for the server-side cart fetch (mirror of next's grid defaults). */
export const CART_IMAGE_FILTERS = {
  imageSearchFilters: { page: 1, offset: 1 },
  imageVariantFilters: {
    transformations: [
      { name: 'thumb', transformation: { format: 'WEBP', height: 100, width: 100, fit: 'BOUNDS' } },
    ],
  },
}

export function isPunchoutEnabled() {
  return (process.env.PUNCHOUT_ENABLED || '').trim().toLowerCase() === 'true'
}

/**
 * `magicTokenCreate` is admin-gated — route it through the order-editor key by
 * adding it to the editor mutation set (same trick msp.js uses for
 * paymentCreate). REPLACES the SDK default list, so the defaults are repeated.
 */
const PUNCHOUT_ORDER_EDITOR_MUTATIONS = [
  'orderSetStatus',
  'triggerQuoteSendRequest',
  'triggerOrderSendConfirm',
  'magicTokenCreate',
]

function createPunchoutAdminClient() {
  // PunchOut setup is a privileged server flow: it reads ANOTHER contact's
  // CXML_SHARED_SECRET (a query, authenticated by `apiKey`) and mints a magic
  // token (an admin-gated mutation, authenticated by `orderEditorApiKey`). Both
  // need elevated rights, so the order-editor key drives the whole client
  // (falling back to the general key if unset).
  const adminKey =
    process.env.SSR_ORDER_EDITOR_API_KEY ||
    process.env.SSR_API_KEY ||
    ''
  return new GraphQLClient({
    endpoint: process.env.SSR_GRAPHQL_ENDPOINT || process.env.VITE_GRAPHQL_PROXY_TARGET || '',
    apiKey: adminKey,
    orderEditorApiKey: adminKey,
    securityMode: 'direct',
    timeout: 30000,
    orderEditorMutations: PUNCHOUT_ORDER_EDITOR_MUTATIONS,
  })
}

/** Read a contact's text track-attribute values (mirrors the machines helper). */
function readAttributeStringValues(value) {
  if (!value || typeof value !== 'object') return []
  const out = []
  for (const tv of value.textValues ?? []) for (const s of tv?.values ?? []) out.push(String(s))
  for (const s of value.enumValues ?? []) out.push(String(s))
  if (out.length === 0 && value.value != null) {
    return String(value.value).split(',').map((s) => s.trim()).filter(Boolean)
  }
  return out
}

/** Authed client for the cart fetch — carries the logged-in user's bearer. */
export function createAuthedClient(bearer) {
  return new GraphQLClient({
    endpoint: process.env.SSR_GRAPHQL_ENDPOINT || process.env.VITE_GRAPHQL_PROXY_TARGET || '',
    apiKey: process.env.SSR_API_KEY || '',
    securityMode: 'direct',
    timeout: 30000,
    ...(bearer ? { headers: { Authorization: `Bearer ${bearer}` } } : {}),
  })
}

/** One hour, in ms — the punchout magic token's lifetime. */
const PUNCHOUT_TOKEN_TTL_MS = 60 * 60 * 1000

/**
 * Mint a magic token for the buyer contact (cXML setup handoff). One-time use
 * and expiring 1h from creation, so a leaked/replayed StartPage link is inert
 * after a single sign-in or an hour, whichever comes first.
 */
export async function createPunchoutMagicToken(contactId) {
  const svc = new MagicTokenService(createPunchoutAdminClient())
  const expiresAt = new Date(Date.now() + PUNCHOUT_TOKEN_TTL_MS).toISOString()
  const token = await svc.createMagicToken({ contactId, oneTimeUse: true, expiresAt })
  return token.id
}

/**
 * Resolve an inbound cXML request to its buyer contact, mirroring the WP plugin
 * (`CxmlTrait::handlePunchOutSetupRequest` + `validatePunchoutCredentials`).
 *
 * `CXML_CONTACT_ID` (CSV, = the plugin's `PROPELLER_CXML_CONTACT_ID`) lists the
 * candidate buyer contacts. For each we read the `CXML_SHARED_SECRET` contact
 * track attribute from the GraphQL API and constant-time compare it to the
 * request's SharedSecret — the SECRET identifies the buyer (Sender Identity is
 * ignored, exactly as the plugin does). Returns the matching contactId.
 */
export async function resolveCxmlBuyer(sharedSecret) {
  if (!sharedSecret) return null
  const ids = (process.env.CXML_CONTACT_ID || '')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n))
  if (ids.length === 0) return null

  const svc = new AttributeService(createPunchoutAdminClient())
  for (const contactId of ids) {
    try {
      const res = await svc.getAttributeResultByContactId({ contactId, input: { page: 1, offset: 50 } })
      const item = (res.items ?? []).find((i) => i.attributeDescription?.name === CXML_SHARED_SECRET_ATTR)
      const stored = readAttributeStringValues(item?.value)[0]
      if (stored && validateSharedSecret(sharedSecret, stored)) return { contactId }
    } catch {
      // Try the next candidate.
    }
  }
  return null
}
