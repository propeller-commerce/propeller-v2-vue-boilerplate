<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-3xl font-bold tracking-tight">Order History</h1>
    </div>
    <div class="bg-card shadow-sm">
      <OrderList
        v-if="authStore.isAuthenticated"
        :showCompanyOrders="false"
        :onOrderClick="(id) => router.push(localizeHref(`/account/orders/${id}`, languageStore.language))"
        :labels="labels"
        :rowsClickable="true"
        :searchFields="['term', 'createdAt', 'price']"
        :columnConfig="{ id: '#', date: 'Datum', status: 'Status', total: 'Totaal' }"
        :columns="['id', 'date', 'status', 'total']"
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
import { useTranslations } from '@/lib/i18n/composable'
import { OrderList } from '@propeller-commerce/propeller-v2-vue-ui';

const router = useRouter()
const authStore = useAuthStore()
const languageStore = useLanguageStore()
const companyStore = useCompanyStore()

const labels = useTranslations('OrderList')
</script>
