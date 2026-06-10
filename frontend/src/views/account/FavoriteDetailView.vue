<template>
  <div class="space-y-6">
    <div class="flex items-center gap-4">
      <button @click="router.back()" class="text-primary hover:underline text-sm">← Back to Favorites</button>
      <h1 class="text-3xl font-bold tracking-tight">{{ listName || 'Loading...' }}</h1>
    </div>
    <FavoriteListDetails
      v-if="authStore.user"
      :labels="favoriteListDetailsLabels"
      :favoriteListId="String(route.params.id)"
      :onListLoaded="(list: any) => { listName = list?.name || '' }"
      :onItemDelete="handleItemDelete"
      :onItemsDelete="handleItemsDelete"
      :onItemAdded="() => authStore.refreshUser()"
      :cartId="cartStore.cartId || undefined"
      :createCart="true"
      :onCartCreated="(cart: any) => cartStore.setCart(cart)"
      :afterAddToCart="(cart: any) => cartStore.setCart(cart)"
      :itemsPerPage="12"
      :showPagination="true"
      :showStockComponent="true"
      :showAvailability="false"
      :showStock="true"
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
import { useFavorites } from '@propeller-commerce/propeller-v2-vue-ui'
import type { AnyUser } from '@propeller-commerce/propeller-v2-vue-ui'
import { FavoriteListDetails } from '@propeller-commerce/propeller-v2-vue-ui';
import type { Contact, Customer } from '@propeller-commerce/propeller-sdk-v2'
import { useTranslations } from '@/lib/i18n/composable';

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const cartStore = useCartStore()
const priceStore = usePriceStore()
const favoriteListDetailsLabels = useTranslations('FavoriteListDetails')

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

async function handleItemsDelete(items: { id: string; type: 'product' | 'cluster' }[]) {
  if (items.length === 0) return
  const listId = String(route.params.id)
  const productIds = items.filter((i) => i.type === 'product').map((i) => Number(i.id))
  const clusterIds = items.filter((i) => i.type === 'cluster').map((i) => Number(i.id))
  await removeFromList(
    listId,
    productIds.length ? productIds : undefined,
    clusterIds.length ? clusterIds : undefined,
  )
  await authStore.refreshUser()
}
</script>
