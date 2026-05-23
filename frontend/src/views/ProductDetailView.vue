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
            :language="languageStore.language"
            :configuration="configuration"
            :currentLabel="productName"
          />
        </div>

        <!-- Main Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          <!-- Gallery -->
          <div class="bg-card rounded-[var(--radius-container)] shadow p-6">
            <ProductGallery :images="images" />
          </div>

          <!-- Info -->
          <div class="flex flex-col gap-4">
            <ProductInfo
              :product="product as Product"
              :user="authStore.user as Contact | Customer"
              :companyId="companyStore.companyId || undefined"
              :language="languageStore.language"
              :includeTax="priceStore.includeTax"
            />

            <ProductPrice
              :product="product as Product"
              :price="product.price as SDKProductPrice"
              :includeTax="priceStore.includeTax"
              :language="languageStore.language"
            />

            <ProductBulkPrices
              v-if="product.price"
              :product="product as Product"
              :bulkPrices="product.bulkPrices as SDKProductPrice[]"
              :includeTax="priceStore.includeTax"
              :language="languageStore.language"
            />

            <ProductShortDescription
              :product="product as Product | Cluster"
              :language="languageStore.language"
            />

            <ItemStock
              v-if="product.inventory"
              :inventory="product.inventory as ProductInventory"
              :language="languageStore.language"
              :showAvailability="false"
            />

            <div class="flex items-center gap-2 mt-4">
              <AddToCart
                :graphqlClient="graphqlClient"
                :user="authStore.user as Contact | Customer"
                :product="product as Product"
                :cartId="cartStore.cartId || undefined"
                :language="languageStore.language"
                :companyId="companyStore.companyId || undefined"
                :createCart="true"
                :showModal="true"
                :className="'flex items-center w-full gap-2'"
                :enableIncrementDecrement="true"
                :onCartCreated="(cart: any) => cartStore.setCart(cart)"
                :afterAddToCart="(cart: any) => cartStore.setCart(cart)"
                :onProceedToCheckout="() => router.push(localizeHref('/checkout', languageStore.language))"
                :onRequestQuoteClick="() => router.push(localizeHref('/checkout?mode=quote', languageStore.language))"
                :configuration="configuration"
              />
              <AddToFavorite
                v-if="authStore.user"
                :graphqlClient="graphqlClient"
                :user="authStore.user as Contact | Customer"
                :productId="product.productId"
                :onFavoriteChanged="() => authStore.refreshUser()"
              />
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="mb-6">
          <ProductTabs
            :graphqlClient="graphqlClient"
            :product="product as Product"
            :productId="product.productId"
            :language="languageStore.language"
            :includeTax="priceStore.includeTax"
          />
        </div>

        <!-- Bundles -->
        <ProductBundles
          :graphqlClient="graphqlClient"
          :productId="product.productId"
          :companyId="companyStore.companyId || undefined"
          :user="authStore.user as Contact | Customer"
          :cartId="cartStore.cartId || undefined"
          :language="languageStore.language"
          taxZone="NL"
          :includeTax="priceStore.includeTax"
          :configuration="configuration"
          :createCart="true"
          :showIndividualItems="true"
          :showModal="true"
          :onCartCreated="(cart: Cart) => cartStore.setCart(cart)"
          :afterBundleAddToCart="(cart: Cart) => cartStore.setCart(cart)"
          :onProceedToCheckout="() => router.push(localizeHref('/checkout', languageStore.language))"
        />

        <!-- Accessories -->
        <ProductSlider
          :graphqlClient="graphqlClient"
          :user="authStore.user as Contact | Customer"
          :cartId="cartStore.cartId || undefined"
          :language="languageStore.language"
          :includeTax="priceStore.includeTax"
          :configuration="configuration"
          :crossUpsellTypes="[CrossupsellType.ACCESSORIES]"
          :productId="product.productId"
          :showAvailability="false"
          :showStock="true"
          :showModal="true"
          :createCart="true"
          :companyId="companyStore.companyId || undefined"
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
        />

        <!-- Related Products -->
        <ProductSlider
          :graphqlClient="graphqlClient"
          :user="authStore.user as Contact | Customer"
          :cartId="cartStore.cartId || undefined"
          :language="languageStore.language"
          :includeTax="priceStore.includeTax"
          :configuration="configuration"
          :crossUpsellTypes="[CrossupsellType.RELATED]"
          :productId="product.productId"
          :showAvailability="false"
          :showStock="true"
          :showModal="true"
          :createCart="true"
          :companyId="companyStore.companyId || undefined"
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
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useHead } from "@unhead/vue";
import { Cart, Cluster, CrossupsellType, Inventory, ProductInventory } from "propeller-sdk-v2";
import { useAuthStore } from "@/stores/auth";
import { useCartStore } from "@/stores/cart";
import { useCompanyStore } from "@/stores/company";
import { usePriceStore } from "@/stores/price";
import { useLanguageStore } from "@/stores/language";
import { useSsrCatalogStore } from "@/stores/ssrCatalog";
import { graphqlClient, productService } from "@/lib/api";
import {
  configuration,
  imageVariantFiltersLarge,
  imageSearchFilters,
  localizeHref,
} from "@/lib/config";
import { getLanguageString } from "@/composables/shared/utils/languageResolver";
import { resolveSeoTitle, resolveSeoDescription, resolveCanonicalUrl } from "@/lib/seo";
import { stripHtml } from "propeller-v2-vue-ui/shared";
import {
  ProductPrice as SDKProductPrice,
  type Category,
  type Contact,
  type Customer,
  type Price,
  type Product,
} from "propeller-sdk-v2";

import { AddToCart, AddToFavorite, Breadcrumbs, ItemStock, ProductBulkPrices, ProductBundles, ProductGallery, ProductInfo, ProductPrice, ProductShortDescription, ProductSlider, ProductTabs } from 'propeller-v2-vue-ui';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const cartStore = useCartStore();
const companyStore = useCompanyStore();
const priceStore = usePriceStore();
const languageStore = useLanguageStore();

// SSR seed: the route's prefetch loader fetched the product server-side and
// stashed it. Seeding `product` here means the whole detail block — gallery,
// info, price, breadcrumbs — and the <head> tags server-render real content.
const ssrCatalog = useSsrCatalogStore();
// peekSeed (not takeSeed): SSR + hydration must agree, or Vue warns of a
// mismatch. consumeSeed in onMounted below clears the entry so a later
// client-side re-navigation fetches fresh.
const seed = ssrCatalog.peekSeed(route.fullPath);
const seededProduct = seed?.kind === "product" ? (seed.data as Product) : null;

const product = ref<Product | null>(seededProduct);
// When seeded there is no spinner — render the product immediately. Without a
// seed (client-side nav) `onMounted` fetches and the spinner shows meanwhile.
const loading = ref(!seededProduct);
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

// SEO <head> — server-rendered from the seeded product. Mirrors the React
// PDP's `generateMetadata`: curated metadata fields win, with sensible
// fallbacks to product name / shortDescriptions / descriptions. Computed
// once and shared into og:title / og:description so meta tags can't drift
// from the visible <title>.
const seoTitle = computed(
  () =>
    resolveSeoTitle(
      (product.value as any)?.metadataTitles,
      product.value?.names,
      languageStore.language,
    ) || productName.value || "Product",
);
const seoDescription = computed(() => {
  const resolved = resolveSeoDescription(
    (product.value as any)?.metadataDescriptions,
    [
      (product.value as any)?.shortDescriptions,
      (product.value as any)?.descriptions,
    ],
    languageStore.language,
  );
  // `descriptions` / `shortDescriptions` may contain HTML — strip it so the
  // meta description is plain text.
  return resolved ? stripHtml(resolved) : "";
});
const seoCanonical = computed(() =>
  resolveCanonicalUrl(
    (product.value as any)?.metadataCanonicalUrls,
    languageStore.language,
  ),
);
// First gallery image, used for og:image + twitter:image. Cheap because the
// `images` computed is already evaluated for the gallery; we just take [0].
const seoImage = computed(() => images.value[0] ?? "");
useHead({
  title: seoTitle,
  meta: [
    { name: "description", content: seoDescription },
    { property: "og:title", content: seoTitle },
    { property: "og:description", content: seoDescription },
    { property: "og:type", content: "product" },
    { property: "og:image", content: seoImage },
    // Twitter card: when there's no image, `summary` is the right type;
    // when there is, `summary_large_image` shows the image preview.
    { name: "twitter:card", content: computed(() => seoImage.value ? "summary_large_image" : "summary") },
    { name: "twitter:title", content: seoTitle },
    { name: "twitter:description", content: seoDescription },
    { name: "twitter:image", content: seoImage },
  ],
  link: computed(() =>
    seoCanonical.value ? [{ rel: "canonical", href: seoCanonical.value }] : [],
  ),
});

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

// Skip the initial client fetch when the SSR seed already populated `product`
// — re-fetching identical data on mount would be wasteful. A later route
// param change (client-side nav to another product) still triggers a fetch.
// Also discard the seed post-hydration so a later same-route navigation
// fetches fresh (the seed would be stale by then).
onMounted(() => {
  if (!seededProduct) loadProduct();
  ssrCatalog.consumeSeed(route.fullPath);
});
watch(
  () => route.params.productId,
  (id, prev) => {
    if (id !== prev) loadProduct();
  },
);
</script>
