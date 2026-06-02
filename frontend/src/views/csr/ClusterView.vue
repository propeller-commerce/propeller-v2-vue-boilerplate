<template>
  <div class="py-12 bg-background">
    <div class="container-width">
      <!-- Breadcrumbs -->
      <div class="mb-6">
        <Breadcrumbs
          :categoryPath="(selectedProduct as any)?.categoryPath || []"
          :currentCategory="(selectedProduct as any)?.category || undefined"
          :showCurrent="true"
        />
      </div>

      <!-- Main Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        <!-- Gallery -->
        <div class="bg-card rounded-[var(--radius-container)] shadow p-6">
          <ProductGallery :images="displayImages" />
        </div>

        <!-- Info -->
        <div class="flex flex-col">
          <div class="mb-6">
            <ClusterInfo
              :clusterId="clusterId"
              :onClusterLoaded="handleClusterLoaded"
              :imageSearchFilters="configuration.imageSearchFilters"
              :imageVariantFilters="configuration.imageVariantFiltersLarge"
            />

            <template v-if="cluster">
              <ProductPrice
                :price="
                  selectedProduct?.price ??
                  (cluster as any).defaultProduct?.price
                "
                :options="(cluster as any).options"
                :selectedOptionProducts="Object.values(selectedOptionProducts)"
              />

              <ProductBulkPrices
                :product="selectedProduct || (cluster as any).defaultProduct"
              />

              <div class="mt-6">
                <ProductShortDescription
                  :product="selectedProduct || (cluster as any).defaultProduct"
                />
              </div>

              <div v-if="(selectedProduct as any)?.inventory" class="my-4">
                <ItemStock
                  :inventory="(selectedProduct as any).inventory"
                  :showAvailability="false"
                />
              </div>

              <!-- ClusterConfigurator -->
              <div
                v-if="
                  (cluster as any).products?.length > 1 &&
                  (cluster as any).config
                "
                class="mt-6 mb-6 pb-6 border-b border-border"
              >
                <ClusterConfigurator
                  :clusterId="clusterId"
                  :products="(cluster as any).products"
                  :config="(cluster as any).config"
                  :defaultProduct="(cluster as any).defaultProduct"
                  :onConfigurationChange="
                    (product: any) => {
                      selectedProduct = product;
                    }
                  "
                />
              </div>

              <!-- ClusterOptions -->
              <div v-if="(cluster as any).options?.length > 0" class="mb-6">
                <ClusterOptions
                  :clusterId="clusterId"
                  :options="(cluster as any).options"
                  :onOptionSelect="handleOptionSelect"
                  :onOptionClear="handleOptionClear"
                  :showErrors="showClusterErrors"
                />
              </div>
            </template>

            <div class="flex items-center gap-2">
              <AddToCart
                :product="selectedProduct"
                :cluster="cluster as any"
                :beforeAddToCart="validateClusterOptions"
                :childItems="
                  Object.values(selectedOptionProducts).map(
                    (p: any) => p.productId,
                  )
                "
                :cartId="cartStore.cartId || undefined"
                :className="'flex items-center w-full gap-2'"
                :createCart="true"
                :showModal="true"
                :onCartCreated="(cart: any) => cartStore.setCart(cart)"
                :afterAddToCart="(cart: any) => cartStore.setCart(cart)"
                :onProceedToCheckout="() => router.push(localizeHref('/checkout', languageStore.language))"
                :onRequestQuoteClick="() => router.push(localizeHref('/checkout?mode=quote', languageStore.language))"
              />
              <AddToFavorite
                v-if="authStore.user"
                :clusterId="clusterId"
                :onFavoriteChanged="() => authStore.refreshUser()"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Product Tabs -->
      <ProductTabs
        v-if="displayProduct"
        :product="displayProduct"
        :productId="displayProduct.productId"
        class="pb-8"
      />

      <!-- 5 ProductSliders -->
      <ProductSlider
        v-for="crossType in crossUpsellSliders"
        :key="crossType"
        :crossUpsellTypes="[crossType]"
        :clusterId="clusterId"
        :cartId="cartStore.cartId || undefined"
        :showAvailability="false"
        :showStock="true"
        :showModal="true"
        :createCart="true"
        :onCartCreated="(cart: any) => cartStore.setCart(cart)"
        :afterAddToCart="(cart: any) => cartStore.setCart(cart)"
        :onProceedToCheckout="() => router.push(localizeHref('/checkout', languageStore.language))"
        :onRequestQuoteClick="() => router.push(localizeHref('/checkout?mode=quote', languageStore.language))"
        :onProductClick="
          (p: any) =>
            router.push(
              configuration.urls.getProductUrl(p, languageStore.language),
            )
        "
        :onClusterClick="
          (c: any) =>
            router.push(
              configuration.urls.getClusterUrl(c, languageStore.language),
            )
        "
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { CrossupsellType } from "propeller-sdk-v2";
import { useAuthStore } from "@/stores/auth";
import { useCartStore } from "@/stores/cart";
import { useCompanyStore } from "@/stores/company";
import { usePriceStore } from "@/stores/price";
import { useLanguageStore } from "@/stores/language";
import { graphqlClient } from "@/lib/api";
import { configuration, localizeHref } from "@/lib/config";

import { AddToCart, AddToFavorite, Breadcrumbs, ClusterConfigurator, ClusterInfo, ClusterOptions, ItemStock, ProductBulkPrices, ProductGallery, ProductPrice, ProductShortDescription, ProductSlider, ProductTabs } from 'propeller-v2-vue-ui';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const cartStore = useCartStore();
const companyStore = useCompanyStore();
const priceStore = usePriceStore();
const languageStore = useLanguageStore();

const clusterId = computed(() => parseInt(route.params.clusterId as string));
const cluster = ref<any>(null);
const selectedProduct = ref<any>(null);
const selectedOptionProducts = ref<Record<number, any>>({});
const showClusterErrors = ref(false);

const crossUpsellSliders = [
  CrossupsellType.ACCESSORIES,
  CrossupsellType.ALTERNATIVES,
  CrossupsellType.RELATED,
  CrossupsellType.OPTIONS,
  CrossupsellType.PARTS,
];

const displayProduct = computed(
  () => selectedProduct.value || cluster.value?.defaultProduct || null,
);

const displayImages = computed(
  () =>
    displayProduct.value?.media?.images?.items
      ?.map((img: any) => img.imageVariants?.[0]?.url)
      .filter((url: any): url is string => !!url) ?? [],
);

function handleClusterLoaded(loadedCluster: any) {
  cluster.value = loadedCluster;
  if (loadedCluster.defaultProduct) {
    selectedProduct.value = loadedCluster.defaultProduct;
  }
}

function handleOptionSelect(product: any) {
  const option = cluster.value?.options?.find((opt: any) =>
    opt.products?.some((p: any) => p.productId === product.productId),
  );
  if (option) {
    selectedOptionProducts.value = {
      ...selectedOptionProducts.value,
      [option.id]: product,
    };
  }
}

function handleOptionClear(optionId: number) {
  if (!(optionId in selectedOptionProducts.value)) return;
  const next = { ...selectedOptionProducts.value };
  delete next[optionId];
  selectedOptionProducts.value = next;
}

function validateClusterOptions(): boolean {
  if (!cluster.value?.options) return true;
  const hasUnfilled = cluster.value.options.some(
    (opt: any) =>
      opt.hidden !== "Y" &&
      opt.isRequired === "Y" &&
      !(opt.id in selectedOptionProducts.value),
  );
  if (hasUnfilled) {
    showClusterErrors.value = true;
    return false;
  }
  return true;
}

watch(
  () => route.params.clusterId,
  () => {
    cluster.value = null;
    selectedProduct.value = null;
    selectedOptionProducts.value = {};
    showClusterErrors.value = false;
  },
);
</script>
