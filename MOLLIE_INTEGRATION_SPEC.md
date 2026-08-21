# Mollie payments in propeller-vue — implementation spec

**Status:** spec / not yet implemented
**Author handoff date:** 2026-06-29
**Package:** `@propeller-commerce/propeller-v2-mollie` (npm, `^0.2.1`)
**Reference implementation:** propeller-next (`d:\laragon\www\propeller-next`) — already shipped, on `master`.
**Estimate:** ~2 days. Three-state thank-you view is the bulk; everything else is a near-verbatim port.

---

## 0. Bottom line

Adding Mollie to propeller-vue is an **app-only change**. No `propeller-v2-vue-ui`
package change is required and no republish cycle. Two facts make this clean:

1. **propeller-vue is an SSR app with an Express server** (`frontend/server.js`),
   not a client-only SPA. The Mollie package is server-side and
   framework-agnostic, so its three host surfaces map onto three Express
   handlers exactly the way they map onto Next.js route handlers.
2. **`useCheckout().placeOrder` in `propeller-v2-vue-ui` already accepts
   `orderStatus` and `finalizeOrder`** — identical signature to the React
   package. The Mollie flow needs `orderStatus: 'UNFINISHED'` + `finalizeOrder:
   false`, both already supported.

The work is: 3 Express routes + 1 provider module + 1 shared helper (server
half) and an extended `handlePlaceOrder` + a three-state thank-you view (client
half) + env. The webhook ladder and all PSP logic live inside the package and
are not touched.

---

## 1. Architecture parity with propeller-next

| Concern | propeller-next (reference) | propeller-vue (this spec) |
|---|---|---|
| Provider singleton | `lib/mollie.ts` | new `frontend/src/server/mollie.ts` |
| Start payment | `POST app/api/mollie/create-payment/route.ts` | `app.post('/api/mollie/create-payment')` in `server.js` |
| Live status lookup | `GET app/api/mollie/payment-status/route.ts` | `app.get('/api/mollie/payment-status')` in `server.js` |
| Webhook | `POST app/api/mollie/webhook/route.ts` | `app.post('/api/mollie/webhook')` in `server.js` |
| On-account classify | `lib/payments.ts` | new `frontend/src/lib/payments.ts` |
| Start payment (client) | `handlePlaceOrder` + `startMolliePayment` in `app/checkout/page.tsx` | extend `handlePlaceOrder` in `src/views/checkout/CheckoutView.vue` |
| Three-state return page | `app/checkout/thank-you/[orderId]/page.tsx` | rework `src/views/checkout/OrderConfirmationView.vue` |
| paymentId stash | `sessionStorage['mollie_payment_${orderId}']` | identical (browser API) |
| Local-cart clear | `clearCart()` (success only) | `cartStore.clearCart()` (success only) |

---

## 2. The two cart rules (do not conflate)

This is the design that propeller-next's 0.2.1 fix got right, and that this port
must preserve. There are **two separate "clear the cart" decisions**:

1. **Backend cart** — cleared by the package's webhook ladder
   (`statusLadder.ts` `deleteCart`), server-side, on `paid`/`open`/`pending`.
   **Untouched by this work** — it lives inside the package.
2. **Local cart** — the shopper's `localStorage` cart in the browser. Cleared on
   the return page **only** on `paid`/`authorized` (`isSettledStatus`). On
   `open`/`pending`/`failed`/`canceled`/`expired` the local cart is **kept** so a
   retry reuses the same un-finalized order instead of stranding it.

Rule 2 is the whole point of the three-state thank-you view. Clearing the local
cart on `open` was the exact bug propeller-next fixed; get it right the first
time here.

---

## 3. Server half

### 3.1 `frontend/src/server/mollie.ts` (new)

Port of `lib/mollie.ts`. Reads `process.env` (server context — **not**
`import.meta.env`). A module-level singleton is fine (one server process).

```ts
import { GraphQLClient } from '@propeller-commerce/propeller-sdk-v2';
import { MollieProvider } from '@propeller-commerce/propeller-v2-mollie';

// The provider talks DIRECTLY to the upstream GraphQL endpoint — it bypasses the
// /api/graphql proxy, so it must carry the order-editor key itself. server.js
// routes orderSetStatus / triggerOrderSendConfirm to the order-editor key via
// the proxy; the provider can't rely on that, so we hand it both keys + the
// order-editor mutation allowlist.
const MOLLIE_ORDER_EDITOR_MUTATIONS = [
  'orderSetStatus',
  'passwordResetLink',
  'triggerQuoteSendRequest',
  'triggerOrderSendConfirm',
  'paymentCreate',
  'paymentUpdate',
];

function createMollieGraphqlClient(): GraphQLClient {
  return new GraphQLClient({
    endpoint: process.env.SSR_GRAPHQL_ENDPOINT || '',
    apiKey: process.env.SSR_API_KEY || '',
    orderEditorApiKey: process.env.SSR_ORDER_EDITOR_API_KEY || '',
    securityMode: 'direct',
    timeout: 30000,
    orderEditorMutations: MOLLIE_ORDER_EDITOR_MUTATIONS,
  });
}

export function isMollieEnabled(): boolean {
  return (process.env.PAYMENT_PROVIDER || '').trim().toLowerCase() === 'mollie';
}

export function mollieWebhookUrl(): string {
  const override = (process.env.MOLLIE_WEBHOOK_URL || '').trim();
  if (override) {
    return /\/api\/mollie\/webhook\/?$/.test(override)
      ? override
      : `${override.replace(/\/$/, '')}/api/mollie/webhook`;
  }
  const origin = (process.env.VITE_SITE_URL || '').replace(/\/$/, '');
  return `${origin}/api/mollie/webhook`;
}

let _provider: MollieProvider | null = null;
export function getMollieProvider(): MollieProvider {
  if (_provider) return _provider;
  _provider = new MollieProvider(
    {
      liveApiKey: process.env.MOLLIE_LIVE_KEY || '',
      testApiKey: process.env.MOLLIE_TEST_KEY || '',
      testMode: (process.env.MOLLIE_TEST_MODE || 'true').trim().toLowerCase() === 'true',
    },
    { client: createMollieGraphqlClient(), webhookUrl: mollieWebhookUrl() },
  );
  return _provider;
}
```

> **Watch the env names.** propeller-next uses `BOILERPLATE_GRAPHQL_ENDPOINT` /
> `BOILERPLATE_API_KEY` / `BOILERPLATE_ORDER_EDITOR_API_KEY` and
> `NEXT_PUBLIC_SITE_URL`. propeller-vue already has `SSR_GRAPHQL_ENDPOINT` /
> `SSR_API_KEY` / `SSR_ORDER_EDITOR_API_KEY` (used by `server.js` for its direct
> clients) and `VITE_SITE_URL`. **Reuse the propeller-vue names** — do not invent
> `BOILERPLATE_*`.

> **`.ts` in `server.js`.** `server.js` runs through Vite's SSR module loader in
> dev (`vite.ssrLoadModule`) and bundles via `build:server` in prod, so importing
> a `.ts` module is fine in dev. For the **production** path confirm the route
> handlers can resolve this module — either author it as part of the SSR bundle,
> or write it as plain `.js` if `server.js` imports it directly with `import`
> outside Vite. Safest: a small `.js` module imported directly by `server.js`,
> mirroring how `server.js` already builds its proxy clients. Decide at
> implementation time based on how `server.js` currently imports its helpers.

### 3.2 Three routes in `frontend/server.js`

Register them **before** the SSR catch-all `app.use('*all', …)` (currently the
last handler, ~line 580) and alongside the other `/api/*` handlers
(`/api/revalidate` ~line 430, `/api/graphql` ~line 494, `/api/order-editor`
~line 495). Paths are distinct from the GraphQL proxy, so no ordering conflict
with it — the only hard requirement is "before `*all`".

```js
import {
  getMollieProvider,
  isMollieEnabled,
} from './src/server/mollie.js'; // or wherever resolved (see 3.1 note)
import { isOnAccountMethod } from './src/lib/payments.js';

// POST /api/mollie/create-payment  — start a payment for a placed order
app.post('/api/mollie/create-payment', express.json({ limit: '8kb' }), async (req, res) => {
  if (!isMollieEnabled()) return res.status(503).json({ error: 'mollie not configured' });
  const b = req.body || {};
  // minimal validation (orderId, amount, currency, method, description, redirectUrl)
  if (isOnAccountMethod(b.method)) {
    return res.status(400).json({ error: 'on-account method does not use a PSP' });
  }
  try {
    const result = await getMollieProvider().createPayment({
      orderId: b.orderId,
      amount: b.amount,
      currency: b.currency,
      method: b.method,
      description: b.description,
      redirectUrl: b.redirectUrl,
      ...(b.userId !== undefined ? { userId: b.userId } : {}),
      ...(b.anonymousId !== undefined ? { anonymousId: b.anonymousId } : {}),
    });
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error('[mollie] create-payment', e);
    res.status(500).json({ ok: false, error: 'create payment failed' });
  }
});

// GET /api/mollie/payment-status?paymentId=tr_xxx  — live status for return page
app.get('/api/mollie/payment-status', async (req, res) => {
  if (!isMollieEnabled()) return res.status(503).json({ error: 'mollie not configured' });
  const paymentId = String(req.query.paymentId || '').trim();
  if (!paymentId) return res.status(400).json({ error: 'missing paymentId' });
  const result = await getMollieProvider().getPaymentStatus(paymentId);
  res.json(result); // { ok, paymentId, status?, settled?, orderId?, error? }
});

// POST /api/mollie/webhook  — Mollie posts form-encoded `id=tr_xxx`. ALWAYS 200.
app.post('/api/mollie/webhook', express.urlencoded({ extended: false }), async (req, res) => {
  if (!isMollieEnabled()) return res.status(200).end();
  const id = (req.body && req.body.id) ? String(req.body.id) : '';
  try {
    const result = await getMollieProvider().handleWebhook(id);
    if (!result.ok) console.warn('[mollie] webhook not processed:', result.error, 'payment:', id);
  } catch (e) {
    console.error('[mollie] webhook handler error:', e instanceof Error ? e.message : e);
  }
  res.status(200).end(); // unconditional ack — never let Mollie retry-storm
});
```

> The webhook's `express.urlencoded` is **scoped to that route** so it never
> intercepts the JSON `/api/graphql` proxy body. Likewise `create-payment` uses a
> scoped `express.json`.

### 3.3 `frontend/src/lib/payments.ts` (new)

Copy `lib/payments.ts` verbatim; swap env reads only. It is imported by **both**
`server.js` (server) and `CheckoutView.vue` (client), so it must read whichever
env is available:

```ts
const DEFAULT_ON_ACCOUNT = ['REKENING', 'ON_ACCOUNT'];

export function onAccountMethods(): string[] {
  // client: import.meta.env.VITE_ON_ACCOUNT_PAYMENTS; server: process.env.ON_ACCOUNT_PAYMENTS
  const fromVite =
    typeof import.meta !== 'undefined' && (import.meta as any).env
      ? (import.meta as any).env.VITE_ON_ACCOUNT_PAYMENTS
      : undefined;
  const fromProc =
    typeof process !== 'undefined' && process.env ? process.env.ON_ACCOUNT_PAYMENTS : undefined;
  const raw = fromVite ?? fromProc ?? '';
  const list = raw.split(',').map((s: string) => s.trim().toUpperCase()).filter(Boolean);
  return list.length ? list : DEFAULT_ON_ACCOUNT;
}

export function isOnAccountMethod(method?: string | null): boolean {
  if (!method) return false;
  return onAccountMethods().includes(method.trim().toUpperCase());
}
```

> If the universal `import.meta`/`process` guard proves awkward across the
> SSR/client boundary, split into `payments.client.ts` (Vite env) and a tiny
> server reader in `server.js`. The single-file version is preferred if it builds
> clean under both `build:client` and `build:server`.

---

## 4. Client half

### 4.1 `src/views/checkout/CheckoutView.vue` — extend `handlePlaceOrder`

Current code (`src/views/checkout/CheckoutView.vue:731`) unconditionally places
the order, clears via `restoreManagerCart()`, and pushes to thank-you (with the
existing `?mode=quote` convention). Replace with the three-way branch. **Mirror
`?mode=quote` with `?psp=mollie`** on the redirect URL.

```ts
import { isOnAccountMethod } from '@/lib/payments';

const mollieEnabled =
  (import.meta.env.VITE_PAYMENT_PROVIDER || '').toLowerCase() === 'mollie';

async function handlePlaceOrder(reference?: string, notes?: string) {
  orderPlaced.value = true;

  const quote = isQuoteMode.value;
  const onAccount = isOnAccountMethod(selectedPayment.value);
  const goesThroughMollie = !quote && !onAccount && mollieEnabled;

  // quote → REQUEST · via Mollie → UNFINISHED (webhook finalizes) · else → NEW
  const orderStatus = quote ? 'REQUEST' : goesThroughMollie ? 'UNFINISHED' : 'NEW';

  const result = await placeOrder((cart.value as any).cartId, {
    isQuoteMode: quote,
    reference,
    notes,
    orderStatus,
    // Don't email / clear backend cart at placement for a Mollie order — the
    // payment webhook finalizes it on `paid`.
    ...(goesThroughMollie ? { finalizeOrder: false } : {}),
  });

  if (!result.ok) {
    orderPlaced.value = false;
    return;
  }

  const orderId = result.data.orderId;

  // --- Mollie path: hand off to hosted checkout ---
  if (goesThroughMollie) {
    const checkoutUrl = await startMolliePayment(orderId);
    if (checkoutUrl) {
      window.location.href = checkoutUrl; // hard redirect off-site
      return;
    }
    // start failed → keep cart, surface error, let them retry
    orderPlaced.value = false;
    // set an error ref the template already renders, e.g.:
    // placeOrderError.value = t('paymentStartFailed')
    return;
  }

  // --- Non-Mollie path: unchanged (on-account / Mollie off / quote) ---
  cartStore.setCart(restoreManagerCart());
  const thankYouUrl =
    localizeHref(`/checkout/thank-you/${orderId}`, languageStore.language) +
    (quote ? '?mode=quote' : '');
  router.push(thankYouUrl);
}

async function startMolliePayment(orderId: number): Promise<string | null> {
  try {
    const total = (cart.value as any)?.total;
    const amount = total?.totalNet ?? total?.totalGross;
    if (amount === undefined) return null;

    const origin = (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, '');
    const redirectUrl =
      origin +
      localizeHref(`/checkout/thank-you/${orderId}`, languageStore.language) +
      '?psp=mollie';

    const res = await fetch('/api/mollie/create-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,
        amount,
        currency: import.meta.env.VITE_CURRENCY_CODE || 'EUR',
        method: selectedPayment.value,
        description: `Order ${orderId}`,
        redirectUrl,
        ...(authStore.user?.userId ? { userId: Number(authStore.user.userId) } : {}),
      }),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { checkoutUrl?: string; paymentId?: string };
    if (data.paymentId) {
      try {
        window.sessionStorage.setItem(`mollie_payment_${orderId}`, data.paymentId);
      } catch { /* private mode — return page falls back to order status */ }
    }
    return data.checkoutUrl ?? null;
  } catch (e) {
    console.error('startMolliePayment failed', e);
    return null;
  }
}
```

> **Amount source:** propeller-next sends `totalNet ?? totalGross`. Confirm which
> total Mollie should charge for this shop's tax model before shipping —
> Mollie charges the gross (incl. VAT) amount the shopper pays. If the Vue shop's
> displayed price is gross, send the gross total. This is a per-shop decision;
> propeller-next's choice is the starting point, not gospel.

### 4.2 `src/views/checkout/OrderConfirmationView.vue` — three-state machine

This is the largest piece: React `useEffect`/`useState` → Vue
`onMounted`/`watch` + `ref`s; the recheck callback → a plain async method. The
view already reads `route.params.orderId` (`:190`) and `route.query.mode`
(`:191`) and fetches the order via `useOrders` (`:193`). Add a `psp` branch.

Status sets (same as propeller-next):

```ts
const SUCCESS_MOLLIE_STATUSES = new Set(['paid', 'authorized']);
const PENDING_MOLLIE_STATUSES = new Set(['open', 'pending']);
const FAILED_MOLLIE_STATUSES  = new Set(['failed', 'canceled', 'cancelled', 'expired']);

type PaymentState = 'none' | 'resolving' | 'success' | 'pending' | 'failed';
const paymentState = ref<PaymentState>('none');
const mollieStatus = ref<string | null>(null);
const rechecking = ref(false);

const isPspReturn = computed(() => route.query.psp === 'mollie');
const cartStore = useCartStore();
let cartCleared = false;
```

Resolution on mount (after the existing `fetchOrder`):

```ts
onMounted(async () => {
  if (!orderId.value) return;
  await fetchOrder(Number(orderId.value));
  if (!isPspReturn.value) return;

  paymentState.value = 'resolving';
  const stash = window.sessionStorage.getItem(`mollie_payment_${orderId.value}`);

  if (!stash) {
    // returned on another device / lost session → best-effort off order status
    const s = (order.value?.paymentData?.status || order.value?.status || '').toUpperCase();
    paymentState.value = (s === 'PAID' || s === 'NEW' || s === 'AUTHORIZED') ? 'success' : 'pending';
    return;
  }

  try {
    const res = await fetch(`/api/mollie/payment-status?paymentId=${encodeURIComponent(stash)}`);
    const data = await res.json();
    const status = (data.status || '').toLowerCase();
    mollieStatus.value = status || null;

    if (data.ok && SUCCESS_MOLLIE_STATUSES.has(status)) {
      paymentState.value = 'success';
      window.sessionStorage.removeItem(`mollie_payment_${orderId.value}`);
    } else if (data.ok && PENDING_MOLLIE_STATUSES.has(status)) {
      paymentState.value = 'pending';                 // keep cart
    } else if (FAILED_MOLLIE_STATUSES.has(status)) {
      paymentState.value = 'failed';                  // keep cart
    } else {
      paymentState.value = 'pending';                 // unknown → keep cart (safe)
    }
  } catch {
    paymentState.value = 'pending';                   // network error → keep cart
  }
});

// Clear the LOCAL cart ONLY on success (paid/authorized).
watch(paymentState, (s) => {
  if (!isPspReturn.value || cartCleared) return;
  if (s === 'success') {
    cartCleared = true;
    cartStore.clearCart();
  }
});

async function recheckStatus() {
  const stash = window.sessionStorage.getItem(`mollie_payment_${orderId.value}`);
  if (!stash) {
    await fetchOrder(Number(orderId.value)); // lost id → refresh order details
    return;
  }
  rechecking.value = true;
  try {
    const res = await fetch(`/api/mollie/payment-status?paymentId=${encodeURIComponent(stash)}`);
    const data = await res.json();
    const status = (data.status || '').toLowerCase();
    mollieStatus.value = status || null;
    if (data.ok && SUCCESS_MOLLIE_STATUSES.has(status)) {
      paymentState.value = 'success'; // triggers the cart-clear watcher
      window.sessionStorage.removeItem(`mollie_payment_${orderId.value}`);
    } else if (FAILED_MOLLIE_STATUSES.has(status)) {
      paymentState.value = 'failed';
    } else {
      paymentState.value = 'pending';
    }
  } catch {
    /* leave pending on transient error */
  } finally {
    rechecking.value = false;
  }
}
```

Template — three branches (keep the **existing** order-summary markup as the
`success` branch, and the non-PSP default):

```vue
<template>
  <!-- non-PSP arrival (on-account / quote / Mollie off): current behavior -->
  <OrderSummaryView v-if="!isPspReturn || paymentState === 'success'" ... />

  <!-- PSP resolving -->
  <div v-else-if="paymentState === 'resolving'">{{ t('checkingPayment') }}</div>

  <!-- PSP pending (open/pending/unknown/network) -->
  <div v-else-if="paymentState === 'pending'">
    <h1>{{ t('paymentStillOpenTitle') }}</h1>      <!-- "Your payment is still open" -->
    <p>{{ t('paymentStillOpenBody') }}</p>
    <button :disabled="rechecking" @click="recheckStatus">
      {{ rechecking ? t('checking') : t('checkPaymentStatus') }}
    </button>
    <RouterLink :to="localizeHref('/checkout', languageStore.language)">{{ t('backToCheckout') }}</RouterLink>
  </div>

  <!-- PSP failed (failed/canceled/expired) -->
  <div v-else-if="paymentState === 'failed'">
    <h1>{{ t('paymentNotCompletedTitle') }}</h1>
    <RouterLink :to="localizeHref('/checkout', languageStore.language)">{{ t('tryAgain') }}</RouterLink>
    <RouterLink :to="localizeHref('/cart', languageStore.language)">{{ t('backToCart') }}</RouterLink>
  </div>
</template>
```

> **i18n:** add the new keys to `frontend/src/locales/{en,nl}/OrderConfirmation*`
> (or a new `MolliePayment.json`), matching the existing locale-file convention
> (`useTranslations`). New keys: `checkingPayment`, `checking`,
> `paymentStillOpenTitle`, `paymentStillOpenBody`, `checkPaymentStatus`,
> `backToCheckout`, `paymentNotCompletedTitle`, `tryAgain`, `backToCart`,
> `paymentStartFailed`.

---

## 5. Env + dependency

### 5.1 `frontend/package.json`
```jsonc
"dependencies": {
  "@propeller-commerce/propeller-v2-mollie": "^0.2.1",
  // ...existing
}
```
Then `npm install` (regen lockfile in the same commit).

### 5.2 `frontend/.env.example` (and the real `.env`)
```bash
# ── Payments (Mollie PSP) ───────────────────────────────────────────────
# Active provider. 'mollie' turns on the Mollie checkout flow.
PAYMENT_PROVIDER=mollie
VITE_PAYMENT_PROVIDER=mollie            # client mirror — keep in sync

# Mollie API keys — SERVER ONLY (no VITE_ prefix → never in the browser bundle).
MOLLIE_LIVE_KEY=live_xxxxxxxxxxxxxxxxxxxx
MOLLIE_TEST_KEY=test_xxxxxxxxxxxxxxxxxxxx
MOLLIE_TEST_MODE=true                   # true → test key, false → live key

# Methods that settle ON ACCOUNT (no PSP). Comma-sep, case-insensitive.
ON_ACCOUNT_PAYMENTS=REKENING,ON_ACCOUNT
VITE_ON_ACCOUNT_PAYMENTS=REKENING,ON_ACCOUNT   # client mirror

# ISO 4217 currency CODE sent to Mollie (NOT the display symbol). Default EUR.
VITE_CURRENCY_CODE=EUR

# Mollie POSTs the webhook to VITE_SITE_URL + /api/mollie/webhook, which must be
# PUBLICLY reachable over HTTPS. Mollie cannot reach localhost. In dev, tunnel
# (cloudflared/ngrok) and set MOLLIE_WEBHOOK_URL to the tunnel webhook URL.
# MOLLIE_WEBHOOK_URL=https://your-tunnel.example.com
```

> Reuses existing `VITE_SITE_URL` (redirect + webhook origin) and `SSR_*` keys
> (provider's direct GraphQL client). No new image-domain or build config.

---

## 6. server.js route-ordering checklist (the one integration risk)

The three `/api/mollie/*` handlers must be registered:
- **after** the body-parser/general middleware that the other `/api/*` routes use,
- **before** `app.use('*all', …)` (the SSR catch-all, currently last),
- with **scoped** body parsers (per-route `express.json` / `express.urlencoded`)
  so they don't intercept the `/api/graphql` proxy.

Path prefixes are distinct (`/api/mollie/*` vs `/api/graphql`, `/api/order-editor`,
`/api/revalidate`), so the only hard rule is "before `*all`".

---

## 7. Verification (manual, in Mollie test mode)

Mollie test mode lets you pick the outcome on the hosted page. Run a tunnel so
the webhook can reach the dev server.

1. `MOLLIE_TEST_MODE=true`, tunnel up, `MOLLIE_WEBHOOK_URL` = tunnel webhook.
2. **Paid** → redirected back to `…/thank-you/<id>?psp=mollie`; success UI; local
   cart **gone** (localStorage `cart` removed); order finalized by webhook.
3. **Open** → "Your payment is still open" UI; local cart **kept**; adding a
   product reuses the same cart; "Check payment status" re-queries and flips to
   success once paid.
4. **Failed / Canceled / Expired** → failure UI; local cart **kept**; retry works.
5. **On-account method** (e.g. REKENING) with Mollie on → bypasses PSP, order →
   `NEW`, straight to thank-you, cart cleared (current behavior).
6. **Mollie off** (`PAYMENT_PROVIDER` unset) → original flow unchanged.
7. `npm run build` (client + server) clean; `vue-tsc --noEmit` clean.

---

## 8. Cross-project hygiene (project rules)

- This is **app code** (`src/views`, `src/server`, `src/lib`, `server.js`) — not
  package code — so there is **no Vue-sync-to-package step** here. It does mirror
  the propeller-next host wiring; keep the two hosts conceptually aligned.
- Branch off `develop`; merge to `master` with `--no-ff`. Never commit directly
  to master.
- **No Claude / AI co-author trailer** in any commit.
- Do **not** commit real keys. `.env` stays gitignored; only `.env.example` is
  tracked. (propeller-next also gitignores `.npmrc` for its registry token —
  check propeller-vue does too if a private install token is ever added.)
- After build, update the memory notes `project-mollie-package` /
  `project-mollie-next-integration` (in propeller-next's memory dir) to record
  the Vue host as a third Mollie consumer.

---

## 9. Effort

| Task | Est. |
|---|---|
| `src/server/mollie.ts` + `src/lib/payments.ts` | 0.25d |
| 3 Express routes in `server.js` (incl. route-order verification) | 0.25d |
| `CheckoutView.vue` `handlePlaceOrder` + `startMolliePayment` | 0.5d |
| `OrderConfirmationView.vue` three-state machine + i18n | 1.0d |
| env, dependency, build/tsc, manual test (tunnel + 3 outcomes) | 0.5d |
| **Total** | **~2.5d** |

No package release cycle — the `~0.5d` worst case from the earlier estimate is
removed because `useCheckout().placeOrder` already supports `orderStatus` +
`finalizeOrder`.
