<template>
  <div :class="`purchase-authorization-requests ${className || ''}`">
    <template v-if="isAuthManager">
      <div class="space-y-4">
        <h2 class="text-xl font-semibold">
          {{ getLabel('title', 'Authorization Requests') }}
        </h2>
        <template v-if="loading">
          <div class="flex items-center justify-center py-12">
            <div
              class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"
            ></div>
          </div>
        </template>

        <template v-if="!loading">
          <template v-if="carts.length === 0">
            <div class="text-center py-12 text-muted-foreground">
              {{ getLabel('empty', 'No pending authorization requests') }}
            </div>
          </template>

          <template v-if="carts.length > 0">
            <div class="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
              <table class="w-full text-sm">
                <thead class="bg-muted/50 border-b border-border">
                  <tr>
                    <th class="text-left px-4 py-3 font-medium text-muted-foreground">
                      {{ getLabel('colDate', 'Date') }}
                    </th>
                    <th class="text-left px-4 py-3 font-medium text-muted-foreground">
                      {{ getLabel('colQuantity', 'Quantity') }}
                    </th>
                    <th class="text-left px-4 py-3 font-medium text-muted-foreground">
                      {{ getLabel('colTotal', 'Total') }}
                    </th>
                    <th class="text-left px-4 py-3 font-medium text-muted-foreground">
                      {{ getLabel('colRequestedBy', 'Requested by') }}
                    </th>
                    <th class="text-left px-4 py-3 font-medium text-muted-foreground">
                      {{ getLabel('colActions', 'Actions') }}
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border">
                  <template :key="index" v-for="(cart, index) in carts">
                    <tr class="hover:bg-muted/30 transition-colors">
                      <td class="px-4 py-3 text-muted-foreground">
                        {{ formatDate(cart.lastModifiedAt ?? '') }}
                      </td>
                      <td class="px-4 py-3">{{ getTotalQuantity(cart) }}</td>
                      <td class="px-4 py-3 font-medium">
                        {{ formatPrice(cart.total?.totalNet ?? 0) }}
                      </td>
                      <td class="px-4 py-3">
                        <div class="font-medium">
                          {{ getContactName(cart.contact) }}
                        </div>
                        <div class="text-xs text-muted-foreground mt-0.5">
                          {{ cart.contact?.email }}
                        </div>
                      </td>
                      <td class="px-4 py-3">
                        <button
                          type="button"
                          class="px-3 py-1.5 text-sm border border-input rounded-md bg-background hover:bg-muted/50 transition-colors"
                          @click="async (event) => handleViewCart(cart)"
                        >
                          {{ getLabel('view', 'View') }}
                        </button>
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
          </template>
        </template>

        <template v-if="!!selectedCart">
          <div class="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div class="fixed inset-0 bg-gray-500/20" @click="async (event) => closeModal()"></div>
            <div
              class="relative w-full max-w-2xl bg-white rounded-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div
                class="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0"
              >
                <h3 class="text-base font-semibold text-gray-900">
                  {{ getLabel('modalTitle', 'Authorization Request') }}
                </h3>
                <button
                  type="button"
                  class="text-gray-400 hover:text-gray-600 focus:outline-none"
                  @click="async (event) => closeModal()"
                >
                  <svg
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    class="h-5 w-5"
                    :strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    ></path>
                  </svg>
                </button>
              </div>
              <template v-if="modalLoading">
                <div class="flex items-center justify-center py-16">
                  <div
                    class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"
                  ></div>
                </div>
              </template>

              <template v-if="!modalLoading">
                <div class="overflow-y-auto flex-1 px-6 py-5 space-y-6">
                  <div>
                    <h4 class="text-sm font-semibold text-gray-700 mb-2">
                      {{ getLabel('requesterInfo', 'Requester') }}
                    </h4>
                    <p class="text-sm font-medium">
                      {{ getContactName(selectedCart?.contact) }}
                    </p>
                    <p class="text-sm text-muted-foreground">
                      {{ selectedCart?.contact?.email }}
                    </p>
                  </div>
                  <div>
                    <h4 class="text-sm font-semibold text-gray-700 mb-2">
                      {{ getLabel('itemsTitle', 'Items') }}
                    </h4>
                    <div class="overflow-x-auto rounded border border-border">
                      <table class="w-full text-sm">
                        <thead class="bg-muted/50 border-b border-border">
                          <tr>
                            <th class="text-left px-3 py-2 font-medium text-muted-foreground">
                              {{ getLabel('itemProduct', 'Product') }}
                            </th>
                            <th class="text-right px-3 py-2 font-medium text-muted-foreground">
                              {{ getLabel('itemQty', 'Qty') }}
                            </th>
                            <th class="text-right px-3 py-2 font-medium text-muted-foreground">
                              {{ getLabel('itemUnitPrice', 'Unit price') }}
                            </th>
                            <th class="text-right px-3 py-2 font-medium text-muted-foreground">
                              {{ getLabel('itemTotal', 'Total') }}
                            </th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-border">
                          <template :key="idx" v-for="(item, idx) in getModalItems()">
                            <tr>
                              <td class="px-3 py-2">
                                {{ item.product?.names?.[0]?.value ?? '' }}
                              </td>
                              <td class="px-3 py-2 text-right">
                                {{ item.quantity ?? 0 }}
                              </td>
                              <td class="px-3 py-2 text-right">
                                {{
                                  formatPrice(
                                    (item.quantity ?? 0) > 0
                                      ? (item.totalSum ?? 0) / (item.quantity ?? 1)
                                      : 0
                                  )
                                }}
                              </td>
                              <td class="px-3 py-2 text-right font-medium">
                                {{ formatPrice(item.totalSumNet ?? 0) }}
                              </td>
                            </tr>
                          </template>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div class="border-t border-border pt-4 space-y-2 text-sm">
                    <div class="flex justify-between text-muted-foreground">
                      <span>{{ getLabel('totalExclVat', 'Total excl. VAT:') }}</span
                      ><span>{{ formatPrice(selectedCart?.total?.totalGross ?? 0) }}</span>
                    </div>
                    <div class="flex justify-between text-muted-foreground">
                      <span>{{ getLabel('totalVat', 'VAT:') }}</span
                      ><span>{{
                        formatPrice(
                          (selectedCart?.total?.totalNet ?? 0) -
                            (selectedCart?.total?.totalGross ?? 0)
                        )
                      }}</span>
                    </div>
                    <div
                      class="flex justify-between font-bold text-base border-t border-border pt-2"
                    >
                      <span>{{ getLabel('total', 'Total:') }}</span
                      ><span>{{ formatPrice(selectedCart?.total?.totalNet ?? 0) }}</span>
                    </div>
                  </div>
                </div>
                <div class="flex gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
                  <button
                    type="button"
                    class="flex-1 inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    @click="async (event) => closeModal()"
                  >
                    {{ getLabel('cancel', 'Cancel') }}</button
                  ><button
                    type="button"
                    class="flex-1 inline-flex justify-center rounded-md border border-transparent bg-secondary px-4 py-2 text-sm font-medium text-white hover:bg-secondary/90 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    @click="async (event) => handleAcceptRequest()"
                    :disabled="acceptLoading"
                  >
                    <template v-if="acceptLoading">
                      {{ getLabel('accepting', 'Accepting...') }}
                    </template>

                    <template v-if="!acceptLoading">
                      {{ getLabel('acceptRequest', 'Accept request') }}
                    </template>
                  </button>
                </div>
              </template>
            </div>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { usePurchaseAuthorizationRequests } from '../../composables/usePurchaseAuthorization';

import {
  Contact,
  Customer,
  GraphQLClient,
  Cart,
  CartMainItem,
} from 'propeller-sdk-v2';

export interface PurchaseAuthorizationRequestsProps {
  /** GraphQL client for the Propeller SDK */
  graphqlClient: GraphQLClient;

  /** The logged-in user */
  user: Contact | Customer;

  /** The companyId of the current selected company */
  companyId: number;

  /**
   * Override: fires instead of the default CartService.acceptPurchaseAuthorizationRequest() call.
   * Receives the cartId string.
   */
  onAcceptRequest?: (cartId: string) => void;

  /**
   * Fires after a purchase authorization request has been accepted.
   * Receives the full accepted Cart object (or the selectedCart if onAcceptRequest override was used).
   */
  afterAcceptRequest?: (cart: Cart) => void;

  /** Format date */
  formatDate?: (dateString: string) => string;

  /** Format price */
  formatPrice?: (price: number) => string;

  /** Labels for the component */
  labels?: Record<string, string>;

  /** Additional CSS class for the root element */
  className?: string;

  /**
   * App configuration passthrough.
   * Used for imageSearchFiltersGrid, imageVariantFiltersSmall when fetching cart detail.
   */
  configuration?: Record<string, any>;

  /** Called when an SDK operation fails; receives the normalized error */
  onError?: (err: Error) => void;
}

const props = defineProps<PurchaseAuthorizationRequestsProps>();

const userRef    = computed(() => props.user ?? null);
const companyRef = computed(() => props.companyId as number);

const {
  carts, loading, selectedCart, modalLoading, acceptLoading, isAuthManager,
  getTotalQuantity, getContactName, getModalItems,
  loadCarts, handleViewCart, handleAcceptRequest, closeModal,
} = usePurchaseAuthorizationRequests({
  graphqlClient: props.graphqlClient,
  user: userRef,
  companyId: companyRef,
  configuration: props.configuration,
  onAcceptRequest: props.onAcceptRequest,
  afterAcceptRequest: props.afterAcceptRequest,
  onError: props.onError,
});

function getLabel(key: string, fallback: string): string {
  return (props.labels as any)?.[key] || fallback;
}

function formatDate(dateStr: string): string {
  if (props.formatDate) return props.formatDate(dateStr);
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

function formatPrice(price: number): string {
  if (props.formatPrice) return props.formatPrice(price);
  if (!price) return '-';
  return `€${Number(price).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
</script>
