<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-4">
        <button @click="router.back()" class="text-sm text-primary hover:underline">← Back</button>
        <h1 class="text-3xl font-bold tracking-tight">Quote Details</h1>
      </div>
    </div>

    <div v-if="loading" class="p-8 text-center">
      <div class="h-8 bg-slate-100 rounded w-1/3 mx-auto mb-4 animate-pulse"></div>
      <div class="h-4 bg-slate-100 rounded w-1/2 mx-auto animate-pulse"></div>
    </div>

    <div v-else-if="error" class="p-8 text-center border rounded-lg">
      <p class="text-destructive mb-4">{{ error }}</p>
      <button @click="router.push(localizeHref('/account/quotes', languageStore.language))" class="text-primary hover:underline">Return to Quotes</button>
    </div>

    <div v-else-if="quote" class="space-y-8">
      <!-- Quote Summary + Actions -->
      <div class="border rounded-lg p-6 space-y-4">
        <OrderSummary
          :order="quote"
          :countries="COUNTRIES"
          :labels="{ orderNumber: 'Quote Number', orderDate: 'Quote Date' }"
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
        <div class="flex flex-row items-end gap-3 flex-shrink-0 mt-4">
          <QuoteActions
            :graphqlClient="graphqlClient"
            :quote="quote as Order"
            :afterAccept="handleAfterAccept"
            :showTermsAndConditions="true"
            :onTermsAndConditionsClick="() => window.open('/terms-conditions', '_blank')"
          />
          <button type="button" class="text-sm text-primary hover:underline px-2 py-1" @click="handleDownloadPDF">
            Download Quote (PDF)
          </button>
        </div>
      </div>

      <!-- Quote Overview -->
      <div class="pt-10">
        <h2 class="text-2xl font-bold mb-6 mt-6">Quote Overview</h2>

        <!-- Parent/child product items -->
        <div v-if="parentItems.length > 0" class="bg-white rounded-lg shadow overflow-hidden mb-8">
          <table class="w-full">
            <thead class="bg-gray-50 border-b">
              <tr>
                <th class="px-6 py-4 text-left text-sm font-medium text-gray-500">Products</th>
                <th class="px-6 py-4 text-center text-sm font-medium text-gray-500">Quantity</th>
                <th class="px-6 py-4 text-right text-sm font-medium text-gray-500">Discount</th>
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
                <OrderItemCard v-for="item in surchargeItems" :key="item.id" :orderItem="item" :titleLinkable="false" :showImage="false" :showSku="false" />
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Totals -->
      <div class="flex flex-col md:flex-row justify-end gap-8 pt-6 border-t">
        <OrderTotals :order="quote" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, markRaw } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePriceStore } from '@/stores/price'
import { useLanguageStore } from '@/stores/language'
import { graphqlClient } from '@/lib/api'
import { configuration, localizeHref } from '@/lib/config'
import { Base64File, Order, OrderService } from 'propeller-sdk-v2'
import OrderSummary from '@/components/propeller/OrderSummary.vue'
import OrderItemCard from '@/components/propeller/OrderItemCard.vue'
import QuoteActions from '@/components/propeller/QuoteActions.vue'
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
const priceStore = usePriceStore()
const languageStore = useLanguageStore()

const quoteId = route.params.id as string

const quote = ref<any>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const parentItems = computed(() => {
  const allProducts = (quote.value?.items || []).filter((i: any) => i.class === 'product' && i.isBonus === 'N')
  return allProducts.filter((i: any) => !i.parentOrderItemId)
})

const childMap = computed(() => {
  const allProducts = (quote.value?.items || []).filter((i: any) => i.class === 'product' && i.isBonus === 'N')
  const map = new Map<number, any[]>()
  allProducts.filter((i: any) => i.parentOrderItemId).forEach((i: any) => {
    const children = map.get(i.parentOrderItemId) || []
    children.push(i)
    map.set(i.parentOrderItemId, children)
  })
  return map
})

const bonusItems = computed(() =>
  (quote.value?.items || []).filter((i: any) => i.class === 'product' && i.isBonus === 'Y')
)

const surchargeItems = computed(() =>
  (quote.value?.items || []).filter((i: any) => i.class === 'surcharge')
)

function handleAfterAccept(acceptedQuote: any) {
  router.push(localizeHref(`/checkout/thank-you/${acceptedQuote.id}`, languageStore.language))
}

async function handleDownloadPDF() {
  try {
    const service = new OrderService(graphqlClient)
    const pdfResponse = await service.getQuotePDF(Number(quoteId))
    if (!pdfResponse) { alert('Failed to download PDF: No response'); return }

    let byteArray: Uint8Array
    let fileName = `quote-${quoteId}.pdf`
    let contentType = 'application/pdf'

    if (typeof pdfResponse === 'object' && (pdfResponse as Base64File).base64) {
      const pdf = pdfResponse as Base64File
      const chars = atob(pdf.base64)
      byteArray = new Uint8Array(chars.length)
      for (let i = 0; i < chars.length; i++) byteArray[i] = chars.charCodeAt(i)
      if (pdf.fileName) fileName = pdf.fileName
      if (pdf.contentType) contentType = pdf.contentType
    } else if (typeof pdfResponse === 'string') {
      const chars = atob(pdfResponse)
      byteArray = new Uint8Array(chars.length)
      for (let i = 0; i < chars.length; i++) byteArray[i] = chars.charCodeAt(i)
    } else {
      alert('Failed to download PDF: Invalid response'); return
    }

    const blob = new Blob([byteArray], { type: contentType })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  } catch (e) {
    console.error('Error downloading PDF:', e)
    alert('Failed to download PDF. Please try again.')
  }
}

onMounted(async () => {
  try {
    const service = new OrderService(graphqlClient)
    const result = await service.getOrder({
      orderId: parseInt(quoteId),
      language: languageStore.language,
      imageSearchFilters: configuration.imageSearchFiltersGrid,
      imageVariantFilters: configuration.imageVariantFiltersSmall,
    })
    if (!result) { error.value = 'Quote not found'; return }
    quote.value = markRaw(result)
  } catch (e) {
    console.error('Failed to load quote', e)
    error.value = 'Failed to load quote details'
  } finally {
    loading.value = false
  }
})
</script>
