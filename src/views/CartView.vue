<template>
  <div class="py-8 bg-muted/20 min-h-[70vh]">
    <div class="container-width max-w-7xl">
      <h1 class="text-3xl font-bold mb-8">Shopping Cart</h1>

      <div v-if="!cartItems.length" class="text-center py-12">
        <p class="text-xl text-muted-foreground mb-4">Your cart is empty</p>
        <router-link
          to="/"
          class="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:bg-primary/90 transition"
        >
          Continue Shopping
        </router-link>
      </div>

      <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div class="lg:col-span-2 space-y-4">
          <CartItem
            v-for="item in cartItems"
            :key="item.itemId"
            :cartItem="item"
            :graphqlClient="graphqlClient"
            :user="authStore.user"
            :cartId="cartStore.cartId || undefined"
            :includeTax="priceStore.includeTax"
            :language="languageStore.language"
            :configuration="configuration"
            :companyId="companyStore.companyId || undefined"
            :showCrossupsells="true"
            :crossupsellTypes="[Enums.CrossupsellType.ACCESSORIES]"
            :crossupsellLimit="2"
            :afterCartUpdate="(cart: any) => cartStore.setCart(cart)"
          />
        </div>

        <div class="space-y-4">
          <ActionCode
            v-if="cartStore.cartId"
            :graphqlClient="graphqlClient"
            :cartId="cartStore.cartId"
            :language="languageStore.language"
            :onCartUpdated="(cart: any) => cartStore.setCart(cart)"
          />

          <CartSummary
            v-if="cartStore.cart"
            :cart="cartStore.cart"
            :includeTax="priceStore.includeTax"
            :language="languageStore.language"
            :afterRequestAuthorization="(cart: any) => {
              cartStore.setCart(null)
              router.push(localizeHref('/authorization-request-sent/' + cart.cartId, languageStore.language))
            }"
          />

          <router-link
            to="/checkout"
            class="block w-full text-center bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition"
          >
            Proceed to Checkout
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Enums } from 'propeller-sdk-v2'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { useCompanyStore } from '@/stores/company'
import { usePriceStore } from '@/stores/price'
import { useLanguageStore } from '@/stores/language'
import { graphqlClient } from '@/lib/api'
import { configuration, localizeHref } from '@/lib/config'
import CartItem from '@/components/propeller/CartItem.vue'
import CartSummary from '@/components/propeller/CartSummary.vue'
import ActionCode from '@/components/propeller/ActionCode.vue'

const router = useRouter()
const authStore = useAuthStore()
const cartStore = useCartStore()
const companyStore = useCompanyStore()
const priceStore = usePriceStore()
const languageStore = useLanguageStore()

const cartItems = computed(() => cartStore.cart?.mainItems?.items || [])
</script>
