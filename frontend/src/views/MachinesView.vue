<template>
  <div class="py-8 bg-background">
    <div class="container-width">
      <p v-if="tooDeep" class="py-24 text-center text-foreground-subtle">Not found.</p>
      <!-- key forces a fresh mount per node so sibling nav re-seeds cleanly. -->
      <MachineGrid
        v-else
        :key="segments.join('/')"
        :segments="segments"
        :basePath="basePath"
        :source="source"
        :sourceIds="sourceIds"
        :machineLanguage="MACHINE_LANGUAGE"
        :listing="listing"
        :onListingChange="onListingChange"
        :configuration="machineConfiguration"
        :cartId="cartStore.cartId || undefined"
        :onCartCreated="(cart: Cart) => cartStore.setCart(cart)"
        :afterAddToCart="(cart: Cart) => cartStore.setCart(cart)"
        :onProductClick="onProductClick"
        :paginationLabels="paginationLabels"
        :filtersLabels="filtersLabels"
        :toolbarLabels="toolbarLabels"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Machines route — a single repeatable-param route (`machines/:slug*`) that
 * matches BOTH the root (`/machines`) and any drill-down (`/machines/a/b/…`),
 * because the package <MachineGrid> handles both modes. This view is a thin
 * host: it reads the URL, resolves the MY_INSTALLATIONS company ids, and maps
 * listing changes back to the URL. All fetching/rendering lives in <MachineGrid>.
 * Auth is enforced by the route's `meta.requiresAuth` guard (redirect to login);
 * the "Machines" nav link is contact-only. Mirrors propeller-next's machines page.
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Cart, Product } from '@propeller-commerce/propeller-sdk-v2'
import { MachineGrid, type MachineListingState } from '@propeller-commerce/propeller-v2-vue-ui'
import { useAuthStore } from '@/stores/auth'
import { useCompanyStore } from '@/stores/company'
import { useCartStore } from '@/stores/cart'
import { useLanguageStore } from '@/stores/language'
import { configuration, localizeHref } from '@/lib/config'
import { parseListingParams, buildListingSearchParams } from '@/lib/listingParams'
import {
  MACHINE_LANGUAGE,
  MACHINE_MAX_DEPTH,
  MACHINE_SORT_FIELD_DEFAULT,
  MACHINE_SORT_ORDER_DEFAULT,
  resolveInstallationIds,
} from '@/lib/machines'
import { useTranslations } from '@/lib/i18n/composable'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const companyStore = useCompanyStore()
const cartStore = useCartStore()
const languageStore = useLanguageStore()

const paginationLabels = useTranslations('GridPagination')
const filtersLabels = useTranslations('GridFilters')
const toolbarLabels = useTranslations('GridToolbar')

const segments = computed<string[]>(() => {
  const raw = route.params.slug
  return Array.isArray(raw) ? raw : raw ? [raw] : []
})
// WP silently 404s past the last rewrite rule; be explicit.
const tooDeep = computed(() => segments.value.length > MACHINE_MAX_DEPTH)

const source = computed(() => configuration.machines?.source)
const sourceIds = computed(() =>
  resolveInstallationIds(authStore.user, companyStore.companyId ?? undefined),
)

const basePath = computed(() => localizeHref('/machines', languageStore.language))

const listing = computed<MachineListingState>(() => ({
  ...parseListingParams(route.query as Record<string, unknown>, MACHINE_SORT_FIELD_DEFAULT),
  term: (route.query.term as string) ?? '',
}))

const machineConfiguration = computed(() => ({
  imageSearchFiltersGrid: configuration.imageSearchFiltersGrid,
  imageVariantFiltersMedium: configuration.imageVariantFiltersMedium,
}))

function onListingChange(next: MachineListingState): void {
  const query = buildListingSearchParams(next, {
    defaultSortField: MACHINE_SORT_FIELD_DEFAULT,
    defaultSortOrder: MACHINE_SORT_ORDER_DEFAULT,
  })
  const path = [basePath.value, ...segments.value].join('/')
  router.push(query ? `${path}?${query}` : path)
}

function onProductClick(product: Product): void {
  router.push(configuration.urls.getProductUrl(product, languageStore.language))
}
</script>
