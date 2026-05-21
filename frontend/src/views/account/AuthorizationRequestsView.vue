<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-3xl font-bold tracking-tight">Authorization Requests</h1>
    </div>
    <PurchaseAuthorizationRequests
      v-if="authStore.user && isContact(authStore.user) && companyStore.companyId"
      :graphqlClient="graphqlClient"
      :user="authStore.user"
      :companyId="companyStore.companyId"
      :configuration="configuration"
      :language="languageStore.language"
      :afterAcceptRequest="handleAfterAccept"
      :labels="{
        title: 'Authorization Requests',
        colId: '#',
        colDate: 'Date',
        colQuantity: 'Quantity',
        colTotal: 'Total',
        colRequestedBy: 'Requested by',
        colActions: 'Actions',
        view: 'View',
        modalTitle: 'Authorization Request',
        requesterInfo: 'Requester',
        itemsTitle: 'Items',
        itemProduct: 'Product',
        itemQty: 'Qty',
        itemUnitPrice: 'Unit price',
        itemTotal: 'Total',
        totalExclVat: 'Total excl. VAT:',
        totalVat: 'VAT:',
        total: 'Total:',
        acceptRequest: 'Accept request',
        accepting: 'Accepting...',
        delete: 'Delete',
        deleting: 'Deleting...',
        deleteConfirmTitle: 'Delete authorization request?',
        deleteConfirmBody: 'Are you sure you want to delete this authorization request? The cart will be permanently removed.',
        deleteConfirmYes: 'Yes, delete',
        deleteConfirmNo: 'No',
        empty: 'No pending authorization requests',
      }"
    />
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Contact, Customer, Cart } from 'propeller-sdk-v2'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { useCompanyStore } from '@/stores/company'
import { useLanguageStore } from '@/stores/language'
import { graphqlClient } from '@/lib/api'
import { configuration, localizeHref } from '@/lib/config'
import { PurchaseAuthorizationRequests } from 'propeller-v2-vue-ui';

const router = useRouter()
const authStore = useAuthStore()
const cartStore = useCartStore()
const companyStore = useCompanyStore()
const languageStore = useLanguageStore()

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
