<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-4">
        <button
          @click="router.back()"
          class="text-sm text-primary hover:underline"
        >
          ← Back
        </button>
        <h1 class="text-3xl font-bold tracking-tight">Quote Details</h1>
      </div>
    </div>

    <div v-if="loading" class="p-8 text-center">
      <div
        class="h-8 bg-slate-100 rounded w-1/3 mx-auto mb-4 animate-pulse"
      ></div>
      <div class="h-4 bg-slate-100 rounded w-1/2 mx-auto animate-pulse"></div>
    </div>

    <AccessErrorView
      v-else-if="error"
      :kind="classifyApiError(error)"
      :backHref="errorBackHref"
      :backLabel="errorBackLabel"
    />

    <div v-else-if="quote" class="space-y-8">
      <!-- Quote Summary + Actions -->
      <div class="border rounded-[var(--radius-container)] p-6 space-y-4">
        <OrderSummary
          :order="quote"
          :countries="COUNTRIES"
          :labels="{ ...orderSummaryLabels, orderNumber: 'Quote Number', orderDate: 'Quote Date' }"
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
        />
        <div class="flex flex-row items-end gap-3 flex-shrink-0 mt-4">
          <QuoteActions
            :quote="quote as Order"
            :afterAccept="handleAfterAccept"
            :labels="quoteActionsLabels"
            :showTermsAndConditions="true"
            :onTermsAndConditionsClick="
              () => window.open(localizeHref('/terms-conditions', languageStore.language), '_blank')
            "
          />
          <button
            type="button"
            class="text-sm text-primary hover:underline px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
            @click="handleDownloadPDF"
            :disabled="downloading"
          >
            <template v-if="downloading">Downloading...</template>
            <template v-else>Download Quote (PDF)</template>
          </button>
        </div>
      </div>

      <!-- Quote Overview -->
      <div class="pt-10">
        <h2 class="text-2xl font-bold mb-6 mt-6">Quote Overview</h2>

        <!-- Parent/child product items -->
        <div
          v-if="parentItems.length > 0"
          class="bg-card rounded-[var(--radius-container)] shadow overflow-hidden mb-8"
        >
          <table class="w-full">
            <thead class="bg-surface-hover border-b">
              <tr>
                <th
                  class="px-6 py-4 text-left text-sm font-medium text-muted-foreground"
                >
                  Products
                </th>
                <th
                  class="px-6 py-4 text-center text-sm font-medium text-muted-foreground"
                >
                  Quantity
                </th>
                <th
                  class="px-6 py-4 text-right text-sm font-medium text-muted-foreground"
                >
                  Discount
                </th>
                <th
                  class="px-6 py-4 text-right text-sm font-medium text-muted-foreground"
                >
                  Price
                </th>
              </tr>
            </thead>

            <OrderItemCard
              v-for="item in parentItems"
              :key="item.id"
              :orderItem="item"
              :childItems="childMap.get(item.id) || []"
              :labels="orderItemCardLabels"
              :titleLinkable="true"
              :showImage="true"
              :showSku="true"
              :showQuantity="true"
              :showDiscount="true"
              :showPrice="true"
            />
          </table>
        </div>

        <!-- Bonus Items -->
        <OrderBonusItems :order="quote" :labels="orderBonusItemsLabels" />
      </div>

      <!-- Totals -->
      <div class="flex flex-col md:flex-row justify-end gap-8 pt-6 border-t">
        <OrderTotals :order="quote" :labels="orderTotalsLabels" />
      </div>
    </div>

    <!-- PDF download toast (success / error feedback) -->
    <template v-if="toastVisible">
      <div
        :class="`fixed top-4 right-4 z-50 flex items-start gap-3 w-80 rounded-[var(--radius-container)] shadow-lg p-4 ${
          toastType === 'success'
            ? 'bg-success border border-success text-success-foreground'
            : 'bg-destructive border border-destructive text-destructive-foreground'
        }`"
        :data-toast-type="toastType"
      >
        <div class="flex-shrink-0 w-5 h-5 mt-0.5">
          <svg v-if="toastType === 'success'" fill="none" viewBox="0 0 24 24" stroke="currentColor" :stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <svg v-else fill="none" viewBox="0 0 24 24" stroke="currentColor" :stroke-width="2">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
        </div>
        <p class="flex-1 text-sm font-medium">{{ toastMessage }}</p>
        <button
          type="button"
          class="flex-shrink-0 rounded focus:outline-none hover:opacity-80"
          @click="toastVisible = false"
        >
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" class="h-4 w-4" :stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { usePriceStore } from "@/stores/price";
import { useLanguageStore } from "@/stores/language";
import { graphqlClient } from "@/lib/api";
import { configuration, localizeHref } from "@/lib/config";
import { useTranslations } from "@/lib/i18n/composable";
import AccessErrorView from "@/components/access/AccessErrorView.vue";
import { classifyApiError } from "@/lib/errors";
import type { Order } from "propeller-sdk-v2";
import { useOrders } from "propeller-v2-vue-ui";
import type { AnyUser } from "propeller-v2-vue-ui";
import { OrderBonusItems, OrderItemCard, OrderSummary, OrderTotals, QuoteActions } from 'propeller-v2-vue-ui';
import { COUNTRIES } from "@/composables/shared/utils/countries";

// COUNTRIES imported from shared utils
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const priceStore = usePriceStore();
const languageStore = useLanguageStore();

const orderSummaryLabels = useTranslations('OrderSummary');
const quoteActionsLabels = useTranslations('QuoteActions');
const orderItemCardLabels = useTranslations('OrderItemCard');
const orderBonusItemsLabels = useTranslations('OrderBonusItems');
const orderTotalsLabels = useTranslations('OrderTotals');
const errorPagesLabels = useTranslations('ErrorPages');

// The router maps both /account/quotes/:id and /account/quote-requests/:id
// to this view. Detect which list to send the user back to on error.
const isQuoteRequest = computed(() => route.name === 'account-quote-request-detail');
const errorBackHref = computed(() =>
  isQuoteRequest.value ? '/account/quote-requests' : '/account/quotes'
);
const errorBackLabel = computed(() =>
  isQuoteRequest.value
    ? errorPagesLabels.value.backToQuoteRequests
    : errorPagesLabels.value.backToQuotes
);

const quoteId = route.params.id as string;

const {
  fetchOrder,
  currentOrder: quote,
  orderLoading: loading,
  error,
  downloadQuotePdf,
} = useOrders({
  graphqlClient,
  user: computed(() => authStore.user as AnyUser),
  language: computed(() => languageStore.language),
  configuration,
});

const parentItems = computed(() => {
  const allProducts = (quote.value?.items || []).filter(
    (i: any) => i.class === "product" && i.isBonus === "N",
  );
  return allProducts.filter((i: any) => !i.parentOrderItemId);
});

const childMap = computed(() => {
  const allProducts = (quote.value?.items || []).filter(
    (i: any) => i.class === "product" && i.isBonus === "N",
  );
  const map = new Map<number, any[]>();
  allProducts
    .filter((i: any) => i.parentOrderItemId)
    .forEach((i: any) => {
      const children = map.get(i.parentOrderItemId) || [];
      children.push(i);
      map.set(i.parentOrderItemId, children);
    });
  return map;
});

function handleAfterAccept(acceptedQuote: any) {
  router.push(
    localizeHref(
      `/checkout/thank-you/${acceptedQuote.id}`,
      languageStore.language,
    ),
  );
}

// PDF download UX state — shows "Downloading..." while the request is in
// flight, then a success or error toast based on the result. Mirrors the
// pattern OrderActions uses for the order-confirmation PDF.
const downloading = ref(false);
const toastVisible = ref(false);
const toastMessage = ref("");
const toastType = ref<"success" | "error">("success");

function showDownloadToast(message: string, type: "success" | "error") {
  toastMessage.value = message;
  toastType.value = type;
  toastVisible.value = true;
  setTimeout(() => {
    toastVisible.value = false;
  }, 4000);
}

async function handleDownloadPDF() {
  if (downloading.value) return;
  downloading.value = true;
  try {
    const result = await downloadQuotePdf(Number(quoteId));
    if (result?.success) {
      showDownloadToast("PDF downloaded successfully", "success");
    } else {
      showDownloadToast(result?.error || "Failed to download PDF", "error");
    }
  } catch (e) {
    console.error("Error downloading quote PDF:", e);
    showDownloadToast("Failed to download PDF", "error");
  } finally {
    downloading.value = false;
  }
}

onMounted(async () => {
  await fetchOrder(parseInt(quoteId));
  if (!quote.value) error.value = "Quote not found";
});
</script>
