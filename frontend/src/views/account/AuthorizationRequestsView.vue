<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-3xl font-bold tracking-tight">Authorization Requests</h1>
    </div>
    <PurchaseAuthorizationRequests
      v-if="authStore.user && isContact(authStore.user) && companyStore.companyId"
      :afterAcceptRequest="handleAfterAccept"
      :labels="purchaseAuthorizationRequestsLabels"
    />
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Contact, Customer, Cart } from '@propeller-commerce/propeller-sdk-v2'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { useCompanyStore } from '@/stores/company'
import { useLanguageStore } from '@/stores/language'
import { graphqlClient } from '@/lib/api'
import { configuration, localizeHref } from '@/lib/config'
import { useTranslations } from '@/lib/i18n/composable'
import { PurchaseAuthorizationRequests } from 'propeller-v2-vue-ui';

const router = useRouter()
const authStore = useAuthStore()
const cartStore = useCartStore()
const companyStore = useCompanyStore()
const languageStore = useLanguageStore()
const purchaseAuthorizationRequestsLabels = useTranslations('PurchaseAuthorizationRequests')

function isContact(u: Contact | Customer | null): u is Contact {
  return u !== null && 'contactId' in u
}

function handleAfterAccept(acceptedCart: Cart) {
  if (cartStore.cart) {
    localStorage.setItem('manager_cart', JSON.stringify(cartStore.cart))
  }
  cartStore.setCart(acceptedCart)
  router.push(localizeHref('/cart', languageStore.language))
}
</script>
