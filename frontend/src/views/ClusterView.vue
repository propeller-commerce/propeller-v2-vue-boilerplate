<template>
  <div class="py-12 bg-background">
    <div class="container-width">
      <!-- schema.org structured data for Google Rich Results. Emits Product
           (schema.org has no Cluster type). Hidden in the DOM as a <script>. -->
      <ClusterJsonLd v-if="cluster" :cluster="cluster" :context="jsonLdContext" />
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
            <!-- Pass the seeded cluster in so ClusterInfo skips its internal
                 re-fetch on hydration. Without this the client refetch
                 overwrites the SSR cluster and the configurator's attribute
                 values reset (textValues bucket order differs across runs;
                 attributeDescription.type may also be dropped). -->
            <ClusterInfo
              :cluster="cluster ?? undefined"
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
import { ref, computed, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useHead } from "@unhead/vue";
import { CrossupsellType } from "propeller-sdk-v2";
import { useAuthStore } from "@/stores/auth";
import { useCartStore } from "@/stores/cart";
import { useCompanyStore } from "@/stores/company";
import { usePriceStore } from "@/stores/price";
import { useLanguageStore } from "@/stores/language";
import { useSsrCatalogStore } from "@/stores/ssrCatalog";
import { graphqlClient } from "@/lib/api";
import { configuration, localizeHref } from "@/lib/config";
import { getLanguageString } from "propeller-v2-vue-ui";
import { resolveSeoTitle, resolveSeoDescription, resolveCanonicalUrl, buildJsonLdContext } from "@/lib/seo";
import { stripHtml } from "propeller-v2-vue-ui/shared";

import { AddToCart, AddToFavorite, Breadcrumbs, ClusterConfigurator, ClusterInfo, ClusterJsonLd, ClusterOptions, ItemStock, ProductBulkPrices, ProductGallery, ProductPrice, ProductShortDescription, ProductSlider, ProductTabs } from 'propeller-v2-vue-ui';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const cartStore = useCartStore();
const companyStore = useCompanyStore();
const priceStore = usePriceStore();
const languageStore = useLanguageStore();

const clusterId = computed(() => parseInt(route.params.clusterId as string));

// SSR seed: the route's prefetch loader fetched the cluster server-side.
// Seeding `cluster` + `selectedProduct` (from its default product) means the
// breadcrumbs / gallery / price shell and the <head> tags server-render real
// content. `ClusterInfo` still runs on the client and re-confirms via
// `onClusterLoaded`.
const ssrCatalog = useSsrCatalogStore();
// peekSeed (not takeSeed): SSR + hydration must agree, or Vue warns of a
// mismatch. consumeSeed in onMounted below clears the entry so a later
// client-side re-navigation fetches fresh.
const seed = ssrCatalog.peekSeed(route.fullPath);
const seededCluster = seed?.kind === "cluster" ? (seed.data as any) : null;

const cluster = ref<any>(seededCluster);
const selectedProduct = ref<any>(seededCluster?.defaultProduct ?? null);
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

// SEO <head> — server-rendered from the seeded cluster. Mirrors React's
// cluster `generateMetadata`: curated metadata wins, falling back to the
// cluster's own names, then to the default product's name. Title + description
// are shared into og:title / og:description so the meta tags can't drift.
const seoTitle = computed(() => {
  const fromMetadata = resolveSeoTitle(
    (cluster.value as any)?.metadataTitles,
    (cluster.value as any)?.names,
    languageStore.language,
  );
  if (fromMetadata) return fromMetadata;
  const productNames = displayProduct.value?.names;
  return productNames
    ? getLanguageString(productNames, languageStore.language, "") || "Product"
    : "Product";
});
const seoDescription = computed(() => {
  const resolved = resolveSeoDescription(
    (cluster.value as any)?.metadataDescriptions,
    [
      (cluster.value as any)?.shortDescriptions,
      (cluster.value as any)?.descriptions,
    ],
    languageStore.language,
  );
  return resolved ? stripHtml(resolved) : "";
});
const seoCanonical = computed(() =>
  resolveCanonicalUrl(
    (cluster.value as any)?.metadataCanonicalUrls,
    languageStore.language,
  ),
);
// First gallery image, used for og:image + twitter:image when present.
const seoImage = computed(() => displayImages.value[0] ?? "");

// schema.org JSON-LD context — Cluster renders as `@type: "Product"`.
const jsonLdContext = computed(() =>
  buildJsonLdContext({
    language: languageStore.language,
    user: authStore.user as any,
  }),
);
useHead({
  title: seoTitle,
  meta: [
    { name: "description", content: seoDescription },
    { property: "og:title", content: seoTitle },
    { property: "og:description", content: seoDescription },
    { property: "og:type", content: "product" },
    { property: "og:image", content: seoImage },
    { name: "twitter:card", content: computed(() => seoImage.value ? "summary_large_image" : "summary") },
    { name: "twitter:title", content: seoTitle },
    { name: "twitter:description", content: seoDescription },
    { name: "twitter:image", content: seoImage },
  ],
  link: computed(() =>
    seoCanonical.value ? [{ rel: "canonical", href: seoCanonical.value }] : [],
  ),
});

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

// Post-hydration: discard the seed so a later same-route navigation fetches
// fresh. Runs only on the client (onMounted is a no-op during SSR).
onMounted(() => {
  ssrCatalog.consumeSeed(route.fullPath);
});

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
