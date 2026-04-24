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
                :onProceedToCheckout="() => router.push('/checkout')"
                :onRequestQuoteClick="() => router.push('/checkout?mode=quote')"
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
          :onProceedToCheckout="() => router.push('/checkout')"
        />

        <!-- Accessories -->
        <ProductSlider
          :graphqlClient="graphqlClient"
          :user="authStore.user as Contact | Customer"
          :cartId="cartStore.cartId || undefined"
          :language="languageStore.language"
          :includeTax="priceStore.includeTax"
          :configuration="configuration"
          :crossUpsellTypes="[Enums.CrossupsellType.ACCESSORIES]"
          :productId="product.productId"
          :showAvailability="false"
          :showStock="true"
          :showModal="true"
          :createCart="true"
          :companyId="companyStore.companyId || undefined"
          :onCartCreated="(cart: Cart) => cartStore.setCart(cart)"
          :afterAddToCart="(cart: Cart) => cartStore.setCart(cart)"
          :onProceedToCheckout="() => router.push('/checkout')"
          :onRequestQuoteClick="() => router.push('/checkout?mode=quote')"
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
          :crossUpsellTypes="[Enums.CrossupsellType.RELATED]"
          :productId="product.productId"
          :showAvailability="false"
          :showStock="true"
          :showModal="true"
          :createCart="true"
          :companyId="companyStore.companyId || undefined"
          :onCartCreated="(cart: Cart) => cartStore.setCart(cart)"
          :afterAddToCart="(cart: Cart) => cartStore.setCart(cart)"
          :onProceedToCheckout="() => router.push('/checkout')"
          :onRequestQuoteClick="() => router.push('/checkout?mode=quote')"
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
import {
  Cart,
  Cluster,
  Enums,
  Inventory,
  ProductInventory,
} from "propeller-sdk-v2";
import { useAuthStore } from "@/stores/auth";
import { useCartStore } from "@/stores/cart";
import { useCompanyStore } from "@/stores/company";
import { usePriceStore } from "@/stores/price";
import { useLanguageStore } from "@/stores/language";
import { graphqlClient, productService } from "@/lib/api";
import {
  configuration,
  imageVariantFiltersLarge,
  imageSearchFiltersGrid,
} from "@/lib/config";
import { getLanguageString } from "@/composables/shared/utils/languageResolver";
import {
  ProductPrice as SDKProductPrice,
  type Category,
  type Contact,
  type Customer,
  type Price,
  type Product,
} from "propeller-sdk-v2";

import Breadcrumbs from "@/components/propeller/Breadcrumbs.vue";
import ProductGallery from "@/components/propeller/ProductGallery.vue";
import ProductInfo from "@/components/propeller/ProductInfo.vue";
import ProductPrice from "@/components/propeller/ProductPrice.vue";
import ProductShortDescription from "@/components/propeller/ProductShortDescription.vue";
import ProductBulkPrices from "@/components/propeller/ProductBulkPrices.vue";
import ProductTabs from "@/components/propeller/ProductTabs.vue";
import ProductBundles from "@/components/propeller/ProductBundles.vue";
import ProductSlider from "@/components/propeller/ProductSlider.vue";
import AddToCart from "@/components/propeller/AddToCart.vue";
import AddToFavorite from "@/components/propeller/AddToFavorite.vue";
import ItemStock from "@/components/propeller/ItemStock.vue";

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
    product.value?.media?.images?.items?.flatMap(
      (img: any) =>
        img.imageVariants?.map((v: any) => v.url).filter(Boolean) ?? [],
    ) ?? [],
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
      imageSearchFilters: imageSearchFiltersGrid,
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
