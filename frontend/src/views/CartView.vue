<template>
  <div class="py-8 bg-surface-hover/20 min-h-[70vh]">
    <div class="container-width max-w-7xl">
      <h1 class="text-3xl font-bold mb-8">Shopping Cart</h1>

      <div v-if="!cartItems.length" class="text-center py-12">
        <p class="text-xl text-muted-foreground mb-4">Your cart is empty</p>
        <router-link
          :to="localizeHref('/', languageStore.language)"
          class="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-[var(--radius-container)] hover:bg-primary/90 transition"
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
            :user="authStore.user as Contact | Customer"
            :cartId="cartStore.cartId as string"
            :includeTax="priceStore.includeTax"
            :language="languageStore.language"
            :configuration="configuration"
            :companyId="companyStore.companyId || undefined"
            :showCrossupsells="true"
            :crossupsellTypes="[CrossupsellType.ACCESSORIES]"
            :crossupsellLimit="2"
            :afterCartUpdate="(cart: any) => cartStore.setCart(cart)"
          />

          <!-- Bonus items — free items added via incentives. Read-only list.
               currency/includeTax/language resolve from the Propeller provider
               (providePropeller in App.vue). -->
          <CartBonusItems :cart="cartStore.cart as Cart" />
        </div>

        <div class="h-fit space-y-4">
          <CartSummary
            v-if="cartStore.cart"
            :cart="cartStore.cart as Cart"
            :graphqlClient="graphqlClient"
            :user="authStore.user as Contact | Customer"
            :companyId="companyStore.companyId || undefined"
            :onCheckoutButtonClick="
              () =>
                router.push(localizeHref('/checkout', languageStore.language))
            "
            :afterRequestAuthorization="
              (cart: any) => {
                cartStore.setCart(null);
                router.push(
                  localizeHref(
                    '/authorization-request-sent/' + cart.cartId,
                    languageStore.language,
                  ),
                );
              }
            "
            :onRequestQuoteClick="
              () =>
                router.push(
                  localizeHref('/checkout?mode=quote', languageStore.language),
                )
            "
          />
          <ActionCode
            v-if="cartStore.cart"
            :graphqlClient="graphqlClient"
            :cart="cartStore.cart as Cart"
            :configuration="configuration"
            :afterActionCodeApply="(cart: any) => cartStore.setCart(cart)"
            :afterActionCodeRemove="(cart: any) => cartStore.setCart(cart)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { Cart, Contact, CrossupsellType, Customer } from "propeller-sdk-v2";
import { useAuthStore } from "@/stores/auth";
import { useCartStore } from "@/stores/cart";
import { useCompanyStore } from "@/stores/company";
import { usePriceStore } from "@/stores/price";
import { useLanguageStore } from "@/stores/language";
import { graphqlClient } from "@/lib/api";
import { configuration, localizeHref } from "@/lib/config";
import { ActionCode, CartBonusItems, CartItem, CartSummary } from 'propeller-v2-vue-ui';

const router = useRouter();
const authStore = useAuthStore();
const cartStore = useCartStore();
const companyStore = useCompanyStore();
const priceStore = usePriceStore();
const languageStore = useLanguageStore();

const cartItems = computed(() => cartStore.cart?.items || []);
</script>
