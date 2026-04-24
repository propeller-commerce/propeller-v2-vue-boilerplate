<template>
  <div class="bg-background">
    <!-- Hero / Featured products fallback -->
    <div class="container-width py-16">
      <div class="text-center mb-12">
        <h1 class="text-4xl font-bold text-foreground mb-4">Welcome to Propeller</h1>
        <p class="text-muted-foreground text-lg max-w-xl mx-auto">
          Discover our full catalog of products — quality, selection, and fast delivery.
        </p>
        <router-link
          to="/search"
          class="inline-block mt-6 bg-primary text-primary-foreground px-8 py-3 rounded-[var(--radius-container)] font-medium hover:bg-primary/90 transition"
        >
          Browse Products
        </router-link>
      </div>

      <ProductSlider
        :graphqlClient="graphqlClient"
        :user="authStore.user as Contact | Customer"
        :productIds="[1531, 5400, 5404, 1620, 5395, 5396]"
        :cartId="cartStore.cartId || undefined"
        :taxZone="configuration.taxZone"
        :language="languageStore.language"
        :includeTax="priceStore.includeTax"
        :configuration="configuration"
        :onCartCreated="(cart: any) => cartStore.setCart(cart)"
        title="Featured Products"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { usePriceStore } from '@/stores/price'
import { useLanguageStore } from '@/stores/language'
import { graphqlClient, productService } from '@/lib/api'
import { configuration } from '@/lib/config'
import ProductSlider from '@/components/propeller/ProductSlider.vue'
import type { Cluster, Contact, Customer, Product } from 'propeller-sdk-v2'

const authStore = useAuthStore()
const cartStore = useCartStore()
const priceStore = usePriceStore()
const languageStore = useLanguageStore()

</script>
