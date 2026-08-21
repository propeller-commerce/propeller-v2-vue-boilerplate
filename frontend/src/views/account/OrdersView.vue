<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-3xl font-bold tracking-tight">{{ t.ordersTitle }}</h1>
    </div>
    <div class="bg-card shadow-sm">
      <OrderList
        v-if="authStore.isAuthenticated"
        :showCompanyOrders="false"
        :onOrderClick="(id) => router.push(localizeHref(`/account/orders/${id}`, languageStore.language))"
        :labels="labels"
        :statusLabels="orderStatusLabels"
        :rowsClickable="true"
        :searchFields="['term', 'createdAt', 'price']"
        :columnConfig="{ id: '#', date: t.colDate, status: t.colStatus, total: t.colTotal }"
        :columns="['id', 'date', 'status', 'total']"
        :enableSearch="true"
        :channelIds="[channelId]"
        :initialSearchForm="initialSearchForm"
        :onSearchApply="persistFilters"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
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

// Seed filters from the URL and write them back on change (shareable view).
const initialSearchForm = orderFilterFromQuery(route.query)
function persistFilters(form: OrderFilterForm) {
  router.replace({ query: orderFilterToQuery(form) })
}
</script>
