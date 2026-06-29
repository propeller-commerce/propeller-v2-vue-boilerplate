/**
 * Payment-method classification — client side.
 *
 * The Vue mirror of `propeller-next/lib/payments.ts`. "On-account" methods
 * (e.g. REKENING, ON_ACCOUNT) are settled outside the PSP — the order is placed
 * straight to NEW with no Mollie hand-off. Every other method goes through
 * Mollie, where the order starts as UNFINISHED and the webhook later promotes it
 * based on the Mollie payment state.
 *
 * Configured via `VITE_ON_ACCOUNT_PAYMENTS` (comma-separated, case-insensitive).
 * Defaults to `REKENING,ON_ACCOUNT` when unset. The checkout view imports this
 * to decide the placement order status + whether to start a Mollie payment.
 *
 * This module reads `import.meta.env` and is therefore CLIENT-ONLY — `server.js`
 * must not import it (it isn't run through Vite's transform). The server route
 * applies the same rule inline against `process.env.ON_ACCOUNT_PAYMENTS` as a
 * defense-in-depth guard; keep the two in sync.
 */

const DEFAULT_ON_ACCOUNT = ['REKENING', 'ON_ACCOUNT'];

/** Parse the configured on-account method codes, upper-cased and trimmed. */
export function onAccountMethods(): string[] {
  const raw = (import.meta.env.VITE_ON_ACCOUNT_PAYMENTS as string | undefined) ?? '';
  const list = raw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  return list.length > 0 ? list : DEFAULT_ON_ACCOUNT;
}

/**
 * Whether a payment-method code settles "on account" (no PSP). Comparison is
 * case-insensitive. Used to decide both the placement order status (on-account →
 * NEW; PSP → UNFINISHED until the webhook resolves it) and whether to start a
 * Mollie payment at all.
 */
export function isOnAccountMethod(method: string | undefined | null): boolean {
  if (!method) return false;
  return onAccountMethods().includes(method.trim().toUpperCase());
}

/** Whether Mollie is the active payment provider, per the client env mirror. */
export function isMollieEnabled(): boolean {
  return (
    (import.meta.env.VITE_PAYMENT_PROVIDER as string | undefined) || ''
  )
    .trim()
    .toLowerCase() === 'mollie';
}
