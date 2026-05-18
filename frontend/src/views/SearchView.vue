<template>
  <div class="py-8 bg-background">
    <div class="container-width">
      <GridTitle
        :title="searchTerm ? `Search Products: '${searchTerm}'` : 'Search Products'"
        :language="languageStore.language"
      />

      <div class="flex flex-col lg:flex-row gap-8 mt-4">
        <!-- Filters Sidebar — hidden when search returned no results so the
             user isn't presented with a price-range slider that has nothing
             to filter (and the price bounds default to 0–9999, which is
             misleading when the result set is empty). -->
        <aside v-if="!hasNoResults" class="w-full lg:w-64 flex-shrink-0">
          <GridFilters
            :filters="gridFilters as AttributeFilter[]"
            :priceMin="priceBoundsMin"
            :priceMax="priceBoundsMax"
            :language="languageStore.language"
            :onFilterChange="handleFilterChange"
            :onPriceChange="handlePriceChange"
            :onClearFilters="handleClearFilters"
            :clearSignal="clearSignal"
            :activeTextFilters="filters"
            :activePriceMin="minPrice"
            :activePriceMax="maxPrice"
            :isLoading="filtersLoading"
            :isMobile="false"
            portalMode="open"
            :collapsed="true"
          />
        </aside>

        <!-- Products Area -->
        <div class="flex-1 w-full min-w-0">
          <div v-if="!hasNoResults" class="sticky top-20 z-30 bg-background/95 backdrop-blur py-2 lg:static lg:bg-transparent lg:py-0 mb-2">
            <GridToolbar
              :viewMode="viewMode"
              :offset="[12, 24, 48]"
              :itemsFound="itemsFound"
              :defaultSort="[{ field: sortField, order: sortOrder }]"
              :defaultOffset="offset"
              :activeTextFilters="filters"
              :priceFilterMin="minPrice"
              :priceFilterMax="maxPrice"
              :onViewChange="(mode: string) => (viewMode = mode as 'grid' | 'list')"
              :onOffsetChange="handleOffsetChange"
              :onSortChange="handleSortChange"
              :onFilterRemove="handleFilterRemove"
              :onPriceFilterRemove="handlePriceFilterRemove"
              :onClearFilters="handleClearFilters"
            />
          </div>

          <!-- Custom empty state (replaces the ProductGrid fallback) so we can
               offer a "Go to homepage" action and reference the search term. -->
          <template v-if="hasNoResults">
            <div class="propeller-search-empty flex flex-col items-center justify-center text-center py-16 px-4 bg-card rounded-[var(--radius-container)] border border-border">
              <svg
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                class="h-12 w-12 text-foreground-subtle mb-4"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  :stroke-width="1.5"
                  d="M21 21l-4.35-4.35M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z"
                />
              </svg>
              <h2 class="text-xl font-semibold text-foreground mb-2">
                No products found for &quot;{{ searchTerm }}&quot;
              </h2>
              <p class="text-sm text-muted-foreground mb-6 max-w-md">
                Try adjusting your search term, or browse our products from the homepage.
              </p>
              <button
                type="button"
                class="inline-flex items-center justify-center px-4 py-2 rounded-[var(--radius-control)] bg-primary text-primary-foreground hover:bg-primary/90 transition font-medium text-sm"
                @click="() => router.push(localizeHref('/', languageStore.language))"
              >
                Go to homepage
              </button>
            </div>
          </template>

          <!-- ProductGrid stays mounted in non-empty states; it owns the fetch
               cycle and reports itemsFound back to the parent. -->
          <ProductGrid
            v-show="!hasNoResults"
            :graphqlClient="graphqlClient"
            :term="effectiveTerm"
            :categoryId="effectiveCategoryId"
            :user="authStore.user as Contact | Customer"
            :companyId="companyStore.selectedCompany?.companyId"
            :configuration="configuration"
            :language="languageStore.language"
            :includeTax="priceStore.includeTax"
            :columns="viewMode === 'list' ? 1 : 3"
            :cartId="cartStore.cartId || undefined"
            :createCart="true"
            :showModal="true"
            :textFilters="activeTextFilters"
            :showPrice="true"
            :showStock="true"
            :showAvailability="false"
            :allowIncrDecr="true"
            :allowAddToCart="true"
            :priceFilterMin="minPrice"
            :priceFilterMax="maxPrice"
            :pageSize="offset"
            :sortField="sortField"
            :sortOrder="sortOrder"
            :page="currentPage"
            :onFiltersChange="handleFiltersChange"
            :onPriceBoundsChange="handlePriceBoundsChange"
            :onItemsFoundChange="handleItemsFoundChange"
            :onLoadingChange="handleLoadingChange"
            :onPageChange="handleProductGridPageChange"
            :onProductsResponse="handleProductsResponse"
            :onCartCreated="(cart: Cart) => cartStore.setCart(cart)"
            :afterAddToCart="(cart: Cart) => cartStore.setCart(cart)"
            :onProductClick="(product: Product) => router.push(configuration.urls.getProductUrl(product, languageStore.language))"
            :onClusterClick="(cluster: Cluster) => router.push(configuration.urls.getClusterUrl(cluster, languageStore.language))"
            :onProceedToCheckout="() => router.push(localizeHref('/checkout', languageStore.language))"
            :onRequestQuoteClick="() => router.push(localizeHref('/checkout?mode=quote', languageStore.language))"
          />

          <div v-if="!hasNoResults" class="flex justify-center gap-2 mt-12">
            <GridPagination
              v-if="productsResponse"
              :products="productsResponse as ProductsResponse"
              :language="languageStore.language"
              :onPageChange="handleGridPaginationPageChange"
              variant="full"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { type AttributeFilter, AttributeType, Cart, Cluster, Contact, Customer, Product, ProductSortField, type ProductsResponse, type ProductTextFilterInput, SortOrder } from 'propeller-sdk-v2';
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { useCompanyStore } from '@/stores/company'
import { usePriceStore } from '@/stores/price'
import { useLanguageStore } from '@/stores/language'
import { graphqlClient } from '@/lib/api'
import { configuration, localizeHref } from '@/lib/config'

import GridFilters from '@/components/propeller/GridFilters.vue'
import GridTitle from '@/components/propeller/GridTitle.vue'
import GridToolbar from '@/components/propeller/GridToolbar.vue'
import GridPagination from '@/components/propeller/GridPagination.vue'
import ProductGrid from '@/components/propeller/ProductGrid.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const cartStore = useCartStore()
const companyStore = useCompanyStore()
const priceStore = usePriceStore()
const languageStore = useLanguageStore()

const searchTerm = computed(() => {
  const term = route.params.term
  return Array.isArray(term) ? term.join(' ') : (term || '')
})

// When the user hits /search with no term, show all products under the
// store's base category. When a term is present, use full-text search
// without a categoryId filter (mirrors React's isAllProducts branching).
const isAllProducts = computed(() => !searchTerm.value)
const effectiveTerm = computed(() => (isAllProducts.value ? undefined : searchTerm.value))
const effectiveCategoryId = computed(() =>
  isAllProducts.value ? configuration.baseCategoryId : undefined,
)

// Populated via ProductGrid callbacks
const productsResponse = ref<ProductsResponse | null>(null)
const gridFilters = ref<AttributeFilter[]>([])
const priceBoundsMin = ref<number | undefined>()
const priceBoundsMax = ref<number | undefined>()
const itemsFound = ref(0)
const filtersLoading = ref(false)

const RESERVED_QUERY_KEYS = ['page', 'minPrice', 'maxPrice', 'offset', 'sortField', 'sortOrder']

function parseFiltersFromQuery(query: Record<string, any>): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const [key, value] of Object.entries(query)) {
    if (RESERVED_QUERY_KEYS.includes(key)) continue
    const raw = Array.isArray(value) ? value[0] : value
    if (typeof raw !== 'string') continue
    try {
      const parsed = JSON.parse(raw)
      result[key] = Array.isArray(parsed) ? parsed.map(String) : [String(parsed)]
    } catch {
      result[key] = [raw]
    }
  }
  return result
}

function readNumberQuery(value: any): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string' || raw === '') return undefined
  const n = parseFloat(raw)
  return Number.isFinite(n) ? n : undefined
}

// Local filter / pagination state — initialised from URL so back-navigation restores
const filters = ref<Record<string, string[]>>(parseFiltersFromQuery(route.query as any))
const minPrice = ref<number | undefined>(readNumberQuery(route.query.minPrice))
const maxPrice = ref<number | undefined>(readNumberQuery(route.query.maxPrice))
const clearSignal = ref(0)
const currentPage = ref(readNumberQuery(route.query.page) ?? 1)
const offset = ref(readNumberQuery(route.query.offset) ?? 12)
const sortField = ref<string>((route.query.sortField as string) || ProductSortField.RELEVANCE)
const sortOrder = ref<string>((route.query.sortOrder as string) || SortOrder.DESC)
const viewMode = ref<'grid' | 'list'>('list')

let suppressQuerySync = false
function syncStateToUrl() {
  const query: Record<string, string> = {}
  if (currentPage.value > 1) query.page = String(currentPage.value)
  for (const [key, values] of Object.entries(filters.value)) {
    if (values.length > 0) query[key] = JSON.stringify(values)
  }
  if (minPrice.value !== undefined) query.minPrice = String(minPrice.value)
  if (maxPrice.value !== undefined) query.maxPrice = String(maxPrice.value)
  if (offset.value !== 12) query.offset = String(offset.value)
  if (sortField.value !== ProductSortField.RELEVANCE) query.sortField = sortField.value
  if (sortOrder.value !== SortOrder.DESC) query.sortOrder = sortOrder.value
  if (JSON.stringify(route.query) === JSON.stringify(query)) return
  suppressQuerySync = true
  router.push({ path: route.path, query }).finally(() => {
    suppressQuerySync = false
  })
}

watch(
  () => route.query,
  (q) => {
    if (suppressQuerySync) return
    const nextFilters = parseFiltersFromQuery(q as any)
    if (JSON.stringify(nextFilters) !== JSON.stringify(filters.value)) {
      filters.value = nextFilters
    }
    minPrice.value = readNumberQuery(q.minPrice)
    maxPrice.value = readNumberQuery(q.maxPrice)
    currentPage.value = readNumberQuery(q.page) ?? 1
    offset.value = readNumberQuery(q.offset) ?? 12
    sortField.value = (q.sortField as string) || ProductSortField.RELEVANCE
    sortOrder.value = (q.sortOrder as string) || SortOrder.DESC
  },
)

// True when a search term is present, the grid has finished loading, and the
// server returned zero matches. Drives the simplified empty-state UI that
// hides the filter sidebar / toolbar / pagination and offers a homepage link.
const hasNoResults = computed(() =>
  !!searchTerm.value &&
  !filtersLoading.value &&
  itemsFound.value === 0 &&
  productsResponse.value !== null,
)

const activeTextFilters = computed<ProductTextFilterInput[]>(() =>
  Object.entries(filters.value)
    .filter(([, values]) => values.length > 0)
    .map(([name, values]) => ({
      name,
      values,
      exclude: false,
      type: AttributeType.TEXT,
    }))
)

// ── ProductGrid callbacks ─────────────────────────────────────────────────────

function handleFiltersChange(f: AttributeFilter[]) { gridFilters.value = f }
function handleItemsFoundChange(count: number) { itemsFound.value = count }
function handleLoadingChange(loading: boolean) { filtersLoading.value = loading }
function handleProductGridPageChange(p: number) { currentPage.value = p }
function handleProductsResponse(r: ProductsResponse) { productsResponse.value = r }

function handlePriceBoundsChange(min: number, max: number) {
  if (priceBoundsMin.value === undefined) priceBoundsMin.value = min
  if (priceBoundsMax.value === undefined) priceBoundsMax.value = max
}

// ── GridFilters callbacks ─────────────────────────────────────────────────────

function handleFilterChange(filter: AttributeFilter, value: string | number) {
  const name = filter.attributeDescription?.name || ''
  const current = filters.value[name] || []
  const valueStr = String(value)
  const next = current.includes(valueStr)
    ? current.filter(v => v !== valueStr)
    : [...current, valueStr]
  if (next.length === 0) {
    const updated = { ...filters.value }
    delete updated[name]
    filters.value = updated
  } else {
    filters.value = { ...filters.value, [name]: next }
  }
  currentPage.value = 1
  syncStateToUrl()
}

function handleFilterRemove(filterName: string, value: string) {
  const current = filters.value[filterName] || []
  const next = current.filter(v => v !== value)
  if (next.length === 0) {
    const updated = { ...filters.value }
    delete updated[filterName]
    filters.value = updated
  } else {
    filters.value = { ...filters.value, [filterName]: next }
  }
  currentPage.value = 1
  syncStateToUrl()
}

function handlePriceFilterRemove() {
  minPrice.value = undefined
  maxPrice.value = undefined
  currentPage.value = 1
  syncStateToUrl()
}

function handlePriceChange(min: number, max: number) {
  minPrice.value = min
  maxPrice.value = max
  currentPage.value = 1
  syncStateToUrl()
}

function handleClearFilters() {
  filters.value = {}
  minPrice.value = undefined
  maxPrice.value = undefined
  clearSignal.value++
  currentPage.value = 1
  syncStateToUrl()
}

// ── GridToolbar callbacks ─────────────────────────────────────────────────────

function handleOffsetChange(val: number) {
  offset.value = val
  currentPage.value = 1
  syncStateToUrl()
}

function handleSortChange(field: string, order?: string) {
  sortField.value = field
  if (order) sortOrder.value = order
  currentPage.value = 1
  syncStateToUrl()
}

// ── GridPagination callback ───────────────────────────────────────────────────

function handleGridPaginationPageChange(page: number) {
  currentPage.value = page
  syncStateToUrl()
}

// Reset filter/page state when search term changes
watch(searchTerm, (newTerm, oldTerm) => {
  if (newTerm === oldTerm) return
  filters.value = parseFiltersFromQuery(route.query as any)
  gridFilters.value = []
  priceBoundsMin.value = undefined
  priceBoundsMax.value = undefined
  minPrice.value = readNumberQuery(route.query.minPrice)
  maxPrice.value = readNumberQuery(route.query.maxPrice)
  currentPage.value = readNumberQuery(route.query.page) ?? 1
  clearSignal.value++
})
</script>
