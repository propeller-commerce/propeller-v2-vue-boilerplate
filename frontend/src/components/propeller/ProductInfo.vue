<template>
  <div :class="`product-info ${className || ''}`">
    <template v-if="loading && !product">
      <div class="animate-pulse space-y-3">
        <div class="h-4 bg-slate-100 rounded w-1/4"></div>
        <div class="h-8 bg-slate-100 rounded w-3/4"></div>
      </div>
    </template>

    <template v-if="!loading || !!product">
      <template v-if="showSku !== false && !!getProductSku()">
        <div class="text-sm font-mono text-muted-foreground mb-2">SKU: {{ getProductSku() }}</div>
      </template>

      <template v-if="showTitle !== false && !!getProductName()">
        <h1 class="text-4xl font-bold tracking-tight text-foreground mb-4">
          {{ getProductName() }}
        </h1>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';

import {
  GraphQLClient,
  Product,
  LocalizedString,
  Contact,
  Customer,
} from 'propeller-sdk-v2';
import { useProductInfo } from '../../composables/useProductInfo';

export interface ProductInfoProps {
  // ── Data source ──────────────────────────────────────────────────────────
  /** The authenticated user (Contact or Customer) */
  user: Contact | Customer | null;

  /** Active company ID from the company switcher.
   * Overrides default company for price calculation.
   * Triggers a re-fetch when changed. */
  companyId?: number;

  /**
   * Pre-fetched product object to display.
   * When provided the component skips internal fetching.
   */
  product?: Product;

  /**
   * Product ID to fetch data for when no `product` prop is provided.
   * Requires `graphqlClient` to be set.
   */
  productId?: number;

  /**
   * Initialised Propeller SDK GraphQL client.
   * Required when `productId` is provided for internal data fetching.
   */
  graphqlClient?: GraphQLClient;

  /**
   * Image search filter passed to ProductService.getProduct().
   * Controls how many image items are returned.
   * Example: { page: 1, offset: 20 }
   */
  imageSearchFilters?: any;

  /**
   * Image variant transformation filter passed to ProductService.getProduct().
   * Controls image size/format variants returned with the product.
   * Example: imageVariantFiltersLarge from @/data/defaults
   * Defaults to { transformations: [] } when omitted.
   */
  imageVariantFilters?: any;

  /**
   * Tax zone to use for price calculation.
   */
  taxZone?: string;

  /**
   * Called once the product data is loaded — either immediately (when
   * `product` prop is supplied) or after the internal fetch completes.
   * Use this to hydrate sibling components (gallery, price, descriptions, etc.).
   */
  onProductLoaded?: (product: Product) => void;

  // ── Display toggles ───────────────────────────────────────────────────────

  /** Show the product name. Defaults to true. */
  showTitle?: boolean;

  /** Show the product SKU. Defaults to true. */
  showSku?: boolean;

  // ── Locale ────────────────────────────────────────────────────────────────

  /** Language code used to resolve localised names. Defaults to 'NL'. */
  language?: string;

  /** Extra CSS class applied to the root element. */
  className?: string;

  /**
   * Config object providing imageSearchFiltersGrid and imageVariantFiltersSmall.
   */
  configuration?: any;

  /**
   * Attribute codes/names to look up and display as badge overlays on the product image.
   * Each code is resolved against `product.attributes.items[].attributeDescription.code`
   * (or `.name`). Attributes with no matching value are silently omitted.
   * Example: ['new', 'sale']
   */
  imageLabels?: string[];

  /**
   * Attribute codes/names to look up and display as extra text rows below the product name.
   * Resolved the same way as `imageLabels`.
   * Example: ['brand', 'color']
   */
  textLabels?: string[];
}

const props = withDefaults(defineProps<ProductInfoProps>(), {
  showSku: true,
  showTitle: true,
});

const userRef    = computed(() => props.user ?? null);
const companyRef = computed(() => props.companyId);
const langRef    = computed(() => props.language || 'NL');

const { product, cluster, loading, error, fetchProduct, fetchCluster } = useProductInfo({
  graphqlClient: props.graphqlClient as GraphQLClient,
  language: langRef,
  taxZone: props.taxZone,
  user: userRef,
  companyId: companyRef,
  configuration: props.configuration,
});

onMounted(() => {
  if (props.product) {
    if (props.onProductLoaded) {
      props.onProductLoaded(props.product);
    }
    return;
  }
  if (props.productId) {
    fetchProduct(props.productId).then(() => {
      if (product.value && props.onProductLoaded) {
        props.onProductLoaded(product.value);
      }
    });
  }
});

watch(
  () => [props.productId, props.product, props.language, props.user, props.companyId],
  () => {
    if (props.product) {
      if (props.onProductLoaded) {
        props.onProductLoaded(props.product);
      }
      return;
    }
    if (!props.productId) return;
    fetchProduct(props.productId).then(() => {
      if (product.value && props.onProductLoaded) {
        props.onProductLoaded(product.value);
      }
    });
  }
);

function getDisplayProduct(): Product | null {
  return (props.product as Product) || product.value;
}
function getProductName(): string {
  const p = getDisplayProduct();
  if (!p) return '';
  const lang = (props.language as string) || 'NL';
  const match = p.names?.find((n: LocalizedString) => n.language === lang);
  return match?.value || p.names?.[0]?.value || '';
}
function getProductSku(): string {
  return getDisplayProduct()?.sku || '';
}
</script>
