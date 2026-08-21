<template>
  <!-- Prepr-driven home page when the CMS has one; else the built-in home. -->
  <CmsPageRenderer
    v-if="cmsPage && cmsPage.blocks.length"
    :page="cmsPage"
    :renderers="cmsBlockRenderers"
    wrapper-class="bg-background"
  />
  <div v-else class="bg-background">
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
  <PreprTrack v-if="cmsPage?.id" :item-id="cmsPage.id" />
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useCartStore } from "@/stores/cart";
import { usePriceStore } from "@/stores/price";
import { useLanguageStore } from "@/stores/language";
import { useCompanyStore } from "@/stores/company";
import { graphqlClient, productService } from "@/lib/api";
import { configuration, localizeHref } from "@/lib/config";
import { CmsPageRenderer } from "@propeller-commerce/propeller-v2-cms-vue";
import PreprTrack from "@/components/cms/PreprTrack.vue";
import { cmsBlockRenderers } from "@/components/cms/blockRenderers";
import { useSsrCatalogStore } from "@/stores/ssrCatalog";
import type { CmsRichPage } from "@/lib/cms/types";
import { ProductSlider } from '@propeller-commerce/propeller-v2-vue-ui';
import { useTranslations } from '@/lib/i18n/composable';
import { useHead } from '@unhead/vue';

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

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const cartStore = useCartStore();
const priceStore = usePriceStore();
const languageStore = useLanguageStore();
const companyStore = useCompanyStore();

// Prepr home page, seeded server-side by the `home` SSR loader. When present it
// renders instead of the built-in home (the fallback). peek (not consume) so
// SSR + hydration read the same value; consume post-hydration.
const ssrCatalog = useSsrCatalogStore();
const homeSeed = ssrCatalog.peekSeed(route.fullPath);
const cmsPage = ref<CmsRichPage | null>(
  homeSeed?.kind === "cms" ? (homeSeed.data as CmsRichPage) : null,
);
onMounted(() => {
  ssrCatalog.consumeSeed(route.fullPath);
});

// The homepage set no head tags of its own, so it inherited the site default:
// no distinct title and no description for crawlers. A CMS-managed home wins;
// otherwise fall back to the localized welcome copy.
useHead({
  title: computed(() => cmsPage.value?.title || t.value.welcomeTitle || ""),
  meta: [
    {
      name: "description",
      content: computed(() => t.value.welcomeSubtitle || ""),
    },
  ],
});
</script>
