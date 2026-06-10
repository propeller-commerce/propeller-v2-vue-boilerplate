<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useHead } from '@unhead/vue'
import { PropellerProvider } from '@propeller-commerce/propeller-v2-vue-ui'
import { useAuthStore } from '@/stores/auth'
import { useLanguageStore } from '@/stores/language'
import { usePriceStore } from '@/stores/price'
import { useCompanyStore } from '@/stores/company'

// Tier 2 — bind the per-scope state to the routed tree. Tier 1 (graphqlClient,
// services, currency, configuration) is installed by app.use(propellerVue, …)
// in app.ts. <PropellerProvider> reads each prop reactively, so Pinia store
// updates (login, language switch, VAT toggle) propagate to package
// components without a re-render of this root.
const auth = useAuthStore()
const language = useLanguageStore()
const price = usePriceStore()
const company = useCompanyStore()

// Document-level head defaults. `htmlAttrs.lang` tracks the active language so
// the SSR <html lang> reflects the rendered locale; per-page <title>/<meta>
// are layered on top by the catalog views via their own useHead() calls.
useHead({
  htmlAttrs: { lang: computed(() => language.language.toLowerCase()) },
})

// Force a fresh view mount whenever the active company changes. The catalog
// views (CategoryView / SearchView / ClusterDetailView / ProductDetailView)
// run their SSR-style `services.*` fetches in `<script setup>`, which is
// re-executed on remount. The company store has already mirrored the new
// selection into the `selected_company_id` cookie, so the next fetch reads
// it via `lib/server.ts:getServerInfra()` and scopes results to the new
// company. Without this the seeded server data sticks around forever after
// a company switch (the controlled `:products` prop on `<ProductGrid>` is
// only released by URL-bound interaction handlers).
const viewKey = ref(0)
watch(
  () => company.companyId,
  () => {
    viewKey.value++
  },
)
</script>

<template>
  <PropellerProvider
    :user="auth.user ?? null"
    :company-id="company.companyId ?? undefined"
    :language="language.language"
    :include-tax="price.includeTax"
    portal-mode="open"
  >
    <router-view :key="viewKey" />
  </PropellerProvider>
</template>
