<template>
  <div class="min-h-[70vh] py-8 bg-muted/20">
    <div class="container-width max-w-7xl">
      <h1 class="text-3xl font-bold mb-8">{{ isQuoteMode ? 'Quote Request' : 'Checkout' }}</h1>

      <!-- Step indicator -->
      <div class="flex justify-between max-w-2xl mb-8 px-2">
        <template v-for="(label, i) in stepLabels" :key="label">
          <div v-if="i > 0" class="flex-1 border-t-2 border-dashed border-muted mx-4 mt-4" />
          <div :class="['flex items-center gap-2', currentStep === i + 1 ? 'text-primary font-bold' : currentStep > i + 1 ? 'text-secondary' : 'text-muted-foreground']">
            <div :class="['w-8 h-8 rounded-full flex items-center justify-center border-2 text-sm', currentStep === i + 1 ? 'border-primary bg-primary text-white' : currentStep > i + 1 ? 'border-secondary bg-secondary/10 text-secondary' : 'border-muted-foreground/30']">
              <svg v-if="currentStep > i + 1" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <span v-else>{{ i + 1 }}</span>
            </div>
            <span class="hidden md:inline">{{ label }}</span>
          </div>
        </template>
      </div>

      <div class="flex flex-col lg:flex-row gap-8">
        <div class="lg:w-2/3 space-y-6">
          <div v-if="error" class="bg-destructive/10 border border-destructive/20 p-4 rounded-md text-destructive text-sm font-medium">
            {{ error }}
          </div>

          <!-- Step 1: Invoice Address -->
          <div :class="['bg-white rounded-lg shadow border', currentStep === 1 ? 'ring-2 ring-primary border-primary' : 'opacity-80']">
            <div
              class="p-6 cursor-pointer"
              @click="currentStep > 1 && (currentStep = 1)"
            >
              <div class="flex items-center justify-between">
                <h2 class="text-lg font-semibold">1. Invoice Address</h2>
                <span v-if="currentStep > 1 && cart?.invoiceAddress?.street" class="text-sm text-muted-foreground border border-muted rounded px-2 py-0.5">
                  {{ cart.invoiceAddress.street }} {{ cart.invoiceAddress.number }}, {{ cart.invoiceAddress.city }}
                </span>
              </div>
            </div>
            <div v-if="currentStep === 1" class="px-6 pb-6 space-y-4">
              <AddressCard
                v-if="cart?.invoiceAddress?.street"
                :address="cart.invoiceAddress"
                :showEmail="true"
                :enableDelete="false"
                :enableSetDefault="false"
                :onEdit="(addr) => handleAddressSubmit(addr, 'INVOICE', false)"
                :countries="COUNTRIES"
              />
              <template v-else>
                <AddressCard
                  :address="null"
                  :inline="true"
                  :isNew="true"
                  addressType="INVOICE"
                  :showIcp="false"
                  :beforeSave="() => { loading = true; error = null }"
                  :onEdit="(addr) => handleAddressSubmit(addr, 'INVOICE')"
                  :countries="COUNTRIES"
                />
                <label v-if="!authStore.isAuthenticated" class="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    v-model="sameAsInvoice"
                    class="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  Delivery address same as invoice address
                </label>
              </template>
              <button
                v-if="cart?.invoiceAddress?.street"
                @click="currentStep = 2"
                class="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary/90 transition"
              >
                Confirm Invoice Address
              </button>
            </div>
          </div>

          <!-- Step 2: Delivery Address -->
          <div :class="['bg-white rounded-lg shadow border', currentStep === 2 ? 'ring-2 ring-primary border-primary' : 'opacity-80']">
            <div
              class="p-6 cursor-pointer"
              @click="currentStep > 2 && (currentStep = 2)"
            >
              <div class="flex items-center justify-between">
                <h2 class="text-lg font-semibold">2. Shipping Address</h2>
                <span v-if="currentStep > 2 && cart?.deliveryAddress?.street" class="text-sm text-muted-foreground border border-muted rounded px-2 py-0.5">
                  {{ cart.deliveryAddress.street }} {{ cart.deliveryAddress.number }}, {{ cart.deliveryAddress.city }}
                </span>
              </div>
            </div>
            <div v-if="currentStep === 2" class="px-6 pb-6 space-y-4">
              <template v-if="cart?.deliveryAddress?.street">
                <AddressCard
                  :address="cart.deliveryAddress"
                  :showEmail="true"
                  :enableDelete="false"
                  :enableSetDefault="false"
                  :onEdit="(addr) => handleAddressSubmit(addr, 'DELIVERY', false)"
                  :countries="COUNTRIES"
                />
                <div class="flex items-center gap-4">
                  <button @click="currentStep = 1" class="px-6 py-2 border rounded-lg hover:bg-gray-50 transition">Back</button>
                  <button @click="currentStep = 3" class="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary/90 transition">Confirm Delivery Address</button>
                  <AddressSelector
                    v-if="authStore.isAuthenticated"
                    :user="authStore.user"
                    :companyId="companyStore.companyId ?? undefined"
                    addressType="delivery"
                    :onAddressSelected="(addr) => handleAddressSubmit(addr, 'DELIVERY', true)"
                    :countries="COUNTRIES"
                    class="ml-auto"
                  />
                </div>
              </template>
              <template v-else>
                <AddressCard
                  :address="null"
                  :inline="true"
                  :isNew="true"
                  addressType="DELIVERY"
                  :showIcp="false"
                  :beforeSave="() => { loading = true; error = null }"
                  :onEdit="(addr) => handleAddressSubmit(addr, 'DELIVERY')"
                  :countries="COUNTRIES"
                />
              </template>
            </div>
          </div>

          <!-- Step 3: Payment & Delivery (normal mode only) -->
          <div
            v-if="!isQuoteMode"
            :class="['bg-white rounded-lg shadow border', currentStep === 3 ? 'ring-2 ring-primary border-primary' : 'opacity-80']"
          >
            <div
              class="p-6 cursor-pointer"
              @click="currentStep > 3 && (currentStep = 3)"
            >
              <h2 class="text-lg font-semibold">3. Payment &amp; Delivery</h2>
            </div>
            <div v-if="currentStep === 3" class="px-6 pb-6 space-y-8">
              <!-- Payment Method -->
              <div class="space-y-3">
                <h3 class="font-semibold text-sm uppercase tracking-wide flex items-center gap-2">Payment Method</h3>
                <p v-if="step3Submitted && !selectedPayment" class="text-sm text-destructive">Please select a payment method</p>
                <CartPaymethods
                  v-if="cart"
                  :cart="(cart as any)"
                  :user="authStore.user"
                  :onPaymethodSelect="(pm) => selectedPayment = pm.code"
                />
              </div>
              <!-- Carrier -->
              <div class="space-y-3">
                <h3 class="font-semibold text-sm uppercase tracking-wide">Carrier</h3>
                <p v-if="step3Submitted && !selectedCarrier" class="text-sm text-destructive">Please select a carrier</p>
                <CartCarriers
                  v-if="cart"
                  :cart="(cart as any)"
                  :showPrice="false"
                  :onCarrierSelect="(c) => selectedCarrier = c.name"
                />
              </div>
              <!-- Delivery Date -->
              <div class="space-y-3">
                <h3 class="font-semibold text-sm uppercase tracking-wide">Delivery Date</h3>
                <p v-if="step3Submitted && !selectedDeliveryDate" class="text-sm text-destructive">Please select a delivery date</p>
                <DeliveryDate
                  v-if="cart"
                  :cart="(cart as any)"
                  :initialDate="(cart as any)?.postageData?.requestDate"
                  :onDateSelect="(d) => selectedDeliveryDate = d"
                />
              </div>
              <div class="flex gap-4 pt-4">
                <button @click="currentStep = 2" class="px-6 py-2 border rounded-lg hover:bg-gray-50 transition">Back</button>
                <button @click="handleStep3Continue" :disabled="loading" class="bg-primary text-white px-6 py-2 rounded-lg disabled:opacity-50 hover:bg-primary/90 transition">
                  {{ loading ? 'Saving...' : 'Continue to Review' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Step 3 (quote) / Step 4 (normal): Review -->
          <div :class="['bg-white rounded-lg shadow border', currentStep === reviewStep ? 'ring-2 ring-primary border-primary' : 'opacity-80']">
            <div class="p-6">
              <h2 class="text-lg font-semibold">{{ reviewStep }}. {{ isQuoteMode ? 'Quote Details' : 'Review & Place Order' }}</h2>
            </div>
            <div v-if="currentStep === reviewStep" class="px-6 pb-6 space-y-6">
              <template v-if="isQuoteMode">
                <div class="space-y-2">
                  <label class="text-sm font-medium text-gray-700" for="quote-reference">Reference</label>
                  <input
                    id="quote-reference"
                    type="text"
                    v-model="quoteReference"
                    placeholder="Your reference (optional)"
                    maxlength="255"
                    class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
                <div class="space-y-2">
                  <label class="text-sm font-medium text-gray-700" for="quote-notes">Notes</label>
                  <textarea
                    id="quote-notes"
                    v-model="quoteNotes"
                    placeholder="Additional notes for your quote request (optional)"
                    rows="4"
                    maxlength="255"
                    class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                  />
                </div>
                <div class="flex gap-4 pt-2">
                  <button @click="currentStep = 2" class="px-6 py-2 border rounded-lg hover:bg-gray-50 transition">Back</button>
                  <button @click="handlePlaceOrder(quoteReference || undefined, quoteNotes || undefined)" :disabled="loading" class="bg-primary text-white px-6 py-2 rounded-lg disabled:opacity-50 hover:bg-primary/90 transition">
                    {{ loading ? 'Submitting...' : 'Place Quote Request' }}
                  </button>
                </div>
              </template>
              <template v-else>
                <CartOverview
                  v-if="cart"
                  :graphqlClient="graphqlClient"
                  :cart="(cart as any)"
                  :onTermsAndConditionsClick="() => window.open('/terms-conditions', '_blank')"
                  :onPurchaseButtonClick="(_cart, reference, notes) => handlePlaceOrder(reference, notes)"
                />
              </template>
            </div>
          </div>
        </div>

        <!-- Order Summary sidebar -->
        <div class="lg:w-1/3">
          <div class="sticky top-24 space-y-6">
            <div class="bg-white rounded-lg shadow border p-6">
              <h3 class="text-lg font-semibold mb-4">Cart Items</h3>
              <ItemsOverview
                v-if="cart"
                :cart="(cart as any)"
                :showAvailability="false"
                :itemNameClickable="false"
              />
            </div>
            <div class="bg-white rounded-lg shadow border p-6">
              <CartSummary
                v-if="cart"
                :cart="(cart as any)"
                title="Order Summary"
                :showCheckoutButton="false"
                :graphqlClient="graphqlClient"
                :user="authStore.user ?? undefined"
                :companyId="companyStore.companyId ?? undefined"
                :afterRequestAuthorization="handleAfterRequestAuthorization"
                :onError="(err) => console.error('Authorization request failed:', err)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  Enums,
  CartService,
  OrderService,
} from 'propeller-sdk-v2'
import type { Cart, CartUpdateAddressInput, Contact, Customer, Company } from 'propeller-sdk-v2'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { usePriceStore } from '@/stores/price'
import { useLanguageStore } from '@/stores/language'
import { useCompanyStore } from '@/stores/company'
import { graphqlClient, cartService, orderService } from '@/lib/api'
import { configuration, localizeHref } from '@/lib/config'

import CartPaymethods from '@/components/propeller/CartPaymethods.vue'
import CartCarriers from '@/components/propeller/CartCarriers.vue'
import DeliveryDate from '@/components/propeller/DeliveryDate.vue'
import CartSummary from '@/components/propeller/CartSummary.vue'
import CartOverview from '@/components/propeller/CartOverview.vue'
import ItemsOverview from '@/components/propeller/ItemsOverview.vue'
import AddressCard from '@/components/propeller/AddressCard.vue'
import AddressSelector from '@/components/propeller/AddressSelector.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const cartStore = useCartStore()
const priceStore = usePriceStore()
const languageStore = useLanguageStore()
const companyStore = useCompanyStore()

const isQuoteMode = computed(() => route.query.mode === 'quote')
const reviewStep = computed(() => isQuoteMode.value ? 3 : 4)
const stepLabels = computed(() =>
  isQuoteMode.value
    ? ['Details', 'Shipping', 'Review']
    : ['Details', 'Shipping', 'Payment', 'Review']
)

const cart = computed(() => cartStore.cart)
const currentStep = ref(1)
const selectedPayment = ref('')
const selectedCarrier = ref('')
const selectedDeliveryDate = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const sameAsInvoice = ref(false)
const step3Submitted = ref(false)
const quoteReference = ref('')
const quoteNotes = ref('')
const orderPlaced = ref(false)

const COUNTRIES = [
  { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'UK', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
]

function isContact(u: Contact | Customer | null): u is Contact {
  return u !== null && 'company' in u
}

function getActiveCompany(): Company | null {
  const user = authStore.user
  if (!user || !isContact(user)) return null
  const storedId = companyStore.companyId
  if (storedId) {
    const companiesRaw = (user as any).companies
    const items = (companiesRaw?.items ?? companiesRaw?._items ?? companiesRaw) as Company[] | undefined
    if (Array.isArray(items)) {
      const found = items.find((c: Company) => c.companyId === storedId)
      if (found) return found
    }
  }
  return ((user as Contact).company as Company | undefined) ?? null
}

function getUserDefaultAddress(type: 'invoice' | 'delivery'): any | null {
  const user = authStore.user
  if (!user) return null
  let addresses: any[] = []
  if (isContact(user)) {
    const company = getActiveCompany()
    if (company) addresses = (company as any).addresses || []
  } else {
    addresses = (user as any).addresses || []
  }
  const addressType = type === 'invoice' ? Enums.AddressType.invoice : Enums.AddressType.delivery
  return addresses.find((a: any) => a.type === addressType && a.isDefault === 'Y')
    || addresses.find((a: any) => a.type === addressType)
    || null
}

async function initializeCheckout() {
  const c = cart.value
  if (!c || !(c as any).items || (c as any).items.length === 0) {
    if (!orderPlaced.value) router.replace(localizeHref('/cart', languageStore.language))
    return
  }

  const hasInvoice = !!(c as any).invoiceAddress?.street
  const hasDelivery = !!(c as any).deliveryAddress?.street

  if (authStore.isAuthenticated && (!hasInvoice || !hasDelivery)) {
    try {
      await (cartService as any).initializeService?.()
      let updatedCart: Cart = c as Cart

      if (!hasInvoice) {
        const defaultInvoice = getUserDefaultAddress('invoice')
        if (defaultInvoice) {
          updatedCart = await cartService.updateCartAddress({
            id: updatedCart.cartId,
            input: buildAddressInput('INVOICE', defaultInvoice),
            imageSearchFilters: configuration.imageSearchFiltersGrid,
            imageVariantFilters: configuration.imageVariantFiltersSmall,
            language: languageStore.language,
          })
        }
      }

      if (!hasDelivery) {
        const defaultDelivery = getUserDefaultAddress('delivery')
        if (defaultDelivery) {
          updatedCart = await cartService.updateCartAddress({
            id: updatedCart.cartId,
            input: buildAddressInput('DELIVERY', defaultDelivery),
            imageSearchFilters: configuration.imageSearchFiltersGrid,
            imageVariantFilters: configuration.imageVariantFiltersSmall,
            language: languageStore.language,
          })
        }
      }

      cartStore.setCart(updatedCart)
    } catch (e) {
      console.error('Error pre-populating cart addresses:', e)
    }
  }

  const updatedCart = cart.value as any
  const updatedHasInvoice = !!updatedCart?.invoiceAddress?.street
  const updatedHasDelivery = !!updatedCart?.deliveryAddress?.street
  if (updatedHasInvoice && updatedHasDelivery) currentStep.value = 3
  else if (updatedHasInvoice) currentStep.value = 2
  else currentStep.value = 1
}

function buildAddressInput(type: 'INVOICE' | 'DELIVERY', addr: any): CartUpdateAddressInput {
  return {
    type: type === 'INVOICE' ? Enums.CartAddressType.INVOICE : Enums.CartAddressType.DELIVERY,
    firstName: addr.firstName || '',
    lastName: addr.lastName || '',
    street: addr.street || '',
    postalCode: addr.postalCode || '',
    city: addr.city || '',
    company: addr.company,
    gender: addr.gender,
    middleName: addr.middleName,
    number: addr.number,
    numberExtension: addr.numberExtension,
    country: addr.country,
    email: addr.email,
    mobile: addr.mobile,
    phone: addr.phone,
  }
}

async function handleAddressSubmit(addressData: any, type: 'INVOICE' | 'DELIVERY', advance = true) {
  try {
    loading.value = true
    error.value = null
    const input: CartUpdateAddressInput = {
      type: type === 'INVOICE' ? Enums.CartAddressType.INVOICE : Enums.CartAddressType.DELIVERY,
      firstName: addressData.firstName || '',
      lastName: addressData.lastName || '',
      street: addressData.street || '',
      postalCode: addressData.postalCode || '',
      city: addressData.city || '',
      company: addressData.company,
      gender: addressData.gender,
      middleName: addressData.middleName,
      number: addressData.number,
      numberExtension: addressData.numberExtension,
      country: addressData.country,
      email: addressData.email,
      mobile: addressData.mobile,
      phone: addressData.phone,
      notes: addressData.notes,
      icp: addressData.icp,
    }

    const updatedCart = await cartService.updateCartAddress({
      id: (cart.value as any).cartId,
      input,
      imageSearchFilters: configuration.imageSearchFiltersGrid,
      imageVariantFilters: configuration.imageVariantFiltersSmall,
      language: languageStore.language,
    })
    cartStore.setCart(updatedCart)

    // Anonymous "same as invoice" shortcut
    if (advance && type === 'INVOICE' && !authStore.isAuthenticated && sameAsInvoice.value) {
      const deliveryCart = await cartService.updateCartAddress({
        id: updatedCart.cartId,
        input: { ...input, type: Enums.CartAddressType.DELIVERY },
        imageSearchFilters: configuration.imageSearchFiltersGrid,
        imageVariantFilters: configuration.imageVariantFiltersSmall,
        language: languageStore.language,
      })
      cartStore.setCart(deliveryCart)
      currentStep.value = 3
      loading.value = false
      return
    }

    if (advance) {
      const hasInvoice = !!(updatedCart as any).invoiceAddress?.street
      const hasDelivery = !!(updatedCart as any).deliveryAddress?.street
      if (hasInvoice && hasDelivery) currentStep.value = 3
      else if (hasInvoice) currentStep.value = 2
      else currentStep.value = currentStep.value + 1
    }
  } catch (e: any) {
    error.value = 'Failed to save address'
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function handleStep3Continue() {
  if (!selectedPayment.value || !selectedCarrier.value || !selectedDeliveryDate.value) {
    step3Submitted.value = true
    return
  }
  try {
    loading.value = true
    error.value = null
    const updatedCart = await cartService.updateCart({
      id: (cart.value as any).cartId,
      input: {
        paymentData: { method: selectedPayment.value },
        postageData: { carrier: selectedCarrier.value, requestDate: selectedDeliveryDate.value },
      },
      imageSearchFilters: configuration.imageSearchFiltersGrid,
      imageVariantFilters: configuration.imageVariantFiltersSmall,
      language: languageStore.language,
    })
    cartStore.setCart(updatedCart)
    currentStep.value = 4
  } catch (e: any) {
    error.value = 'Failed to update cart'
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function handlePlaceOrder(reference?: string, notes?: string) {
  try {
    loading.value = true
    error.value = null
    orderPlaced.value = true

    if (reference || notes) {
      await cartService.updateCart({
        id: (cart.value as any).cartId,
        input: { reference: reference || undefined, notes: notes || undefined },
        imageSearchFilters: configuration.imageSearchFiltersGrid,
        imageVariantFilters: configuration.imageVariantFiltersSmall,
        language: languageStore.language,
      })
    }

    const orderStatus = isQuoteMode.value ? 'REQUEST' : 'NEW'
    const response = await cartService.processCart({
      id: (cart.value as any).cartId,
      input: { orderStatus, language: languageStore.language },
    })

    if (response?.cartOrderId) {
      const orderId = response.cartOrderId
      await orderService.setOrderStatus({
        orderId,
        status: orderStatus,
        payStatus: Enums.PaymentStatuses.OPEN,
        sendOrderConfirmationEmail: !isQuoteMode.value,
        addPDFAttachment: !isQuoteMode.value,
        triggerOrderSendConfirmEvent: !isQuoteMode.value,
        deleteCart: true,
      })

      if (isQuoteMode.value) {
        await (orderService as any).triggerQuoteSendRequest?.({
          orderId,
          language: languageStore.language,
        })
      }

      cartStore.setCart(null)
      const thankYouUrl = isQuoteMode.value
        ? localizeHref(`/checkout/thank-you/${orderId}`, languageStore.language) + '?mode=quote'
        : localizeHref(`/checkout/thank-you/${orderId}`, languageStore.language)
      router.push(thankYouUrl)
    } else {
      throw new Error('No Order ID returned')
    }
  } catch (e: any) {
    orderPlaced.value = false
    error.value = isQuoteMode.value ? 'Failed to submit quote request' : 'Failed to place order'
    console.error(e)
  } finally {
    loading.value = false
  }
}

function handleAfterRequestAuthorization(updatedCart: Cart) {
  cartStore.setCart(null)
  router.push(localizeHref(`/authorization-request-sent/${updatedCart.cartId}`, languageStore.language))
}

onMounted(() => initializeCheckout())
</script>
