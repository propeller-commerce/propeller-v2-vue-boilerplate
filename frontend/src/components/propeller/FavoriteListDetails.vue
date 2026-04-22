<template>
  <div :class="className || ''">
    <template v-if="loading">
      <div class="space-y-4">
        <template :key="i" v-for="(i, index) in [1, 2, 3]">
          <div class="flex items-center gap-4 p-4 border-b border-gray-200 animate-pulse">
            <div class="w-20 h-20 bg-gray-100 rounded-md flex-shrink-0"></div>
            <div class="flex-1 space-y-2">
              <div class="h-4 w-1/4 bg-gray-100 rounded"></div>
              <div class="h-5 w-1/2 bg-gray-100 rounded"></div>
              <div class="h-4 w-1/6 bg-gray-100 rounded"></div>
            </div>
            <div class="h-10 w-28 bg-gray-100 rounded"></div>
          </div>
        </template>
      </div>
    </template>

    <template v-if="!loading && isMounted">
      <template v-if="allItems.length > 0">
        <div class="space-y-3">
          <template
            :key="'productId' in item ? 'p-' + item.productId : 'c-' + item.clusterId"
            v-for="(item, idx) in getPagedItems()"
          >
            <div>
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
          </template>
          <template v-if="showPagination !== false && getTotalPages() > 1">
            <div class="mt-6">
              <GridPagination
                :products="getPaginationData()"
                :onPageChange="(page) => handlePageChange(page)"
                :variant="paginationVariant || 'compact'"
              ></GridPagination>
            </div>
          </template>
        </div>
      </template>

      <template v-if="allItems.length === 0">
        <div class="border border-gray-200 rounded-lg p-12 text-center space-y-4">
          <div
            class="bg-gray-100 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto"
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
              class="text-gray-400"
            >
              <path
                d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
              ></path>
            </svg>
          </div>
          <div>
            <p class="text-lg font-medium">
              {{ getLabel('emptyTitle', 'List is empty') }}
            </p>
            <p class="text-gray-500">
              {{
                getLabel(
                  'emptyDescription',
                  "You haven't added any products or clusters to this list yet."
                )
              }}
            </p>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

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
} from 'propeller-sdk-v2';
import FavoriteListItem from './FavoriteListItem.vue';
import GridPagination from './GridPagination.vue';
import { getLabel as _getLabel } from '../../composables/shared/utils/labelHelpers';

export interface FavoriteListDetailsProps {
  /** GraphQL client for the Propeller SDK */
  graphqlClient: GraphQLClient;

  /** The logged in user for which the favorite list is going to be displayed */
  user: Contact | Customer;

  /** The favorite list ID to display */
  favoriteListId: string;

  /** Action method for deleting a favorite list item. If not provided, delete button is hidden */
  onItemDelete?: (itemId: string, itemType?: string) => void;

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
    showModal?: boolean
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
const loading = ref<FavoriteListDetailsState['loading']>(true);
const favoriteList = ref<FavoriteListDetailsState['favoriteList']>(null);
const allItems = ref<FavoriteListDetailsState['allItems']>([]);
const currentPage = ref<FavoriteListDetailsState['currentPage']>(1);
const isMounted = ref<FavoriteListDetailsState['isMounted']>(false);
const prevListId = ref<FavoriteListDetailsState['prevListId']>('');

onMounted(() => {
  isMounted.value = true;
  prevListId.value = props.favoriteListId || '';
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
  { immediate: true }
);
function getLabel(key: string, fallback: string): ReturnType<FavoriteListDetailsState['getLabel']> {
  return _getLabel(props.labels, key, fallback);
}
function getItemsPerPage(): ReturnType<FavoriteListDetailsState['getItemsPerPage']> {
  return props.itemsPerPage || 12;
}
function getTotalPages(): ReturnType<FavoriteListDetailsState['getTotalPages']> {
  return Math.max(1, Math.ceil(allItems.value.length / getItemsPerPage()));
}
function getPagedItems(): ReturnType<FavoriteListDetailsState['getPagedItems']> {
  const perPage = getItemsPerPage();
  const start = (currentPage.value - 1) * perPage;
  return allItems.value.slice(start, start + perPage);
}
function getPaginationData(): ReturnType<FavoriteListDetailsState['getPaginationData']> {
  return {
    page: currentPage.value,
    pages: getTotalPages(),
    itemsFound: allItems.value.length,
    offset: getItemsPerPage(),
  };
}
function handlePageChange(page: number): ReturnType<FavoriteListDetailsState['handlePageChange']> {
  currentPage.value = page;
}
function buildFetchVariables(): ReturnType<FavoriteListDetailsState['buildFetchVariables']> {
  const priceInput: Record<string, unknown> = {
    taxZone: 'NL',
  };
  if (props.user) {
    if ('customerId' in props.user) {
      const customer = props.user as Customer;
      if (customer.customerId) {
        priceInput.customerId = customer.customerId;
      }
    } else if ('contactId' in props.user) {
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
    language: props.language || 'NL',
    priceCalculateProductInput: priceInput,
    imageSearchFilters: {
      page: 1,
      offset: 1,
    },
    imageVariantFilters: {
      transformations: [
        {
          name: 'cart_thumb',
          transformation: {
            format: 'WEBP',
            height: 200,
            width: 200,
            fit: 'BOUNDS',
          },
        },
      ],
    },
  };
}
async function fetchList(): ReturnType<FavoriteListDetailsState['fetchList']> {
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
      (productsRef.items as Product[]).forEach((item: Product) => items.push(item));
    }
    const clustersRef = list?.clusters as ProductsResponse;
    if (clustersRef?.items && Array.isArray(clustersRef.items)) {
      (clustersRef.items as Cluster[]).forEach((item: Cluster) => items.push(item));
    }
    allItems.value = items;
    currentPage.value = 1;
  } catch (error) {
    console.error('Error fetching favorite list:', error);
    favoriteList.value = null;
    allItems.value = [];
  } finally {
    loading.value = false;
  }
}
function handleItemDelete(
  itemId: string
): ReturnType<FavoriteListDetailsState['handleItemDelete']> {
  /* Determine item type before removing from local state */
  const deletedItem = allItems.value.find((item: Product | Cluster) => {
    if ('productId' in item) return String(item.productId) === itemId;
    return String((item as Cluster).clusterId) === itemId;
  });
  const itemType: string = deletedItem && 'clusterId' in deletedItem ? 'cluster' : 'product';
  /* Optimistic: remove from local state */
  allItems.value = allItems.value.filter((item: Product | Cluster) => {
    if ('productId' in item) return String(item.productId) !== itemId;
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
