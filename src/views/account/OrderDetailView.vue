<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-4">
        <button @click="router.back()" class="text-sm text-primary hover:underline">← Back</button>
        <h1 class="text-3xl font-bold tracking-tight">Order Details</h1>
      </div>
    </div>

    <div v-if="loading" class="p-8 text-center">
      <div class="h-8 bg-slate-100 rounded w-1/3 mx-auto mb-4 animate-pulse"></div>
      <div class="h-4 bg-slate-100 rounded w-1/2 mx-auto animate-pulse"></div>
    </div>

    <div v-else-if="error" class="p-8 text-center border rounded-lg">
      <p class="text-destructive mb-4">{{ error }}</p>
      <button @click="router.push(localizeHref('/account/orders', languageStore.language))" class="text-primary hover:underline">Return to Orders</button>
    </div>

    <div v-else-if="order" class="space-y-8">
      <!-- Order Summary + Actions -->
      <div class="border rounded-lg p-6 space-y-4">
        <OrderSummary 
          :order="order as Order" 
          :countries="COUNTRIES" 
          :includeTax="priceStore.includeTax" 
          :language="languageStore.language" 
          :showReference="true"
          :showNotes="true"
          :showDeliveryAddress="true"
          :showInvoiceAddress="true"
          :showOrderNumber="true"
          :showOrderDate="true"
          :showOrderStatus="true"
          :showOrderTotal="true"
          :showDeliveryInfo="true"
          :showRemarks="true"
        />
        <OrderActions
          :graphqlClient="graphqlClient"
          :order="order as Order"
          :user="authStore.user as Contact | Customer"
          :cartId="cartStore.cartId || undefined"
          :companyId="companyStore.companyId ?? undefined"
          :configuration="configuration"
          :onCartCreated="(cart: Cart) => cartStore.setCart(cart)"
          :afterReorder="(cart: Cart) => cartStore.setCart(cart)"
        />
      </div>

      <!-- Shipments -->
      <OrderShipments :order="order" />

      <!-- Order Overview -->
      <div class="pt-10">
        <h2 class="text-2xl font-bold mb-6">Order Overview</h2>

        <!-- Parent/child product items -->
        <div v-if="parentItems.length > 0" class="bg-white rounded-lg shadow overflow-hidden mb-8">
          <table class="w-full">
            <thead class="bg-gray-50 border-b">
              <tr>
                <th class="px-6 py-4 text-left text-sm font-medium text-gray-500 w-2/3">Product</th>
                <th class="px-6 py-4 text-center text-sm font-medium text-gray-500">Quantity</th>
                <th class="px-6 py-4 text-right text-sm font-medium text-gray-500">Price</th>
              </tr>
            </thead>
            <tbody>
              <OrderItemCard
                v-for="item in parentItems"
                :key="item.id"
                :orderItem="item"
                :childItems="childMap.get(item.id) || []"
                :titleLinkable="true"
                :showImage="true"
                :showSku="true"
                :showQuantity="true"
                :showPrice="true"
              />
            </tbody>
          </table>
        </div>

        <!-- Bonus Items -->
        <div v-if="bonusItems.length > 0" class="mb-8">
          <h3 class="text-lg font-bold mb-3 text-gray-800">Bonus Items</h3>
          <div class="bg-white rounded-lg shadow overflow-hidden">
            <table class="w-full">
              <thead class="bg-gray-50 border-b">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                </tr>
              </thead>
              <tbody>
                <OrderItemCard 
                  v-for="item in bonusItems" 
                  :key="item.id" 
                  :orderItem="item" 
                  :titleLinkable="false" 
                  :showImage="true"
                  :showSku="true"
                  :showQuantity="true"
                  :showPrice="true"
                />
              </tbody>
            </table>
          </div>
        </div>

        <!-- Surcharges -->
        <div v-if="surchargeItems.length > 0" class="mb-8">
          <h3 class="text-lg font-bold mb-3 text-gray-800">Surcharges</h3>
          <div class="bg-white rounded-lg shadow overflow-hidden">
            <table class="w-full">
              <tbody>
                <OrderItemCard 
                  v-for="item in surchargeItems" 
                  :key="item.id" 
                  :orderItem="item" 
                  :titleLinkable="false" 
                  :showImage="false" 
                  :showSku="false" 
                  :showQuantity="true"
                  :showPrice="true"
                />
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Bottom Actions + Totals -->
      <div class="flex flex-col md:flex-row justify-between gap-8 pt-6 border-t">
        <OrderActions
          :graphqlClient="graphqlClient"
          :order="order"
          :user="authStore.user as Contact | Customer"
          :cartId="cartStore.cartId || undefined"
          :companyId="companyStore.companyId ?? undefined"
          :configuration="configuration"
          :onCartCreated="(cart: any) => cartStore.setCart(cart)"
          :afterReorder="(cart: any) => cartStore.setCart(cart)"
        />
        <OrderTotals 
          :order="order as Order" 
          :includeTax="priceStore.includeTax"
          :showSubtotal="true"
          :showDiscount="true"
          :showShippingCosts="true"
          :showVATs="true"
          :showTotalExclVat="true"
          :showTotalVat="true"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, markRaw } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { useCompanyStore } from '@/stores/company'
import { usePriceStore } from '@/stores/price'
import { useLanguageStore } from '@/stores/language'
import { graphqlClient } from '@/lib/api'
import { configuration, localizeHref } from '@/lib/config'
import { Cart, Contact, Customer, Order, OrderService } from 'propeller-sdk-v2'
import OrderSummary from '@/components/propeller/OrderSummary.vue'
import OrderItemCard from '@/components/propeller/OrderItemCard.vue'
import OrderActions from '@/components/propeller/OrderActions.vue'
import OrderShipments from '@/components/propeller/OrderShipments.vue'
import OrderTotals from '@/components/propeller/OrderTotals.vue'

const COUNTRIES = [
  { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'UK', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
]

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const cartStore = useCartStore()
const companyStore = useCompanyStore()
const priceStore = usePriceStore()
const languageStore = useLanguageStore()

const order = ref<any>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const parentItems = computed(() => {
  const allProducts = (order.value?.items || []).filter((i: any) => i.class === 'product' && i.isBonus === 'N')
  return allProducts.filter((i: any) => !i.parentOrderItemId)
})

const childMap = computed(() => {
  const allProducts = (order.value?.items || []).filter((i: any) => i.class === 'product' && i.isBonus === 'N')
  const map = new Map<number, any[]>()
  allProducts.filter((i: any) => i.parentOrderItemId).forEach((i: any) => {
    const children = map.get(i.parentOrderItemId) || []
    children.push(i)
    map.set(i.parentOrderItemId, children)
  })
  return map
})

const bonusItems = computed(() =>
  (order.value?.items || []).filter((i: any) => i.class === 'product' && i.isBonus === 'Y')
)

const surchargeItems = computed(() =>
  (order.value?.items || []).filter((i: any) => i.class === 'surcharge')
)

onMounted(async () => {
  try {
    const service = new OrderService(graphqlClient)
    const result = await service.getOrder({
      orderId: parseInt(route.params.id as string),
      language: languageStore.language,
      imageSearchFilters: configuration.imageSearchFiltersGrid,
      imageVariantFilters: configuration.imageVariantFiltersSmall,
    })
    if (!result) { error.value = 'Order not found'; return }
    order.value = markRaw(result)
  } catch (e) {
    console.error('Failed to load order', e)
    error.value = 'Failed to load order details'
  } finally {
    loading.value = false
  }
})
</script>
