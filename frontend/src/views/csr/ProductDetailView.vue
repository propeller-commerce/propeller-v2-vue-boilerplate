<template>
  <div class="py-12 bg-background">
    <div class="container-width max-w-5xl">
      <!-- Loading -->
      <div v-if="loading" class="flex justify-center py-24">
        <div
          class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"
        ></div>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="text-center py-24 text-destructive">
        <p>{{ error }}</p>
        <button
          @click="router.back()"
          class="mt-4 text-primary hover:underline"
        >
          Go back
        </button>
      </div>

      <template v-else-if="product">
        <!-- Breadcrumbs -->
        <div class="mb-6">
          <Breadcrumbs
            :categoryPath="(product.categoryPath as Category[]) || []"
            :currentCategory="(product as any).category || undefined"
            :currentLabel="productName"
            :labels="breadcrumbsLabels"
          />
        </div>

        <!-- Main Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          <!-- Gallery -->
          <div class="bg-card rounded-[var(--radius-container)] shadow p-6">
            <ProductGallery :images="images" :labels="productGalleryLabels" />
          </div>

          <!-- Info -->
          <div class="flex flex-col gap-4">
            <ProductInfo
              :product="product as Product"
            />

            <ProductPrice
              :product="product as Product"
              :price="product.price as SDKProductPrice"
              :labels="productPriceLabels"
            />

            <ProductBulkPrices
              v-if="product.price"
              :product="product as Product"
              :bulkPrices="product.bulkPrices as SDKProductPrice[]"
              :labels="productBulkPricesLabels"
            />

            <ProductShortDescription
              :product="product as Product | Cluster"
            />

            <ItemStock
              v-if="product.inventory"
              :inventory="product.inventory as ProductInventory"
              :showAvailability="false"
              :labels="itemStockLabels"
            />

            <div class="flex items-center gap-2 mt-4">
              <AddToCart
                :product="product as Product"
                :cartId="cartStore.cartId || undefined"
                :createCart="true"
                :showModal="true"
                :className="'flex items-center w-full gap-2'"
                :enableIncrementDecrement="true"
                :onCartCreated="(cart: any) => cartStore.setCart(cart)"
                :afterAddToCart="(cart: any) => cartStore.setCart(cart)"
                :onProceedToCheckout="() => router.push(localizeHref('/checkout', languageStore.language))"
                :onRequestQuoteClick="() => router.push(localizeHref('/checkout?mode=quote', languageStore.language))"
                :labels="addToCartLabels"
              />
              <AddToFavorite
                v-if="authStore.user"
                :productId="product.productId"
                :onFavoriteChanged="() => authStore.refreshUser()"
                :labels="addToFavoriteLabels"
              />
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="mb-6">
          <ProductTabs
            :product="product as Product"
            :productId="product.productId"
            :labels="productTabsLabels"
          />
        </div>

        <!-- Bundles -->
        <ProductBundles
          :productId="product.productId"
          :cartId="cartStore.cartId || undefined"
          taxZone="NL"
          :createCart="true"
          :showIndividualItems="true"
          :showModal="true"
          :onCartCreated="(cart: Cart) => cartStore.setCart(cart)"
          :afterBundleAddToCart="(cart: Cart) => cartStore.setCart(cart)"
          :onProceedToCheckout="() => router.push(localizeHref('/checkout', languageStore.language))"
          :labels="productBundlesLabels"
        />

        <!-- Accessories -->
        <ProductSlider
          :cartId="cartStore.cartId || undefined"
          :crossUpsellTypes="[CrossupsellType.ACCESSORIES]"
          :productId="product.productId"
          :showAvailability="false"
          :showStock="true"
          :showModal="true"
          :createCart="true"
          :onCartCreated="(cart: Cart) => cartStore.setCart(cart)"
          :afterAddToCart="(cart: Cart) => cartStore.setCart(cart)"
          :onProceedToCheckout="() => router.push(localizeHref('/checkout', languageStore.language))"
          :onRequestQuoteClick="() => router.push(localizeHref('/checkout?mode=quote', languageStore.language))"
          :onProductClick="
            (p: Product) =>
              router.push(
                configuration.urls.getProductUrl(p, languageStore.language),
              )
          "
          :onClusterClick="
            (c: Cluster) =>
              router.push(
                configuration.urls.getClusterUrl(c, languageStore.language),
              )
          "
          :labels="productSliderLabels"
          :productCardLabels="productCardLabels"
          :clusterCardLabels="clusterCardLabels"
          :stockLabels="itemStockLabels"
          :addToCartLabels="addToCartLabels"
          :priceLabels="productPriceLabels"
        />

        <!-- Related Products -->
        <ProductSlider
          :cartId="cartStore.cartId || undefined"
          :crossUpsellTypes="[CrossupsellType.RELATED]"
          :productId="product.productId"
          :showAvailability="false"
          :showStock="true"
          :showModal="true"
          :createCart="true"
          :onCartCreated="(cart: Cart) => cartStore.setCart(cart)"
          :afterAddToCart="(cart: Cart) => cartStore.setCart(cart)"
          :onProceedToCheckout="() => router.push(localizeHref('/checkout', languageStore.language))"
          :onRequestQuoteClick="() => router.push(localizeHref('/checkout?mode=quote', languageStore.language))"
          :onProductClick="
            (p: Product) =>
              router.push(
                configuration.urls.getProductUrl(p, languageStore.language),
              )
          "
          :onClusterClick="
            (c: Cluster) =>
              router.push(
                configuration.urls.getClusterUrl(c, languageStore.language),
              )
          "
          :labels="productSliderLabels"
          :productCardLabels="productCardLabels"
          :clusterCardLabels="clusterCardLabels"
          :stockLabels="itemStockLabels"
          :addToCartLabels="addToCartLabels"
          :priceLabels="productPriceLabels"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Cart, Cluster, CrossupsellType, Inventory, ProductInventory } from "@propeller-commerce/propeller-sdk-v2";
import { useAuthStore } from "@/stores/auth";
import { useCartStore } from "@/stores/cart";
import { useCompanyStore } from "@/stores/company";
import { usePriceStore } from "@/stores/price";
import { useLanguageStore } from "@/stores/language";
import { graphqlClient, productService } from "@/lib/api";
import {
  configuration,
  imageVariantFiltersLarge,
  imageSearchFilters,
  localizeHref,
} from "@/lib/config";
import { getLanguageString } from "@propeller-commerce/propeller-v2-vue-ui";
import {
  ProductPrice as SDKProductPrice,
  type Category,
  type Contact,
  type Customer,
  type Price,
  type Product,
} from "@propeller-commerce/propeller-sdk-v2";

import { AddToCart, AddToFavorite, Breadcrumbs, ItemStock, ProductBulkPrices, ProductBundles, ProductGallery, ProductInfo, ProductPrice, ProductShortDescription, ProductSlider, ProductTabs } from '@propeller-commerce/propeller-v2-vue-ui';
import { useTranslations } from '@/lib/i18n/composable';

const breadcrumbsLabels = useTranslations('Breadcrumbs');
const productGalleryLabels = useTranslations('ProductGallery');
const productPriceLabels = useTranslations('ProductPrice');
const productBulkPricesLabels = useTranslations('ProductBulkPrices');
const itemStockLabels = useTranslations('ItemStock');
const addToCartLabels = useTranslations('AddToCart');
const addToFavoriteLabels = useTranslations('AddToFavorite');
const productTabsLabels = useTranslations('ProductTabs');
const productBundlesLabels = useTranslations('ProductBundles');
const productSliderLabels = useTranslations('ProductSlider');
const productCardLabels = useTranslations('ProductCard');
const clusterCardLabels = useTranslations('ClusterCard');

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const cartStore = useCartStore();
const companyStore = useCompanyStore();
const priceStore = usePriceStore();
const languageStore = useLanguageStore();

const product = ref<Product | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

const images = computed(
  () =>
    product.value?.media?.images?.items
      ?.map((img: any) => img.imageVariants?.[0]?.url)
      .filter((url: any): url is string => !!url) ?? [],
);

const productName = computed(() =>
  product.value
    ? getLanguageString(product.value.names, languageStore.language, "")
    : "",
);

async function loadProduct() {
  loading.value = true;
  error.value = null;
  try {
    const productId = parseInt(route.params.productId as string);
    const result = await productService.getProduct({
      productId,
      language: languageStore.language,
      // imageSearchFilters (offset 20) returns the full set of product images
      // for the gallery; imageSearchFiltersGrid (offset 1) would only return
      // the first one and the gallery would render a single thumbnail.
      imageSearchFilters,
      imageVariantFilters: imageVariantFiltersLarge,
    });
    product.value = result || null;
    if (!result) error.value = "Product not found";
  } catch (e: any) {
    error.value = e?.message || "Failed to load product";
  } finally {
    loading.value = false;
  }
}

onMounted(loadProduct);
watch(() => route.params.productId, loadProduct);
</script>
