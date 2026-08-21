<template>
  <section class="bg-primary/5 py-16 lg:py-20">
    <div class="container-width">
      <div class="text-center mb-10">
        <h2 class="text-3xl font-bold">{{ block.title }}</h2>
        <p v-if="block.subtitle" class="text-muted-foreground mt-2 max-w-2xl mx-auto">
          {{ block.subtitle }}
        </p>
        <router-link
          v-if="block.buttonText && block.buttonUrl"
          :to="localizeHref(block.buttonUrl, languageStore.language)"
          class="inline-block mt-4 text-primary font-medium hover:underline"
        >
          {{ block.buttonText }}
        </router-link>
      </div>

      <ProductSlider
        v-if="productIds.length > 0"
        :labels="productSliderLabels"
        :productCardLabels="productCardLabels"
        :clusterCardLabels="clusterCardLabels"
        :addToCartLabels="addToCartLabels"
        :stockLabels="itemStockLabels"
        :priceLabels="productPriceLabels"
        :productIds="productIds"
        :cartId="cartStore.cartId || undefined"
        :taxZone="configuration.taxZone"
        :createCart="true"
        :onCartCreated="(cart: Cart) => cartStore.setCart(cart)"
        :afterAddToCart="(cart: Cart) => cartStore.setCart(cart)"
        :onProductClick="
          (product: Product) =>
            router.push(configuration.urls.getProductUrl(product, languageStore.language))
        "
        :onClusterClick="
          (cluster: Cluster) =>
            router.push(configuration.urls.getClusterUrl(cluster, languageStore.language))
        "
        :onLoginClick="() => router.push(localizeHref('/login', languageStore.language))"
      />
      <p v-else class="text-muted-foreground text-center">
        {{ cmsBlocksLabels.noProductsConfigured }}
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ProductSlider } from '@propeller-commerce/propeller-v2-vue-ui'
import { useCartStore } from '@/stores/cart'
import { useLanguageStore } from '@/stores/language'
import { configuration, localizeHref } from '@/lib/config'
import { useTranslations } from '@/lib/i18n/composable'
import type { CmsProductCards } from '@/lib/cms/types'
import type { Cart, Cluster, Product } from '@propeller-commerce/propeller-sdk-v2'

const props = defineProps<{ block: CmsProductCards }>()

const router = useRouter()
const cartStore = useCartStore()
const languageStore = useLanguageStore()

const productSliderLabels = useTranslations('ProductSlider')
const productCardLabels = useTranslations('ProductCard')
const clusterCardLabels = useTranslations('ClusterCard')
const addToCartLabels = useTranslations('AddToCart')
const itemStockLabels = useTranslations('ItemStock')
const productPriceLabels = useTranslations('ProductPrice')
const cmsBlocksLabels = useTranslations('CmsBlocks')

const productIds = computed(() =>
  props.block.products
    .map((p) => (typeof p.productId === 'string' ? parseInt(p.productId, 10) : p.productId))
    .filter((id): id is number => id != null && !isNaN(id) && id > 0),
)
</script>
