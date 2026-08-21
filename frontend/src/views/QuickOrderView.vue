<template>
  <div class="py-8 bg-background">
    <div class="container-width">
      <h1 class="text-3xl font-bold mb-8 text-foreground">{{ t.pageTitle }}</h1>
      <div class="bg-card rounded-[var(--radius-container)] shadow-sm p-6">
        <QuickOrder
          :companyId="companyStore.companyId ?? undefined"
          :language="languageStore.language"
          :currency="configuration.currency"
          :configuration="quickOrderConfiguration"
          :parseSpreadsheet="handleParseSpreadsheet"
          templateUrl="/files/quickorder-template.xlsx"
          :onTemplateDownload="handleTemplateDownload"
          :afterAddToCart="handleAddToCart"
          :onMissingCodes="onMissingCodes"
          :labels="t"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Quick-order route — a standalone bulk order pad (type/paste SKUs with
 * typeahead, or upload an XLSX of code+quantity pairs, then add everything to
 * the cart in one bulk mutation). CSR + login-only: the router's requiresAuth
 * guard redirects direct/anonymous access to /login, and logging out while here
 * navigates to '/' via AppHeader's logout. Infra (graphqlClient/user) resolves
 * from <PropellerProvider>; the XLSX parser is app-local (SheetJS, dynamic
 * import). Mirrors nextDemo's /quick-order page + react-ui <QuickOrder>.
 */
import { computed } from 'vue'
import type { Cart } from '@propeller-commerce/propeller-sdk-v2'
import { QuickOrder } from '@propeller-commerce/propeller-v2-vue-ui'
import { useCartStore } from '@/stores/cart'
import { useCompanyStore } from '@/stores/company'
import { useLanguageStore } from '@/stores/language'
import { useMenuStore } from '@/stores/menu'
import { configuration } from '@/lib/config'
import { useTranslations } from '@/lib/i18n/composable'
import { parseQuickOrderXlsx } from '@/lib/parseQuickOrderXlsx'
import { track } from '@/lib/tracking/bus'
import { cartItems } from '@/lib/tracking/events'

const cartStore = useCartStore()
const companyStore = useCompanyStore()
const languageStore = useLanguageStore()
const menuStore = useMenuStore()
const t = useTranslations('QuickOrder')

// Image filters so typeahead results carry thumbnails (same as the SearchBar).
// `baseCategoryId` scopes the code search to this shop's catalog — the store
// value first, since a hardcoded id is wrong on a channel-driven shop.
const quickOrderConfiguration = computed(() => ({
  imageSearchFiltersGrid: configuration.imageSearchFiltersGrid,
  imageVariantFiltersSmall: configuration.imageVariantFiltersSmall,
  baseCategoryId: menuStore.baseCategoryId ?? configuration.baseCategoryId,
}))

/**
 * The template link is a plain anchor the package renders; this only observes
 * the click. Navigation is untouched, so a slow bus must not delay it — which
 * `track()` already guarantees by buffering rather than awaiting.
 */
function handleTemplateDownload() {
  track(
    'propeller.quick_order_template_downloaded',
    {},
    `quick_order_template_downloaded:${Math.floor(Date.now() / 2000)}`,
  )
}

function handleParseSpreadsheet(file: File) {
  const parsed = parseQuickOrderXlsx(file)
  Promise.resolve(parsed)
    .then((rows) => {
      track(
        'propeller.quick_order_file_uploaded',
        { row_count: Array.isArray(rows) ? rows.length : null },
        `quick_order_file_uploaded:${Math.floor(Date.now() / 2000)}`,
      )
    })
    .catch(() => {
      /* parse errors are the component's to surface, not ours */
    })
  return parsed
}

function handleAddToCart(cart: Cart) {
  cartStore.setCart(cart)
  track(
    'propeller.quick_order_submitted',
    { item_count: cart?.items?.length ?? 0, items: cartItems(cart, languageStore.language) },
    `quick_order_submitted:${cart?.cartId ?? ''}:${Math.floor(Date.now() / 2000)}`,
  )
}

function onMissingCodes(codes: string[]) {
  if (codes.length) {
    // The same class of signal as a zero-result search: a named account typing
    // SKUs we cannot match is an assortment gap, not a user error.
    track(
      'propeller.quick_order_submitted',
      { unmatched_count: codes.length, unmatched_skus: codes.slice(0, 20) },
      `quick_order_unmatched:${codes.join(',').slice(0, 60)}`,
    )
    // eslint-disable-next-line no-console
    console.warn(`${t.value.missing}: ${codes.join(', ')}`)
  }
}
</script>
