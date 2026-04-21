<template>
  <template v-if="!(isCrossUpsellMode() && !isLoading && items().length === 0)">
    <div :class="containerClassName || 'mb-12'">
      <template v-if="sliderTitle() || items().length > 0">
        <div class="flex items-center justify-between mb-6">
          <template v-if="sliderTitle()">
            <h2 class="text-2xl font-bold">{{ sliderTitle() }}</h2>
          </template>

          <template v-if="items().length > desktopCount()">
            <div class="flex gap-2">
              <button
                class="p-2 rounded-full bg-white shadow hover:bg-gray-50 transition disabled:opacity-30 disabled:cursor-not-allowed"
                @click="() => { if (sliderRef) sliderScrollLeft(sliderRef as HTMLElement) }"
                :disabled="!canScrollLeft"
                :aria-label="getLabel('scrollLeft', 'Scroll left')"
              >
                <svg
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  class="w-5 h-5"
                >
                  <path d="M15 19l-7-7 7-7"></path>
                </svg></button
              ><button
                class="p-2 rounded-full bg-white shadow hover:bg-gray-50 transition disabled:opacity-30 disabled:cursor-not-allowed"
                @click="() => { if (sliderRef) sliderScrollRight(sliderRef as HTMLElement) }"
                :disabled="!canScrollRight"
                :aria-label="getLabel('scrollRight', 'Scroll right')"
              >
                <svg
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  class="w-5 h-5"
                >
                  <path d="M9 5l7 7-7 7"></path>
                </svg>
              </button>
            </div>
          </template>
        </div>
      </template>

      <template v-if="isLoading">
        <div class="flex gap-6 overflow-hidden">
          <div class="flex-shrink-0 w-72 h-80 bg-gray-100 rounded-lg animate-pulse"></div>
          <div class="flex-shrink-0 w-72 h-80 bg-gray-100 rounded-lg animate-pulse"></div>
          <div class="flex-shrink-0 w-72 h-80 bg-gray-100 rounded-lg animate-pulse"></div>
          <div class="flex-shrink-0 w-72 h-80 bg-gray-100 rounded-lg animate-pulse"></div>
        </div>
      </template>

      <template v-if="!isLoading && items().length > 0">
        <div
          ref="sliderRef"
          class="flex gap-6 overflow-x-auto scroll-smooth pb-4"
          @scroll="(e) => sliderOnScroll(e.target as HTMLElement)"
          :style="{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }"
        >
          <template :key="getItemId(item) + '-' + index" v-for="(item, index) in items()">
            <div
              class="flex-shrink-0 w-[calc((100%_-_1.5rem)_/_1.5)] md:w-[calc((100%_-_3rem)_/_2.5)] lg:w-[calc((100%_-_4.5rem)_/_4)]"
            >
              <template v-if="isCluster(item)">
                <ClusterCard
                  :cluster="item as Cluster "
                  :configuration="configuration"
                  :includeTax="includeTax"
                  :language="language"
                  :columns="3"
                  :enableAddFavorite="enableAddFavorite"
                  :showStock="showStock"
                  :showAvailability="showAvailability"
                  :stockLabels="stockLabels"
                  :labels="labels"
                  :onToggleFavorite="
                    (cluster, isFav) => {
                      if (onToggleFavorite) {
                        onToggleFavorite(cluster, isFav);
                      }
                    }
                  "
                  :onClusterClick="(cluster) => handleClusterClick(cluster)"
                ></ClusterCard>
              </template>

              <template v-if="!isCluster(item)">
                <ProductCard
                  :product="item as Product"
                  :graphqlClient="graphqlClient"
                  :user="user || null"
                  :companyId="companyId"
                  :cartId="cartId"
                  :configuration="configuration"
                  :includeTax="includeTax"
                  :columns="3"
                  :allowAddToCart="portalMode() === 'open'"
                  :createCart="createCart"
                  :onCartCreated="onCartCreated"
                  :afterAddToCart="afterAddToCart"
                  :showModal="showModal"
                  :allowIncrDecr="showIncrDecr !== false"
                  :enableStockValidation="stockValidation"
                  :language="language"
                  :onProceedToCheckout="onProceedToCheckout"
                  :onRequestQuoteClick="onRequestQuoteClick"
                  :addToCartLabels="addToCartLabels"
                  :enableAddFavorite="enableAddFavorite"
                  :showStock="showStock"
                  :showAvailability="showAvailability"
                  :stockLabels="stockLabels"
                  :labels="labels"
                  :onToggleFavorite="(product, isFav) => { if (onToggleFavorite) onToggleFavorite(product, isFav); }"
                  :onProductClick="(product) => handleProductClick(product)"
                ></ProductCard>
              </template>
            </div>
          </template>
        </div>
      </template>

      <template v-if="!isLoading && items().length === 0 && !products && !isCrossUpsellMode()">
        <div class="text-center text-gray-500 py-8">
          {{ getLabel('noProducts', 'No products found') }}
        </div>
      </template>
    </div>
  </template>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import {
  GraphQLClient,
  Product,
  Cluster,
  Contact,
  Customer,
  Cart,
  CartMainItem,
  Enums,
} from 'propeller-sdk-v2';
import ProductCard from './ProductCard.vue';
import ClusterCard from './ClusterCard.vue';
import { useProductSlider } from '../../composables/useProductSlider';
import { getLabel as _getLabel } from '../../shared/utils/labelHelpers';

export interface ProductSliderProps {
  // === Data source ===

  /** Propeller SDK GraphQL client */
  graphqlClient: GraphQLClient;

  /** Pre-loaded products or clusters to display. When provided, skips internal fetching. */
  products?: (Product | Cluster)[];

  /** Product IDs to fetch internally when `products` is not provided */
  productIds?: number[];

  /** Cluster IDs to fetch internally when `products` is not provided */
  clusterIds?: number[];

  /**
   * Cross-upsell types to fetch. When provided, fetches cross-upsells for the given
   * productId/clusterId instead of fetching products by IDs.
   * Values: 'ACCESSORIES' | 'ALTERNATIVES' | 'RELATED' | 'OPTIONS' | 'PARTS'
   */
  crossUpsellTypes?: Enums.CrossupsellType[];

  /** Source product ID for cross-upsell lookup. Required when crossUpsellTypes is set. */
  productId?: number;

  /** Source cluster ID for cross-upsell lookup. Required when crossUpsellTypes is set. */
  clusterId?: number;

  // === Locale / pricing ===

  /** Language code for API requests and localized content */
  language: string;

  /** Tax zone for price calculations */
  taxZone?: string;

  /**
   * When true, net price (incl. tax) is the leading price.
   * Forwarded to each ProductCard / ClusterCard.
   */
  includeTax?: boolean;

  // === Portal / visibility ===

  /**
   * Controls portal visibility mode.
   * 'open' — AddToCart is shown on product cards.
   * 'semi-closed' — AddToCart is hidden (catalog-only view).
   * Defaults to 'open'.
   */
  portalMode?: string;

  /** Authenticated user for cart operations */
  user?: Contact | Customer | null;

  /**
   * Active company ID from the company switcher.
   * Overrides the user's default company for price calculation in cross-upsell fetches
   * and is forwarded to each embedded ProductCard / AddToCart.
   * Triggers a re-fetch when changed.
   */
  companyId?: number;

  /* === Layout === */

  /** Items visible per breakpoint */
  itemsPerView?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };

  /** Slider title displayed above the track */
  title?: string;

  /** Additional CSS class for the outer container */
  containerClassName?: string;

  /* === Card stock display === */

  /**
   * Show the stock / availability widget on each product card.
   * Forwarded to `ProductCard.showStock`.
   * Defaults to false.
   */
  showStock?: boolean;

  /**
   * Show only the availability indicator (Available / Not available) inside the stock widget.
   * Forwarded to `ProductCard.showAvailability`.
   * Defaults to true.
   */
  showAvailability?: boolean;

  /**
   * Label overrides forwarded to the embedded ItemStock component inside each card.
   * Keys: inStock, outOfStock, lowStock, available, notAvailable, pieces
   */
  stockLabels?: Record<string, string>;

  /* === Card favourites === */

  /** Show a heart-icon favourite toggle on each card. Defaults to false. */
  enableAddFavorite?: boolean;

  /**
   * Called when a favourite is toggled on any card.
   * Receives the full Product or Cluster object and the new favourite state.
   */
  onToggleFavorite?: (item: Product | Cluster, isFavorite: boolean) => void;

  /* === Card navigation === */

  /** Called when a product card is clicked — use for SPA-style routing. */
  onProductClick?: (product: Product) => void;

  /** Called when a cluster card is clicked — use for SPA-style routing. */
  onClusterClick?: (cluster: Cluster) => void;

  /* === AddToCart pass-through === */

  /** Validate stock before adding to cart. Defaults to false. */
  stockValidation?: boolean;

  /** Show increment/decrement stepper buttons in AddToCart. Defaults to true. */
  showIncrDecr?: boolean;

  /** ID of an existing cart to add items to. */
  cartId?: string;

  /** Auto-create a cart when none is available. Pair with onCartCreated. */
  createCart?: boolean;

  /** Called after AddToCart creates a new cart internally. */
  onCartCreated?: (cart: Cart) => void;

  /** Called after every successful add-to-cart. Receives the updated cart and the added item. */
  afterAddToCart?: (cart: Cart, item?: CartMainItem) => void;

  /**
   * When true, AddToCart shows a success modal instead of a toast.
   * Defaults to false.
   */
  showModal?: boolean;

  /** Called when "Proceed to checkout" is clicked in the AddToCart modal. */
  onProceedToCheckout?: () => void;

  /** Called when "Request a Quote" is clicked in the AddToCart modal. */
  onRequestQuoteClick?: (cart: Cart) => void;

  /**
   * Label overrides forwarded to the embedded AddToCart component.
   * Keys: add, adding, addedToCart, outOfStock, noCartId, errorAdding,
   *       modalTitle, quantity, continueShopping, proceedToCheckout
   */
  addToCartLabels?: Record<string, string>;

  /* === Misc === */

  /** Configuration object providing imageSearchFiltersGrid, imageVariantFiltersMedium, urls */
  configuration?: any;

  /**
   * Label overrides for the slider UI.
   * Available keys: scrollLeft, scrollRight, noProducts, viewCluster,
   *                 ACCESSORIES, ALTERNATIVES, RELATED, OPTIONS, PARTS
   */
  labels?: Record<string, string>;
}

const props = withDefaults(defineProps<ProductSliderProps>(), {
  showAvailability: true,
  showIncrDecr: true,
  showStock: false,
  enableAddFavorite: false,
});

const langRef = computed(() => props.language || 'NL');
const sliderRef = ref<HTMLElement | null>(null);

const {
  products: fetchedItems,
  loading: isLoading,
  canScrollLeft,
  canScrollRight,
  fetchCrossupsells,
  fetchProducts,
  scrollLeft: sliderScrollLeft,
  scrollRight: sliderScrollRight,
  onScroll: sliderOnScroll,
} = useProductSlider({
  graphqlClient: props.graphqlClient,
  language: langRef,
  configuration: props.configuration,
});

onMounted(() => {
  if (props.products && props.products.length > 0) return;
  if (isCrossUpsellMode()) {
    fetchCrossupsells({
      productId: props.productId,
      clusterId: props.clusterId,
      types: props.crossUpsellTypes,
    });
  } else {
    fetchProducts(props.productIds || [], props.clusterIds || []);
  }
});

watch(
  () => [
    JSON.stringify(props.productIds),
    JSON.stringify(props.clusterIds),
    JSON.stringify(props.crossUpsellTypes),
    props.productId,
    props.clusterId,
    props.language,
    props.companyId,
  ],
  () => {
    if (props.products && props.products.length > 0) return;
    if (isCrossUpsellMode()) {
      fetchCrossupsells({
        productId: props.productId,
        clusterId: props.clusterId,
        types: props.crossUpsellTypes,
      });
    } else {
      fetchProducts(props.productIds || [], props.clusterIds || []);
    }
  }
);

function items(): (Product | Cluster)[] {
  if (props.products && props.products.length > 0) {
    return props.products;
  }
  return fetchedItems.value;
}
function isCrossUpsellMode(): boolean {
  return !!(props.crossUpsellTypes && props.crossUpsellTypes.length > 0);
}
function crossUpsellTitle(): string {
  if (!props.crossUpsellTypes || props.crossUpsellTypes.length === 0) return '';
  const typeLabels: Record<string, string> = {
    ACCESSORIES: 'Accessories',
    ALTERNATIVES: 'Alternatives',
    RELATED: 'Related products',
    OPTIONS: 'Options',
    PARTS: 'Parts',
  };
  return props.crossUpsellTypes
    .map((t: string) => props.labels?.[t.toLowerCase()] || typeLabels[t] || t)
    .join(' & ');
}
function sliderTitle(): string | undefined {
  if (props.title !== undefined) return props.title;
  if (isCrossUpsellMode()) return crossUpsellTitle();
  return undefined;
}
function desktopCount(): number {
  return props.itemsPerView?.desktop || 4;
}
function portalMode(): string {
  return (props.portalMode as string) || 'open';
}
function getLabel(key: string, fallback: string): string {
  return _getLabel(props.labels, key, fallback);
}
function isCluster(item: any): boolean {
  return 'clusterId' in item && !('productId' in item);
}
function getItemId(item: any): number {
  return isCluster(item) ? item.clusterId : item.productId;
}
function handleProductClick(product: Product): void {
  if (props.onProductClick) {
    props.onProductClick(product);
  }
}
function handleClusterClick(cluster: Cluster): void {
  if (props.onClusterClick) {
    props.onClusterClick(cluster);
  }
}
</script>
