<template>
  <div class="bg-background">
    <!-- Hero / Featured products fallback -->
    <div class="container-width py-16">
      <div class="text-center mb-12">
        <h1 class="text-4xl font-bold text-foreground mb-4">
          {{ t.welcomeTitle }}
        </h1>
        <p class="text-muted-foreground text-lg max-w-xl mx-auto">
          {{ t.welcomeSubtitle }}
        </p>
        <router-link
          :to="localizeHref('/search', languageStore.language)"
          class="inline-block mt-6 bg-primary text-primary-foreground px-8 py-3 rounded-[var(--radius-container)] font-medium hover:bg-primary/90 transition"
        >
          {{ t.browseProducts }}
        </router-link>
      </div>

      <ProductSlider
        :productIds="[140, 64, 1382, 142, 146, 145]"
        :taxZone="configuration.taxZone"
        :cartId="cartStore.cartId || undefined"
        :createCart="true"
        :showModal="true"
        :showStock="true"
        :showAvailability="false"
        :onCartCreated="(cart: Cart) => cartStore.setCart(cart)"
        :afterAddToCart="(cart: Cart) => cartStore.setCart(cart)"
        :title="t.featuredProducts"
        :onProductClick="
          (product: Product) =>
            router.push(
              configuration.urls.getProductUrl(product, languageStore.language),
            )
        "
        :onClusterClick="
          (cluster: Cluster) =>
            router.push(
              configuration.urls.getClusterUrl(cluster, languageStore.language),
            )
        "
        :onProceedToCheckout="
          () => router.push(localizeHref('/checkout', languageStore.language))
        "
        :onRequestQuoteClick="
          () =>
            router.push(
              localizeHref('/checkout?mode=quote', languageStore.language),
            )
        "
        :labels="productSliderLabels"
        :productCardLabels="productCardLabels"
        :clusterCardLabels="clusterCardLabels"
        :stockLabels="itemStockLabels"
        :addToCartLabels="addToCartLabels"
        :priceLabels="productPriceLabels"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useCartStore } from "@/stores/cart";
import { usePriceStore } from "@/stores/price";
import { useLanguageStore } from "@/stores/language";
import { useCompanyStore } from "@/stores/company";
import { graphqlClient, productService } from "@/lib/api";
import { configuration, localizeHref } from "@/lib/config";
import { ProductSlider } from '@propeller-commerce/propeller-v2-vue-ui';
import { useTranslations } from '@/lib/i18n/composable';

const t = useTranslations('Home');
const productSliderLabels = useTranslations('ProductSlider');
const productCardLabels = useTranslations('ProductCard');
const clusterCardLabels = useTranslations('ClusterCard');
const itemStockLabels = useTranslations('ItemStock');
const addToCartLabels = useTranslations('AddToCart');
const productPriceLabels = useTranslations('ProductPrice');
import type {
  Cart,
  Cluster,
  Contact,
  Customer,
  Product,
} from "@propeller-commerce/propeller-sdk-v2";

const router = useRouter();
const authStore = useAuthStore();
const cartStore = useCartStore();
const priceStore = usePriceStore();
const languageStore = useLanguageStore();
const companyStore = useCompanyStore();
</script>
