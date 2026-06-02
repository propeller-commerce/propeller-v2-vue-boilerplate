<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-3xl font-bold tracking-tight">Quote Requests</h1>
    </div>
    <div class="bg-card shadow-sm">
      <OrderList
        v-if="authStore.isAuthenticated"
        :showCompanyOrders="false"
        :onOrderClick="(id) => router.push(localizeHref(`/account/quote-requests/${id}`, languageStore.language))"
        :orderStatus="['REQUEST']"
        :labels="labels"
        :rowsClickable="true"
        :columnConfig="{ id: '#', date: 'Datum', status: 'Status', total: 'Totaal' }"
        :columns="['id', 'date', 'status', 'total']"
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
import { OrderList } from 'propeller-v2-vue-ui';

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
