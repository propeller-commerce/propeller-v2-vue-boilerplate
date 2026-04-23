<template>
  <div
    :class="`propeller-cluster-info ${className || ''}`"
    :data-loading="loading ? 'true' : 'false'"
  >
    <template v-if="loading && !cluster">
      <div class="propeller-cluster-info__skeleton animate-pulse space-y-3">
        <div class="propeller-cluster-info__skeleton-line h-4 bg-slate-100 rounded w-1/4"></div>
        <div class="propeller-cluster-info__skeleton-line h-8 bg-slate-100 rounded w-3/4"></div>
      </div>
    </template>

    <template v-if="!loading || !!cluster">
      <template v-if="showSku !== false && !!getClusterSku()">
        <div class="text-sm font-mono text-muted-foreground mb-2">SKU: {{ getClusterSku() }}</div>
      </template>

      <template v-if="showTitle !== false && !!getClusterName()">
        <h1 class="text-4xl font-bold tracking-tight text-foreground mb-4">
          {{ getClusterName() }}
        </h1>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';

import {
  GraphQLClient,
  Cluster,
  LocalizedString,
  Contact,
  Customer,
} from 'propeller-sdk-v2';
import { useProductInfo } from '../../composables/useProductInfo';
import { getLanguageString, getLanguageUri } from '../../composables/shared/utils/languageResolver';

export interface ClusterInfoProps {
  // ── Data source ──────────────────────────────────────────────────────────
  /** The authenticated user (Contact or Customer) */
  user: Contact | Customer | null;
  /**
   * Pre-fetched cluster object to display.
   * When provided the component skips internal fetching.
   */
  cluster?: Cluster;

  /**
   * Cluster ID to fetch data for when no `cluster` prop is provided.
   * Requires `graphqlClient` to be set.
   */
  clusterId?: number;

  /**
   * Initialised Propeller SDK GraphQL client.
   * Required when `clusterId` is provided for internal data fetching.
   */
  graphqlClient?: GraphQLClient;

  /**
   * Called once the cluster data is loaded — either immediately (when
   * `cluster` prop is supplied) or after the internal fetch completes.
   * Use this to hydrate sibling components (configurator, price, gallery, etc.).
   */
  onClusterLoaded?: (cluster: Cluster) => void;

  // ── Display toggles ───────────────────────────────────────────────────────

  /** Show the cluster name. Defaults to true. */
  showTitle?: boolean;

  /** Show the cluster SKU. Defaults to true. */
  showSku?: boolean;

  // ── Locale ────────────────────────────────────────────────────────────────

  /** Language code used to resolve localised names. Defaults to 'NL'. */
  language?: string;

  /** Extra CSS class applied to the root element. */
  className?: string;

  /**
   * Tax zone to use for price calculation.
   */
  taxZone?: string;

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

const props = withDefaults(defineProps<ClusterInfoProps>(), {
  showTitle: true,
  showSku: true,
});

const userRef = computed(() => props.user ?? null);
const langRef = computed(() => props.language || 'NL');

const { cluster, loading, error, fetchCluster } = useProductInfo({
  graphqlClient: props.graphqlClient as GraphQLClient,
  language: langRef,
  user: userRef,
  configuration: props.configuration,
});

onMounted(() => {
  if (props.cluster) {
    if (props.onClusterLoaded) {
      props.onClusterLoaded(props.cluster);
    }
    return;
  }
  if (props.clusterId) {
    fetchCluster(props.clusterId).then(() => {
      if (cluster.value && props.onClusterLoaded) {
        props.onClusterLoaded(cluster.value);
      }
    });
  }
});

watch(
  () => [props.clusterId, props.cluster],
  () => {
    if (props.cluster) {
      if (props.onClusterLoaded) {
        props.onClusterLoaded(props.cluster);
      }
      return;
    }
    if (!props.clusterId) return;
    fetchCluster(props.clusterId).then(() => {
      if (cluster.value && props.onClusterLoaded) {
        props.onClusterLoaded(cluster.value);
      }
    });
  }
);

function getDisplayCluster(): Cluster | null {
  return (props.cluster as Cluster) || cluster.value;
}
function getClusterName(): string {
  const c = getDisplayCluster();
  if (!c) return '';
  return getLanguageString(c.names, props.language || 'NL', '');
}
function getClusterSku(): string {
  return getDisplayCluster()?.sku || '';
}
</script>
