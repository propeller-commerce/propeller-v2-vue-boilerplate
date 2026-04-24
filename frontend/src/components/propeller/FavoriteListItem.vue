<template>
  <div
    @click="async (e) => handleItemClick(e)"
    :data-type="isProduct() ? 'product' : 'cluster'"
    :class="`propeller-favorite-list-item flex flex-row items-center gap-4 rounded-[var(--radius-container)] border border-border bg-card p-4 transition-colors hover:border-secondary/20 hover:shadow-sm cursor-pointer ${
      className || ''
    }`"
  >
    <div
      class="propeller-favorite-list-item__media relative w-16 h-16 flex-shrink-0 overflow-hidden rounded-[var(--radius-control)] bg-surface-hover p-1"
    >
      <template v-if="titleLinkable !== false">
        <a
          class="block h-full w-full"
          :href="getItemUrl()"
          @click="async (e) => handleItemClick(e)"
        >
          <template v-if="!!getImageUrl()">
            <img
              class="propeller-favorite-list-item__image h-full w-full object-contain"
              :src="getImageUrl()"
              :alt="getName()"
            />
          </template>

          <template v-if="!getImageUrl()">
            <div
              class="propeller-favorite-list-item__image-placeholder flex h-full w-full items-center justify-center text-foreground-subtle"
            >
              <svg
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                class="h-8 w-8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  :strokeWidth="1"
                ></path>
              </svg>
            </div>
          </template>
        </a>
      </template>

      <template v-if="titleLinkable === false">
        <div class="block h-full w-full">
          <template v-if="!!getImageUrl()">
            <img
              class="propeller-favorite-list-item__image h-full w-full object-contain"
              :src="getImageUrl()"
              :alt="getName()"
            />
          </template>

          <template v-if="!getImageUrl()">
            <div
              class="propeller-favorite-list-item__image-placeholder flex h-full w-full items-center justify-center text-foreground-subtle"
            >
              <svg
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                class="h-8 w-8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  :strokeWidth="1"
                ></path>
              </svg>
            </div>
          </template>
        </div>
      </template>
    </div>
    <div
      class="propeller-favorite-list-item__body flex flex-col gap-0.5 min-w-0 flex-1"
    >
      <template v-if="showSku !== false && !!getSku()">
        <span
          class="propeller-favorite-list-item__sku font-mono text-xs text-foreground-subtle"
          >{{ getSku() }}</span
        >
      </template>

      <template v-if="titleLinkable !== false">
        <a
          class="propeller-favorite-list-item__title text-sm font-medium leading-tight text-foreground transition-colors hover:text-secondary line-clamp-1"
          :href="getItemUrl()"
          @click="async (e) => handleItemClick(e)"
          >{{ getName() }}</a
        >
      </template>

      <template v-if="titleLinkable === false">
        <span
          class="propeller-favorite-list-item__title text-sm font-medium leading-tight text-foreground line-clamp-1"
          >{{ getName() }}</span
        >
      </template>
    </div>
    <template
      v-if="showStockComponent && isProduct() && !!getProduct().inventory"
    >
      <div class="flex-shrink-0">
        <ItemStock
          :inventory="getProduct().inventory"
          :showAvailability="showAvailability !== false"
          :showStock="showStock !== false"
          :labels="stockLabels"
        ></ItemStock>
      </div>
    </template>

    <template v-if="showStockComponent && !isProduct()">
      <template
        v-if="
          getCluster()?.defaultProduct?.inventory?.totalQuantity !== undefined
        "
      >
        <div class="propeller-favorite-list-item__stock flex-shrink-0">
          <template
            v-if="
              (getCluster()?.defaultProduct?.inventory?.totalQuantity || 0) > 5
            "
          >
            <span
              class="propeller-favorite-list-item__stock-badge inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-success bg-success/10"
              data-stock="in"
              >{{ getLabel("inStock", "In stock") }}</span
            >
          </template>

          <template
            v-if="
              (getCluster()?.defaultProduct?.inventory?.totalQuantity || 0) >
                0 &&
              (getCluster()?.defaultProduct?.inventory?.totalQuantity || 0) <= 5
            "
          >
            <span
              class="propeller-favorite-list-item__stock-badge inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-warning bg-warning/10"
              data-stock="low"
              >{{ getLabel("lowStock", "Low stock") }}</span
            >
          </template>

          <template
            v-if="
              (getCluster()?.defaultProduct?.inventory?.totalQuantity || 0) ===
              0
            "
          >
            <span
              class="propeller-favorite-list-item__stock-badge inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-destructive bg-destructive/10"
              data-stock="out"
              >{{ getLabel("outOfStock", "Out of stock") }}</span
            >
          </template>
        </div>
      </template>
    </template>

    <template v-if="!!getItemPrice()">
      <span
        class="propeller-favorite-list-item__price text-base font-bold text-foreground whitespace-nowrap flex-shrink-0"
        >{{ getItemPrice() }}</span
      >
    </template>

    <div
      class="propeller-favorite-list-item__actions flex items-center gap-2 flex-shrink-0"
      @click="async (e) => e.stopPropagation()"
    >
      <template
        v-if="allowAddToCart !== false && isProduct() && !!graphqlClient"
      >
        <AddToCart
          :graphqlClient="graphqlClient"
          :user="user || null"
          :product="getProduct()"
          :cartId="cartId"
          :configuration="configuration"
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
          :labels="addToCartLabels"
        ></AddToCart>
      </template>

      <template v-if="!isProduct()">
        <a
          class="propeller-favorite-list-item__view-cluster inline-flex items-center justify-center rounded-[var(--radius-control)] bg-secondary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-secondary/90 whitespace-nowrap"
          :href="getItemUrl()"
          @click="async (e) => handleItemClick(e)"
          >{{ getLabel("viewCluster", "View cluster") }}</a
        >
      </template>

      <template v-if="showDelete !== false">
        <button
          type="button"
          class="propeller-favorite-list-item__delete-btn h-8 w-8 p-0 inline-flex items-center justify-center rounded-[var(--radius-control)] text-foreground-subtle hover:text-destructive hover:bg-destructive/10 transition-colors"
          @click="async (event) => handleDelete()"
          :title="getLabel('delete', 'Remove from list')"
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
            <path d="M3 6h18"></path>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
          </svg>
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Product,
  Cluster,
  GraphQLClient,
  Contact,
  Customer,
  Cart,
  CartMainItem,
  CartChildItemInput,
} from "propeller-sdk-v2";
import AddToCart from "./AddToCart.vue";
import ItemStock from "./ItemStock.vue";
import { getLabel as _getLabel } from "../../composables/shared/utils/labelHelpers";
import {
  getProductImageUrl as _getProductImageUrl,
  getClusterImageUrl as _getClusterImageUrl,
  getProductSku as _getProductSku,
  getClusterSku as _getClusterSku,
} from "../../composables/shared/utils/productHelpers";
import { formatPrice as _formatPrice } from "../../composables/shared/utils/formatting";

export interface FavoriteListItemProps {
  /** Product or Cluster to be listed as a favorite list item */
  item: Product | Cluster;

  /** Should the item title be a link to the PDP (default: true) */
  titleLinkable?: boolean;

  /** Should the stock be displayed in the favorite list item (default: false) */
  showStockComponent?: boolean;

  /** Show availability status (e.g. "In stock") inside ItemStock (default: true) */
  showAvailability?: boolean;

  /** Show numeric stock quantity inside ItemStock (default: true) */
  showStock?: boolean;

  /** Display the SKU of the item beneath the item name (default: true) */
  showSku?: boolean;

  /** Enables the add to cart functionality for products. Clusters show a "View cluster" button instead (default: true) */
  allowAddToCart?: boolean;

  /** Display a delete button that removes the favorite list item from the list (default: true) */
  showDelete?: boolean;

  /** Action callback fired when a favorite list item is deleted from the list */
  onDelete?: (itemId: string) => void;

  /** Callback when the item title or image is clicked. Prevents default <a> navigation when provided */
  onItemClick?: (item: Product | Cluster) => void;

  /** Extra CSS class applied to the root element */
  className?: string;

  /** Configuration object for URL generation */
  configuration?: any;

  /** UI string overrides */
  labels?: Record<string, string>;

  /** Include tax in the price display. When provided, overrides the internal PriceToggle state */
  includeTax?: boolean;

  // === AddToCart pass-through props (only used for products) ===

  /** Initialised Propeller SDK GraphQL client (required by embedded AddToCart) */
  graphqlClient?: GraphQLClient;

  /** Authenticated user — used for cart creation / lookup */
  user?: Contact | Customer | null;

  /** ID of an existing cart to add items to */
  cartId?: string;

  /** When true and no cartId is available, AddToCart automatically creates a cart */
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
}
interface FavoriteListItemState {
  isProduct: () => boolean;
  getProduct: () => Product;
  getCluster: () => Cluster;
  getName: () => string;
  getSku: () => string;
  getImageUrl: () => string;
  getItemUrl: () => string;
  getItemId: () => string;
  getItemPrice: () => string;
  getLabel: (key: string, fallback: string) => string;
  handleItemClick: (e: any) => void;
  handleDelete: () => void;
}

const props = withDefaults(defineProps<FavoriteListItemProps>(), {
  titleLinkable: true,
  showSku: true,
  allowAddToCart: true,
  showDelete: true,
  showStockComponent: false,
  showAvailability: false,
  showStock: false,
});

function isProduct(): ReturnType<FavoriteListItemState["isProduct"]> {
  return "productId" in props.item;
}
function getProduct(): ReturnType<FavoriteListItemState["getProduct"]> {
  return props.item as Product;
}
function getCluster(): ReturnType<FavoriteListItemState["getCluster"]> {
  return props.item as Cluster;
}
function getName(): ReturnType<FavoriteListItemState["getName"]> {
  if (isProduct()) {
    return getProduct()?.names?.[0]?.value || "Product";
  }
  return (
    getCluster()?.names?.[0]?.value ||
    getCluster()?.defaultProduct?.names?.[0]?.value ||
    "Cluster"
  );
}
function getSku(): ReturnType<FavoriteListItemState["getSku"]> {
  if (isProduct()) return _getProductSku(getProduct());
  return _getClusterSku(getCluster());
}
function getImageUrl(): ReturnType<FavoriteListItemState["getImageUrl"]> {
  if (isProduct()) return _getProductImageUrl(getProduct());
  return _getClusterImageUrl(getCluster());
}
function getItemUrl(): ReturnType<FavoriteListItemState["getItemUrl"]> {
  if (isProduct()) {
    return props.configuration?.urls?.getProductUrl?.(props.item) || "";
  }
  return props.configuration?.urls?.getClusterUrl?.(props.item) || "";
}
function getItemId(): ReturnType<FavoriteListItemState["getItemId"]> {
  if (isProduct()) {
    return String(getProduct()?.productId || "");
  }
  return String(getCluster()?.clusterId || "");
}
function getItemPrice(): ReturnType<FavoriteListItemState["getItemPrice"]> {
  const useTax: boolean =
    props.includeTax !== undefined ? !!props.includeTax : false;
  let priceObj: any = null;
  if (isProduct()) {
    priceObj = getProduct()?.price;
  } else {
    priceObj = getCluster()?.defaultProduct?.price;
  }
  if (!priceObj) return "";
  const value: number | undefined = useTax ? priceObj?.net : priceObj?.gross;
  if (!value && value !== 0) return "";
  return _formatPrice(Number(value), { symbol: "€" });
}
function getLabel(
  key: string,
  fallback: string,
): ReturnType<FavoriteListItemState["getLabel"]> {
  return _getLabel(props.labels, key, fallback);
}
function handleItemClick(
  e: any,
): ReturnType<FavoriteListItemState["handleItemClick"]> {
  if (props.onItemClick) {
    e.preventDefault();
    props.onItemClick(props.item);
  } else if (getItemUrl()) {
    e.preventDefault();
    window.location.href = getItemUrl();
  }
}
function handleDelete(): ReturnType<FavoriteListItemState["handleDelete"]> {
  if (props.onDelete) {
    props.onDelete(getItemId());
  }
}
</script>
