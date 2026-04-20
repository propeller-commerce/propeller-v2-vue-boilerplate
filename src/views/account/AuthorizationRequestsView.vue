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
        cancel: 'Cancel',
        acceptRequest: 'Accept request',
        accepting: 'Accepting...',
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
import { graphqlClient } from '@/lib/api'
import { configuration } from '@/lib/config'
import PurchaseAuthorizationRequests from '@/components/propeller/PurchaseAuthorizationRequests.vue'

const router = useRouter()
const authStore = useAuthStore()
const cartStore = useCartStore()
const companyStore = useCompanyStore()

function isContact(u: Contact | Customer | null): u is Contact {
  return u !== null && 'contactId' in u
}

function handleAfterAccept(acceptedCart: Cart) {
  if (cartStore.cart) {
    localStorage.setItem('manager_cart', JSON.stringify(cartStore.cart))
  }
  cartStore.setCart(acceptedCart)
  router.push('/cart')
}
</script>
