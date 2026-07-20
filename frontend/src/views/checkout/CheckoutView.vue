<template>
  <div class="min-h-[70vh] py-8 bg-surface-hover/20">
    <div class="container-width max-w-7xl">
      <h1 class="text-3xl font-bold mb-8">
        {{ isQuoteMode ? t.quotePageTitle : t.pageTitle }}
      </h1>

      <!-- Step indicator -->
      <div class="flex justify-between max-w-2xl mb-8 px-2">
        <template v-for="(label, i) in stepLabels" :key="label">
          <div
            v-if="i > 0"
            class="flex-1 border-t-2 border-dashed border-muted mx-4 mt-4"
          />
          <div
            :class="[
              'flex items-center gap-2',
              currentStep === i + 1
                ? 'text-primary font-bold'
                : currentStep > i + 1
                  ? 'text-secondary'
                  : 'text-muted-foreground',
            ]"
          >
            <div
              :class="[
                'w-8 h-8 rounded-full flex items-center justify-center border-2 text-sm',
                currentStep === i + 1
                  ? 'border-primary bg-primary text-primary-foreground'
                  : currentStep > i + 1
                    ? 'border-secondary bg-secondary/10 text-secondary'
                    : 'border-muted-foreground/30',
              ]"
            >
              <svg
                v-if="currentStep > i + 1"
                class="w-4 h-4"
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
              <span v-else>{{ i + 1 }}</span>
            </div>
            <span class="hidden md:inline">{{ label }}</span>
          </div>
        </template>
      </div>

      <div class="flex flex-col lg:flex-row gap-8">
        <div class="lg:w-2/3 space-y-6">
          <div
            v-if="error"
            class="bg-destructive/10 border border-destructive/20 p-4 rounded-[var(--radius-control)] text-destructive text-sm font-medium"
          >
            {{ error }}
          </div>

          <!-- Step 1: Invoice Address -->
          <div
            :class="[
              'bg-card rounded-[var(--radius-container)] shadow border',
              currentStep === 1
                ? 'ring-2 ring-primary border-primary'
                : 'opacity-80',
            ]"
          >
            <div
              class="p-6 cursor-pointer"
              @click="currentStep > 1 && (currentStep = 1)"
            >
              <div class="flex items-center justify-between">
                <h2 class="text-lg font-semibold">{{ t.step1Title }}</h2>
                <span
                  v-if="currentStep > 1 && cart?.invoiceAddress?.street"
                  class="text-sm text-muted-foreground border border-muted rounded px-2 py-0.5"
                >
                  {{ cart.invoiceAddress.street }}
                  {{ cart.invoiceAddress.number }},
                  {{ cart.invoiceAddress.city }}
                </span>
              </div>
            </div>
            <div v-if="currentStep === 1" class="px-6 pb-6 space-y-4">
              <AddressCard
                v-if="cart?.invoiceAddress?.street"
                :address="cart.invoiceAddress as CartAddress"
                :showEmail="true"
                :showFullName="true"
                :showStreet="true"
                :showPostalCode="true"
                :showCity="true"
                :showCountry="true"
                :showNumberExtension="true"
                :enableDelete="false"
                :enableSetDefault="false"
                :onEdit="(addr) => handleAddressSubmit(addr, 'INVOICE', false)"
                :countries="getCountries(languageStore.language)"
                :labels="addressCardLabels"
              />
              <template v-else>
                <AddressCard
                  :address="null"
                  :inline="true"
                  :isNew="true"
                  addressType="INVOICE"
                  :showIcp="false"
                  :beforeSave="
                    () => {
                      loading = true;
                      error = null;
                    }
                  "
                  :onEdit="(addr) => handleAddressSubmit(addr, 'INVOICE')"
                  :countries="getCountries(languageStore.language)"
                  :labels="addressCardLabels"
                />
                <label
                  v-if="!authStore.isAuthenticated"
                  class="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <input
                    type="checkbox"
                    v-model="sameAsInvoice"
                    class="rounded border-input text-primary focus:ring-primary"
                  />
                  {{ t.deliverySameAsInvoice }}
                </label>
              </template>
              <button
                v-if="cart?.invoiceAddress?.street"
                @click="currentStep = 2"
                class="bg-primary text-primary-foreground px-6 py-2 rounded-[var(--radius-container)] hover:bg-primary/90 transition"
              >
                {{ t.confirmInvoiceAddress }}
              </button>
            </div>
          </div>

          <!-- Step 2: Delivery Address -->
          <div
            :class="[
              'bg-card rounded-[var(--radius-container)] shadow border',
              currentStep === 2
                ? 'ring-2 ring-primary border-primary'
                : 'opacity-80',
            ]"
          >
            <div
              class="p-6 cursor-pointer"
              @click="currentStep > 2 && (currentStep = 2)"
            >
              <div class="flex items-center justify-between">
                <h2 class="text-lg font-semibold">{{ t.step2Title }}</h2>
                <span
                  v-if="currentStep > 2 && cart?.deliveryAddress?.street"
                  class="text-sm text-muted-foreground border border-muted rounded px-2 py-0.5"
                >
                  {{ cart.deliveryAddress.street }}
                  {{ cart.deliveryAddress.number }},
                  {{ cart.deliveryAddress.city }}
                </span>
              </div>
            </div>
            <div v-if="currentStep === 2" class="px-6 pb-6 space-y-4">
              <template v-if="cart?.deliveryAddress?.street">
                <AddressCard
                  :address="cart.deliveryAddress as CartAddress"
                  :showEmail="true"
                  :showFullName="true"
                  :showStreet="true"
                  :showPostalCode="true"
                  :showCity="true"
                  :showCountry="true"
                  :showNumberExtension="true"
                  :enableDelete="false"
                  :enableSetDefault="false"
                  :enableEdit="true"
                  :onEdit="
                    (addr) => handleAddressSubmit(addr, 'DELIVERY', false)
                  "
                  :countries="getCountries(languageStore.language)"
                  :labels="addressCardLabels"
                />
                <div class="flex items-center gap-4">
                  <button
                    @click="currentStep = 1"
                    class="px-6 py-2 border rounded-[var(--radius-container)] hover:bg-surface-hover transition"
                  >
                    {{ t.back }}
                  </button>
                  <button
                    @click="currentStep = 3"
                    class="bg-primary text-primary-foreground px-6 py-2 rounded-[var(--radius-container)] hover:bg-primary/90 transition"
                  >
                    {{ t.confirmDeliveryAddress }}
                  </button>
                  <AddressSelector
                    v-if="authStore.isAuthenticated"
                    :addressType="AddressType.delivery"
                    :onAddressSelected="
                      (addr) => handleAddressSubmit(addr, 'DELIVERY', true)
                    "
                    :countries="getCountries(languageStore.language)"
                    :labels="addressSelectorLabels"
                    class="ml-auto"
                  />
                </div>
              </template>
              <template v-else>
                <AddressCard
                  :address="null"
                  :inline="true"
                  :isNew="true"
                  addressType="DELIVERY"
                  :showIcp="false"
                  :beforeSave="
                    () => {
                      loading = true;
                      error = null;
                    }
                  "
                  :onEdit="(addr) => handleAddressSubmit(addr, 'DELIVERY')"
                  :countries="getCountries(languageStore.language)"
                  :labels="addressCardLabels"
                />
              </template>
            </div>
          </div>

          <!-- Step 3: Payment & Delivery (normal mode only) -->
          <div
            v-if="!isQuoteMode"
            :class="[
              'bg-card rounded-[var(--radius-container)] shadow border',
              currentStep === 3
                ? 'ring-2 ring-primary border-primary'
                : 'opacity-80',
            ]"
          >
            <div
              class="p-6 cursor-pointer"
              @click="currentStep > 3 && (currentStep = 3)"
            >
              <h2 class="text-lg font-semibold">{{ t.step3PaymentTitle }}</h2>
            </div>
            <div v-if="currentStep === 3" class="px-6 pb-6 space-y-8">
              <!-- Payment Method -->
              <div class="space-y-3">
                <h3
                  class="font-semibold text-sm uppercase tracking-wide flex items-center gap-2"
                >
                  {{ t.paymentMethodHeading }}
                </h3>
                <p
                  v-if="step3Submitted && !selectedPayment"
                  class="text-sm text-destructive"
                >
                  {{ t.selectPaymentError }}
                </p>
                <CartPaymethods
                  v-if="cart"
                  :cart="cart as Cart"
                  :onPaymethodSelect="(pm) => (selectedPayment = pm.code)"
                  :labels="cartPaymethodsLabels"
                  :paymethodLabels="paymethodNames"
                />
              </div>
              <!-- Carrier -->
              <div class="space-y-3">
                <h3 class="font-semibold text-sm uppercase tracking-wide">
                  {{ t.carrierHeading }}
                </h3>
                <p
                  v-if="step3Submitted && ((cart as any)?.carriers?.length ?? 0) > 0 && !selectedCarrier"
                  class="text-sm text-destructive"
                >
                  {{ t.selectCarrierError }}
                </p>
                <CartCarriers
                  v-if="cart"
                  :cart="cart as Cart"
                  :showPrice="false"
                  :onCarrierSelect="(c) => (selectedCarrier = c.name)"
                  :labels="cartCarriersLabels"
                />
              </div>
              <!-- Delivery Date -->
              <div class="space-y-3">
                <h3 class="font-semibold text-sm uppercase tracking-wide">
                  {{ t.deliveryDateHeading }}
                </h3>
                <p
                  v-if="step3Submitted && !selectedDeliveryDate"
                  class="text-sm text-destructive"
                >
                  {{ t.selectDeliveryDateError }}
                </p>
                <DeliveryDate
                  v-if="cart"
                  :cart="cart as Cart"
                  :initialDate="(cart as Cart)?.postageData?.requestDate"
                  :onDateSelect="(d) => (selectedDeliveryDate = d)"
                  :showUpcomingDays="3"
                  :skipWeekends="true"
                  :showDatePicker="true"
                  :labels="deliveryDateLabels"
                />
              </div>
              <div class="flex gap-4 pt-4">
                <button
                  @click="currentStep = 2"
                  class="px-6 py-2 border rounded-[var(--radius-container)] hover:bg-surface-hover transition"
                >
                  {{ t.back }}
                </button>
                <button
                  @click="handleStep3Continue"
                  :disabled="loading"
                  class="bg-primary text-primary-foreground px-6 py-2 rounded-[var(--radius-container)] disabled:opacity-50 hover:bg-primary/90 transition"
                >
                  {{ loading ? t.saving : t.continueToReview }}
                </button>
              </div>
            </div>
          </div>

          <!-- Step 3 (quote) / Step 4 (normal): Review -->
          <div
            :class="[
              'bg-card rounded-[var(--radius-container)] shadow border',
              currentStep === reviewStep
                ? 'ring-2 ring-primary border-primary'
                : 'opacity-80',
            ]"
          >
            <div class="p-6">
              <h2 class="text-lg font-semibold">
                {{ reviewStep }}.
                {{ isQuoteMode ? t.quoteDetailsTitle : t.reviewTitle }}
              </h2>
            </div>
            <div v-if="currentStep === reviewStep" class="px-6 pb-6 space-y-6">
              <template v-if="isQuoteMode">
                <div class="space-y-2">
                  <label
                    class="text-sm font-medium text-muted-foreground"
                    for="quote-reference"
                    >{{ t.reference }}</label
                  >
                  <input
                    id="quote-reference"
                    type="text"
                    v-model="quoteReference"
                    :placeholder="t.referencePlaceholder"
                    maxlength="255"
                    class="w-full border border-input rounded-[var(--radius-control)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
                <div class="space-y-2">
                  <label
                    class="text-sm font-medium text-muted-foreground"
                    for="quote-notes"
                    >{{ t.notes }}</label
                  >
                  <textarea
                    id="quote-notes"
                    v-model="quoteNotes"
                    :placeholder="t.notesPlaceholder"
                    rows="4"
                    maxlength="255"
                    class="w-full border border-input rounded-[var(--radius-control)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                  />
                </div>
                <div class="flex gap-4 pt-2">
                  <button
                    @click="currentStep = 2"
                    class="px-6 py-2 border rounded-[var(--radius-container)] hover:bg-surface-hover transition"
                  >
                    {{ t.back }}
                  </button>
                  <button
                    @click="
                      handlePlaceOrder(
                        quoteReference || undefined,
                        quoteNotes || undefined,
                      )
                    "
                    :disabled="loading"
                    class="bg-primary text-primary-foreground px-6 py-2 rounded-[var(--radius-container)] disabled:opacity-50 hover:bg-primary/90 transition"
                  >
                    {{ loading ? t.submitting : t.placeQuoteRequest }}
                  </button>
                </div>
              </template>
              <template v-else>
                <p
                  v-if="paymentStartError"
                  class="mb-4 rounded-[var(--radius-container)] border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                  role="alert"
                >
                  {{ paymentStartError }}
                </p>
                <CartOverview
                  v-if="cart"
                  :cart="cart as Cart"
                  :showTermsAndConditions="true"
                  :showReference="true"
                  :showNotes="true"
                  :showPurchaseButton="true"
                  :onTermsAndConditionsClick="() => openTermsAndConditions()"
                  :onPurchaseButtonClick="
                    (_cart, reference, notes) =>
                      handlePlaceOrder(reference, notes)
                  "
                  :labels="cartOverviewLabels"
                />
              </template>
            </div>
          </div>
        </div>

        <!-- Order Summary sidebar -->
        <div class="lg:w-1/3">
          <div class="sticky top-24 space-y-6">
            <div
              class="bg-card rounded-[var(--radius-container)] shadow border p-6"
            >
              <h3 class="text-lg font-semibold mb-4">{{ t.cartItemsTitle }}</h3>
              <ItemsOverview
                v-if="cart"
                :cart="cart as Cart"
                :showAvailability="false"
                :itemNameClickable="false"
                :showImage="true"
                :showSku="true"
                :showQuantity="true"
                :showPrice="true"
                :showStockComponent="true"
                :isChildItem="true"
                :labels="itemsOverviewLabels"
              />
            </div>
            <div
              class="bg-card rounded-[var(--radius-container)] shadow border p-6"
            >
              <CartSummary
                v-if="cart"
                :cart="cart as Cart"
                :title="t.orderSummaryTitle"
                :showCheckoutButton="false"
                :afterRequestAuthorization="handleAfterRequestAuthorization"
                :onError="
                  (err) => console.error('Authorization request failed:', err)
                "
                :labels="cartSummaryLabels"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import type { Cart, Contact, Customer, CartAddress } from "@propeller-commerce/propeller-sdk-v2";
import { AddressType } from "@propeller-commerce/propeller-sdk-v2";
import { useAuthStore } from "@/stores/auth";
import { useCartStore } from "@/stores/cart";
import { usePriceStore } from "@/stores/price";
import { useLanguageStore } from "@/stores/language";
import { useCompanyStore } from "@/stores/company";
import { graphqlClient } from "@/lib/api";
import { configuration, localizeHref } from "@/lib/config";
import { useTranslations } from "@/lib/i18n/composable";
import { restoreManagerCart } from "@/lib/cartHelpers";
import { isOnAccountMethod, isMollieEnabled } from "@/lib/payments";
import { useCheckout } from "@propeller-commerce/propeller-v2-vue-ui";
import type { AnyUser } from "@propeller-commerce/propeller-v2-vue-ui";

import { AddressCard, AddressSelector, CartCarriers, CartOverview, CartPaymethods, CartSummary, DeliveryDate, ItemsOverview } from '@propeller-commerce/propeller-v2-vue-ui';
import { getCountries } from "@/composables/shared/utils/countries";

const addressCardLabels = useTranslations('AddressCard');
const addressSelectorLabels = useTranslations('AddressSelector');
const cartCarriersLabels = useTranslations('CartCarriers');
const cartOverviewLabels = useTranslations('CartOverview');
const cartPaymethodsLabels = useTranslations('CartPaymethods');
const paymethodNames = useTranslations('PaymethodNames');
const cartSummaryLabels = useTranslations('CartSummary');
const molliePaymentLabels = useTranslations('MolliePayment');
const deliveryDateLabels = useTranslations('DeliveryDate');
const itemsOverviewLabels = useTranslations('ItemsOverview');
const t = useTranslations('CheckoutPage');

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const cartStore = useCartStore();
const priceStore = usePriceStore();
const languageStore = useLanguageStore();
const companyStore = useCompanyStore();

const {
  loading,
  error,
  updateCartAddress,
  updateCartSettings,
  placeOrder,
  getUserDefaultAddress,
  buildAddressInput,
} = useCheckout({
  graphqlClient,
  user: computed(() => authStore.user as AnyUser),
  companyId: computed(() => companyStore.companyId ?? undefined),
  language: computed(() => languageStore.language),
  configuration,
});

const isQuoteMode = computed(() => route.query.mode === "quote");
const reviewStep = computed(() => (isQuoteMode.value ? 3 : 4));
const stepLabels = computed(() =>
  isQuoteMode.value
    ? [t.value.stepDetails, t.value.stepShipping, t.value.stepReview]
    : [t.value.stepDetails, t.value.stepShipping, t.value.stepPayment, t.value.stepReview],
);

const cart = computed(() => cartStore.cart);
const currentStep = ref(1);
const selectedPayment = ref("");
const selectedCarrier = ref("");
const selectedDeliveryDate = ref("");
const sameAsInvoice = ref(false);
const step3Submitted = ref(false);
const quoteReference = ref("");
const quoteNotes = ref("");
const orderPlaced = ref(false);
// Idempotency guard for the PSP retry path: placeOrder converts the cart to an
// order server-side, and a payment-start failure keeps the cart for retry.
// Without this, a second Place Order click re-runs placeOrder on the SAME cart
// and (if the backend isn't idempotent) strands another UNFINISHED order. We
// remember the orderId this cart already produced and, on retry, skip straight
// to starting payment for that same order.
const placedOrder = ref<{ cartId: string; orderId: number } | null>(null);
// Surfaced when starting the Mollie payment fails after the order was placed —
// the order stays UNFINISHED and the cart is kept, so the shopper can retry.
const paymentStartError = ref("");

// COUNTRIES imported from shared utils
let lastInitCart: any = null;

async function initializeCheckout() {
  const c = cart.value as any;
  if (!c || !c.items || c.items.length === 0) {
    if (!orderPlaced.value)
      router.replace(localizeHref("/cart", languageStore.language));
    return;
  }

  if (
    lastInitCart &&
    lastInitCart.cartId === c.cartId &&
    lastInitCart.invoiceAddress?.street === c.invoiceAddress?.street &&
    lastInitCart.deliveryAddress?.street === c.deliveryAddress?.street
  )
    return;
  lastInitCart = c;

  const hasInvoice = !!c.invoiceAddress?.street;
  const hasDelivery = !!c.deliveryAddress?.street;

  if (authStore.isAuthenticated && (!hasInvoice || !hasDelivery)) {
    try {
      let updatedCart: Cart = c as Cart;

      if (!hasInvoice) {
        const defaultInvoice = getUserDefaultAddress("invoice");
        if (defaultInvoice) {
          const result = await updateCartAddress(
            updatedCart.cartId,
            "INVOICE",
            defaultInvoice,
          );
          if (result) updatedCart = result;
        }
      }

      if (!hasDelivery) {
        const defaultDelivery = getUserDefaultAddress("delivery");
        if (defaultDelivery) {
          const result = await updateCartAddress(
            updatedCart.cartId,
            "DELIVERY",
            defaultDelivery,
          );
          if (result) updatedCart = result;
        }
      }

      cartStore.setCart(updatedCart);
    } catch (e) {
      console.error("Error pre-populating cart addresses:", e);
    }
  }

  const finalCart = cart.value as any;
  const updatedHasInvoice = !!finalCart?.invoiceAddress?.street;
  const updatedHasDelivery = !!finalCart?.deliveryAddress?.street;
  if (updatedHasInvoice && updatedHasDelivery) currentStep.value = 3;
  else if (updatedHasInvoice) currentStep.value = 2;
  else currentStep.value = 1;
}

async function handleAddressSubmit(
  addressData: any,
  type: "INVOICE" | "DELIVERY",
  advance = true,
) {
  const updatedCart = await updateCartAddress(
    (cart.value as any).cartId,
    type,
    addressData,
  );
  if (!updatedCart) return;
  cartStore.setCart(updatedCart);

  if (
    advance &&
    type === "INVOICE" &&
    !authStore.isAuthenticated &&
    sameAsInvoice.value
  ) {
    const deliveryInput = buildAddressInput("DELIVERY", addressData);
    const deliveryCart = await updateCartAddress(
      updatedCart.cartId,
      "DELIVERY",
      deliveryInput,
    );
    if (deliveryCart) cartStore.setCart(deliveryCart);
    currentStep.value = 3;
    return;
  }

  if (advance) {
    const hasInvoice = !!(updatedCart as any).invoiceAddress?.street;
    const hasDelivery = !!(updatedCart as any).deliveryAddress?.street;
    if (hasInvoice && hasDelivery) currentStep.value = 3;
    else if (hasInvoice) currentStep.value = 2;
    else currentStep.value = currentStep.value + 1;
  }
}

// First available delivery date — tomorrow, skipping weekends. Mirrors the
// tile-0 logic inside the `DeliveryDate` component (`computeUpcomingDates(1,
// true)` + `toApiDate`) so an auto-advance picks the same date the user would
// have seen highlighted on the quick-pick row. ISO `YYYY-MM-DDT00:00:00Z`.
function computeFirstDeliveryDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}T00:00:00Z`;
}

// One-shot guard for the step-3 auto-advance: we only auto-skip step 3 the
// FIRST time we enter it for a given cart. Otherwise clicking Back from step 4
// (or expanding the step-3 header) would immediately push the user right back
// to step 4, making step 3 unreachable in single-option carts.
const autoAdvancedCartId = ref<string | null>(null);

// Auto-advance step 3 → 4 when the cart offers only ONE payment method and at
// most ONE carrier. Preselects payment + carrier (if any) + the first available
// delivery date, persists via `updateCartSettings`, then jumps to step 4. Falls
// through to the normal step-3 UI when a precondition isn't met (no payments
// yet, multi-option, quote mode).
watch(
  [currentStep, cart, isQuoteMode],
  async () => {
    if (currentStep.value !== 3) return;
    if (isQuoteMode.value) return;
    const c = cart.value as any;
    if (!c?.cartId) return;
    if (autoAdvancedCartId.value === c.cartId) return;
    const payMethods = (c.payMethods ?? []) as { code?: string }[];
    const carriers = (c.carriers ?? []) as { name?: string }[];
    if (payMethods.length !== 1) return;
    if (carriers.length > 1) return;
    const onlyPayment = payMethods[0]?.code;
    const onlyCarrier = carriers[0]?.name;
    if (!onlyPayment) return;
    const requestDate =
      (c.postageData?.requestDate as string | undefined) || computeFirstDeliveryDate();
    autoAdvancedCartId.value = c.cartId;
    try {
      const updatedCart = await updateCartSettings(c.cartId, {
        paymentMethod: onlyPayment,
        ...(onlyCarrier ? { carrier: onlyCarrier } : {}),
        requestDate,
      });
      if (updatedCart) {
        cartStore.setCart(updatedCart);
        selectedPayment.value = onlyPayment;
        selectedCarrier.value = onlyCarrier ?? "";
        selectedDeliveryDate.value = requestDate;
        currentStep.value = 4;
      }
    } catch (e) {
      // On failure, release the one-shot guard so the user can try Continue
      // manually. The normal step-3 UI is still rendered.
      autoAdvancedCartId.value = null;
      console.error("[checkout] auto-advance step 3 failed:", e);
    }
  },
  { immediate: true },
);

async function handleStep3Continue() {
  // A carrier is only required when the cart actually offers one. Some carts
  // (e.g. digital-only or business-rule configs) return no carriers; in that
  // case CartCarriers shows "No carriers available." and never fires a
  // selection, so requiring one here would dead-end the checkout.
  const hasCarriers = ((cart.value as any)?.carriers?.length ?? 0) > 0;
  if (
    !selectedPayment.value ||
    (hasCarriers && !selectedCarrier.value) ||
    !selectedDeliveryDate.value
  ) {
    step3Submitted.value = true;
    return;
  }
  const updatedCart = await updateCartSettings((cart.value as any).cartId, {
    paymentMethod: selectedPayment.value,
    ...(selectedCarrier.value ? { carrier: selectedCarrier.value } : {}),
    requestDate: selectedDeliveryDate.value,
  });
  if (updatedCart) {
    cartStore.setCart(updatedCart);
    currentStep.value = 4;
  }
}

async function handlePlaceOrder(reference?: string, notes?: string) {
  orderPlaced.value = true;
  paymentStartError.value = "";

  const quote = isQuoteMode.value;
  // Source of truth for the payment method is the cart's PERSISTED method
  // (`paymentData.method`), not the local `selectedPayment` ref — the ref can
  // drift out of sync with the cart (e.g. the cart is reloaded after selection,
  // or the user navigates back), but the order is placed against whatever is on
  // the cart. Reading the ref instead would mis-route a PSP method (IDEAL) as
  // on-account → NEW + finalized, skipping Mollie and clearing the cart. Fall
  // back to the ref only if the cart somehow has no method yet.
  const paymentMethod =
    (cart.value as any)?.paymentData?.method || selectedPayment.value;
  const onAccount = isOnAccountMethod(paymentMethod);
  // PSP path only when Mollie is on, it's a real sale, and the method isn't
  // settled on account.
  const goesThroughMollie = !quote && !onAccount && isMollieEnabled();

  // quote → REQUEST · via Mollie → UNFINISHED (the webhook finalizes it on
  // `paid`) · everything else → NEW (settled immediately, no PSP).
  const orderStatus = quote ? "REQUEST" : goesThroughMollie ? "UNFINISHED" : "NEW";

  const cartId = (cart.value as any).cartId;

  // Retry after a payment-start failure: this cart was already converted to an
  // order by a prior placeOrder. Reuse that orderId and re-run only the Mollie
  // hand-off instead of placing the order again (which would strand a duplicate
  // UNFINISHED order on a non-idempotent backend).
  const alreadyPlaced =
    goesThroughMollie && placedOrder.value?.cartId === cartId
      ? placedOrder.value.orderId
      : null;

  const result = alreadyPlaced
    ? ({ ok: true as const, data: { orderId: alreadyPlaced } })
    : await placeOrder(cartId, {
        isQuoteMode: quote,
        reference,
        notes,
        orderStatus,
        // A Mollie order is finalized later by the payment webhook (on paid): don't
        // send the confirmation email / clear the backend cart at placement.
        ...(goesThroughMollie ? { finalizeOrder: false } : {}),
      });

  if (!result.ok) {
    orderPlaced.value = false;
    return;
  }

  const orderId = result.data.orderId;
  // Remember the order this cart produced so a payment-start retry reuses it.
  // Only PSP orders keep the cart around to retry against.
  if (goesThroughMollie) placedOrder.value = { cartId, orderId };

  // PSP step: hand off to Mollie's hosted checkout.
  if (goesThroughMollie) {
    const checkoutUrl = await startMolliePayment(orderId, paymentMethod);
    if (checkoutUrl) {
      window.location.href = checkoutUrl; // hard redirect off-site
      return;
    }
    // Start failed: keep the cart, surface the error, let them retry. The order
    // stays UNFINISHED — Mollie can still be retried, or it ages out.
    orderPlaced.value = false;
    paymentStartError.value =
      molliePaymentLabels.value.startFailed ??
      "Could not start the payment. Please try again.";
    return;
  }

  // Non-PSP path (on-account / quote / Mollie off): unchanged behaviour.
  // Restore the manager's parked cart if they were acting on a requester's
  // authorization cart; otherwise clear.
  cartStore.setCart(restoreManagerCart());
  const thankYouUrl =
    localizeHref(`/checkout/thank-you/${orderId}`, languageStore.language) +
    (quote ? "?mode=quote" : "");
  router.push(thankYouUrl);
}

/**
 * Create the Mollie payment for a just-placed order and return its hosted
 * checkout URL (or null on failure). Stashes the Mollie payment id in
 * sessionStorage so the return page can resolve the real outcome — Mollie sends
 * every outcome back to the same redirect URL.
 */
async function startMolliePayment(
  orderId: number,
  paymentMethod: string,
): Promise<string | null> {
  try {
    const total = (cart.value as any)?.total;
    // Mollie collects the gross (incl. VAT) amount the shopper pays.
    const amount = total?.totalGross ?? total?.totalNet;
    if (amount === undefined || amount === null) return null;

    const origin = (
      import.meta.env.VITE_SITE_URL || window.location.origin
    ).replace(/\/$/, "");
    // `psp=mollie` marks this as a PSP return so the thank-you page resolves the
    // real payment outcome instead of assuming success.
    const redirectUrl =
      origin +
      localizeHref(`/checkout/thank-you/${orderId}`, languageStore.language) +
      "?psp=mollie";

    const res = await fetch("/api/mollie/create-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId,
        amount,
        currency: import.meta.env.VITE_CURRENCY_CODE || "EUR",
        method: paymentMethod,
        description: `Order ${orderId}`,
        redirectUrl,
        ...(authStore.user?.userId
          ? { userId: Number(authStore.user.userId) }
          : {}),
      }),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      checkoutUrl?: string;
      paymentId?: string;
    };
    if (data.paymentId && typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(
          `mollie_payment_${orderId}`,
          data.paymentId,
        );
      } catch {
        /* sessionStorage unavailable — the return page falls back to order status */
      }
    }
    return data.checkoutUrl ?? null;
  } catch (e) {
    console.error("startMolliePayment failed", e);
    return null;
  }
}

function openTermsAndConditions() {
  window.open("/terms-conditions", "_blank");
}

function handleAfterRequestAuthorization(updatedCart: Cart) {
  // If a manager parked their own cart to act on this request, hand it back;
  // otherwise clear.
  cartStore.setCart(restoreManagerCart());
  router.push(
    localizeHref(
      `/authorization-request-sent/${updatedCart.cartId}`,
      languageStore.language,
    ),
  );
}

watch(
  [() => cartStore.cart, () => authStore.isAuthenticated],
  () => {
    initializeCheckout();
  },
  { immediate: false },
);

onMounted(() => initializeCheckout());
</script>
