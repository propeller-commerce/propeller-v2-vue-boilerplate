<template>
  <div class="py-8 bg-background">
    <div class="container-width">
      <Breadcrumbs
        v-if="category"
        :categoryPath="(category as any).categoryPath || []"
        :language="languageStore.language"
        :configuration="configuration"
        :showCurrent="true"
      />

      <GridTitle
        :title="getCategoryName()"
        :language="languageStore.language"
      />

      <CategoryDescription
        v-if="category"
        :category="category as Category"
        :language="languageStore.language"
      />

      <div class="flex flex-col lg:flex-row gap-8 mt-4">
        <!-- Filters Sidebar -->
        <aside class="w-full lg:w-64 flex-shrink-0">
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
            :user="authStore.user as Contact | Customer"
            :collapsed="true"
          />
        </aside>

        <!-- Products Area -->
        <div class="flex-1 w-full min-w-0">
          <div class="sticky top-20 z-30 bg-background/95 backdrop-blur py-2 lg:static lg:bg-transparent lg:py-0 mb-2">
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

          <ProductGrid
            :graphqlClient="graphqlClient"
            :categoryId="categoryId"
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
            :priceFilterMin="minPrice"
            :priceFilterMax="maxPrice"
            :pageSize="offset"
            :sortField="sortField"
            :sortOrder="sortOrder"
            :page="currentPage"
            :showAvailability="false"
            :showStock="true"
            :onFiltersChange="handleFiltersChange"
            :onPriceBoundsChange="handlePriceBoundsChange"
            :onItemsFoundChange="handleItemsFoundChange"
            :onLoadingChange="handleLoadingChange"
            :onPageChange="handleProductGridPageChange"
            :onProductsResponse="handleProductsResponse"
            :onCategoryChange="handleCategoryChange"
            :onCartCreated="(cart: Cart) => cartStore.setCart(cart)"
            :afterAddToCart="(cart: Cart) => cartStore.setCart(cart)"
            :onProductClick="(product: Product) => router.push(configuration.urls.getProductUrl(product, languageStore.language))"
            :onClusterClick="(cluster: Cluster) => router.push(configuration.urls.getClusterUrl(cluster, languageStore.language))"
            :onProceedToCheckout="() => router.push(localizeHref('/checkout', languageStore.language))"
            :onRequestQuoteClick="() => router.push(localizeHref('/checkout?mode=quote', languageStore.language))"
          />

          <div class="flex justify-center gap-2 mt-12">
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
import {
  Enums,
  type Category,
  type AttributeFilter,
  type ProductsResponse,
  type ProductTextFilterInput,
  Contact,
  Customer,
  Cart,
  Product,
  Cluster,
} from 'propeller-sdk-v2'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { useCompanyStore } from '@/stores/company'
import { usePriceStore } from '@/stores/price'
import { useLanguageStore } from '@/stores/language'
import { graphqlClient } from '@/lib/api'
import { configuration, localizeHref } from '@/lib/config'

import Breadcrumbs from '@/components/propeller/Breadcrumbs.vue'
import GridFilters from '@/components/propeller/GridFilters.vue'
import GridTitle from '@/components/propeller/GridTitle.vue'
import GridToolbar from '@/components/propeller/GridToolbar.vue'
import GridPagination from '@/components/propeller/GridPagination.vue'
import ProductGrid from '@/components/propeller/ProductGrid.vue'
import CategoryDescription from '@/components/propeller/CategoryDescription.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const cartStore = useCartStore()
const companyStore = useCompanyStore()
const priceStore = usePriceStore()
const languageStore = useLanguageStore()

// Derived from route — ProductGrid fetches internally using this
const categoryId = computed(() => parseInt(route.params.id as string))

// Populated via ProductGrid callbacks
const category = ref<Category | null>(null)
const productsResponse = ref<ProductsResponse | null>(null)
const gridFilters = ref<AttributeFilter[]>([])
const priceBoundsMin = ref<number | undefined>()
const priceBoundsMax = ref<number | undefined>()
const itemsFound = ref(0)
const filtersLoading = ref(false)

// Local filter / pagination state
const filters = ref<Record<string, string[]>>({})
const minPrice = ref<number | undefined>()
const maxPrice = ref<number | undefined>()
const clearSignal = ref(0)
const currentPage = ref(1)
const offset = ref(12)
const sortField = ref<string>(Enums.ProductSortField.CATEGORY_ORDER)
const sortOrder = ref<string>(Enums.SortOrder.DESC)
const viewMode = ref<'grid' | 'list'>('list')

// Convert local filters state → ProductGrid textFilters prop format
const activeTextFilters = computed<ProductTextFilterInput[]>(() =>
  Object.entries(filters.value)
    .filter(([, values]) => values.length > 0)
    .map(([name, values]) => ({
      name,
      values,
      exclude: false,
      type: Enums.AttributeType.TEXT,
    }))
)

function getCategoryName(): string {
  if (!category.value) return ''
  const nameArr = (category.value as any).name || (category.value as any).names || []
  const match = nameArr.find((n: any) => n.language === languageStore.language)
  return match?.value || nameArr[0]?.value || ''
}

// ── ProductGrid callbacks ─────────────────────────────────────────────────────

function handleFiltersChange(f: AttributeFilter[]) { gridFilters.value = f }
function handleItemsFoundChange(count: number) { itemsFound.value = count }
function handleLoadingChange(loading: boolean) { filtersLoading.value = loading }
function handleProductGridPageChange(p: number) { currentPage.value = p }
function handleProductsResponse(r: ProductsResponse) { productsResponse.value = r }
function handleCategoryChange(c: Category) { category.value = c }

function handlePriceBoundsChange(min: number, max: number) {
  // Set bounds once on first fetch so filter slider has correct range
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
}

function handlePriceFilterRemove() {
  minPrice.value = undefined
  maxPrice.value = undefined
  currentPage.value = 1
}

function handlePriceChange(min: number, max: number) {
  minPrice.value = min
  maxPrice.value = max
  currentPage.value = 1
}

function handleClearFilters() {
  filters.value = {}
  minPrice.value = undefined
  maxPrice.value = undefined
  clearSignal.value++
  currentPage.value = 1
}

// ── GridToolbar callbacks ─────────────────────────────────────────────────────

function handleOffsetChange(val: number) {
  offset.value = val
  currentPage.value = 1
}

function handleSortChange(field: string, order?: string) {
  sortField.value = field
  if (order) sortOrder.value = order
  currentPage.value = 1
}

// ── GridPagination callback ───────────────────────────────────────────────────

function handleGridPaginationPageChange(page: number) {
  currentPage.value = page
}

// Reset state when navigating to a different category
watch(() => route.params.id, () => {
  category.value = null
  productsResponse.value = null
  filters.value = {}
  gridFilters.value = []
  priceBoundsMin.value = undefined
  priceBoundsMax.value = undefined
  minPrice.value = undefined
  maxPrice.value = undefined
  currentPage.value = 1
  clearSignal.value++
})
</script>
