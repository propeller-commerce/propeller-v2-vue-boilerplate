<template>
  <div class="py-8 bg-background">
    <div class="container-width">
      <!-- schema.org ItemList of the SSR first-page products. -->
      <ItemListJsonLd
        v-if="jsonLdFirstPage.length"
        :products="jsonLdFirstPage"
        :context="jsonLdContext"
      />
      <Breadcrumbs
        v-if="category"
        :categoryPath="(category as any).categoryPath || []"
        :currentCategory="category as Category"
        :showCurrent="true"
      />

      <GridTitle :title="getCategoryName()" />

      <CategoryDescription v-if="category" :category="category as Category" />

      <!-- Hybrid SSR island. The grid is now server-rendered too — when a
           seed is available we hand the items array to <ProductGrid> via the
           controlled `products` prop and the component skips its internal
           fetch. The first paint shows real product cards. As soon as the
           user changes a filter/sort/page `usingServerData` flips to false,
           we drop the prop, and the grid resumes its own fetching. Matches
           propeller-next's CategoryIsland posture exactly. -->
      <div class="flex flex-col lg:flex-row gap-8 mt-4">
        <!-- Filters Sidebar -->
        <aside class="w-full lg:w-64 flex-shrink-0">
          <GridFilters
            :filters="gridFilters as AttributeFilter[]"
            :priceMin="priceBoundsMin"
            :priceMax="priceBoundsMax"
            :onFilterChange="handleFilterChange"
            :onPriceChange="handlePriceChange"
            :onClearFilters="handleClearFilters"
            :clearSignal="clearSignal"
            :activeTextFilters="filters"
            :activePriceMin="minPrice"
            :activePriceMax="maxPrice"
            :isLoading="filtersLoading"
            :isMobile="false"
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
            :products="controlledProducts"
            :categoryId="categoryId"
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
import { ref, computed, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useHead } from "@unhead/vue";
import { type AttributeFilter, AttributeType, Cart, type Category, Cluster, Contact, Customer, Product, ProductSortField, type ProductsResponse, type ProductTextFilterInput, SortOrder } from "propeller-sdk-v2";
import { useAuthStore } from "@/stores/auth";
import { useCartStore } from "@/stores/cart";
import { useCompanyStore } from "@/stores/company";
import { usePriceStore } from "@/stores/price";
import { useLanguageStore } from "@/stores/language";
import { useSsrCatalogStore } from "@/stores/ssrCatalog";
import { graphqlClient } from "@/lib/api";
import { configuration, localizeHref } from "@/lib/config";
import { resolveSeoTitle, resolveSeoDescription, resolveSeoKeywords, resolveCanonicalUrl, buildJsonLdContext } from "@/lib/seo";

import { Breadcrumbs, CategoryDescription, GridFilters, GridPagination, GridTitle, GridToolbar, ItemListJsonLd, ProductGrid } from 'propeller-v2-vue-ui';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const cartStore = useCartStore();
const companyStore = useCompanyStore();
const priceStore = usePriceStore();
const languageStore = useLanguageStore();

// Derived from route — ProductGrid fetches internally using this
const categoryId = computed(() => parseInt(route.params.id as string));

// SSR seed: the route's `ssrPrefetch` loader fetched the full Category (incl.
// its first product page + filter facets) and stashed it in the ssrCatalog
// store. Consuming it here means the breadcrumbs/title/description shell —
// and the <head> tags below — server-render real content for SEO.
const ssrCatalog = useSsrCatalogStore();
// peekSeed (not takeSeed): the SSR render and the client's hydration render
// must read the same value, or the resulting DOM differs and Vue warns about
// a hydration mismatch. The post-hydration consumeSeed call below clears the
// entry so a later client-side navigation back to this route fetches fresh.
const seed = ssrCatalog.peekSeed(route.fullPath);
const seededCategory =
  seed?.kind === "category" ? (seed.data as Category) : null;

// `category` starts from the SSR seed so it is non-null on the server render.
const category = ref<Category | null>(seededCategory);
// Seed the products + filters too, from the category the server already
// fetched, so first paint has data before ProductGrid's client fetch returns.
const seededProducts =
  (seededCategory?.products as ProductsResponse | undefined) ?? null;
const productsResponse = ref<ProductsResponse | null>(seededProducts);
const gridFilters = ref<AttributeFilter[]>(
  (seededProducts?.filters as AttributeFilter[] | undefined) ?? [],
);

// Controlled-mode seam (mirrors React's CategoryIsland `usingServerData`).
// While true and the SSR seed exists, ProductGrid receives the items array via
// :products and its internal fetch is skipped — so the SSR HTML renders real
// product cards. The first user interaction (filter / sort / page) flips this
// to false, the prop becomes undefined, and the grid resumes its own fetching
// for every subsequent change.
const usingServerData = ref(!!seededProducts);
const seededItems = (seededProducts?.items ?? []) as (Product | Cluster)[];

// schema.org ItemList of the first-page items. Built once from the SSR seed
// — filter/sort/page navigation does NOT re-emit (crawlers see this snapshot).
const jsonLdContext = computed(() =>
  buildJsonLdContext({
    language: languageStore.language,
    user: authStore.user as any,
  }),
);
const jsonLdFirstPage = seededItems as Product[];
const controlledProducts = computed<(Product | Cluster)[] | undefined>(() =>
  usingServerData.value ? seededItems : undefined,
);
function markUserInteracted(): void {
  if (usingServerData.value) usingServerData.value = false;
}
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
  // First user-driven change → hand control back to ProductGrid's internal
  // fetcher. From this point on the SSR-seeded items are stale (the URL no
  // longer matches them) and the grid must re-query.
  markUserInteracted();
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

// SEO <head> — driven by the (SSR-seeded) category. Reactive: a client-side
// category switch updates the title without a reload. Server-rendered into
// the initial HTML so crawlers see the right title/description/canonical/og:*.
//
// Title + description are computed once and reused for og:title / og:description
// so the meta tags can't drift from the visible <title>.
const seoTitle = computed(
  () =>
    resolveSeoTitle(
      category.value?.metadataTitles,
      category.value?.name,
      languageStore.language,
    ) || getCategoryName() || "Category",
);
const seoDescription = computed(
  () =>
    resolveSeoDescription(
      category.value?.metadataDescriptions,
      [category.value?.shortDescription, category.value?.description],
      languageStore.language,
    ) || "",
);
const seoKeywords = computed(
  () =>
    resolveSeoKeywords(
      category.value?.metadataKeywords,
      languageStore.language,
    ) || "",
);
const seoCanonical = computed(() =>
  resolveCanonicalUrl(category.value?.metadataCanonicalUrls, languageStore.language),
);
useHead({
  title: seoTitle,
  meta: [
    { name: "description", content: seoDescription },
    { name: "keywords", content: seoKeywords },
    { property: "og:title", content: seoTitle },
    { property: "og:description", content: seoDescription },
    { property: "og:type", content: "website" },
    // Twitter card: `summary` (no image) — categories rarely have a single
    // representative image, so we don't try to pick one.
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: seoTitle },
    { name: "twitter:description", content: seoDescription },
  ],
  link: computed(() =>
    // Omit the canonical link entirely when there's no curated URL —
    // a `<link rel="canonical">` with an empty href is worse than no tag.
    seoCanonical.value ? [{ rel: "canonical", href: seoCanonical.value }] : [],
  ),
});

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

// Post-hydration: discard the seed so a later client-side navigation back to
// this route falls back to a client fetch (the cached items would be stale by
// then). This runs only on the client because Vue does not call onMounted
// during server rendering, which is exactly the contract we want.
onMounted(() => {
  ssrCatalog.consumeSeed(route.fullPath);
});

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
    // Drop the controlled-products seam — the seeded items belong to the
    // previous category; the grid must fetch the new one itself.
    markUserInteracted();
  },
);
</script>
