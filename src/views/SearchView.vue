<template>
  <div class="py-8 bg-background">
    <div class="container-width">
      <GridTitle
        :title="searchTerm ? `Search results for &quot;${searchTerm}&quot;` : 'Search Products'"
        :language="languageStore.language"
      />

      <div class="flex gap-6">
        <aside class="hidden lg:block w-64 flex-shrink-0">
          <GridFilters
            :filters="gridFilters"
            :selectedFilters="filters"
            :minPrice="minPrice"
            :maxPrice="maxPrice"
            :priceBoundsMin="priceBoundsMin"
            :priceBoundsMax="priceBoundsMax"
            :language="languageStore.language"
            :clearSignal="clearSignal"
            :onFilterChange="handleFilterChange"
            :onPriceChange="handlePriceChange"
            :onClearFilters="handleClearFilters"
          />
        </aside>

        <div class="flex-1 min-w-0">
          <GridToolbar
            :viewMode="viewMode"
            :offset="offset"
            :sortField="sortField"
            :sortOrder="sortOrder"
            :language="languageStore.language"
            :onViewModeChange="(mode: string) => viewMode = mode as 'grid' | 'list'"
            :onOffsetChange="(val: number) => { offset = val; currentPage = 1; updateURL() }"
            :onSortChange="(field: any, order: any) => { sortField = field; sortOrder = order; currentPage = 1; updateURL() }"
          />

          <ProductGrid
            :graphqlClient="graphqlClient"
            :user="authStore.user"
            :products="products"
            :isLoading="loading"
            :columns="viewMode === 'list' ? 1 : 3"
            :cartId="cartStore.cartId || undefined"
            :createCart="true"
            :language="languageStore.language"
            :includeTax="priceStore.includeTax"
            :companyId="companyStore.companyId || undefined"
            :configuration="configuration"
            :onProductClick="(product: any) => router.push(configuration.urls.getProductUrl(product, languageStore.language))"
            :onCartCreated="(cart: any) => cartStore.setCart(cart)"
          />

          <GridPagination
            v-if="productsResponse"
            :products="productsResponse"
            :language="languageStore.language"
            :onPageChange="(page: number) => { currentPage = page; updateURL() }"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Enums, type AttributeFilter, type Product, type ProductsResponse } from 'propeller-sdk-v2'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { useCompanyStore } from '@/stores/company'
import { usePriceStore } from '@/stores/price'
import { useLanguageStore } from '@/stores/language'
import { graphqlClient, productService } from '@/lib/api'
import { configuration } from '@/lib/config'

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

const products = ref<Product[]>([])
const productsResponse = ref<ProductsResponse | null>(null)
const loading = ref(false)
const gridFilters = ref<AttributeFilter[]>([])
const filters = ref<Record<string, string[]>>({})
const minPrice = ref<number | undefined>()
const maxPrice = ref<number | undefined>()
const priceBoundsMin = ref<number | undefined>()
const priceBoundsMax = ref<number | undefined>()
const clearSignal = ref(0)
const currentPage = ref(1)
const offset = ref(12)
const sortField = ref<Enums.ProductSortField>(Enums.ProductSortField.RELEVANCE)
const sortOrder = ref<Enums.SortOrder>(Enums.SortOrder.DESC)
const viewMode = ref<'grid' | 'list'>('grid')

function readFromURL() {
  const q = route.query
  if (q.page) currentPage.value = parseInt(q.page as string) || 1
  if (q.offset) offset.value = parseInt(q.offset as string) || 12
  if (q.sortField) sortField.value = q.sortField as Enums.ProductSortField
  if (q.sortOrder) sortOrder.value = q.sortOrder as Enums.SortOrder
  if (q.minPrice) minPrice.value = parseFloat(q.minPrice as string)
  if (q.maxPrice) maxPrice.value = parseFloat(q.maxPrice as string)
  if (q.filters) {
    try { filters.value = JSON.parse(q.filters as string) } catch {}
  }
}

function updateURL() {
  const q: Record<string, string> = {}
  if (currentPage.value > 1) q.page = String(currentPage.value)
  if (offset.value !== 12) q.offset = String(offset.value)
  if (sortField.value !== Enums.ProductSortField.RELEVANCE) q.sortField = sortField.value
  if (sortOrder.value !== Enums.SortOrder.DESC) q.sortOrder = sortOrder.value
  if (minPrice.value !== undefined) q.minPrice = String(minPrice.value)
  if (maxPrice.value !== undefined) q.maxPrice = String(maxPrice.value)
  if (Object.keys(filters.value).length > 0) q.filters = JSON.stringify(filters.value)
  router.replace({ query: q })
  search()
}

function handleFilterChange(key: string, values: string[]) {
  if (values.length) filters.value = { ...filters.value, [key]: values }
  else { const f = { ...filters.value }; delete f[key]; filters.value = f }
  currentPage.value = 1; updateURL()
}

function handlePriceChange(min?: number, max?: number) {
  minPrice.value = min; maxPrice.value = max; currentPage.value = 1; updateURL()
}

function handleClearFilters() {
  filters.value = {}; minPrice.value = undefined; maxPrice.value = undefined
  clearSignal.value++; currentPage.value = 1; updateURL()
}

async function search() {
  if (!searchTerm.value) return
  loading.value = true
  try {
    const attributeFilters: AttributeFilter[] = Object.entries(filters.value).map(([name, values]) => ({ name, values }))
    const result = await productService.getProducts({
      page: currentPage.value,
      offset: offset.value,
      searchWord: searchTerm.value,
      language: languageStore.language,
      sortField: sortField.value,
      sortOrder: sortOrder.value,
      attributeFilters,
      minPrice: minPrice.value,
      maxPrice: maxPrice.value,
      imageSearchFilters: configuration.imageSearchFiltersGrid,
      imageVariantFilters: configuration.imageVariantFiltersSmall,
    })
    productsResponse.value = result || null
    products.value = result?.items || []
    if ((result as any)?.attributeFilters?.items) {
      gridFilters.value = (result as any).attributeFilters.items
      if (priceBoundsMin.value === undefined) priceBoundsMin.value = (result as any).minPrice
      if (priceBoundsMax.value === undefined) priceBoundsMax.value = (result as any).maxPrice
    }
  } catch (e) {
    console.error('Search failed', e)
  } finally {
    loading.value = false
  }
}

onMounted(() => { readFromURL(); search() })
watch(searchTerm, () => { currentPage.value = 1; search() })
</script>
