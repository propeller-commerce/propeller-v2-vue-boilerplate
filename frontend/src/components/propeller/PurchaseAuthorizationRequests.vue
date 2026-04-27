<template>
  <div :class="`propeller-purchase-authorization-requests ${className || ''}`">
    <template v-if="isAuthManager">
      <div class="propeller-purchase-authorization-requests__content space-y-4">
        <h2
          class="propeller-purchase-authorization-requests__title text-xl font-semibold"
        >
          {{ getLabel("title", "Authorization Requests") }}
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
              {{ getLabel("empty", "No pending authorization requests") }}
            </div>
          </template>

          <template v-if="carts.length > 0">
            <div
              class="overflow-x-auto rounded-[var(--radius-container)] border border-border bg-card shadow-sm"
            >
              <table class="w-full text-sm">
                <thead class="bg-surface-hover/50 border-b border-border">
                  <tr>
                    <th
                      class="text-left px-4 py-3 font-medium text-muted-foreground"
                    >
                      {{ getLabel("colDate", "Date") }}
                    </th>
                    <th
                      class="text-left px-4 py-3 font-medium text-muted-foreground"
                    >
                      {{ getLabel("colQuantity", "Quantity") }}
                    </th>
                    <th
                      class="text-left px-4 py-3 font-medium text-muted-foreground"
                    >
                      {{ getLabel("colTotal", "Total") }}
                    </th>
                    <th
                      class="text-left px-4 py-3 font-medium text-muted-foreground"
                    >
                      {{ getLabel("colRequestedBy", "Requested by") }}
                    </th>
                    <th
                      class="text-left px-4 py-3 font-medium text-muted-foreground"
                    >
                      {{ getLabel("colActions", "Actions") }}
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border">
                  <template :key="index" v-for="(cart, index) in carts">
                    <tr class="hover:bg-surface-hover/30 transition-colors">
                      <td class="px-4 py-3 text-muted-foreground">
                        {{ formatDate(cart.lastModifiedAt ?? "") }}
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
                          class="px-3 py-1.5 text-sm border border-input rounded-[var(--radius-control)] bg-background hover:bg-surface-hover/50 transition-colors"
                          @click="async (event) => handleViewCart(cart)"
                        >
                          {{ getLabel("view", "View") }}
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
          <div
            class="propeller-purchase-authorization-requests__modal fixed inset-0 z-50 flex items-center justify-center px-4"
          >
            <div
              class="propeller-purchase-authorization-requests__modal-backdrop fixed inset-0 bg-foreground/20"
              @click="async (event) => closeModal()"
            ></div>
            <div
              class="propeller-purchase-authorization-requests__modal-content relative w-full max-w-2xl bg-card rounded-[var(--radius-container)] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div
                class="propeller-purchase-authorization-requests__modal-header flex items-center justify-between px-6 py-4 border-b border-border-subtle flex-shrink-0"
              >
                <h3
                  class="propeller-purchase-authorization-requests__modal-title text-base font-semibold text-foreground"
                >
                  {{ getLabel("modalTitle", "Authorization Request") }}
                </h3>
                <button
                  type="button"
                  class="propeller-purchase-authorization-requests__modal-close text-foreground-subtle hover:text-muted-foreground focus:outline-none"
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
                    <h4
                      class="propeller-purchase-authorization-requests__modal-section-title text-sm font-semibold text-muted-foreground mb-2"
                    >
                      {{ getLabel("requesterInfo", "Requester") }}
                    </h4>
                    <p class="text-sm font-medium">
                      {{ getContactName(selectedCart?.contact) }}
                    </p>
                    <p class="text-sm text-muted-foreground">
                      {{ selectedCart?.contact?.email }}
                    </p>
                  </div>
                  <div>
                    <h4
                      class="propeller-purchase-authorization-requests__modal-section-title text-sm font-semibold text-muted-foreground mb-2"
                    >
                      {{ getLabel("itemsTitle", "Items") }}
                    </h4>
                    <div class="overflow-x-auto rounded border border-border">
                      <table class="w-full text-sm">
                        <thead
                          class="bg-surface-hover/50 border-b border-border"
                        >
                          <tr>
                            <th
                              class="text-left px-3 py-2 font-medium text-muted-foreground"
                            >
                              {{ getLabel("itemProduct", "Product") }}
                            </th>
                            <th
                              class="text-right px-3 py-2 font-medium text-muted-foreground"
                            >
                              {{ getLabel("itemQty", "Qty") }}
                            </th>
                            <th
                              class="text-right px-3 py-2 font-medium text-muted-foreground"
                            >
                              {{ getLabel("itemUnitPrice", "Unit price") }}
                            </th>
                            <th
                              class="text-right px-3 py-2 font-medium text-muted-foreground"
                            >
                              {{ getLabel("itemTotal", "Total") }}
                            </th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-border">
                          <template
                            :key="idx"
                            v-for="(item, idx) in getModalItems()"
                          >
                            <tr>
                              <td class="px-3 py-2">
                                {{ getProductName(item) }}
                              </td>
                              <td class="px-3 py-2 text-right">
                                {{ item.quantity ?? 0 }}
                              </td>
                              <td class="px-3 py-2 text-right">
                                {{
                                  formatPrice(
                                    (item.quantity ?? 0) > 0
                                      ? (item.totalSum ?? 0) /
                                          (item.quantity ?? 1)
                                      : 0,
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
                      <span>{{
                        getLabel("totalExclVat", "Total excl. VAT:")
                      }}</span
                      ><span>{{
                        formatPrice(selectedCart?.total?.totalGross ?? 0)
                      }}</span>
                    </div>
                    <div class="flex justify-between text-muted-foreground">
                      <span>{{ getLabel("totalVat", "VAT:") }}</span
                      ><span>{{
                        formatPrice(
                          (selectedCart?.total?.totalNet ?? 0) -
                            (selectedCart?.total?.totalGross ?? 0),
                        )
                      }}</span>
                    </div>
                    <div
                      class="flex justify-between font-bold text-base border-t border-border pt-2"
                    >
                      <span>{{ getLabel("total", "Total:") }}</span
                      ><span>{{
                        formatPrice(selectedCart?.total?.totalNet ?? 0)
                      }}</span>
                    </div>
                  </div>
                </div>
                <div
                  class="propeller-purchase-authorization-requests__modal-actions flex gap-3 px-6 py-4 border-t border-border-subtle flex-shrink-0"
                >
                  <button
                    type="button"
                    class="propeller-purchase-authorization-requests__modal-delete flex-1 inline-flex justify-center rounded-[var(--radius-control)] border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-hover/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    @click="async (event) => openDeleteConfirm()"
                    :disabled="deleteLoading || acceptLoading"
                  >
                    {{ getLabel("delete", "Delete") }}</button
                  ><button
                    type="button"
                    class="propeller-purchase-authorization-requests__modal-accept flex-1 inline-flex justify-center rounded-[var(--radius-control)] border border-transparent bg-secondary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-secondary/90 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    @click="async (event) => handleAcceptRequest()"
                    :disabled="acceptLoading || deleteLoading"
                  >
                    <template v-if="acceptLoading">
                      {{ getLabel("accepting", "Accepting...") }}
                    </template>

                    <template v-if="!acceptLoading">
                      {{ getLabel("acceptRequest", "Accept request") }}
                    </template>
                  </button>
                </div>

                <!--
                  Delete confirmation overlay. Shown on top of the preview
                  modal when the user clicks Delete; matches the two-step
                  flow in playground-v2's `delete_purchase_authorization`
                  Bootstrap modal so destructive action requires explicit
                  consent before the cart is removed.
                -->
                <template v-if="showDeleteConfirm">
                  <div
                    class="propeller-purchase-authorization-requests__delete-confirm fixed inset-0 z-[60] flex items-center justify-center px-4"
                  >
                    <div
                      class="propeller-purchase-authorization-requests__delete-confirm-backdrop fixed inset-0 bg-foreground/40"
                      @click="async (event) => closeDeleteConfirm()"
                    ></div>
                    <div
                      class="propeller-purchase-authorization-requests__delete-confirm-content relative w-full max-w-md bg-card rounded-[var(--radius-container)] shadow-2xl overflow-hidden"
                    >
                      <div class="px-6 py-4 border-b border-border-subtle">
                        <h4
                          class="propeller-purchase-authorization-requests__delete-confirm-title text-base font-semibold text-foreground"
                        >
                          {{
                            getLabel(
                              "deleteConfirmTitle",
                              "Delete authorization request?",
                            )
                          }}
                        </h4>
                      </div>
                      <div class="px-6 py-4">
                        <p class="text-sm text-muted-foreground">
                          {{
                            getLabel(
                              "deleteConfirmBody",
                              "Are you sure you want to delete this authorization request? The cart will be permanently removed.",
                            )
                          }}
                        </p>
                      </div>
                      <div
                        class="flex gap-3 px-6 py-4 border-t border-border-subtle"
                      >
                        <button
                          type="button"
                          class="flex-1 inline-flex justify-center rounded-[var(--radius-control)] border border-input bg-card px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                          @click="async (event) => closeDeleteConfirm()"
                          :disabled="deleteLoading"
                        >
                          {{ getLabel("deleteConfirmNo", "No") }}
                        </button>
                        <button
                          type="button"
                          class="flex-1 inline-flex justify-center rounded-[var(--radius-control)] border border-transparent bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          @click="async (event) => confirmDelete()"
                          :disabled="deleteLoading"
                        >
                          <template v-if="deleteLoading">
                            {{ getLabel("deleting", "Deleting...") }}
                          </template>

                          <template v-if="!deleteLoading">
                            {{ getLabel("deleteConfirmYes", "Yes, delete") }}
                          </template>
                        </button>
                      </div>
                    </div>
                  </div>
                </template>
              </template>
            </div>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { usePurchaseAuthorizationRequests } from "../../composables/usePurchaseAuthorization";
import { getLabel as _getLabel } from "../../composables/shared/utils/labelHelpers";
import { formatPrice as _formatPrice } from "../../composables/shared/utils/formatting";
import { getLanguageString } from "../../composables/shared/utils/languageResolver";

import {
  Contact,
  Customer,
  GraphQLClient,
  Cart,
  CartMainItem,
} from "propeller-sdk-v2";

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

  /**
   * Override: fires instead of the default CartService.deleteCart() call.
   * Receives the cartId string.
   */
  onDeleteRequest?: (cartId: string) => void;

  /**
   * Fires after a purchase authorization request has been deleted (cart removed).
   * Receives the deleted cart's id.
   */
  afterDeleteRequest?: (cartId: string) => void;

  /** Format date */
  formatDate?: (dateString: string) => string;

  /** Format price */
  formatPrice?: (price: number) => string;

  /** Labels for the component */
  labels?: Record<string, string>;

  /** Language used to resolve localized product names in the items table. Defaults to 'NL'. */
  language?: string;

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

const userRef = computed(() => props.user ?? null);
const companyRef = computed(() => props.companyId as number);

const {
  carts,
  loading,
  selectedCart,
  modalLoading,
  acceptLoading,
  deleteLoading,
  isAuthManager,
  getTotalQuantity,
  getContactName,
  getModalItems,
  loadCarts,
  handleViewCart,
  handleAcceptRequest,
  handleDeleteRequest,
  closeModal,
} = usePurchaseAuthorizationRequests({
  graphqlClient: props.graphqlClient,
  user: userRef,
  companyId: companyRef,
  configuration: props.configuration,
  onAcceptRequest: props.onAcceptRequest,
  afterAcceptRequest: props.afterAcceptRequest,
  onDeleteRequest: props.onDeleteRequest,
  afterDeleteRequest: props.afterDeleteRequest,
  onError: props.onError,
});

// Two-step delete UX: clicking Delete in the preview modal opens a small
// confirmation overlay. Mirrors playground-v2's `delete_purchase_authorization`
// modal so the destructive action requires explicit user confirmation.
const showDeleteConfirm = ref(false);
function openDeleteConfirm() {
  showDeleteConfirm.value = true;
}
function closeDeleteConfirm() {
  showDeleteConfirm.value = false;
}
async function confirmDelete() {
  await handleDeleteRequest();
  showDeleteConfirm.value = false;
}

function getLabel(key: string, fallback: string): string {
  return _getLabel(props.labels, key, fallback);
}

function getProductName(item: CartMainItem | any): string {
  // First-class lookup: localized names array on the line item's product.
  // Falls back to bundle name (bundle items) and finally to the SKU so the
  // cell never renders empty for an item that does have data.
  const lang = props.language || 'NL';
  const fromNames = getLanguageString((item as any)?.product?.names, lang, '');
  if (fromNames) return fromNames;
  const fromBundle = getLanguageString((item as any)?.bundle?.names, lang, '');
  if (fromBundle) return fromBundle;
  return (item as any)?.product?.sku || '';
}

function formatDate(dateStr: string): string {
  if (props.formatDate) return props.formatDate(dateStr);
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

function formatPrice(price: number): string {
  if (props.formatPrice) return props.formatPrice(price);
  if (!price) return "-";
  return _formatPrice(price, { symbol: "€" });
}
</script>
