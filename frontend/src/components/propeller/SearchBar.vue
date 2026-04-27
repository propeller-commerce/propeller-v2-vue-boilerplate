<template>
  <div
    :data-search-bar="true"
    :class="`propeller-search-bar ${containerClassName || 'relative flex-1 max-w-2xl mx-8'}`"
    :data-open="showDropdown ? 'true' : 'false'"
  >
    <form class="propeller-search-bar__form" @submit="async (e) => handleSubmit(e)">
      <div class="propeller-search-bar__input-wrapper relative">
        <button
          type="submit"
          class="propeller-search-bar__submit absolute left-3 top-1/2 transform -translate-y-1/2 p-0 bg-transparent border-none cursor-pointer"
        >
          <svg
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            class="propeller-search-bar__submit-icon w-5 h-5 text-foreground-subtle hover:text-muted-foreground"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg></button
        ><input
          type="search"
          autoComplete="off"
          class="propeller-search-bar__input w-full pl-10 pr-10 py-2 bg-white/95 border border-white/20 rounded-[var(--radius-container)] focus:outline-none focus:ring-2 focus:ring-secondary placeholder:text-muted-foreground"
          :placeholder="placeholder"
          :value="searchTerm"
          @input="async (e) => handleInputChange((e.target as HTMLInputElement).value)"
        />
        <template v-if="isLoading">
          <div class="propeller-search-bar__spinner-wrapper absolute right-3 top-1/2 transform -translate-y-1/2">
            <div class="propeller-search-bar__spinner animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
          </div>
        </template>
      </div>
    </form>
    <template v-if="showDropdown">
      <div
        class="propeller-search-bar__dropdown absolute top-full left-0 right-0 mt-2 bg-card rounded-[var(--radius-container)] shadow-xl border max-h-96 overflow-y-auto z-50"
      >
        <template v-if="results.length > 0">
          <template :key="result.id + '-' + index" v-for="(result, index) in results">
            <div
              class="propeller-search-bar__result flex items-center gap-4 p-3 hover:bg-surface-hover cursor-pointer border-b border-border last:border-b-0"
              @click="async (event) => handleResultClick(result)"
            >
              <template v-if="result.imageUrl || noImageUrl">
                <div class="propeller-search-bar__result-media relative w-16 h-16 flex-shrink-0">
                  <img
                    class="propeller-search-bar__result-image w-full h-full object-contain"
                    :src="result.imageUrl || noImageUrl"
                    :alt="result.name"
                  />
                </div>
              </template>

              <div class="flex-1 min-w-0">
                <div class="propeller-search-bar__result-name font-semibold truncate">{{ result.name }}</div>
                <template v-if="result.sku">
                  <div class="propeller-search-bar__result-sku text-sm text-muted-foreground">SKU: {{ result.sku }}</div>
                </template>
              </div>
              <template v-if="result.price !== undefined && result.price !== null">
                <div class="propeller-search-bar__result-price text-sm font-semibold text-foreground flex-shrink-0">
                  {{ formatItemPrice(result.price) }}
                </div>
              </template>
            </div>
          </template>

          <template v-if="itemsFound > maxResults">
            <div
              class="propeller-search-bar__view-all p-3 text-center text-primary hover:bg-primary/5 cursor-pointer font-semibold"
              @click="async (event) => handleViewAllClick()"
            >
              {{ getLabel('viewAll', 'View all results') }} ({{ itemsFound }})
            </div>
          </template>
        </template>

        <template v-if="results.length === 0 && searchTerm.length >= minLength && !isLoading">
          <div class="propeller-search-bar__empty p-4 text-center text-muted-foreground">
            {{ getLabel('noResults', 'No products found for') }} &quot;{{ searchTerm }}&quot;
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

import {
  GraphQLClient,
  Product,
  Cluster,
  Contact,
  Customer,
} from 'propeller-sdk-v2';
import { useProductSearch } from '../../composables/useProductSearch';
import { getLabel as _getLabel } from '../../composables/shared/utils/labelHelpers';
import { formatPrice as _formatPrice } from '../../composables/shared/utils/formatting';
import { localizeHref as _localizeHref } from '@/lib/config';

export interface SearchBarResult {
  /** Unique identifier */
  id: number | string;
  /** Display name */
  name: string;
  /** SKU code */
  sku?: string;
  /** Price value */
  price?: number;
  /** Image URL */
  imageUrl?: string;
  /** URL path to navigate to */
  url?: string;
  /** Whether this is a cluster (vs product) */
  isCluster?: boolean;
}
export interface SearchBarProps {
  /** Propeller SDK GraphQL client */
  graphqlClient: GraphQLClient;

  /** The currently logged in user (Contact or Customer) */
  user?: Contact | Customer | null;

  /** Language code for search requests */
  language?: string;

  /** Placeholder text for the search input */
  placeholder?: string;

  /** Minimum characters before search triggers */
  minSearchLength?: number;

  /** Debounce delay in milliseconds */
  debounceMs?: number;

  /** Maximum number of results to show in dropdown */
  maxResults?: number;

  /** Fallback image URL when product has no image */
  noImageUrl?: string;

  /** Fires when the search form is submitted (Enter key). Receives the search term. */
  onSubmit?: (term: string) => void;

  /** Fires when a result item is clicked. Receives the result object. */
  onResultClick?: (result: SearchBarResult) => void;

  /** Fires when "View all results" is clicked. Receives the search term. */
  onViewAllClick?: (term: string) => void;

  /** Custom price formatting function */
  formatPrice?: (price: number) => string;

  /** Labels for the component */
  labels?: Record<string, string>;

  /** Additional class name for the container */
  containerClassName?: string;

  /** Tax zone used for price calculation. Defaults to 'NL'. */
  taxZone?: string;

  /**
   * Active company ID from the company switcher.
   * When provided, can be forwarded to price calculation in search results
   * if the underlying SDK call supports priceCalculateProductInput.
   */
  companyId?: number;

  /**
   * Configuration object providing:
   *   imageSearchFiltersGrid, imageVariantFiltersMedium — passed to CategoryService
   *   baseCategoryId — used when querying by term or brand
   *   urls.getProductUrl / urls.getClusterUrl — for card URL generation
   */
  configuration?: any;
}
interface SearchBarState {
  searchTerm: string;
  results: SearchBarResult[];
  isLoading: boolean;
  showDropdown: boolean;
  itemsFound: number;
  debounceTimer: any;
  clickOutsideListener: {
    fn: ((e: MouseEvent) => void) | null;
  };
  placeholder: string;
  minLength: number;
  debounceMs: number;
  maxResults: number;
  noImageUrl: string;
  getLabel: (key: string, fallback: string) => string;
  formatItemPrice: (price: number) => string;
  mapProductToResult: (item: Product | Cluster) => SearchBarResult;
  handleInputChange: (value: string) => void;
  fetchResults: (term: string) => Promise<void>;
  handleSubmit: (e: any) => void;
  handleResultClick: (result: SearchBarResult) => void;
  handleViewAllClick: () => void;
}

const props = defineProps<SearchBarProps>();

const companyRef = computed(() => props.companyId);

const { search, searchResults, searchLoading } = useProductSearch({
  graphqlClient: props.graphqlClient,
  language: computed(() => props.language || 'NL'),
  configuration: props.configuration || {},
  companyId: companyRef,
});

const searchTerm = ref<SearchBarState['searchTerm']>('');
const results = ref<SearchBarState['results']>([]);
const isLoading = searchLoading;
const showDropdown = ref<SearchBarState['showDropdown']>(false);
const itemsFound = ref<SearchBarState['itemsFound']>(0);
const clickOutsideListener = ref<SearchBarState['clickOutsideListener']>({
  fn: null as any,
});

onMounted(() => {
  const listener = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target && !target.closest('[data-search-bar]')) {
      showDropdown.value = false;
    }
  };
  clickOutsideListener.value = {
    fn: listener,
  };
  document.addEventListener('mousedown', listener);
});
onUnmounted(() => {
  if (clickOutsideListener.value.fn) {
    document.removeEventListener('mousedown', clickOutsideListener.value.fn);
  }
});
const placeholder = computed(() => {
  return props.placeholder || 'Search products...';
});
const minLength = computed(() => {
  return props.minSearchLength !== undefined ? props.minSearchLength : 3;
});
const maxResults = computed(() => {
  return props.maxResults !== undefined ? props.maxResults : 8;
});
const noImageUrl = computed(() => {
  return props.noImageUrl || '';
});

// Sync composable search results into local mapped results + dropdown state
watch(searchResults, (rawItems) => {
  const mapped: SearchBarResult[] = [];
  const limit = maxResults.value;
  for (let i = 0; i < rawItems.length && i < limit; i++) {
    mapped.push(mapProductToResult(rawItems[i] as Product | Cluster));
  }
  results.value = mapped;
  itemsFound.value = rawItems.length;
  showDropdown.value = mapped.length > 0 || searchTerm.value.length >= minLength.value;
});

function getLabel(key: string, fallback: string): ReturnType<SearchBarState['getLabel']> {
  return _getLabel(props.labels, key, fallback);
}
function formatItemPrice(price: number): ReturnType<SearchBarState['formatItemPrice']> {
  if (props.formatPrice) {
    return props.formatPrice(price);
  }
  return _formatPrice(price || 0, { symbol: '€' });
}
function mapProductToResult(
  item: Product | Cluster
): ReturnType<SearchBarState['mapProductToResult']> {
  const isCluster = 'clusterId' in item;
  const displayItem = isCluster ? (item as Cluster).defaultProduct : item;
  const id = isCluster ? (item as Cluster).clusterId : (item as Product).productId;
  const slug = item.slugs?.[0]?.value || '';
  // Build a language-prefixed URL so /en/... navigation stays in EN when the
  // user clicks a search result. localizeHref no-ops for the default language.
  const basePath = isCluster ? '/cluster/' + id + '/' + slug : '/product/' + id + '/' + slug;
  const url = _localizeHref(basePath, props.language);
  return {
    id: id,
    name: item.names?.[0]?.value || 'Product',
    sku: item.sku || displayItem?.sku || '',
    price: displayItem?.price?.gross || 0,
    imageUrl: displayItem?.media?.images?.items?.[0]?.imageVariants?.[0]?.url || '',
    url: url,
    isCluster: isCluster,
  } as SearchBarResult;
}
function handleInputChange(value: string): ReturnType<SearchBarState['handleInputChange']> {
  searchTerm.value = value;
  if (value.length < minLength.value) {
    results.value = [];
    showDropdown.value = false;
    return;
  }
  // Delegate debouncing + fetching to composable
  search(value);
}
function handleSubmit(e: any): ReturnType<SearchBarState['handleSubmit']> {
  e.preventDefault();
  const term = searchTerm.value.trim();
  if (props.onSubmit) {
    props.onSubmit(term);
    showDropdown.value = false;
  }
}
function handleResultClick(
  result: SearchBarResult
): ReturnType<SearchBarState['handleResultClick']> {
  if (props.onResultClick) {
    props.onResultClick(result);
  }
  showDropdown.value = false;
  searchTerm.value = '';
}
function handleViewAllClick(): ReturnType<SearchBarState['handleViewAllClick']> {
  if (props.onViewAllClick) {
    props.onViewAllClick(searchTerm.value);
  }
  showDropdown.value = false;
}
</script>
