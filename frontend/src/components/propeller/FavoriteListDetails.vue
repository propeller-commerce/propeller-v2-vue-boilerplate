<template>
  <div
    :class="`propeller-favorite-list-details ${className || ''}`"
    :data-loading="loading ? 'true' : 'false'"
  >
    <template v-if="loading">
      <div class="propeller-favorite-list-details__skeleton space-y-4">
        <template :key="i" v-for="(i, index) in [1, 2, 3]">
          <div
            class="propeller-favorite-list-details__skeleton-row flex items-center gap-4 p-4 border-b border-border animate-pulse"
          >
            <div
              class="w-20 h-20 bg-surface-hover rounded-[var(--radius-control)] flex-shrink-0"
            ></div>
            <div class="flex-1 space-y-2">
              <div class="h-4 w-1/4 bg-surface-hover rounded"></div>
              <div class="h-5 w-1/2 bg-surface-hover rounded"></div>
              <div class="h-4 w-1/6 bg-surface-hover rounded"></div>
            </div>
            <div class="h-10 w-28 bg-surface-hover rounded"></div>
          </div>
        </template>
      </div>
    </template>

    <template v-if="!loading && isMounted">
      <template v-if="allItems.length > 0">
        <div class="propeller-favorite-list-details__list space-y-3">
          <div class="propeller-favorite-list-details__select-all flex items-center gap-2 pb-2">
            <input
              id="favorite-list-select-all-top"
              type="checkbox"
              class="propeller-favorite-list-details__select-all-checkbox h-4 w-4 rounded border-border accent-secondary cursor-pointer"
              :checked="isAllPageSelected()"
              @change="togglePageSelectAll()"
            />
            <label
              for="favorite-list-select-all-top"
              class="propeller-favorite-list-details__select-all-label text-sm font-medium cursor-pointer select-none"
            >
              {{ getLabel("selectAll", "Select all") }}
            </label>
          </div>
          <template
            :key="
              'productId' in item
                ? 'p-' + item.productId
                : 'c-' + item.clusterId
            "
            v-for="(item, idx) in getPagedItems()"
          >
            <div
              class="propeller-favorite-list-details__row flex items-center gap-3"
              :data-selected="isRowSelected(item) ? 'true' : 'false'"
            >
              <input
                type="checkbox"
                class="propeller-favorite-list-details__row-checkbox h-4 w-4 flex-shrink-0 rounded border-border accent-secondary cursor-pointer"
                :checked="isRowSelected(item)"
                @change="toggleRow(item)"
                :aria-label="getLabel('selectItem', 'Select item')"
              />
              <div class="propeller-favorite-list-details__row-item flex-1 min-w-0">
                <FavoriteListItem
                  :item="item"
                  :graphqlClient="graphqlClient"
                  :user="user"
                  :cartId="cartId"
                  :createCart="createCart"
                  :onCartCreated="onCartCreated"
                  :onAddToCart="onAddToCart"
                  :afterAddToCart="afterAddToCart"
                  :showModal="showModal"
                  :allowIncrDecr="allowIncrDecr"
                  :enableStockValidation="enableStockValidation"
                  :language="language"
                  :onProceedToCheckout="onProceedToCheckout"
                  :onRequestQuoteClick="onRequestQuoteClick"
                  :addToCartLabels="addToCartLabels"
                  :stockLabels="stockLabels"
                  :labels="itemLabels"
                  :configuration="configuration"
                  :titleLinkable="titleLinkable"
                  :showStockComponent="showStockComponent"
                  :showAvailability="showAvailability"
                  :showStock="showStock"
                  :showSku="showSku"
                  :allowAddToCart="allowAddToCart"
                  :showDelete="showDelete"
                  :onDelete="(itemId) => handleItemDelete(itemId)"
                  :onItemClick="onItemClick"
                  :includeTax="includeTax"
                ></FavoriteListItem>
              </div>
            </div>
          </template>
          <template v-if="showPagination !== false && getTotalPages() > 1">
            <div class="propeller-favorite-list-details__pagination mt-6">
              <GridPagination
                :products="getPaginationData()"
                :onPageChange="(page) => handlePageChange(page)"
                :variant="paginationVariant || 'compact'"
              ></GridPagination>
            </div>
          </template>
        </div>
      </template>

      <div class="propeller-favorite-list-details__add-wrapper mt-6">
        <button
          type="button"
          class="propeller-favorite-list-details__add-btn inline-flex items-center justify-center rounded-[var(--radius-control)] bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/90"
          @click="showAddModal = true"
        >
          {{ getLabel("addProductDirectly", "Add product directly to this wishlist") }}
        </button>
      </div>

      <template v-if="allItems.length === 0">
        <div
          class="propeller-favorite-list-details__empty border border-border rounded-[var(--radius-container)] p-12 text-center space-y-4"
        >
          <div
            class="propeller-favorite-list-details__empty-icon-wrapper bg-surface-hover p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              class="propeller-favorite-list-details__empty-icon text-foreground-subtle"
            >
              <path
                d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
              ></path>
            </svg>
          </div>
          <div>
            <p
              class="propeller-favorite-list-details__empty-title text-lg font-medium"
            >
              {{ getLabel("emptyTitle", "List is empty") }}
            </p>
            <p
              class="propeller-favorite-list-details__empty-message text-muted-foreground"
            >
              {{
                getLabel(
                  "emptyDescription",
                  "You haven't added any products or clusters to this list yet.",
                )
              }}
            </p>
          </div>
        </div>
      </template>
    </template>

    <template v-if="selectedIds.size > 0">
      <div class="propeller-favorite-list-details__floating-bar fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card shadow-lg">
        <div class="propeller-favorite-list-details__floating-bar-inner flex items-center justify-between gap-4 px-6 py-4">
          <div class="propeller-favorite-list-details__floating-bar-status flex items-center gap-2">
            <input
              id="favorite-list-select-all-floating"
              type="checkbox"
              class="h-4 w-4 rounded border-border accent-secondary cursor-pointer"
              :checked="isAllPageSelected()"
              @change="togglePageSelectAll()"
            />
            <label
              for="favorite-list-select-all-floating"
              class="text-sm font-medium cursor-pointer select-none"
            >
              {{ getLabel("selectAll", "Select all") }}
            </label>
            <span class="propeller-favorite-list-details__floating-bar-count text-sm text-foreground-subtle ml-3">
              {{ selectedIds.size }} {{ getLabel("ofWord", "of") }} {{ allItems.length }} {{ getLabel("itemsSelected", "items selected") }}
            </span>
          </div>
          <div class="propeller-favorite-list-details__floating-bar-actions flex items-center gap-3">
            <button
              type="button"
              class="propeller-favorite-list-details__bulk-remove-btn inline-flex items-center justify-center rounded-[var(--radius-control)] border border-border bg-transparent px-4 py-2 text-sm font-medium text-secondary transition-colors hover:bg-surface-hover disabled:opacity-50"
              :disabled="bulkBusy"
              @click="handleBulkRemove()"
            >
              {{ getLabel("removeFromList", "Remove from this list") }}
            </button>
            <button
              type="button"
              class="propeller-favorite-list-details__bulk-add-btn inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-secondary px-6 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/90 disabled:opacity-50"
              :disabled="bulkBusy || getSelectedProducts().length === 0"
              @click="handleBulkAddToCart()"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              {{ getLabel("addToCart", "Add to cart") }}
            </button>
          </div>
        </div>
      </div>
    </template>

    <template v-if="showAddModal">
      <div
        class="propeller-favorite-list-details__modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click="closeAddModal()"
      >
        <div
          class="propeller-favorite-list-details__modal w-full max-w-xl rounded-[var(--radius-container)] bg-card shadow-xl"
          @click.stop
        >
          <div class="propeller-favorite-list-details__modal-header border-b border-border px-6 py-4">
            <h2 class="propeller-favorite-list-details__modal-title text-lg font-bold">
              {{ getLabel("addProductModalTitle", "Add product to list") }}
            </h2>
          </div>
          <div class="propeller-favorite-list-details__modal-body px-6 py-4 space-y-4">
            <div class="propeller-favorite-list-details__search-input-wrapper relative">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                class="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-subtle"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                class="propeller-favorite-list-details__search-input w-full rounded-[var(--radius-control)] border border-border bg-card px-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
                :placeholder="getLabel('searchPlaceholder', 'Search for products...')"
                :value="searchTerm"
                @input="onSearchInput($event)"
                autofocus
              />
              <button
                v-if="searchTerm"
                type="button"
                class="propeller-favorite-list-details__search-clear absolute right-3 top-1/2 -translate-y-1/2 text-foreground-subtle hover:text-foreground"
                @click="search('')"
                aria-label="Clear search"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div class="propeller-favorite-list-details__search-results max-h-80 overflow-y-auto">
              <template v-if="searchLoading">
                <div class="propeller-favorite-list-details__search-loading py-6 text-center text-sm text-foreground-subtle">
                  {{ getLabel("searching", "Searching...") }}
                </div>
              </template>
              <template v-if="!searchLoading && searchTerm && searchResults.length === 0">
                <div class="propeller-favorite-list-details__search-empty py-6 text-center text-sm text-foreground-subtle">
                  {{ getLabel("noResults", "No results") }}
                </div>
              </template>
              <template v-if="!searchLoading && searchResults.length > 0">
                <ul class="propeller-favorite-list-details__search-list divide-y divide-border">
                  <li
                    v-for="item in searchResults"
                    :key="getRowKey(item)"
                    class="propeller-favorite-list-details__search-item flex items-center gap-3 py-3 cursor-pointer hover:bg-surface-hover transition-colors px-2 rounded-[var(--radius-control)]"
                    :data-adding="addingItemKey === getRowKey(item) ? 'true' : 'false'"
                    @click="handleAddItemFromSearch(item)"
                  >
                    <div class="propeller-favorite-list-details__search-item-media h-14 w-14 flex-shrink-0 rounded-[var(--radius-control)] bg-surface-hover overflow-hidden flex items-center justify-center">
                      <img
                        v-if="getSearchItemImage(item)"
                        :src="getSearchItemImage(item)"
                        :alt="getSearchItemName(item)"
                        class="h-full w-full object-contain"
                      />
                      <svg
                        v-else
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        class="text-foreground-subtle"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                    </div>
                    <div class="propeller-favorite-list-details__search-item-body flex-1 min-w-0">
                      <p class="propeller-favorite-list-details__search-item-name text-sm font-medium line-clamp-2">
                        {{ getSearchItemName(item) }}
                      </p>
                      <p
                        v-if="getSearchItemSku(item)"
                        class="propeller-favorite-list-details__search-item-sku font-mono text-xs text-foreground-subtle mt-0.5"
                      >
                        SKU: {{ getSearchItemSku(item) }}
                      </p>
                      <p
                        v-if="getSearchItemStockLabel(item)"
                        class="propeller-favorite-list-details__search-item-stock text-xs text-foreground-subtle mt-0.5"
                      >
                        {{ getSearchItemStockLabel(item) }}
                      </p>
                    </div>
                    <span
                      v-if="addingItemKey === getRowKey(item)"
                      class="propeller-favorite-list-details__search-item-spinner text-xs text-foreground-subtle"
                    >
                      {{ getLabel("adding", "Adding...") }}
                    </span>
                  </li>
                </ul>
              </template>
            </div>
          </div>
          <div class="propeller-favorite-list-details__modal-footer border-t border-border px-6 py-4 flex justify-end">
            <button
              type="button"
              class="propeller-favorite-list-details__modal-close inline-flex items-center justify-center rounded-[var(--radius-control)] border border-border px-6 py-2 text-sm font-medium text-secondary transition-colors hover:bg-surface-hover"
              @click="closeAddModal()"
            >
              {{ getLabel("close", "Close") }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch, toRef, computed } from "vue";

import {
  Product,
  Cluster,
  FavoriteList,
  FavoriteListService,
  GraphQLClient,
  Contact,
  Customer,
  Cart,
  CartMainItem,
  CartChildItemInput,
  ProductsResponse,
} from "propeller-sdk-v2";
import FavoriteListItem from "./FavoriteListItem.vue";
import GridPagination from "./GridPagination.vue";
import { getLabel as _getLabel } from "../../composables/shared/utils/labelHelpers";
import { getProductImageUrl, getClusterImageUrl } from "../../composables/shared/utils/productHelpers";
import { useFavorites } from "../../composables/useFavorites";
import { useProductSearch } from "../../composables/useProductSearch";
import { useCart } from "../../composables/useCart";

export interface FavoriteListDetailsProps {
  /** GraphQL client for the Propeller SDK */
  graphqlClient: GraphQLClient;

  /** The logged in user for which the favorite list is going to be displayed */
  user: Contact | Customer;

  /** The favorite list ID to display */
  favoriteListId: string;

  /** Action method for deleting a single favorite list item. If not provided, delete button is hidden */
  onItemDelete?: (itemId: string, itemType?: string) => void;

  /** Batched delete callback for the floating bar "Remove" action. When provided, it is called once with all selected items; otherwise the component falls back to calling `onItemDelete` per item */
  onItemsDelete?: (items: { id: string; type: "product" | "cluster" }[]) => void;

  /** Called after the favorite list is fetched, with the full list object */
  onListLoaded?: (list: FavoriteList) => void;

  /** Number of items to show per page (default: 12) */
  itemsPerPage?: number;

  /** Show pagination controls (default: true) */
  showPagination?: boolean;

  /** Pagination display variant: 'compact' or 'full' (default: 'compact') */
  paginationVariant?: string;

  /** Extra CSS class applied to the root element */
  className?: string;

  /** Configuration object for URL generation */
  configuration?: any;

  /** UI string overrides */
  labels?: Record<string, string>;

  // === FavoriteListItem display props ===

  /** Should item titles link to the PDP (default: true) */
  titleLinkable?: boolean;

  /** Show stock availability on items (default: false) */
  showStockComponent?: boolean;

  /** Show availability status (e.g. "In stock") inside ItemStock (default: true) */
  showAvailability?: boolean;

  /** Show numeric stock quantity inside ItemStock (default: true) */
  showStock?: boolean;

  /** Display the SKU beneath item names (default: true) */
  showSku?: boolean;

  /** Enable add to cart for products. Clusters show "View cluster" instead (default: true) */
  allowAddToCart?: boolean;

  /** Show delete button on each item (default: true) */
  showDelete?: boolean;

  /** Callback when an item title or image is clicked */
  onItemClick?: (item: Product | Cluster) => void;

  // === AddToCart pass-through props (products only) ===

  /** ID of an existing cart to add items to */
  cartId?: string;

  /** Auto-create cart if none exists */
  createCart?: boolean;

  /** Called after a new cart is created internally by AddToCart */
  onCartCreated?: (cart: Cart) => void;

  /** Fully replaces the internal CartService.addItemToCart call */
  onAddToCart?: (
    product: Product,
    clusterId?: number,
    quantity?: number,
    childItems?: CartChildItemInput[],
    notes?: string,
    price?: number,
    showModal?: boolean,
  ) => Cart;

  /** Called after every successful add-to-cart */
  afterAddToCart?: (cart: Cart, item?: CartMainItem) => void;

  /** Show modal after successful add (default: false) */
  showModal?: boolean;

  /** Renders increment/decrement buttons beside quantity input (default: true) */
  allowIncrDecr?: boolean;

  /** Validate stock before adding to cart (default: false) */
  enableStockValidation?: boolean;

  /** Language code forwarded to CartService (default: 'NL') */
  language?: string;

  /** Called when "Proceed to checkout" is clicked in AddToCart modal */
  onProceedToCheckout?: () => void;

  /** Called when "Request a Quote" is clicked in AddToCart modal */
  onRequestQuoteClick?: (cart: Cart) => void;

  /** Label overrides for AddToCart UI strings */
  addToCartLabels?: Record<string, string>;

  /** Label overrides for ItemStock UI strings */
  stockLabels?: Record<string, string>;

  /** Label overrides for FavoriteListItem UI strings */
  itemLabels?: Record<string, string>;

  /** Include tax in prices. Pass from PriceContext's usePrice() */
  includeTax?: boolean;
}
interface FavoriteListDetailsState {
  loading: boolean;
  favoriteList: FavoriteList | null;
  allItems: (Product | Cluster)[];
  currentPage: number;
  isMounted: boolean;
  prevListId: string;
  getLabel: (key: string, fallback: string) => string;
  getItemsPerPage: () => number;
  getTotalPages: () => number;
  getPagedItems: () => (Product | Cluster)[];
  getPaginationData: () => Record<string, number>;
  handlePageChange: (page: number) => void;
  buildFetchVariables: () => Record<string, unknown>;
  fetchList: () => Promise<void>;
  handleItemDelete: (itemId: string) => void;
}

const props = withDefaults(defineProps<FavoriteListDetailsProps>(), {
  titleLinkable: true,
  showSku: true,
  allowAddToCart: true,
  showDelete: true,
  showPagination: true,
  showStockComponent: false,
  showAvailability: false,
  showStock: false,
});
const loading = ref<FavoriteListDetailsState["loading"]>(true);
const favoriteList = ref<FavoriteListDetailsState["favoriteList"]>(null);
const allItems = ref<FavoriteListDetailsState["allItems"]>([]);
const currentPage = ref<FavoriteListDetailsState["currentPage"]>(1);
const isMounted = ref<FavoriteListDetailsState["isMounted"]>(false);
const prevListId = ref<FavoriteListDetailsState["prevListId"]>("");
const selectedIds = ref<Set<string>>(new Set());
const bulkBusy = ref(false);
const showAddModal = ref(false);
const addingItemKey = ref("");

const userRef = toRef(props, "user") as any;
const languageRef = computed(() => props.language || "NL");

const { addToList } = useFavorites({
  graphqlClient: props.graphqlClient,
  user: userRef,
  language: languageRef,
});

const { addItem } = useCart({
  graphqlClient: props.graphqlClient,
  user: userRef,
  cartId: props.cartId,
  language: languageRef,
  configuration: (props.configuration || {}) as any,
  onCartCreated: props.onCartCreated,
});

const { searchTerm, searchResults, searchLoading, search } = useProductSearch({
  graphqlClient: props.graphqlClient,
  language: languageRef,
  user: userRef,
  configuration: (props.configuration || {}) as any,
});

function getRowKey(item: Product | Cluster): string {
  if ("productId" in item) return "p-" + String((item as Product).productId);
  return "c-" + String((item as Cluster).clusterId);
}

function isRowSelected(item: Product | Cluster): boolean {
  return selectedIds.value.has(getRowKey(item));
}

function toggleRow(item: Product | Cluster) {
  const next = new Set(selectedIds.value);
  const key = getRowKey(item);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  selectedIds.value = next;
}

function getPageRowKeys(): string[] {
  return getPagedItems().map((i) => getRowKey(i));
}

function isAllPageSelected(): boolean {
  const keys = getPageRowKeys();
  if (keys.length === 0) return false;
  return keys.every((k) => selectedIds.value.has(k));
}

function togglePageSelectAll() {
  const next = new Set(selectedIds.value);
  const keys = getPageRowKeys();
  const allSelected = keys.every((k) => next.has(k));
  if (allSelected) keys.forEach((k) => next.delete(k));
  else keys.forEach((k) => next.add(k));
  selectedIds.value = next;
}

function clearSelection() {
  selectedIds.value = new Set();
}

function getSelectedItems(): (Product | Cluster)[] {
  return allItems.value.filter((i) => selectedIds.value.has(getRowKey(i)));
}

function getSelectedProducts(): Product[] {
  return getSelectedItems().filter((i) => "productId" in i) as Product[];
}

async function handleBulkRemove() {
  if (bulkBusy.value) return;
  const items = getSelectedItems();
  if (items.length === 0) return;
  bulkBusy.value = true;
  try {
    const entries: { id: string; type: "product" | "cluster" }[] = items.map((it) => ({
      id:
        "productId" in it
          ? String((it as Product).productId)
          : String((it as Cluster).clusterId),
      type: "productId" in it ? "product" : "cluster",
    }));
    const remaining = allItems.value.filter(
      (p) => !selectedIds.value.has(getRowKey(p))
    );
    allItems.value = remaining;
    clearSelection();
    const newTotalPages = Math.max(
      1,
      Math.ceil(remaining.length / getItemsPerPage())
    );
    if (currentPage.value > newTotalPages) {
      currentPage.value = newTotalPages;
    }
    if (props.onItemsDelete) {
      props.onItemsDelete(entries);
    } else if (props.onItemDelete) {
      entries.forEach((entry) =>
        props.onItemDelete!(entry.id, entry.type)
      );
    }
  } finally {
    bulkBusy.value = false;
  }
}

async function handleBulkAddToCart() {
  if (bulkBusy.value) return;
  const products = getSelectedProducts();
  if (products.length === 0) return;
  bulkBusy.value = true;
  try {
    for (const product of products) {
      await addItem({
        product,
        quantity:
          product.minimumQuantity && product.minimumQuantity > 0
            ? product.minimumQuantity
            : 1,
        cartId: props.cartId,
        createCart: props.createCart !== false,
        enableStockValidation: props.enableStockValidation,
        afterAddToCart: (resultCart, addedItem) => {
          props.afterAddToCart?.(resultCart, addedItem || undefined);
        },
      });
    }
    clearSelection();
  } finally {
    bulkBusy.value = false;
  }
}

async function handleAddItemFromSearch(item: Product | Cluster) {
  const key = getRowKey(item);
  if (addingItemKey.value) return;
  addingItemKey.value = key;
  try {
    const productId =
      "productId" in item ? (item as Product).productId : undefined;
    const clusterId =
      "clusterId" in item ? (item as Cluster).clusterId : undefined;
    await addToList(props.favoriteListId, productId, clusterId);
    await fetchList();
  } finally {
    addingItemKey.value = "";
  }
}

function getSearchItemName(item: Product | Cluster): string {
  if ("productId" in item)
    return (item as Product).names?.[0]?.value || "Product";
  const cluster = item as Cluster;
  return (
    cluster.names?.[0]?.value ||
    cluster.defaultProduct?.names?.[0]?.value ||
    "Cluster"
  );
}

function getSearchItemSku(item: Product | Cluster): string {
  if ("productId" in item) return (item as Product).sku || "";
  const cluster = item as Cluster;
  return cluster.sku || cluster.defaultProduct?.sku || "";
}

function getSearchItemImage(item: Product | Cluster): string {
  if ("productId" in item) return getProductImageUrl(item as Product);
  return getClusterImageUrl(item as Cluster);
}

function getSearchItemStockLabel(item: Product | Cluster): string {
  const qty =
    "productId" in item
      ? (item as Product).inventory?.totalQuantity
      : (item as Cluster).defaultProduct?.inventory?.totalQuantity;
  if (qty === undefined || qty === null) return "";
  if (qty <= 0) return getLabel("outOfStock", "Out of stock");
  if (qty <= 5) return getLabel("lowStock", "Low stock");
  return getLabel("inStock", "In stock");
}

function closeAddModal() {
  showAddModal.value = false;
  search("");
}

function onSearchInput(event: Event) {
  const target = event.target as HTMLInputElement;
  search(target.value);
}

onMounted(() => {
  isMounted.value = true;
  prevListId.value = props.favoriteListId || "";
  fetchList();
});

watch(
  () => [props.favoriteListId],
  () => {
    if (props.favoriteListId && props.favoriteListId !== prevListId.value) {
      prevListId.value = props.favoriteListId;
      fetchList();
    }
  },
  { immediate: true },
);
function getLabel(
  key: string,
  fallback: string,
): ReturnType<FavoriteListDetailsState["getLabel"]> {
  return _getLabel(props.labels, key, fallback);
}
function getItemsPerPage(): ReturnType<
  FavoriteListDetailsState["getItemsPerPage"]
> {
  return props.itemsPerPage || 12;
}
function getTotalPages(): ReturnType<
  FavoriteListDetailsState["getTotalPages"]
> {
  return Math.max(1, Math.ceil(allItems.value.length / getItemsPerPage()));
}
function getPagedItems(): ReturnType<
  FavoriteListDetailsState["getPagedItems"]
> {
  const perPage = getItemsPerPage();
  const start = (currentPage.value - 1) * perPage;
  return allItems.value.slice(start, start + perPage);
}
function getPaginationData(): ReturnType<
  FavoriteListDetailsState["getPaginationData"]
> {
  return {
    page: currentPage.value,
    pages: getTotalPages(),
    itemsFound: allItems.value.length,
    offset: getItemsPerPage(),
  };
}
function handlePageChange(
  page: number,
): ReturnType<FavoriteListDetailsState["handlePageChange"]> {
  currentPage.value = page;
}
function buildFetchVariables(): ReturnType<
  FavoriteListDetailsState["buildFetchVariables"]
> {
  const priceInput: Record<string, unknown> = {
    taxZone: "NL",
  };
  if (props.user) {
    if ("customerId" in props.user) {
      const customer = props.user as Customer;
      if (customer.customerId) {
        priceInput.customerId = customer.customerId;
      }
    } else if ("contactId" in props.user) {
      const contact = props.user as Contact;
      if (contact.contactId) {
        priceInput.contactId = contact.contactId;
      }
      if (contact.company?.companyId) {
        priceInput.companyId = contact.company.companyId;
      }
    }
  }
  return {
    id: props.favoriteListId,
    language: props.language || "NL",
    priceCalculateProductInput: priceInput,
    imageSearchFilters: {
      page: 1,
      offset: 1,
    },
    imageVariantFilters: {
      transformations: [
        {
          name: "cart_thumb",
          transformation: {
            format: "WEBP",
            height: 200,
            width: 200,
            fit: "BOUNDS",
          },
        },
      ],
    },
  };
}
async function fetchList(): ReturnType<FavoriteListDetailsState["fetchList"]> {
  if (!props.graphqlClient || !props.favoriteListId) return;
  loading.value = true;
  try {
    const service = new FavoriteListService(props.graphqlClient);
    const list = await service.getFavoriteList(buildFetchVariables());
    favoriteList.value = list;
    if (props.onListLoaded) {
      props.onListLoaded(list);
    }
    const items: (Product | Cluster)[] = [];
    const productsRef = list?.products as ProductsResponse;
    if (productsRef?.items && Array.isArray(productsRef.items)) {
      (productsRef.items as Product[]).forEach((item: Product) =>
        items.push(item),
      );
    }
    const clustersRef = list?.clusters as ProductsResponse;
    if (clustersRef?.items && Array.isArray(clustersRef.items)) {
      (clustersRef.items as Cluster[]).forEach((item: Cluster) =>
        items.push(item),
      );
    }
    allItems.value = items;
    currentPage.value = 1;
  } catch (error) {
    console.error("Error fetching favorite list:", error);
    favoriteList.value = null;
    allItems.value = [];
  } finally {
    loading.value = false;
  }
}
function handleItemDelete(
  itemId: string,
): ReturnType<FavoriteListDetailsState["handleItemDelete"]> {
  /* Determine item type before removing from local state */
  const deletedItem = allItems.value.find((item: Product | Cluster) => {
    if ("productId" in item) return String(item.productId) === itemId;
    return String((item as Cluster).clusterId) === itemId;
  });
  const itemType: string =
    deletedItem && "clusterId" in deletedItem ? "cluster" : "product";
  /* Optimistic: remove from local state */
  allItems.value = allItems.value.filter((item: Product | Cluster) => {
    if ("productId" in item) return String(item.productId) !== itemId;
    return String((item as Cluster).clusterId) !== itemId;
  });
  /* Adjust current page if needed */
  if (currentPage.value > getTotalPages()) {
    currentPage.value = Math.max(1, getTotalPages());
  }
  /* Notify parent with type info */
  if (props.onItemDelete) {
    props.onItemDelete(itemId, itemType);
  }
}
</script>
