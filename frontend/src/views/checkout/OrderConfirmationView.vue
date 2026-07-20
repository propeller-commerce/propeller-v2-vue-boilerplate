<template>
  <div class="min-h-[70vh] py-12 bg-surface-hover">
    <!-- Loading -->
    <div
      v-if="loading"
      class="container mx-auto px-4 max-w-3xl space-y-8 animate-pulse"
    >
      <div
        class="h-24 bg-surface-hover rounded-[var(--radius-container)] w-full"
      ></div>
      <div
        class="h-64 bg-surface-hover rounded-[var(--radius-container)] w-full"
      ></div>
    </div>

    <!-- Error -->
    <AccessErrorView
      v-else-if="error"
      :kind="classifyApiError(error)"
      class="container mx-auto px-4"
    />

    <!-- PSP: resolving the Mollie outcome -->
    <div
      v-else-if="isPspReturn && paymentState === 'resolving'"
      class="container mx-auto px-4 max-w-3xl space-y-8 animate-pulse"
    >
      <div
        class="h-24 bg-surface-hover rounded-[var(--radius-container)] w-full"
      ></div>
      <div
        class="h-64 bg-surface-hover rounded-[var(--radius-container)] w-full"
      ></div>
    </div>

    <!-- PSP: payment still open / pending -->
    <div
      v-else-if="isPspReturn && paymentState === 'pending'"
      class="container mx-auto px-4"
    >
      <div class="max-w-2xl mx-auto text-center py-12">
        <div
          class="w-20 h-20 bg-warning/10 rounded-full flex items-center justify-center mx-auto mb-6"
        >
          <svg
            class="w-10 h-10 text-warning"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h1 class="text-3xl font-bold text-foreground mb-4">
          {{ molliePaymentLabels.pendingTitle }}
        </h1>
        <p class="text-lg text-muted-foreground mb-8">
          {{ molliePaymentLabels.pendingBody }}
        </p>
        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            type="button"
            :disabled="rechecking"
            class="px-8 py-3 bg-primary text-primary-foreground rounded-[var(--radius-container)] font-semibold hover:bg-primary/80 transition disabled:opacity-50"
            @click="recheckStatus"
          >
            {{
              rechecking
                ? molliePaymentLabels.checking
                : molliePaymentLabels.checkStatus
            }}
          </button>
          <router-link
            :to="localizeHref('/checkout', languageStore.language)"
            class="px-8 py-3 bg-card border-2 border-primary text-primary rounded-[var(--radius-container)] font-semibold hover:bg-primary/5 transition text-center"
          >
            {{ molliePaymentLabels.backToCheckout }}
          </router-link>
        </div>
      </div>
    </div>

    <!-- PSP: payment failed / canceled / expired -->
    <div
      v-else-if="isPspReturn && paymentState === 'failed'"
      class="container mx-auto px-4"
    >
      <div class="max-w-2xl mx-auto text-center py-12">
        <div
          class="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6"
        >
          <svg
            class="w-10 h-10 text-destructive"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
        <h1 class="text-3xl font-bold text-foreground mb-4">
          {{ molliePaymentLabels.failedTitle }}
        </h1>
        <p class="text-lg text-muted-foreground mb-8">
          {{ molliePaymentLabels.failedBody }}
        </p>
        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <router-link
            :to="localizeHref('/checkout', languageStore.language)"
            class="px-8 py-3 bg-primary text-primary-foreground rounded-[var(--radius-container)] font-semibold hover:bg-primary/80 transition text-center"
          >
            {{ molliePaymentLabels.tryAgain }}
          </router-link>
          <router-link
            :to="localizeHref('/cart', languageStore.language)"
            class="px-8 py-3 bg-card border-2 border-primary text-primary rounded-[var(--radius-container)] font-semibold hover:bg-primary/5 transition text-center"
          >
            {{ molliePaymentLabels.backToCart }}
          </router-link>
        </div>
      </div>
    </div>

    <!-- Success (non-PSP arrival, or a resolved paid/authorized PSP return) -->
    <div
      v-else-if="!isPspReturn || paymentState === 'success'"
      class="container mx-auto px-4"
    >
      <div class="max-w-4xl mx-auto">
        <!-- Header -->
        <div class="text-center mb-12">
          <div
            class="w-20 h-20 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <svg
              class="w-10 h-10 text-secondary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 class="text-4xl font-bold text-foreground mb-4">
            {{ isQuoteMode ? t.thankYouQuoteTitle : t.thankYouOrderTitle }}
          </h1>
          <p class="text-lg text-muted-foreground">
            {{ isQuoteMode ? t.thankYouQuoteText : t.thankYouOrderText }}
          </p>
        </div>

        <div v-if="order" class="space-y-8">
          <!-- Order Summary -->
          <div
            class="bg-card rounded-[var(--radius-container)] shadow-sm border border-border p-6"
          >
            <OrderSummary
              :order="order"
              :countries="getCountries(languageStore.language)"
              :title="isQuoteMode ? t.quoteSummaryTitle : t.orderSummaryTitle"
              :showReference="true"
              :showNotes="true"
              :showDeliveryAddress="true"
              :showInvoiceAddress="true"
              :showOrderNumber="true"
              :showOrderDate="true"
              :showOrderStatus="true"
              :showOrderTotal="true"
              :showDeliveryInfo="true"
              :showRemarks="true"
              :labels="summaryLabels"
              :statusLabels="orderStatusLabels"
              :paymethodLabels="paymethodNames"
            />
          </div>

          <!-- Order Overview -->
          <div class="pt-10">
            <h2 class="text-2xl font-bold mb-6">{{ isQuoteMode ? t.quoteOverviewTitle : t.orderOverviewTitle }}</h2>

            <!-- Regular Products -->
            <div
              v-if="parentItems.length > 0"
              class="bg-card rounded-[var(--radius-container)] shadow overflow-hidden mb-8"
            >
              <table class="w-full">
                <thead class="bg-surface-hover border-b">
                  <tr>
                    <th
                      class="px-6 py-4 text-left text-sm font-medium text-muted-foreground w-2/3"
                    >
                      {{ t.colProduct }}
                    </th>
                    <th
                      class="px-6 py-4 text-center text-sm font-medium text-muted-foreground"
                    >
                      {{ t.colQuantity }}
                    </th>
                    <th
                      class="px-6 py-4 text-right text-sm font-medium text-muted-foreground"
                    >
                      {{ t.colPrice }}
                    </th>
                  </tr>
                </thead>

                <OrderItemCard
                  v-for="item in parentItems"
                  :key="item.id"
                  :orderItem="item"
                  :childItems="childMap.get(item.id) || []"
                  :titleLinkable="true"
                  :showImage="true"
                  :showSku="true"
                  :showQuantity="true"
                  :showPrice="true"
                  :labels="orderItemCardLabels"
                />
              </table>
            </div>

            <!-- Bonus Items -->
            <OrderBonusItems :order="order" :labels="orderBonusItemsLabels" />
          </div>

          <!-- Actions -->
          <div class="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <router-link
              v-if="authStore.isAuthenticated"
              :to="localizeHref(isQuoteMode ? '/account/quotes' : '/account/orders', languageStore.language)"
              class="px-8 py-3 bg-card border-2 border-primary text-primary rounded-[var(--radius-container)] font-semibold hover:bg-primary/5 transition text-center"
            >
              {{ isQuoteMode ? t.viewQuoteHistory : t.viewOrderHistory }}
            </router-link>
            <router-link
              :to="localizeHref('/', languageStore.language)"
              class="px-8 py-3 bg-primary text-primary-foreground rounded-[var(--radius-container)] font-semibold hover:bg-primary/80 transition text-center"
            >
              {{ t.continueShopping }}
            </router-link>
          </div>

          <div class="text-center text-muted-foreground pt-4">
            <p>
              {{ t.questionsBefore }}
              <router-link
                :to="localizeHref('/contact', languageStore.language)"
                class="text-primary hover:underline"
                >{{ t.contactLink }}</router-link
              >.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import type { OrderItem } from "@propeller-commerce/propeller-sdk-v2";
import { useAuthStore } from "@/stores/auth";
import { useCartStore } from "@/stores/cart";
import { restoreManagerCart } from "@/lib/cartHelpers";
import { useLanguageStore } from "@/stores/language";
import { graphqlClient } from "@/lib/api";
import { configuration, localizeHref } from "@/lib/config";
import AccessErrorView from "@/components/access/AccessErrorView.vue";
import { classifyApiError } from "@/lib/errors";
import { useOrders } from "@propeller-commerce/propeller-v2-vue-ui";
import type { AnyUser } from "@propeller-commerce/propeller-v2-vue-ui";
import { OrderBonusItems, OrderItemCard, OrderSummary } from '@propeller-commerce/propeller-v2-vue-ui';
import { useTranslations } from '@/lib/i18n/composable';
import { getCountries } from "@/composables/shared/utils/countries";

const orderSummaryLabels = useTranslations('OrderSummary');
const orderStatusLabels = useTranslations('OrderStatus');
const paymethodNames = useTranslations('PaymethodNames');
const orderItemCardLabels = useTranslations('OrderItemCard');
const orderBonusItemsLabels = useTranslations('OrderBonusItems');
const molliePaymentLabels = useTranslations('MolliePayment');
const t = useTranslations('CheckoutThankYou');

const route = useRoute();
const authStore = useAuthStore();
const cartStore = useCartStore();
const languageStore = useLanguageStore();

const orderId = computed(() => route.params.orderId as string);
const isQuoteMode = computed(() => route.query.mode === "quote");

// In quote mode the summary is for a quote *request* — override OrderSummary's
// order-number/date labels with request wording.
const summaryLabels = computed(() =>
  isQuoteMode.value
    ? { ...orderSummaryLabels.value, orderNumber: t.value.quoteNumber, orderDate: t.value.quoteDate }
    : orderSummaryLabels.value,
);

// ── Mollie PSP return resolution ────────────────────────────────────────────
//
// Mollie redirects the shopper back to this page for EVERY outcome (paid, open,
// failed, canceled, expired all land on the same `?psp=mollie` URL), and the
// webhook that finalizes the order is asynchronous — so the order status alone
// can't tell `open` from `failed` (both are UNFINISHED). We ask Mollie directly
// via /api/mollie/payment-status and branch into three return-page states.
//
// The LOCAL cart is cleared ONLY on success (paid/authorized) — keeping it on
// open/pending/failed leaves it in sync with the still-live backend cart so a
// retry reuses the same un-finalized order instead of stranding it. (This is a
// separate rule from the package's server-side webhook cart ladder.)
const SUCCESS_MOLLIE_STATUSES = new Set(["paid", "authorized"]);
const PENDING_MOLLIE_STATUSES = new Set(["open", "pending"]);
const FAILED_MOLLIE_STATUSES = new Set([
  "failed",
  "canceled",
  "cancelled",
  "expired",
]);

// Mollie redirects the shopper back the instant they finish the hosted
// checkout, but it flips the payment to `paid` and fires the webhook a beat
// later (async). So the first status check on return very often still reads
// `open` even though the payment succeeds seconds later — stranding the shopper
// on the "payment still open" screen. Auto-poll a bounded number of times
// before settling on the pending UI: this resolves the common redirect⇄webhook
// race without an unbounded loop. `failed`/`canceled`/`expired` resolve
// immediately (no poll); genuinely slow methods fall through to the pending
// screen with its manual "Check payment status" button intact.
const PENDING_POLL_ATTEMPTS = 5; // total status checks before showing pending
const PENDING_POLL_INTERVAL_MS = 2000; // ~8s of polling across the 5 attempts

type PaymentState =
  | "none"
  | "resolving"
  | "success"
  | "pending"
  | "failed";

interface MollieStatusResponse {
  ok?: boolean;
  status?: string;
  settled?: boolean;
  paymentId?: string;
  orderId?: number;
  error?: string;
}

const isPspReturn = computed(() => route.query.psp === "mollie");
const paymentState = ref<PaymentState>("none");
const mollieStatus = ref<string | null>(null);
const rechecking = ref(false);
let cartCleared = false;

const stashKey = computed(() => `mollie_payment_${orderId.value}`);

function readStash(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(stashKey.value);
  } catch {
    return null;
  }
}

function dropStash() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(stashKey.value);
  } catch {
    /* sessionStorage unavailable */
  }
}

/**
 * Map a live Mollie status to a return-page state and apply it. Returns whether
 * the status is TERMINAL (success/failed → stop polling) or not (open/pending/
 * unknown → keep polling). The pending/unknown branches set `paymentState` to
 * `"pending"` so a caller that has exhausted its attempts lands on the right UI.
 */
function applyMollieStatus(data: MollieStatusResponse): { terminal: boolean } {
  const status = (data.status || "").toLowerCase();
  mollieStatus.value = status || null;
  if (data.ok && SUCCESS_MOLLIE_STATUSES.has(status)) {
    paymentState.value = "success"; // → cart-clear watcher fires
    dropStash();
    return { terminal: true };
  }
  if (FAILED_MOLLIE_STATUSES.has(status)) {
    paymentState.value = "failed"; // keep cart
    return { terminal: true };
  }
  // open / pending / unknown → not resolved yet; keep cart, keep polling.
  paymentState.value = "pending";
  return { terminal: false };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Resolve the PSP outcome on return from Mollie, polling a bounded number of
 * times while still open/pending to absorb the redirect⇄webhook race (see
 * PENDING_POLL_* above). Stays in `resolving` (spinner) during the retries so
 * the shopper doesn't see a premature "open" flash; settles on `pending` once
 * attempts are exhausted (the manual re-check button remains).
 */
async function resolvePspReturn() {
  paymentState.value = "resolving";
  const paymentId = readStash();

  if (!paymentId) {
    // No stashed id (e.g. returned on another device / lost session). Fall back
    // to the order status as a best-effort signal.
    const status = (
      (order.value as any)?.paymentData?.status ||
      (order.value as any)?.status ||
      ""
    ).toUpperCase();
    paymentState.value =
      status === "PAID" || status === "NEW" || status === "AUTHORIZED"
        ? "success"
        : "pending";
    return;
  }

  for (let attempt = 1; attempt <= PENDING_POLL_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(
        `/api/mollie/payment-status?paymentId=${encodeURIComponent(paymentId)}`,
      );
      const data = (await res.json()) as MollieStatusResponse;
      const { terminal } = applyMollieStatus(data);
      if (terminal) return;
    } catch {
      // network error → treat as not-yet-resolved; keep cart, keep polling.
      paymentState.value = "pending";
    }
    if (attempt < PENDING_POLL_ATTEMPTS) {
      // Stay in the resolving spinner between attempts, not the pending screen.
      paymentState.value = "resolving";
      await sleep(PENDING_POLL_INTERVAL_MS);
    } else {
      paymentState.value = "pending"; // exhausted → settle on pending
    }
  }
}

/** Manual re-check for a pending (open) payment. */
async function recheckStatus() {
  const paymentId = readStash();
  if (!paymentId) {
    // Lost the id → refresh order details from the backend instead.
    await fetchOrder(Number(orderId.value));
    return;
  }
  rechecking.value = true;
  try {
    const res = await fetch(
      `/api/mollie/payment-status?paymentId=${encodeURIComponent(paymentId)}`,
    );
    const data = (await res.json()) as MollieStatusResponse;
    applyMollieStatus(data);
  } catch {
    /* leave pending on transient error */
  } finally {
    rechecking.value = false;
  }
}

// Clear the LOCAL cart ONLY on success (paid/authorized). Mirror every
// non-PSP completion path: if a manager paid a requester's authorization cart
// by card, their own cart was parked in `manager_cart` — restore it instead of
// clearing, else it's orphaned. setCart(null) when nothing was parked == clear.
watch(paymentState, (s) => {
  if (!isPspReturn.value || cartCleared) return;
  if (s === "success") {
    cartCleared = true;
    cartStore.setCart(restoreManagerCart());
  }
});

const {
  fetchOrder,
  currentOrder: order,
  orderLoading: loading,
  error,
} = useOrders({
  graphqlClient,
  user: computed(() => authStore.user as AnyUser),
  language: computed(() => languageStore.language),
  configuration,
});

// Authoritative override: a PAID/AUTHORIZED backend order means the webhook
// already confirmed AND finalized the payment — that's the source of truth,
// regardless of what the (async, occasionally lagging) live Mollie poll
// returned. Promote to success so a confirmed-paid order can never strand the
// shopper on the "payment still open" screen. Only upgrades toward success.
watch(
  order,
  (o) => {
    if (!isPspReturn.value || !o) return;
    const orderStatus = (
      (o as any).paymentData?.status ||
      (o as any).status ||
      ""
    ).toUpperCase();
    if (orderStatus === "PAID" || orderStatus === "AUTHORIZED") {
      paymentState.value = "success"; // → cart-clear watcher fires
      dropStash();
    }
  },
  { immediate: true },
);

const parentItems = computed<OrderItem[]>(() => {
  const all: OrderItem[] =
    order.value?.items?.filter(
      (i: OrderItem) => i.class === "product" && i.isBonus === "N",
    ) || [];
  return all.filter((i) => !i.parentOrderItemId);
});

const childMap = computed<Map<number, OrderItem[]>>(() => {
  const map = new Map<number, OrderItem[]>();
  const all: OrderItem[] =
    order.value?.items?.filter(
      (i: OrderItem) => i.class === "product" && i.isBonus === "N",
    ) || [];
  all
    .filter((i) => i.parentOrderItemId)
    .forEach((i) => {
      const children = map.get(i.parentOrderItemId!) || [];
      children.push(i);
      map.set(i.parentOrderItemId!, children);
    });
  return map;
});

onMounted(async () => {
  if (!orderId.value) return;
  await fetchOrder(Number(orderId.value));
  if (isPspReturn.value) await resolvePspReturn();
});
</script>
