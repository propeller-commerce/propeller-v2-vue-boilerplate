<template>
  <div class="py-8 bg-background">
    <div class="container-width">
      <Breadcrumbs
        v-if="category"
        :categoryPath="(category as any).categoryPath || []"
        :currentCategory="category as Category"
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
          <div
            class="sticky top-20 z-30 bg-background/95 backdrop-blur py-2 lg:static lg:bg-transparent lg:py-0 mb-2"
          >
            <GridToolbar
              :viewMode="viewMode"
              :offset="[12, 24, 48]"
              :itemsFound="itemsFound"
              :defaultSort="[{ field: sortField, order: sortOrder }]"
              :defaultOffset="offset"
              :activeTextFilters="filters"
              :priceFilterMin="minPrice"
              :priceFilterMax="maxPrice"
              :onViewChange="
                (mode: string) => (viewMode = mode as 'grid' | 'list')
              "
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
            :showPrice="true"
            :showStock="true"
            :showAvailability="false"
            :allowAllCategories="true"
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
            :onCategoryChange="handleCategoryChange"
            :onCartCreated="(cart: Cart) => cartStore.setCart(cart)"
            :afterAddToCart="(cart: Cart) => cartStore.setCart(cart)"
            :onProductClick="
              (product: Product) =>
                router.push(
                  configuration.urls.getProductUrl(
                    product,
                    languageStore.language,
                  ),
                )
            "
            :onClusterClick="
              (cluster: Cluster) =>
                router.push(
                  configuration.urls.getClusterUrl(
                    cluster,
                    languageStore.language,
                  ),
                )
            "
            :onProceedToCheckout="
              () =>
                router.push(localizeHref('/checkout', languageStore.language))
            "
            :onRequestQuoteClick="
              () =>
                router.push(
                  localizeHref('/checkout?mode=quote', languageStore.language),
                )
            "
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
import { ref, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { type AttributeFilter, AttributeType, Cart, type Category, Cluster, Contact, Customer, Product, ProductSortField, type ProductsResponse, type ProductTextFilterInput, SortOrder } from "propeller-sdk-v2";
import { useAuthStore } from "@/stores/auth";
import { useCartStore } from "@/stores/cart";
import { useCompanyStore } from "@/stores/company";
import { usePriceStore } from "@/stores/price";
import { useLanguageStore } from "@/stores/language";
import { graphqlClient } from "@/lib/api";
import { configuration, localizeHref } from "@/lib/config";

import { Breadcrumbs, CategoryDescription, GridFilters, GridPagination, GridTitle, GridToolbar, ProductGrid } from 'propeller-v2-vue-ui';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const cartStore = useCartStore();
const companyStore = useCompanyStore();
const priceStore = usePriceStore();
const languageStore = useLanguageStore();

// Derived from route — ProductGrid fetches internally using this
const categoryId = computed(() => parseInt(route.params.id as string));

// Populated via ProductGrid callbacks
const category = ref<Category | null>(null);
const productsResponse = ref<ProductsResponse | null>(null);
const gridFilters = ref<AttributeFilter[]>([]);
const priceBoundsMin = ref<number | undefined>();
const priceBoundsMax = ref<number | undefined>();
const itemsFound = ref(0);
const filtersLoading = ref(false);

const RESERVED_QUERY_KEYS = ['page', 'minPrice', 'maxPrice', 'offset', 'sortField', 'sortOrder'];

function parseFiltersFromQuery(query: Record<string, any>): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(query)) {
    if (RESERVED_QUERY_KEYS.includes(key)) continue;
    const raw = Array.isArray(value) ? value[0] : value;
    if (typeof raw !== 'string') continue;
    try {
      const parsed = JSON.parse(raw);
      result[key] = Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
    } catch {
      result[key] = [raw];
    }
  }
  return result;
}

function readNumberQuery(value: any): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string' || raw === '') return undefined;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : undefined;
}

// Local filter / pagination state — initialised from URL so back-navigation restores
const filters = ref<Record<string, string[]>>(parseFiltersFromQuery(route.query as any));
const minPrice = ref<number | undefined>(readNumberQuery(route.query.minPrice));
const maxPrice = ref<number | undefined>(readNumberQuery(route.query.maxPrice));
const clearSignal = ref(0);
const currentPage = ref(readNumberQuery(route.query.page) ?? 1);
const offset = ref(readNumberQuery(route.query.offset) ?? 12);
const sortField = ref<string>(
  (route.query.sortField as string) || ProductSortField.CATEGORY_ORDER,
);
const sortOrder = ref<string>(
  (route.query.sortOrder as string) || SortOrder.DESC,
);
const viewMode = ref<"grid" | "list">("list");

// Sync local state to URL — uses router.push so each navigation enters history
// and the browser back button can restore the filtered view after visiting a product.
let suppressQuerySync = false;
function syncStateToUrl() {
  const query: Record<string, string> = {};
  if (currentPage.value > 1) query.page = String(currentPage.value);
  for (const [key, values] of Object.entries(filters.value)) {
    if (values.length > 0) query[key] = JSON.stringify(values);
  }
  if (minPrice.value !== undefined) query.minPrice = String(minPrice.value);
  if (maxPrice.value !== undefined) query.maxPrice = String(maxPrice.value);
  if (offset.value !== 12) query.offset = String(offset.value);
  if (sortField.value !== ProductSortField.CATEGORY_ORDER) query.sortField = sortField.value;
  if (sortOrder.value !== SortOrder.DESC) query.sortOrder = sortOrder.value;
  const currentJson = JSON.stringify(route.query);
  const nextJson = JSON.stringify(query);
  if (currentJson === nextJson) return;
  suppressQuerySync = true;
  router.push({ path: route.path, query }).finally(() => {
    suppressQuerySync = false;
  });
}

// Restore state when the user navigates via back/forward (route.query changes externally)
watch(
  () => route.query,
  (q) => {
    if (suppressQuerySync) return;
    const nextFilters = parseFiltersFromQuery(q as any);
    if (JSON.stringify(nextFilters) !== JSON.stringify(filters.value)) {
      filters.value = nextFilters;
    }
    minPrice.value = readNumberQuery(q.minPrice);
    maxPrice.value = readNumberQuery(q.maxPrice);
    currentPage.value = readNumberQuery(q.page) ?? 1;
    offset.value = readNumberQuery(q.offset) ?? 12;
    sortField.value = (q.sortField as string) || ProductSortField.CATEGORY_ORDER;
    sortOrder.value = (q.sortOrder as string) || SortOrder.DESC;
  },
);

// Convert local filters state → ProductGrid textFilters prop format
const activeTextFilters = computed<ProductTextFilterInput[]>(() =>
  Object.entries(filters.value)
    .filter(([, values]) => values.length > 0)
    .map(([name, values]) => ({
      name,
      values,
      exclude: false,
      type: AttributeType.TEXT,
    })),
);

function getCategoryName(): string {
  if (!category.value) return "";
  const nameArr =
    (category.value as any).name || (category.value as any).names || [];
  const match = nameArr.find((n: any) => n.language === languageStore.language);
  return match?.value || nameArr[0]?.value || "";
}

// ── ProductGrid callbacks ─────────────────────────────────────────────────────

function handleFiltersChange(f: AttributeFilter[]) {
  gridFilters.value = f;
}
function handleItemsFoundChange(count: number) {
  itemsFound.value = count;
}
function handleLoadingChange(loading: boolean) {
  filtersLoading.value = loading;
}
function handleProductGridPageChange(p: number) {
  currentPage.value = p;
}
function handleProductsResponse(r: ProductsResponse) {
  productsResponse.value = r;
}
function handleCategoryChange(c: Category) {
  category.value = c;
}

function handlePriceBoundsChange(min: number, max: number) {
  // Set bounds once on first fetch so filter slider has correct range
  if (priceBoundsMin.value === undefined) priceBoundsMin.value = min;
  if (priceBoundsMax.value === undefined) priceBoundsMax.value = max;
}

// ── GridFilters callbacks ─────────────────────────────────────────────────────

function handleFilterChange(filter: AttributeFilter, value: string | number) {
  const name = filter.attributeDescription?.name || "";
  const current = filters.value[name] || [];
  const valueStr = String(value);
  const next = current.includes(valueStr)
    ? current.filter((v) => v !== valueStr)
    : [...current, valueStr];
  if (next.length === 0) {
    const updated = { ...filters.value };
    delete updated[name];
    filters.value = updated;
  } else {
    filters.value = { ...filters.value, [name]: next };
  }
  currentPage.value = 1;
  syncStateToUrl();
}

function handleFilterRemove(filterName: string, value: string) {
  const current = filters.value[filterName] || [];
  const next = current.filter((v) => v !== value);
  if (next.length === 0) {
    const updated = { ...filters.value };
    delete updated[filterName];
    filters.value = updated;
  } else {
    filters.value = { ...filters.value, [filterName]: next };
  }
  currentPage.value = 1;
  syncStateToUrl();
}

function handlePriceFilterRemove() {
  minPrice.value = undefined;
  maxPrice.value = undefined;
  currentPage.value = 1;
  syncStateToUrl();
}

function handlePriceChange(min: number, max: number) {
  minPrice.value = min;
  maxPrice.value = max;
  currentPage.value = 1;
  syncStateToUrl();
}

function handleClearFilters() {
  filters.value = {};
  minPrice.value = undefined;
  maxPrice.value = undefined;
  clearSignal.value++;
  currentPage.value = 1;
  syncStateToUrl();
}

// ── GridToolbar callbacks ─────────────────────────────────────────────────────

function handleOffsetChange(val: number) {
  offset.value = val;
  currentPage.value = 1;
  syncStateToUrl();
}

function handleSortChange(field: string, order?: string) {
  sortField.value = field;
  if (order) sortOrder.value = order;
  currentPage.value = 1;
  syncStateToUrl();
}

// ── GridPagination callback ───────────────────────────────────────────────────

function handleGridPaginationPageChange(page: number) {
  currentPage.value = page;
  syncStateToUrl();
}

// Reset state when navigating to a different category
watch(
  () => route.params.id,
  (newId, oldId) => {
    if (newId === oldId) return;
    category.value = null;
    productsResponse.value = null;
    filters.value = parseFiltersFromQuery(route.query as any);
    gridFilters.value = [];
    priceBoundsMin.value = undefined;
    priceBoundsMax.value = undefined;
    minPrice.value = readNumberQuery(route.query.minPrice);
    maxPrice.value = readNumberQuery(route.query.maxPrice);
    currentPage.value = readNumberQuery(route.query.page) ?? 1;
    clearSignal.value++;
  },
);
</script>
