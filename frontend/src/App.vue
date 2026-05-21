<script setup lang="ts">
import { reactive } from 'vue'
import { providePropeller, type PropellerInfra } from 'propeller-v2-vue-ui'
import { graphqlClient, services } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useLanguageStore } from '@/stores/language'
import { usePriceStore } from '@/stores/price'
import { useCompanyStore } from '@/stores/company'
import { configuration } from '@/lib/config'

// Wire the host's Pinia stores into the Propeller provider. The infra object
// is `reactive` with getters, so package components and composables see live
// store updates (login, language switch, VAT toggle) without a re-provide.
const auth = useAuthStore()
const language = useLanguageStore()
const price = usePriceStore()
const company = useCompanyStore()

const infra = reactive({
  graphqlClient,
  services,
  get user() {
    return auth.user ?? null
  },
  get companyId() {
    return company.companyId ?? undefined
  },
  get language() {
    return language.language
  },
  get includeTax() {
    return price.includeTax
  },
  currency: '€',
  configuration,
  portalMode: 'open',
}) as unknown as PropellerInfra

providePropeller(infra)
</script>

<template>
  <router-view />
</template>
