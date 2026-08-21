<template>
  <div class="min-h-[70vh] py-12 bg-surface-hover">
    <div class="container-width max-w-4xl">
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
              :stroke-width="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h1 class="text-4xl font-bold text-foreground mb-4">
          {{ t.title }}
        </h1>
        <p class="text-lg text-muted-foreground">
          {{ t.description }}
        </p>
        <p
          v-if="route.params.cartId"
          class="text-sm text-foreground-subtle mt-2"
        >
          {{ t.reference }} {{ route.params.cartId }}
        </p>
      </div>

      <!-- Cart items table -->
      <div v-if="cartItems.length > 0" class="space-y-8">
        <div
          class="bg-card rounded-[var(--radius-container)] shadow-sm border border-border overflow-hidden"
        >
          <div class="px-6 py-4 border-b border-border-subtle">
            <h2 class="text-xl font-bold text-foreground">{{ t.cartSummary }}</h2>
          </div>
          <table class="w-full">
            <thead class="bg-surface-hover border-b border-border-subtle">
              <tr>
                <th
                  class="px-6 py-3 text-left text-sm font-medium text-muted-foreground w-2/3"
                >
                  {{ t.colProduct }}
                </th>
                <th
                  class="px-6 py-3 text-center text-sm font-medium text-muted-foreground"
                >
                  {{ t.colQty }}
                </th>
                <th
                  class="px-6 py-3 text-right text-sm font-medium text-muted-foreground"
                >
                  {{ t.colTotal }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              <tr
                v-for="item in cartItems"
                :key="item.itemId"
                class="hover:bg-surface-hover"
              >
                <td class="px-6 py-4">
                  <div class="flex items-center gap-3">
                    <img
                      v-if="getItemImageUrl(item)"
                      :src="getItemImageUrl(item)"
                      :alt="getItemName(item)"
                      class="w-12 h-12 object-contain rounded border border-border-subtle flex-shrink-0"
                    />
                    <div
                      v-else
                      class="w-12 h-12 bg-surface-hover rounded border border-border-subtle flex-shrink-0 flex items-center justify-center"
                    >
                      <svg
                        class="w-6 h-6 text-foreground-subtle"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        :stroke-width="1.5"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
                        />
                      </svg>
                    </div>
                    <div>
                      <p class="text-sm font-medium text-foreground">
                        {{ getItemName(item) }}
                      </p>
                      <p
                        v-if="item.product?.sku"
                        class="text-xs text-foreground-subtle mt-0.5"
                      >
                        SKU: {{ item.product.sku }}
                      </p>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 text-center text-sm text-muted-foreground">
                  {{ item.quantity }}
                </td>
                <td
                  class="px-6 py-4 text-right text-sm font-medium text-foreground"
                >
                  {{ formatPrice(item.totalSumNet ?? 0) }}
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Totals -->
          <div
            class="px-6 py-4 bg-surface-hover border-t border-border-subtle space-y-2"
          >
            <div class="flex justify-between text-sm text-muted-foreground">
              <span>{{ t.totalExclVat }}</span>
              <span>{{ formatPrice(totalExclVat) }}</span>
            </div>
            <div
              v-if="totalVat > 0"
              class="flex justify-between text-sm text-muted-foreground"
            >
              <span>{{ t.vat }}</span>
              <span>{{ formatPrice(totalVat) }}</span>
            </div>
            <div
              class="flex justify-between text-base font-bold text-foreground pt-2 border-t border-border"
            >
              <span>{{ t.total }}</span>
              <span>{{ formatPrice(total) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex justify-center pt-8">
        <router-link
          :to="localizeHref('/', languageStore.language)"
          class="px-8 py-3 bg-primary text-primary-foreground rounded-[var(--radius-container)] font-semibold hover:bg-primary/80 transition text-center"
        >
          {{ t.continueShopping }}
        </router-link>
      </div>
      <div class="text-center text-muted-foreground pt-6 text-sm">
        <p>
          {{ t.notified }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useCartStore } from "@/stores/cart";
import { useLanguageStore } from "@/stores/language";
import { localizeHref } from "@/lib/config";
import { useTranslations } from "@/lib/i18n/composable";

const route = useRoute();
const cartStore = useCartStore();
const languageStore = useLanguageStore();
const t = useTranslations("AuthorizationRequestSent");

const cartItems = computed(
  () =>
    (cartStore.cart as any)?.items || (cartStore.cart as any)?.mainItems?.items || [],
);
const total = computed(() => (cartStore.cart as any)?.total?.totalNet ?? 0);
const totalExclVat = computed(
  () => (cartStore.cart as any)?.total?.totalGross ?? 0,
);
const totalVat = computed(() => total.value - totalExclVat.value);

function formatPrice(price: number) {
  return `€${Number(price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getItemName(item: any) {
  return item.product?.names?.[0]?.value || t.value.colProduct;
}

function getItemImageUrl(item: any) {
  return item.product?.media?.images?.items?.[0]?.imageVariants?.[0]?.url || "";
}
</script>
