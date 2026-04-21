<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-3xl font-bold tracking-tight">Quote History</h1>
    </div>
    <div class="bg-card shadow-sm">
      <OrderList
        v-if="authStore.isAuthenticated"
        :graphqlClient="graphqlClient"
        :user="authStore.user"
        :companyId="companyStore.companyId ?? undefined"
        :showCompanyOrders="false"
        :onOrderClick="(id) => router.push(localizeHref(`/account/quotes/${id}`, languageStore.language))"
        :orderStatus="['QUOTATION']"
        :labels="labels"
        :rowsClickable="true"
        :searchFields="['term', 'createdAt', 'price']"
        :columnConfig="{ id: '#', date: 'Datum', status: 'Status', validUntil: 'Geldig tot', total: 'Totaal' }"
        :columns="['id', 'date', 'status', 'validUntil', 'total']"
        :enableSearch="true"
        :channelIds="[channelId]"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useLanguageStore } from '@/stores/language'
import { useCompanyStore } from '@/stores/company'
import { graphqlClient } from '@/lib/api'
import { channelId, localizeHref } from '@/lib/config'
import OrderList from '@/components/propeller/OrderList.vue'

const router = useRouter()
const authStore = useAuthStore()
const languageStore = useLanguageStore()
const companyStore = useCompanyStore()

const labels = {
  view: 'Weergave',
  previous: 'Vorige',
  next: 'Volgende',
  showingPage: 'Pagina',
  of: 'van',
  noOrders: 'Geen offertes',
  loading: 'Laden',
  order: 'Order',
  date: 'Datum',
  status: 'Status',
  total: 'Totaal',
  action: 'Actie',
}
</script>
