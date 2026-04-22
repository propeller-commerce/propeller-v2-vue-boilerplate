<template>
  <div class="space-y-6">
    <div class="flex items-center gap-4">
      <button @click="router.back()" class="text-primary hover:underline text-sm">← Back to Favorites</button>
      <h1 class="text-3xl font-bold tracking-tight">{{ listName || 'Loading...' }}</h1>
    </div>
    <FavoriteListDetails
      v-if="authStore.user"
      :graphqlClient="graphqlClient"
      :user="authStore.user as Contact | Customer"
      :favoriteListId="String(route.params.id)"
      :onListLoaded="(list: any) => { listName = list?.name || '' }"
      :onItemDelete="handleItemDelete"
      :configuration="configuration"
      :cartId="cartStore.cartId || undefined"
      :createCart="true"
      :onCartCreated="(cart: any) => cartStore.setCart(cart)"
      :afterAddToCart="(cart: any) => cartStore.setCart(cart)"
      :itemsPerPage="12"
      :showPagination="true"
      :showStockComponent="true"
      :showAvailability="false"
      :showStock="true"
      :includeTax="priceStore.includeTax"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { usePriceStore } from '@/stores/price'
import { graphqlClient } from '@/lib/api'
import { configuration } from '@/lib/config'
import { useFavorites } from '@/composables/useFavorites'
import type { AnyUser } from '@/composables/shared/utils/userIdentity'
import FavoriteListDetails from '@/components/propeller/FavoriteListDetails.vue'
import type { Contact, Customer } from 'propeller-sdk-v2'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const cartStore = useCartStore()
const priceStore = usePriceStore()

const listName = ref('')

const { removeFromList } = useFavorites({
  graphqlClient,
  user: computed(() => authStore.user as AnyUser),
})

async function handleItemDelete(itemId: string, itemType?: string) {
  const listId = String(route.params.id)
  const numericId = Number(itemId)
  if (itemType === 'cluster') {
    await removeFromList(listId, undefined, numericId)
  } else {
    await removeFromList(listId, numericId, undefined)
  }
  await authStore.refreshUser()
}
</script>
