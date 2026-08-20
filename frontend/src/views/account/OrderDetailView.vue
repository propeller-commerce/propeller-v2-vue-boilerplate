<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-4">
        <button
          @click="router.back()"
          class="text-sm text-primary hover:underline"
        >
          ← {{ t.back }}
        </button>
        <h1 class="text-3xl font-bold tracking-tight">{{ t.orderDetailsTitle }}</h1>
      </div>
    </div>

    <div v-if="loading" class="p-8 text-center">
      <div
        class="h-8 bg-slate-100 rounded w-1/3 mx-auto mb-4 animate-pulse"
      ></div>
      <div class="h-4 bg-slate-100 rounded w-1/2 mx-auto animate-pulse"></div>
    </div>

    <AccessErrorView v-else-if="error" :kind="classifyApiError(error)" />

    <div v-else-if="order" class="space-y-8">
      <!-- Order Summary + Actions -->
      <div class="border rounded-[var(--radius-container)] p-6 space-y-4">
        <OrderSummary
          :order="order as Order"
          :countries="getCountries(languageStore.language)"
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
          :labels="orderSummaryLabels"
          :statusLabels="orderStatusLabels"
          :paymethodLabels="paymethodNames"
        />
        <OrderActions
          :order="order as Order"
          :cartId="cartStore.cartId || undefined"
          :onCartCreated="(cart: Cart) => cartStore.setCart(cart)"
          :afterReorder="handleReorder"
          :labels="orderActionsLabels"
        />
      </div>

      <!-- Shipments -->
      <OrderShipments :order="order" :labels="orderShipmentsLabels" />

      <!-- Order Overview -->
      <div class="pt-10">
        <h2 class="text-2xl font-bold mb-6">{{ t.orderOverviewTitle }}</h2>

        <!-- Parent/child product items -->
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

      <!-- Bottom Actions + Totals -->
      <div
        class="flex flex-col md:flex-row justify-between gap-8 pt-6 border-t"
      >
        <OrderActions
          :order="order"
          :cartId="cartStore.cartId || undefined"
          :onCartCreated="(cart: any) => cartStore.setCart(cart)"
          :afterReorder="handleReorder"
          :labels="orderActionsLabels"
        />
        <OrderTotals
          :order="order as Order"
          :showSubtotal="true"
          :showDiscount="true"
          :showShippingCosts="true"
          :showVATs="true"
          :showTotalExclVat="true"
          :showTotalVat="true"
          :labels="orderTotalsLabels"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useCartStore } from "@/stores/cart";
import { useCompanyStore } from "@/stores/company";
import { usePriceStore } from "@/stores/price";
import { useLanguageStore } from "@/stores/language";
import { graphqlClient } from "@/lib/api";
import { configuration, localizeHref } from "@/lib/config";
import AccessErrorView from "@/components/access/AccessErrorView.vue";
import { classifyApiError } from "@/lib/errors";
import type { Cart, Contact, Customer, Order } from "@propeller-commerce/propeller-sdk-v2";
import { useOrders } from "@propeller-commerce/propeller-v2-vue-ui";
import type { AnyUser } from "@propeller-commerce/propeller-v2-vue-ui";
import { OrderActions, OrderBonusItems, OrderItemCard, OrderShipments, OrderSummary, OrderTotals } from '@propeller-commerce/propeller-v2-vue-ui';
import { useTranslations } from '@/lib/i18n/composable';
import { track } from '@/lib/tracking/bus';
import { orderItems } from '@/lib/tracking/events';
import { getCountries } from "@/composables/shared/utils/countries";

// COUNTRIES imported from shared utils
const orderSummaryLabels = useTranslations('OrderSummary');
const orderStatusLabels = useTranslations('OrderStatus');
const paymethodNames = useTranslations('PaymethodNames');
const orderActionsLabels = useTranslations('OrderActions');
const orderShipmentsLabels = useTranslations('OrderShipments');
const orderItemCardLabels = useTranslations('OrderItemCard');
const orderBonusItemsLabels = useTranslations('OrderBonusItems');
const orderTotalsLabels = useTranslations('OrderTotals');
const t = useTranslations('Account');

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const cartStore = useCartStore();
const companyStore = useCompanyStore();
const priceStore = usePriceStore();
const languageStore = useLanguageStore();

const {
  fetchOrder,
  currentOrder: order,
  orderLoading: loading,
  error,
} = useOrders({
  graphqlClient,
  user: computed(() => authStore.user as AnyUser),
  companyId: computed(() => companyStore.companyId ?? undefined),
  language: computed(() => languageStore.language),
  configuration,
});

const parentItems = computed(() => {
  const allProducts = (order.value?.items || []).filter(
    (i: any) => i.class === "product" && i.isBonus === "N",
  );
  return allProducts.filter((i: any) => !i.parentOrderItemId);
});

const childMap = computed(() => {
  const allProducts = (order.value?.items || []).filter(
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

function handleReorder(cart: any) {
  cartStore.setCart(cart);
  // A reorder is the strongest repeat-purchase signal in the account area:
  // it says the assortment worked, without needing a new search.
  track(
    "propeller.reorder_started",
    {
      source_order_id: Number(route.params.id) || null,
      item_count: order.value?.items?.length ?? 0,
      value: (order.value as any)?.total?.gross ?? null,
      items: orderItems(order.value as never, languageStore.language),
    },
    `reorder_started:${route.params.id}:${Math.floor(Date.now() / 2000)}`,
  );
}

onMounted(async () => {
  await fetchOrder(parseInt(route.params.id as string));
  if (!order.value) {
    error.value = "Order not found";
    return;
  }
  const placed = Date.parse(String((order.value as any).orderDate ?? ""));
  track(
    "propeller.order_viewed",
    {
      order_id: Number(route.params.id) || null,
      order_status: (order.value as any).status ?? null,
      // `gross` is the EX-VAT total in this SDK — see lib/tracking/items.ts.
      value: (order.value as any).total?.gross ?? null,
      item_count: order.value.items?.length ?? 0,
      // How long after placing it the customer came back to look. A short tail
      // is order-tracking; a long one is usually a reorder about to happen.
      age_days: Number.isNaN(placed)
        ? null
        : Math.floor((Date.now() - placed) / 86_400_000),
    },
    `order_viewed:${route.params.id}`,
  );
});
</script>
