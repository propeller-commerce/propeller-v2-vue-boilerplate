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

    <!-- Success -->
    <div v-else class="container mx-auto px-4">
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
            {{
              isQuoteMode
                ? "Thank You for Your Quote Request!"
                : "Thank You for Your Order!"
            }}
          </h1>
          <p class="text-lg text-muted-foreground">
            {{
              isQuoteMode
                ? "Your quote request has been successfully submitted. We will get back to you shortly."
                : "Your order has been successfully placed and is being processed."
            }}
          </p>
        </div>

        <div v-if="order" class="space-y-8">
          <!-- Order Summary -->
          <div
            class="bg-card rounded-[var(--radius-container)] shadow-sm border border-border p-6"
          >
            <OrderSummary
              :order="order"
              :countries="COUNTRIES"
              title="Order Summary"
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
            />
          </div>

          <!-- Order Overview -->
          <div class="pt-10">
            <h2 class="text-2xl font-bold mb-6">Order Overview</h2>

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
              :to="localizeHref('/account/orders', languageStore.language)"
              class="px-8 py-3 bg-card border-2 border-primary text-primary rounded-[var(--radius-container)] font-semibold hover:bg-primary/5 transition text-center"
            >
              View Order History
            </router-link>
            <router-link
              :to="localizeHref('/', languageStore.language)"
              class="px-8 py-3 bg-primary text-primary-foreground rounded-[var(--radius-container)] font-semibold hover:bg-primary/80 transition text-center"
            >
              Continue Shopping
            </router-link>
          </div>

          <div class="text-center text-muted-foreground pt-4">
            <p>
              If you have any questions, please
              <router-link
                :to="localizeHref('/contact', languageStore.language)"
                class="text-primary hover:underline"
                >contact our customer service team</router-link
              >.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import type { OrderItem } from "@propeller-commerce/propeller-sdk-v2";
import { useAuthStore } from "@/stores/auth";
import { useLanguageStore } from "@/stores/language";
import { graphqlClient } from "@/lib/api";
import { configuration, localizeHref } from "@/lib/config";
import AccessErrorView from "@/components/access/AccessErrorView.vue";
import { classifyApiError } from "@/lib/errors";
import { useOrders } from "@propeller-commerce/propeller-v2-vue-ui";
import type { AnyUser } from "@propeller-commerce/propeller-v2-vue-ui";
import { OrderBonusItems, OrderItemCard, OrderSummary } from '@propeller-commerce/propeller-v2-vue-ui';
import { useTranslations } from '@/lib/i18n/composable';
import { COUNTRIES } from "@/composables/shared/utils/countries";

const orderSummaryLabels = useTranslations('OrderSummary');
const orderItemCardLabels = useTranslations('OrderItemCard');
const orderBonusItemsLabels = useTranslations('OrderBonusItems');

const route = useRoute();
const authStore = useAuthStore();
const languageStore = useLanguageStore();

const orderId = computed(() => route.params.orderId as string);
const isQuoteMode = computed(() => route.query.mode === "quote");

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
});
</script>
