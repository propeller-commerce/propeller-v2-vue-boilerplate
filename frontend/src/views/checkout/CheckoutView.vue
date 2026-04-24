<template>
  <div class="min-h-[70vh] py-8 bg-surface-hover/20">
    <div class="container-width max-w-7xl">
      <h1 class="text-3xl font-bold mb-8">
        {{ isQuoteMode ? "Quote Request" : "Checkout" }}
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
                <h2 class="text-lg font-semibold">1. Invoice Address</h2>
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
                :countries="COUNTRIES"
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
                  :countries="COUNTRIES"
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
                  Delivery address same as invoice address
                </label>
              </template>
              <button
                v-if="cart?.invoiceAddress?.street"
                @click="currentStep = 2"
                class="bg-primary text-primary-foreground px-6 py-2 rounded-[var(--radius-container)] hover:bg-primary/90 transition"
              >
                Confirm Invoice Address
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
                <h2 class="text-lg font-semibold">2. Shipping Address</h2>
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
                  :countries="COUNTRIES"
                />
                <div class="flex items-center gap-4">
                  <button
                    @click="currentStep = 1"
                    class="px-6 py-2 border rounded-[var(--radius-container)] hover:bg-surface-hover transition"
                  >
                    Back
                  </button>
                  <button
                    @click="currentStep = 3"
                    class="bg-primary text-primary-foreground px-6 py-2 rounded-[var(--radius-container)] hover:bg-primary/90 transition"
                  >
                    Confirm Delivery Address
                  </button>
                  <AddressSelector
                    v-if="authStore.isAuthenticated"
                    :user="authStore.user as Contact | Customer | null"
                    :companyId="companyStore.companyId ?? undefined"
                    :addressType="Enums.AddressType.delivery"
                    :onAddressSelected="
                      (addr) => handleAddressSubmit(addr, 'DELIVERY', true)
                    "
                    :countries="COUNTRIES"
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
                  :countries="COUNTRIES"
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
              <h2 class="text-lg font-semibold">3. Payment &amp; Delivery</h2>
            </div>
            <div v-if="currentStep === 3" class="px-6 pb-6 space-y-8">
              <!-- Payment Method -->
              <div class="space-y-3">
                <h3
                  class="font-semibold text-sm uppercase tracking-wide flex items-center gap-2"
                >
                  Payment Method
                </h3>
                <p
                  v-if="step3Submitted && !selectedPayment"
                  class="text-sm text-destructive"
                >
                  Please select a payment method
                </p>
                <CartPaymethods
                  v-if="cart"
                  :cart="cart as Cart"
                  :user="authStore.user as Contact | Customer"
                  :onPaymethodSelect="(pm) => (selectedPayment = pm.code)"
                />
              </div>
              <!-- Carrier -->
              <div class="space-y-3">
                <h3 class="font-semibold text-sm uppercase tracking-wide">
                  Carrier
                </h3>
                <p
                  v-if="step3Submitted && !selectedCarrier"
                  class="text-sm text-destructive"
                >
                  Please select a carrier
                </p>
                <CartCarriers
                  v-if="cart"
                  :cart="cart as Cart"
                  :showPrice="false"
                  :onCarrierSelect="(c) => (selectedCarrier = c.name)"
                />
              </div>
              <!-- Delivery Date -->
              <div class="space-y-3">
                <h3 class="font-semibold text-sm uppercase tracking-wide">
                  Delivery Date
                </h3>
                <p
                  v-if="step3Submitted && !selectedDeliveryDate"
                  class="text-sm text-destructive"
                >
                  Please select a delivery date
                </p>
                <DeliveryDate
                  v-if="cart"
                  :cart="cart as Cart"
                  :initialDate="(cart as Cart)?.postageData?.requestDate"
                  :onDateSelect="(d) => (selectedDeliveryDate = d)"
                  :showUpcomingDays="3"
                  :skipWeekends="true"
                  :showDatePicker="true"
                />
              </div>
              <div class="flex gap-4 pt-4">
                <button
                  @click="currentStep = 2"
                  class="px-6 py-2 border rounded-[var(--radius-container)] hover:bg-surface-hover transition"
                >
                  Back
                </button>
                <button
                  @click="handleStep3Continue"
                  :disabled="loading"
                  class="bg-primary text-primary-foreground px-6 py-2 rounded-[var(--radius-container)] disabled:opacity-50 hover:bg-primary/90 transition"
                >
                  {{ loading ? "Saving..." : "Continue to Review" }}
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
                {{ isQuoteMode ? "Quote Details" : "Review & Place Order" }}
              </h2>
            </div>
            <div v-if="currentStep === reviewStep" class="px-6 pb-6 space-y-6">
              <template v-if="isQuoteMode">
                <div class="space-y-2">
                  <label
                    class="text-sm font-medium text-muted-foreground"
                    for="quote-reference"
                    >Reference</label
                  >
                  <input
                    id="quote-reference"
                    type="text"
                    v-model="quoteReference"
                    placeholder="Your reference (optional)"
                    maxlength="255"
                    class="w-full border border-input rounded-[var(--radius-control)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
                <div class="space-y-2">
                  <label
                    class="text-sm font-medium text-muted-foreground"
                    for="quote-notes"
                    >Notes</label
                  >
                  <textarea
                    id="quote-notes"
                    v-model="quoteNotes"
                    placeholder="Additional notes for your quote request (optional)"
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
                    Back
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
                    {{ loading ? "Submitting..." : "Place Quote Request" }}
                  </button>
                </div>
              </template>
              <template v-else>
                <CartOverview
                  v-if="cart"
                  :graphqlClient="graphqlClient"
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
              <h3 class="text-lg font-semibold mb-4">Cart Items</h3>
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
              />
            </div>
            <div
              class="bg-card rounded-[var(--radius-container)] shadow border p-6"
            >
              <CartSummary
                v-if="cart"
                :cart="cart as Cart"
                title="Order Summary"
                :showCheckoutButton="false"
                :graphqlClient="graphqlClient"
                :user="authStore.user as Contact | Customer | undefined"
                :companyId="companyStore.companyId ?? undefined"
                :afterRequestAuthorization="handleAfterRequestAuthorization"
                :onError="
                  (err) => console.error('Authorization request failed:', err)
                "
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
import { Enums } from "propeller-sdk-v2";
import type { Cart, Contact, Customer, CartAddress } from "propeller-sdk-v2";
import { useAuthStore } from "@/stores/auth";
import { useCartStore } from "@/stores/cart";
import { usePriceStore } from "@/stores/price";
import { useLanguageStore } from "@/stores/language";
import { useCompanyStore } from "@/stores/company";
import { graphqlClient } from "@/lib/api";
import { configuration, localizeHref } from "@/lib/config";
import { useCheckout } from "@/composables/useCheckout";
import type { AnyUser } from "@/composables/shared/utils/userIdentity";

import CartPaymethods from "@/components/propeller/CartPaymethods.vue";
import CartCarriers from "@/components/propeller/CartCarriers.vue";
import DeliveryDate from "@/components/propeller/DeliveryDate.vue";
import CartSummary from "@/components/propeller/CartSummary.vue";
import CartOverview from "@/components/propeller/CartOverview.vue";
import ItemsOverview from "@/components/propeller/ItemsOverview.vue";
import AddressCard from "@/components/propeller/AddressCard.vue";
import AddressSelector from "@/components/propeller/AddressSelector.vue";

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
    ? ["Details", "Shipping", "Review"]
    : ["Details", "Shipping", "Payment", "Review"],
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

const COUNTRIES = [
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "UK", name: "United Kingdom" },
  { code: "US", name: "United States" },
];

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

async function handleStep3Continue() {
  if (
    !selectedPayment.value ||
    !selectedCarrier.value ||
    !selectedDeliveryDate.value
  ) {
    step3Submitted.value = true;
    return;
  }
  const updatedCart = await updateCartSettings((cart.value as any).cartId, {
    paymentMethod: selectedPayment.value,
    carrier: selectedCarrier.value,
    requestDate: selectedDeliveryDate.value,
  });
  if (updatedCart) {
    cartStore.setCart(updatedCart);
    currentStep.value = 4;
  }
}

async function handlePlaceOrder(reference?: string, notes?: string) {
  orderPlaced.value = true;
  const result = await placeOrder((cart.value as any).cartId, {
    isQuoteMode: isQuoteMode.value,
    reference,
    notes,
  });

  if (result.success && result.orderId) {
    cartStore.setCart(null);
    const thankYouUrl = isQuoteMode.value
      ? localizeHref(
          `/checkout/thank-you/${result.orderId}`,
          languageStore.language,
        ) + "?mode=quote"
      : localizeHref(
          `/checkout/thank-you/${result.orderId}`,
          languageStore.language,
        );
    router.push(thankYouUrl);
  } else {
    orderPlaced.value = false;
  }
}

function openTermsAndConditions() {
  window.open("/terms-conditions", "_blank");
}

function handleAfterRequestAuthorization(updatedCart: Cart) {
  cartStore.setCart(null);
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
