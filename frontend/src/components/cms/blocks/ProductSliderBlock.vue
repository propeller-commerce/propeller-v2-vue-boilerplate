<template>
  <section v-if="block.productIds.length > 0 || block.clusterIds.length > 0" class="py-16">
    <div class="container-width">
      <ProductSlider
        :labels="productSliderLabels"
        :productCardLabels="productCardLabels"
        :clusterCardLabels="clusterCardLabels"
        :addToCartLabels="addToCartLabels"
        :stockLabels="itemStockLabels"
        :priceLabels="productPriceLabels"
        :productIds="block.productIds"
        :clusterIds="block.clusterIds"
        :taxZone="configuration.taxZone"
        :title="block.title"
        :cartId="cartStore.cartId || undefined"
        :createCart="true"
        :showModal="true"
        :onCartCreated="(cart: Cart) => cartStore.setCart(cart)"
        :afterAddToCart="(cart: Cart) => cartStore.setCart(cart)"
        :onProceedToCheckout="() => router.push(localizeHref('/checkout', languageStore.language))"
        :onProductClick="
          (product: Product) =>
            router.push(configuration.urls.getProductUrl(product, languageStore.language))
        "
        :onClusterClick="
          (cluster: Cluster) =>
            router.push(configuration.urls.getClusterUrl(cluster, languageStore.language))
        "
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ProductSlider } from '@propeller-commerce/propeller-v2-vue-ui'
import { useCartStore } from '@/stores/cart'
import { useLanguageStore } from '@/stores/language'
import { configuration, localizeHref } from '@/lib/config'
import { useTranslations } from '@/lib/i18n/composable'
import type { CmsProductSlider } from '@/lib/cms/types'
import type { Cart, Cluster, Product } from '@propeller-commerce/propeller-sdk-v2'

defineProps<{ block: CmsProductSlider }>()

const router = useRouter()
const cartStore = useCartStore()
const languageStore = useLanguageStore()

const productSliderLabels = useTranslations('ProductSlider')
const productCardLabels = useTranslations('ProductCard')
const clusterCardLabels = useTranslations('ClusterCard')
const addToCartLabels = useTranslations('AddToCart')
const itemStockLabels = useTranslations('ItemStock')
const productPriceLabels = useTranslations('ProductPrice')
</script>
