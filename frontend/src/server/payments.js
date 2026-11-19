/**
 * Pure decisions for the PSP routes (#19): what to charge for an order read
 * server-side, where the PSP sends the payer back, and which webhook
 * notifications may run the provider's order processing. The browser's amount,
 * currency and redirect URL are never used as such.
 */

import { idOf, isOwnOrder } from './orderEditorRouting.js'

/** Reads what a payment and the owner checks need (order-editor key); `total.net` is the total incl. VAT (Propeller's naming is inverted). */
export const PAYMENT_ORDER_QUERY =
  'query paymentOrder($orderId: Int!) { order(orderId: $orderId) { id userId status currency total { net } } }'

/** Integer cents, rounded half-up on the decimal value: 13.3947 → 1339, 1.005 → 101. Null if not an amount. */
export function toCentsHalfUp(amount) {
  const n = typeof amount === 'string' ? Number(amount) : amount
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return null
  // toPrecision drops the binary noise (1.005 * 100 = 100.49999…) before rounding.
  return Math.round(Number((n * 100).toPrecision(12)))
}

/**
 * `{ amount, currency }` to charge for `order` (the upstream `order` from
 * PAYMENT_ORDER_QUERY), or `{ error }`. Only an UNFINISHED order (placed for a
 * PSP, not yet paid) with a positive total can be paid.
 */
export function chargeFor(order, fallbackCurrency = 'EUR') {
  if (!order) return { error: 'order not found' }
  if (order.status !== 'UNFINISHED') return { error: 'order is not awaiting payment' }
  const cents = toCentsHalfUp(order.total?.net)
  if (!cents) return { error: 'order has nothing to pay' }
  const currency = typeof order.currency === 'string' && /^[A-Z]{3}$/.test(order.currency) ? order.currency : fallbackCurrency
  return { amount: cents / 100, currency }
}

/**
 * The site the PSP sends the payer back to: `VITE_SITE_URL`. The request's own origin
 * only in development: it comes from the client's Host header. Null in production
 * without `VITE_SITE_URL` (create-payment then refuses).
 */
export function paymentSiteUrl(siteUrl, requestOrigin, isProd) {
  if (siteUrl) return siteUrl
  return isProd ? null : requestOrigin
}

/**
 * The PSP's return URL: always on `siteUrl`, the thank-you page of this order
 * (with the language prefix the browser asked for, if any), marked as a PSP return.
 */
export function paymentRedirectUrl(siteUrl, requested, orderId, provider) {
  let path = `/checkout/thank-you/${orderId}`
  try {
    const asked = new URL(String(requested ?? ''), 'http://x').pathname
    if (new RegExp(`^(/[a-z]{2})?/checkout/thank-you/${orderId}$`).test(asked)) path = asked
  } catch {
    // keep the default path
  }
  return `${siteUrl.replace(/\/+$/, '')}${path}?psp=${provider}`
}

/**
 * The order behind a payment request, for its owner only, else null: the order this
 * browser just placed (`lastOrderId`, from the signed last-order cookie), or one the
 * verified viewer placed (`order.userId`). `fetchOrder(id)` reads it with the
 * order-editor key: what the storefront key reads with a Bearer says nothing about
 * who owns the order. `getViewer()` → the verified viewer or null, asked only when
 * the cookie doesn't name the order.
 */
export async function ownedOrder(orderId, { lastOrderId = null, getViewer, fetchOrder }) {
  const id = idOf(orderId)
  if (!id) return null
  if (id === lastOrderId) return fetchOrder(id)
  const viewer = await getViewer()
  const order = viewer ? await fetchOrder(id) : null
  return isOwnOrder(order, viewer) ? order : null
}

/**
 * Whether a payment notification for `orderId` may run the provider's order
 * processing: only while the order is still UNFINISHED (placed, payment pending).
 * The providers re-apply NEW/PAID, the confirmation mail with PDF and the cart
 * delete for every paid state, so running them again for an order already
 * processed re-mails the customer and resets its back-office status. Unknown
 * order or failed lookup: no. `fetchOrder(id)` reads it with the order-editor key.
 */
export async function awaitsPayment(orderId, fetchOrder) {
  const id = idOf(orderId)
  if (!id) return false
  const order = await fetchOrder(id).catch(() => null)
  return order?.status === 'UNFINISHED'
}

/** Unsigned (GET) MSP notifications per client IP and per order: MSP's own servers send a few per order. */
export const UNSIGNED_PER_IP = { limit: 30, windowMs: 60 * 1000 }
export const UNSIGNED_PER_ORDER = { limit: 10, windowMs: 60 * 60 * 1000 }

/** The order id a signed MSP POST body names (`order_id`), '' when there is none. */
export function signedOrderId(body) {
  try {
    const orderId = JSON.parse(body || '')?.order_id
    return typeof orderId === 'string' || typeof orderId === 'number' ? String(orderId).trim() : ''
  } catch {
    return ''
  }
}

/**
 * One MultiSafepay notification (`?transactionid=<orderId>`), as the HTTP answer.
 * POST: refused (403) without a valid signature (`signed`, verified over the raw
 * `body`), and when the signed body names another order than the query (a
 * captured notification replayed against another order within the signature
 * window). GET carries no signature (propeller-v2-msp <= 0.1.3 orders send GET),
 * so anyone can send one for any order id: limited per IP and per order (429,
 * MSP retries later), and processed only while the order awaits payment;
 * otherwise acknowledged and dropped. Everything else answers 200 'OK', so MSP
 * doesn't retry-storm.
 *
 * deps: { limiter (rateLimit.js), fetchOrder(orderId), provider() → MspProvider }
 */
export async function handleMspNotification({ method, id, ip, signed, body }, { limiter, fetchOrder, provider }) {
  const ok = { status: 200, body: 'OK' }
  if (method === 'POST') {
    if (!signed) {
      console.warn('[msp] webhook POST with a missing or invalid signature refused')
      return { status: 403, body: 'Invalid signature' }
    }
    if (!id || signedOrderId(body) !== id) {
      console.warn('[msp] webhook POST for another order than its signed body refused, order:', id)
      return { status: 403, body: 'Order mismatch' }
    }
  } else {
    const perIp = limiter.hit(`msp-webhook:${ip}`, UNSIGNED_PER_IP.limit, UNSIGNED_PER_IP.windowMs)
    if (!perIp.ok) return { status: 429, body: 'Too many notifications' }
    if (!(await awaitsPayment(id, fetchOrder))) return ok
    // Counted only for an order that would run, so made-up ids add no entries.
    const perOrder = limiter.hit(`msp-webhook-order:${id}`, UNSIGNED_PER_ORDER.limit, UNSIGNED_PER_ORDER.windowMs)
    if (!perOrder.ok) return { status: 429, body: 'Too many notifications' }
  }
  const result = await provider().handleWebhook(id)
  if (!result.ok) console.warn('[msp] webhook not processed:', result.error, 'order:', id)
  return ok
}
