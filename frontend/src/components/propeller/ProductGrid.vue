<template>
  <div
    :class="`propeller-product-grid w-full ${className || ''}`"
    :data-loading="getIsLoading() ? 'true' : 'false'"
  >
    <template v-if="getIsLoading()">
      <div
        :class="`propeller-product-grid__skeleton-grid ${getGridColsClass()}`"
      >
        <template :key="idx" v-for="(_, idx) in getSkeletonItems()">
          <div
            class="propeller-product-grid__skeleton-card flex flex-col overflow-hidden rounded-[var(--radius-container)] border border-border bg-card shadow-sm"
          >
            <div
              class="propeller-product-grid__skeleton-image aspect-square bg-surface-hover animate-pulse"
            ></div>
            <div class="p-4 flex flex-col gap-2 flex-1">
              <div
                class="propeller-product-grid__skeleton-line h-3 bg-surface-hover animate-pulse rounded w-1/4"
              ></div>
              <div
                class="propeller-product-grid__skeleton-line h-4 bg-surface-hover animate-pulse rounded w-3/4"
              ></div>
              <div
                class="propeller-product-grid__skeleton-line h-4 bg-surface-hover animate-pulse rounded w-1/2"
              ></div>
              <div class="mt-auto pt-2">
                <div
                  class="propeller-product-grid__skeleton-line h-5 bg-surface-hover animate-pulse rounded w-1/3"
                ></div>
              </div>
            </div>
            <template v-if="showAddToCart()">
              <div class="p-4 pt-0">
                <div class="flex items-center gap-2">
                  <div
                    class="propeller-product-grid__skeleton-line h-9 flex-1 bg-surface-hover animate-pulse rounded"
                  ></div>
                  <div
                    class="propeller-product-grid__skeleton-line h-9 flex-1 bg-surface-hover animate-pulse rounded"
                  ></div>
                </div>
              </div>
            </template>
          </div>
        </template>
      </div>
    </template>

    <template v-if="!getIsLoading()">
      <template v-if="getDisplayProducts().length === 0">
        <div
          class="propeller-product-grid__empty text-center py-24 bg-surface-hover rounded-xl border border-dashed border-border"
        >
          <svg
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            class="propeller-product-grid__empty-icon mx-auto h-12 w-12 text-foreground-subtle"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              :strokeWidth="1"
            ></path>
          </svg>
          <h3
            class="propeller-product-grid__empty-title mt-4 text-lg font-semibold text-foreground"
          >
            No products found
          </h3>
          <p
            class="propeller-product-grid__empty-message mt-1 text-sm text-muted-foreground"
          >
            Try adjusting your filters or search term.
          </p>
        </div>
      </template>

      <template v-if="getDisplayProducts().length > 0">
        <div :class="`propeller-product-grid__grid ${getGridColsClass()}`">
          <template
            :key="item.productId || item.clusterId || idx"
            v-for="(item, idx) in getDisplayProducts()"
          >
            <div>
              <template v-if="isClusterItem(item)">
                <template v-if="!renderClusterCard">
                  <ClusterCard
                    :columns="props.columns || 3"
                    :cluster="item"
                    :configuration="props.configuration"
                    :includeTax="props.includeTax"
                    :showPrice="props.showPrice"
                    :language="props.language || 'NL'"
                    :showStock="props.showStock"
                    :showAvailability="props.showAvailability"
                    :stockLabels="props.stockLabels"
                    :enableAddFavorite="props.enableAddFavorite"
                    :onToggleFavorite="
                      (cluster, isFav) => {
                        if (props.onToggleFavorite) {
                          props.onToggleFavorite(cluster, isFav);
                        }
                      }
                    "
                    :onClusterClick="
                      (cluster) => {
                        if (props.onClusterClick) {
                          props.onClusterClick(cluster);
                        }
                      }
                    "
                  ></ClusterCard>
                </template>
              </template>

              <template v-if="!isClusterItem(item)">
                <template v-if="!renderProductCard">
                  <ProductCard
                    :columns="props.columns || 3"
                    :product="item"
                    :showPrice="props.showPrice"
                    :allowAddToCart="
                      showAddToCart() ? props.allowAddToCart : false
                    "
                    :graphqlClient="props.graphqlClient"
                    :user="props.user || null"
                    :configuration="props.configuration"
                    :includeTax="props.includeTax"
                    :cartId="props.cartId"
                    :createCart="props.createCart"
                    :onCartCreated="props.onCartCreated"
                    :afterAddToCart="props.afterAddToCart"
                    :showModal="props.showModal"
                    :allowIncrDecr="props.allowIncrDecr"
                    :enableStockValidation="props.stockValidation"
                    :language="props.language || 'NL'"
                    :onProceedToCheckout="props.onProceedToCheckout"
                    :onRequestQuoteClick="props.onRequestQuoteClick"
                    :addToCartLabels="props.addToCartLabels"
                    :enableAddFavorite="props.enableAddFavorite"
                    :showStock="props.showStock"
                    :showAvailability="props.showAvailability"
                    :stockLabels="props.stockLabels"
                    :companyId="props.companyId"
                    :onToggleFavorite="
                      (product, isFav) => {
                        if (props.onToggleFavorite)
                          props.onToggleFavorite(product, isFav);
                      }
                    "
                    :onProductClick="
                      (product) => {
                        if (props.onProductClick) props.onProductClick(product);
                      }
                    "
                  />
                </template>
              </template>
            </div>
          </template>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from "vue";

import {
  GraphQLClient,
  Product,
  Cluster,
  Cart,
  CartMainItem,
  AttributeFilter,
  ProductTextFilterInput,
  ProductsResponse,
  Category,
} from "propeller-sdk-v2";
import ProductCard from "./ProductCard.vue";
import ClusterCard from "./ClusterCard.vue";
import { useProductSearch } from "../../composables/useProductSearch";

export interface ProductGridProps {
  // ── Data source ──────────────────────────────────────────────────────────

  /**
   * Initialised Propeller SDK GraphQL client.
   * Required when `products` is not provided — used for internal data fetching.
   */
  graphqlClient?: GraphQLClient;

  /**
   * Pre-fetched products/clusters to display.
   * When provided the component skips internal API calls entirely.
   * Pass an empty array (not undefined) to show the empty state while the
   * parent controls loading.
   */
  products?: (Product | Cluster)[];

  // ── Locale / pricing ─────────────────────────────────────────────────────

  /** Language code for product data. Defaults to 'NL'. */
  language?: string;

  /** Tax zone used for price calculation. Defaults to 'NL'. */
  taxZone?: string;

  // ── Query mode (only used when graphqlClient is provided) ─────────────────

  /**
   * Category ID to list products for (category-page mode).
   * When omitted alongside `term` and `brand`, `config.baseCategoryId` is used.
   */
  categoryId?: number;

  /**
   * Search term — passes `term` into categoryProductSearchInput and uses
   * `config.baseCategoryId` so the whole catalog is searched.
   */
  term?: string;

  /**
   * Manufacturer/brand name — passes `manufacturers: [brand]` into
   * categoryProductSearchInput and uses `config.baseCategoryId`.
   */
  brand?: string;

  // ── Layout ────────────────────────────────────────────────────────────────

  /** Number of columns in the grid. Accepts 2, 3, 4, 5, or 6. Defaults to 3. */
  columns?: number;

  // ── Loading ───────────────────────────────────────────────────────────────

  /**
   * Show a skeleton loader.
   * Useful when the parent controls loading state and passes `products` down.
   * The grid automatically shows a skeleton during internal fetches regardless
   * of this prop. Defaults to false.
   */
  isLoading?: boolean;

  // ── Custom card renderers (render-prop / slot) ────────────────────────────

  /**
   * Provide a custom product card renderer.
   * Falls back to the built-in `<ProductCard>` when not set.
   */
  renderProductCard?: (product: Product) => any;

  /**
   * Provide a custom cluster card renderer.
   * Falls back to the built-in `<ClusterCard>` when not set.
   */
  renderClusterCard?: (cluster: Cluster) => any;

  // ── Portal / visibility ───────────────────────────────────────────────────

  /**
   * Controls portal visibility mode.
   * 'open'        — full e-commerce; AddToCart is visible in product cards.
   * 'semi-closed' — catalog-only; AddToCart is hidden.
   * Defaults to 'open'.
   */
  portalMode?: string;

  /** Authenticated user passed through to ProductCard / AddToCart. */
  user?: Contact | Customer | null;

  /** Active company ID from the company switcher. Overrides user's default company for price calculation. Triggers a re-fetch when changed. */
  companyId?: number;

  /**
   * When true, tax-inclusive (gross) price is the leading price.
   * Defaults to false.
   */
  includeTax?: boolean;

  /**
   * Enables stock validation inside AddToCart.
   * Blocks add when requested quantity exceeds available stock.
   * Defaults to false.
   */
  stockValidation?: boolean;

  /**
   * When false, hides the AddToCart control in product cards.
   * ClusterCards always show their "View cluster" navigation button.
   * Defaults to true.
   */
  allowAddToCart?: boolean;

  /* ── External hooks ───────────────────────────────────────────────────────── */

  /**
   * Called after each internal data fetch with the filterable attributes
   * returned by the API (for driving a sibling FiltersSidebar).
   */
  onFiltersChange?: (filters: AttributeFilter[]) => void;

  /**
   * Active text filters to apply — built by the parent from FiltersSidebar
   * `onFilterChange` callbacks.  Each entry maps to a `textFilters` input
   * row in the CategoryService query.
   * When this prop changes the grid automatically re-fetches (page resets to 1).
   */
  textFilters?: ProductTextFilterInput[];

  /**
   * Active price range lower bound from the FiltersSidebar `onPriceChange`.
   * Triggers a re-fetch when changed.
   */
  priceFilterMin?: number;

  /**
   * Active price range upper bound from the FiltersSidebar `onPriceChange`.
   * Triggers a re-fetch when changed.
   */
  priceFilterMax?: number;

  /**
   * Called when sort state changes internally (for syncing a sibling toolbar).
   */
  onSortChange?: (sort: any) => void;

  /**
   * Called after each internal data fetch with the min/max price of the
   * current product set — use to populate a price range slider in the parent.
   */
  onPriceBoundsChange?: (min: number, max: number) => void;

  /**
   * Called after each fetch with the total number of products found —
   * use to display a result count in the parent toolbar.
   */
  onItemsFoundChange?: (count: number) => void;

  /**
   * Called after each fetch with the number of items visible on the current page
   * (after client-side language filtering).
   */
  onPageItemCountChange?: (count: number) => void;

  /**
   * Called when the user clicks Previous / Next in the built-in pagination —
   * use to keep the parent URL / page state in sync.
   */
  onPageChange?: (page: number) => void;

  /**
   * Called after each successful internal data fetch with the full
   * ProductsResponse object — use to drive an external GridPagination
   * component by passing the result as its `products` prop.
   */
  onProductsResponse?: (products: ProductsResponse) => void;

  /**
   * Called after each successful internal data fetch with the full
   * Category object — use to populate sibling components like GridTitle,
   * CategoryDescription, and CategoryShortDescription.
   */
  onCategoryChange?: (category: Category) => void;

  /**
   * Called whenever the internal loading state changes.
   * Use to disable sibling components (e.g. GridFilters) while a fetch is in flight.
   */
  onLoadingChange?: (isLoading: boolean) => void;

  /**
   * Externally controlled current page.
   * When provided, the grid uses this value instead of its internal page
   * counter. Wire this to the `onPageChange` callback from a sibling
   * GridPagination so the two components stay in sync.
   * When changed the grid automatically re-fetches.
   */
  page?: number;

  /**
   * Number of products per page. Defaults to 12.
   * When changed the grid automatically re-fetches (page resets to 1).
   */
  pageSize?: number;

  /**
   * Sort field to use (e.g. 'NAME', 'PRICE').
   * When provided overrides internal sort state.
   * When changed the grid automatically re-fetches (page resets to 1).
   */
  sortField?: string;

  /**
   * Sort direction: 'ASC' or 'DESC'.
   * Only used when sortField is also provided.
   * When changed the grid automatically re-fetches (page resets to 1).
   */
  sortOrder?: string;

  /* ── Configuration ──────────────────────────────────────────────────────── */

  /**
   * Configuration object providing:
   *   imageSearchFiltersGrid, imageVariantFiltersMedium — passed to CategoryService
   *   baseCategoryId — used when querying by term or brand
   *   urls.getProductUrl / urls.getClusterUrl — for card URL generation
   */
  configuration?: any;

  /* ── ProductCard / AddToCart pass-through props ─────────────────────────── */

  /** ID of an existing cart to add items into. */
  cartId?: string;

  /**
   * Auto-create a cart when none is available.
   * Always pair with `onCartCreated` to persist the new cart ID.
   */
  createCart?: boolean;

  /** Called after AddToCart creates a new cart internally. */
  onCartCreated?: (cart: Cart) => void;

  /** Called after every successful add-to-cart operation. */
  afterAddToCart?: (cart: Cart, item?: CartMainItem) => void;

  /**
   * When true, AddToCart shows a success modal instead of a toast.
   * Defaults to false.
   */
  showModal?: boolean;

  /**
   * Render − / + stepper buttons in AddToCart.
   * Defaults to true.
   */
  allowIncrDecr?: boolean;

  /** Called when "Proceed to checkout" is clicked in the AddToCart modal. */
  onProceedToCheckout?: () => void;

  /** Called when "Request a Quote" is clicked in the AddToCart modal. */
  onRequestQuoteClick?: (cart: Cart) => void;

  /**
   * Label overrides forwarded directly to the embedded AddToCart component.
   * Keys: add, adding, addedToCart, outOfStock, noCartId, errorAdding,
   *       modalTitle, quantity, continueShopping, proceedToCheckout
   */
  addToCartLabels?: Record<string, string>;

  /* ── Stock display ───────────────────────────────────────────────────────── */

  /**
   * Show the stock / availability widget on each product card.
   * Forwarded directly to `ProductCard.showStock`.
   * Defaults to false.
   */
  showStock?: boolean;

  /**
   * Show only the availability indicator inside the stock widget.
   * Forwarded to `ProductCard.showAvailability`.
   * Defaults to true.
   */
  showAvailability?: boolean;

  /**
   * Show the price below the product name.
   * Defaults to true.
   */
  showPrice?: boolean;

  /**
   * Label overrides forwarded to the embedded ItemStock component inside each card.
   * Keys: inStock, outOfStock, lowStock, available, notAvailable, pieces
   */
  stockLabels?: Record<string, string>;

  /* ── Card interaction ────────────────────────────────────────────────────── */

  /** Show a heart-icon favourite toggle on each card. */
  enableAddFavorite?: boolean;

  /**
   * Called when a favourite is toggled on any card.
   * Receives the full Product or Cluster object and the new favourite state.
   */
  onToggleFavorite?: (item: Product | Cluster, isFavorite: boolean) => void;

  /**
   * Called when a cluster card name, image, or "View cluster" button is
   * clicked — use for SPA-style routing instead of full-page navigation.
   */
  onClusterClick?: (cluster: Cluster) => void;

  /**
   * Called when a product card name or image is clicked — use for SPA
   * routing instead of full-page navigation.
   */
  onProductClick?: (product: Product) => void;

  /** Extra CSS class applied to the root element. */
  className?: string;
}
interface ProductGridState {
  internalProducts: (Product | Cluster)[];
  isInternalLoading: boolean;
  currentPage: number;
  totalPages: number;
  itemsFound: number;
  currentSortField: string;
  currentSortOrder: string;
  fetchId: number;
  fetchProducts: () => Promise<void>;
  isClusterItem: (item: Product | Cluster) => boolean;
  getGridColsClass: () => string;
  handlePageChange: (page: number) => void;
  getDisplayProducts: () => (Product | Cluster)[];
  getIsLoading: () => boolean;
  showAddToCart: () => boolean;
  getSkeletonItems: () => number[];
}

const props = withDefaults(defineProps<ProductGridProps>(), {
  allowAddToCart: true,
  allowIncrDecr: true,
  showAvailability: true,
  showPrice: true,
  showStock: false,
  isLoading: false,
});

const categoryIdRef = computed(() => props.categoryId);
const termRef = computed(() => props.term);
const brandRef = computed(() => props.brand);
const langRef = computed(() => props.language || "NL");
const userRef = computed(() => props.user ?? null);
const companyRef = computed(() => props.companyId);
const textFiltersRef = computed(() => props.textFilters);
const priceMinRef = computed(() => props.priceFilterMin);
const priceMaxRef = computed(() => props.priceFilterMax);
const sortFieldRef = computed(() => props.sortField);
const sortOrderRef = computed(() => props.sortOrder);
const pageRef = computed(() => props.page);
const pageSizeRef = computed(() => props.pageSize ?? 12);
const productsRef = computed(() => props.products);

const {
  displayProducts,
  isLoading,
  itemsFound,
  currentSortField,
  currentSortOrder,
  currentPage,
  totalPages,
  fetchProducts,
  goToPage,
} = useProductSearch({
  graphqlClient: props.graphqlClient,
  products: productsRef,
  categoryId: categoryIdRef,
  term: termRef,
  brand: brandRef,
  language: langRef,
  taxZone: props.taxZone,
  user: userRef,
  companyId: companyRef,
  textFilters: textFiltersRef,
  priceFilterMin: priceMinRef,
  priceFilterMax: priceMaxRef,
  sortField: sortFieldRef,
  sortOrder: sortOrderRef,
  page: pageRef,
  pageSize: pageSizeRef,
  configuration: props.configuration,
  onFiltersChange: props.onFiltersChange,
  onPriceBoundsChange: props.onPriceBoundsChange,
  onItemsFoundChange: props.onItemsFoundChange,
  onPageChange: props.onPageChange,
  onProductsResponse: props.onProductsResponse,
  onCategoryChange: props.onCategoryChange,
});

// onLoadingChange is not a composable option — wire via watch:
watch(
  () => isLoading.value,
  (v) => props.onLoadingChange?.(v),
);

function isClusterItem(
  item: Product | Cluster,
): ReturnType<ProductGridState["isClusterItem"]> {
  return !!(item as any)?.clusterId;
}
function getGridColsClass(): ReturnType<ProductGridState["getGridColsClass"]> {
  const cols = (props.columns as number) || 3;
  if (cols === 1) return "flex flex-col gap-4";
  if (cols === 2) return "grid grid-cols-2 gap-3 sm:gap-6 auto-rows-fr";
  if (cols === 4)
    return "grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 auto-rows-fr";
  if (cols === 5)
    return "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-6 auto-rows-fr";
  if (cols === 6)
    return "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-6 auto-rows-fr";
  return "grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 auto-rows-fr";
}
function handlePageChange(
  page: number,
): ReturnType<ProductGridState["handlePageChange"]> {
  goToPage(page);
}
function getDisplayProducts(): ReturnType<
  ProductGridState["getDisplayProducts"]
> {
  return displayProducts.value;
}
function getIsLoading(): ReturnType<ProductGridState["getIsLoading"]> {
  return isLoading.value || (props.isLoading ?? false);
}
function showAddToCart(): ReturnType<ProductGridState["showAddToCart"]> {
  const mode = (props.portalMode as string) || "open";
  const allow = (props.allowAddToCart as boolean) !== false;
  return mode === "open" && allow;
}
function getSkeletonItems(): ReturnType<ProductGridState["getSkeletonItems"]> {
  const cols = (props.columns as number) || 3;
  const count =
    cols === 2 ? 4 : cols === 4 ? 8 : cols === 5 ? 10 : cols === 6 ? 12 : 6;
  const items: number[] = [];
  for (let i = 0; i < count; i++) items.push(i);
  return items;
}
</script>
