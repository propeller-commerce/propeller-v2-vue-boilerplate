<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-3xl font-bold tracking-tight">{{ t.dashboardTitle }}</h1>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section class="rounded-lg border border-border bg-card p-5">
        <div class="flex items-center justify-between gap-4 mb-4">
          <h2 class="text-base font-semibold">{{ t.openQuotesTitle }}</h2>
          <RouterLink
            :to="localizeHref('/account/quotes', languageStore.language)"
            class="text-sm text-secondary hover:underline shrink-0"
          >
            {{ t.viewAll }}
          </RouterLink>
        </div>
        <OrderList
          v-if="authStore.isAuthenticated"
          :showCompanyOrders="false"
          :orderStatus="['QUOTATION']"
          :columns="['id', 'validUntil', 'total']"
          :columnConfig="{ id: '#', validUntil: t.colValidUntil, total: t.colTotal }"
          :initialItemsPerPage="DASHBOARD_LIMIT"
          :hidePagination="true"
          :flat="true"
          :hideHeader="true"
          :enableSearch="false"
          :rowsClickable="true"
          :channelIds="[channelId]"
          :onOrderClick="(id) => router.push(localizeHref(`/account/quotes/${id}`, languageStore.language))"
          :labels="quoteLabels"
          :statusLabels="orderStatusLabels"
        />
      </section>

      <section class="rounded-lg border border-border bg-card p-5">
        <div class="flex items-center justify-between gap-4 mb-4">
          <h2 class="text-base font-semibold">{{ t.latestOrdersTitle }}</h2>
          <RouterLink
            :to="localizeHref('/account/orders', languageStore.language)"
            class="text-sm text-secondary hover:underline shrink-0"
          >
            {{ t.viewAll }}
          </RouterLink>
        </div>
        <OrderList
          v-if="authStore.isAuthenticated"
          :showCompanyOrders="false"
          :columns="['id', 'status', 'total']"
          :columnConfig="{ id: '#', status: t.colStatus, total: t.colTotal }"
          :initialItemsPerPage="DASHBOARD_LIMIT"
          :hidePagination="true"
          :flat="true"
          :hideHeader="true"
          :enableSearch="false"
          :rowsClickable="true"
          :channelIds="[channelId]"
          :onOrderClick="(id) => router.push(localizeHref(`/account/orders/${id}`, languageStore.language))"
          :labels="orderListLabels"
          :statusLabels="orderStatusLabels"
        />
      </section>

      <section class="rounded-lg border border-border bg-card p-5">
        <div class="flex items-center justify-between gap-4 mb-4">
          <h2 class="text-base font-semibold">{{ t.favoritesTitle }}</h2>
          <RouterLink
            :to="localizeHref('/account/favorites', languageStore.language)"
            class="text-sm text-secondary hover:underline shrink-0"
          >
            {{ t.viewAll }}
          </RouterLink>
        </div>
        <FavoriteLists
          v-if="authStore.user"
          :limit="DASHBOARD_LIMIT"
          :showActions="false"
          :allowFavoriteListCreate="false"
          :onListClick="(id: string | number) => router.push(localizeHref(`/account/favorites/${id}`, languageStore.language))"
          :labels="favoriteListsLabels"
        />
      </section>

      <section
        v-if="isAuthManager"
        class="rounded-lg border border-border bg-card p-5"
      >
        <div class="flex items-center justify-between gap-4 mb-4">
          <h2 class="text-base font-semibold">{{ t.authorizationRequestsTitle }}</h2>
          <RouterLink
            :to="localizeHref('/account/authorization-requests', languageStore.language)"
            class="text-sm text-secondary hover:underline shrink-0"
          >
            {{ t.viewAll }}
          </RouterLink>
        </div>
        <PurchaseAuthorizationRequests
          :limit="DASHBOARD_LIMIT"
          :columns="['date', 'requestedBy', 'total']"
          :showActions="false"
          :flat="true"
          :hideHeader="true"
          :hideTitle="true"
          :labels="purchaseAuthorizationRequestsLabels"
        />
      </section>
    </div>

    <UserDetails
      v-if="authStore.user"
      :labels="userDetailsLabels"
      :activeCompany="companyStore.selectedCompany as Company"
      :showCompanyInfo="true"
      :listAllContactCompanies="false"
      :showDefaultInvoiceAddress="true"
      :showDefaultDeliveryAddress="true"
      :countries="getCountries(languageStore.language)"
      :onUserUpdated="(user: any) => authStore.setUser(user)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useLanguageStore } from '@/stores/language'
import { useCompanyStore } from '@/stores/company'
import {
  UserDetails,
  OrderList,
  FavoriteLists,
  PurchaseAuthorizationRequests,
} from '@propeller-commerce/propeller-v2-vue-ui';
import type { Company } from '@propeller-commerce/propeller-sdk-v2'
import { getCountries } from "@/composables/shared/utils/countries";
import { useTranslations } from '@/lib/i18n/composable';
import { channelId, localizeHref } from '@/lib/config'

const DASHBOARD_LIMIT = 3

const router = useRouter()
const authStore = useAuthStore()
const languageStore = useLanguageStore()
const companyStore = useCompanyStore()
const userDetailsLabels = useTranslations('UserDetails')
const orderListLabels = useTranslations('OrderList')
const orderStatusLabels = useTranslations('OrderStatus')
const favoriteListsLabels = useTranslations('FavoriteLists')
const purchaseAuthorizationRequestsLabels = useTranslations('PurchaseAuthorizationRequests')
const t = useTranslations('Account')

// The quotes card reuses OrderList, whose empty state says "no orders found".
const quoteLabels = computed(() => ({ ...orderListLabels.value, noOrders: t.value.noQuotes }))

const isAuthManager = computed(() =>
  authStore.isAuthManagerForCompany(authStore.user, companyStore.companyId)
)
</script>
