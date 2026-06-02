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
        <h1 class="text-3xl font-bold tracking-tight">Order Details</h1>
      </div>
    </div>

    <div v-if="loading" class="p-8 text-center">
      <div
        class="h-8 bg-slate-100 rounded w-1/3 mx-auto mb-4 animate-pulse"
      ></div>
      <div class="h-4 bg-slate-100 rounded w-1/2 mx-auto animate-pulse"></div>
    </div>

    <div
      v-else-if="error"
      class="p-8 text-center border rounded-[var(--radius-container)]"
    >
      <p class="text-destructive mb-4">{{ error }}</p>
      <button
        @click="
          router.push(localizeHref('/account/orders', languageStore.language))
        "
        class="text-primary hover:underline"
      >
        Return to Orders
      </button>
    </div>

    <div v-else-if="order" class="space-y-8">
      <!-- Order Summary + Actions -->
      <div class="border rounded-[var(--radius-container)] p-6 space-y-4">
        <OrderSummary
          :order="order as Order"
          :countries="COUNTRIES"
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
        <OrderActions
          :order="order as Order"
          :cartId="cartStore.cartId || undefined"
          :onCartCreated="(cart: Cart) => cartStore.setCart(cart)"
          :afterReorder="(cart: Cart) => cartStore.setCart(cart)"
        />
      </div>

      <!-- Shipments -->
      <OrderShipments :order="order" />

      <!-- Order Overview -->
      <div class="pt-10">
        <h2 class="text-2xl font-bold mb-6">Order Overview</h2>

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
                  Product
                </th>
                <th
                  class="px-6 py-4 text-center text-sm font-medium text-muted-foreground"
                >
                  Quantity
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
              :titleLinkable="true"
              :showImage="true"
              :showSku="true"
              :showQuantity="true"
              :showPrice="true"
            />
          </table>
        </div>

        <!-- Bonus Items -->
        <OrderBonusItems :order="order" />
      </div>

      <!-- Bottom Actions + Totals -->
      <div
        class="flex flex-col md:flex-row justify-between gap-8 pt-6 border-t"
      >
        <OrderActions
          :order="order"
          :cartId="cartStore.cartId || undefined"
          :onCartCreated="(cart: any) => cartStore.setCart(cart)"
          :afterReorder="(cart: any) => cartStore.setCart(cart)"
        />
        <OrderTotals
          :order="order as Order"
          :showSubtotal="true"
          :showDiscount="true"
          :showShippingCosts="true"
          :showVATs="true"
          :showTotalExclVat="true"
          :showTotalVat="true"
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
import type { Cart, Contact, Customer, Order } from "propeller-sdk-v2";
import { useOrders } from "propeller-v2-vue-ui";
import type { AnyUser } from "propeller-v2-vue-ui";
import { OrderActions, OrderBonusItems, OrderItemCard, OrderShipments, OrderSummary, OrderTotals } from 'propeller-v2-vue-ui';
import { COUNTRIES } from "@/composables/shared/utils/countries";

// COUNTRIES imported from shared utils
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

onMounted(async () => {
  await fetchOrder(parseInt(route.params.id as string));
  if (!order.value) error.value = "Order not found";
});
</script>
