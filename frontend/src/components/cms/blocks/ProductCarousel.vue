<template>
  <section class="py-16">
    <div class="container-width">
      <h2 class="text-2xl font-bold mb-8">{{ block.title }}</h2>

      <!-- Loading skeleton (mirrors the React ProductCarousel) -->
      <div v-if="loading" class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          v-for="i in 4"
          :key="i"
          class="aspect-square bg-slate-100 animate-pulse rounded-lg"
        />
      </div>

      <!--
        TODO: wire vue-ui ProductSlider props — the React source fetches a
        category's products but its post-load render is incomplete. We fetch the
        same way and hand the pre-loaded products to the vue-ui ProductSlider.
      -->
      <ProductSlider
        v-else-if="products.length > 0"
        :products="products"
        :taxZone="configuration.taxZone"
        :cartId="cartStore.cartId || undefined"
        :createCart="true"
        :showModal="true"
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
        :labels="productSliderLabels"
        :productCardLabels="productCardLabels"
        :clusterCardLabels="clusterCardLabels"
        :stockLabels="itemStockLabels"
        :addToCartLabels="addToCartLabels"
        :priceLabels="productPriceLabels"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { services } from '@/lib/api'
import {
  configuration,
  imageSearchFiltersGrid,
  imageVariantFiltersMedium,
} from '@/lib/config'
import { useCartStore } from '@/stores/cart'
import { useLanguageStore } from '@/stores/language'
import { useTranslations } from '@/lib/i18n/composable'
import { ProductSlider } from '@propeller-commerce/propeller-v2-vue-ui'
import type { CmsProductCarousel } from '@/lib/cms/types'
import type { Cart, Cluster, Product } from '@propeller-commerce/propeller-sdk-v2'

const props = defineProps<{ block: CmsProductCarousel }>()

const router = useRouter()
const cartStore = useCartStore()
const languageStore = useLanguageStore()

const productSliderLabels = useTranslations('ProductSlider')
const productCardLabels = useTranslations('ProductCard')
const clusterCardLabels = useTranslations('ClusterCard')
const itemStockLabels = useTranslations('ItemStock')
const addToCartLabels = useTranslations('AddToCart')
const productPriceLabels = useTranslations('ProductPrice')

const products = ref<(Product | Cluster)[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const data = await services.category.getCategory({
      categoryId: parseInt(props.block.categoryId, 10),
      language: languageStore.language,
      imageSearchFilters: imageSearchFiltersGrid,
      imageVariantFilters: imageVariantFiltersMedium,
    })

    if (data.products?.items) {
      products.value = data.products.items.slice(
        0,
        props.block.limit,
      ) as (Product | Cluster)[]
    }
  } catch (error) {
    console.error('Failed to load carousel products:', error)
  } finally {
    loading.value = false
  }
})
</script>
