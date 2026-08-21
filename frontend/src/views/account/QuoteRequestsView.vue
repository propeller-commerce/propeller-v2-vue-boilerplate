<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-3xl font-bold tracking-tight">{{ t.quoteRequestsTitle }}</h1>
    </div>
    <div class="bg-card shadow-sm">
      <OrderList
        v-if="authStore.isAuthenticated"
        :showCompanyOrders="false"
        :onOrderClick="(id) => router.push(localizeHref(`/account/quote-requests/${id}`, languageStore.language))"
        :orderStatus="['REQUEST']"
        :labels="quoteLabels"
        :statusLabels="orderStatusLabels"
        :rowsClickable="true"
        :columnConfig="{ id: '#', date: t.colDate, status: t.colStatus, total: t.colTotal }"
        :columns="['id', 'date', 'status', 'total']"
        :channelIds="[channelId]"
        :searchFields="['term', 'createdAt', 'price']"
        :enableSearch="true"
        :initialSearchForm="initialSearchForm"
        :onSearchApply="persistFilters"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useLanguageStore } from '@/stores/language'
import { useCompanyStore } from '@/stores/company'
import { graphqlClient } from '@/lib/api'
import { channelId, localizeHref } from '@/lib/config'
import { useTranslations } from '@/lib/i18n/composable'
import { orderFilterFromQuery, orderFilterToQuery, type OrderFilterForm } from '@/lib/orderFilters'
import { OrderList } from '@propeller-commerce/propeller-v2-vue-ui';

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const languageStore = useLanguageStore()
const companyStore = useCompanyStore()

const labels = useTranslations('OrderList')
const orderStatusLabels = useTranslations('OrderStatus')
const t = useTranslations('Account')

// Quote-request history, not order history — override the empty-state string.
const quoteLabels = computed(() => ({ ...labels.value, noOrders: t.value.noQuotes }))

// Seed filters from the URL and write them back on change (shareable view).
const initialSearchForm = orderFilterFromQuery(route.query)
function persistFilters(form: OrderFilterForm) {
  router.replace({ query: orderFilterToQuery(form) })
}
</script>
