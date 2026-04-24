<template>
  <template v-if="product">
    <div
      :class="`propeller-product-tabs ${className || ''}`"
      :data-active-tab="activeTab"
    >
      <div class="propeller-product-tabs__desktop hidden md:block">
        <div class="propeller-product-tabs__tablist flex border-b border-border">
          <template v-if="isTabVisible('description')">
            <button
              type="button"
              @click="async (event) => selectTab('description')"
              data-tab="description"
              :data-active="isActive('description') ? 'true' : 'false'"
              :class="`propeller-product-tabs__tab px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                isActive('description')
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`"
            >
              {{ getLabel('description', 'Description') }}
            </button>
          </template>

          <template v-if="isTabVisible('specifications')">
            <button
              type="button"
              @click="async (event) => selectTab('specifications')"
              data-tab="specifications"
              :data-active="isActive('specifications') ? 'true' : 'false'"
              :class="`propeller-product-tabs__tab px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                isActive('specifications')
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`"
            >
              {{ getLabel('specifications', 'Specifications') }}
            </button>
          </template>

          <template v-if="isTabVisible('downloads')">
            <button
              type="button"
              @click="async (event) => selectTab('downloads')"
              data-tab="downloads"
              :data-active="isActive('downloads') ? 'true' : 'false'"
              :class="`propeller-product-tabs__tab px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                isActive('downloads')
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`"
            >
              {{ getLabel('downloads', 'Downloads') }}
            </button>
          </template>

          <template v-if="isTabVisible('videos')">
            <button
              type="button"
              @click="async (event) => selectTab('videos')"
              data-tab="videos"
              :data-active="isActive('videos') ? 'true' : 'false'"
              :class="`propeller-product-tabs__tab px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                isActive('videos')
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`"
            >
              {{ getLabel('videos', 'Videos') }}
            </button>
          </template>
        </div>
        <div class="propeller-product-tabs__panel pt-6">
          <template v-if="isActive('description') && isTabVisible('description')">
            <ProductDescription
              :product="product"
              :language="language"
              :collapsed="descriptionCollapsed"
              :maxLength="descriptionMaxLength"
            ></ProductDescription>
          </template>

          <template v-if="specsVisited && isTabVisible('specifications')">
            <div :class="isActive('specifications') ? '' : 'hidden'">
              <ProductSpecifications
                :attributes="getSpecsAttributes()"
                :language="language"
                :layout="specificationsLayout"
                :grouping="specificationsGrouping"
              ></ProductSpecifications>
            </div>
          </template>

          <template v-if="isActive('downloads') && isTabVisible('downloads')">
            <ProductDownloads
              :downloads="product.media?.documents"
              :language="language || 'NL'"
              :labels="downloadsLabels"
            ></ProductDownloads>
          </template>

          <template v-if="isActive('videos') && isTabVisible('videos')">
            <ProductVideos
              :videos="product.media?.videos"
              :language="language || 'NL'"
              :labels="videosLabels"
            ></ProductVideos>
          </template>
        </div>
      </div>
      <div class="propeller-product-tabs__mobile md:hidden divide-y divide-border border border-border rounded-[var(--radius-container)]">
        <template v-if="isTabVisible('description')">
          <div>
            <button
              type="button"
              class="propeller-product-tabs__accordion-trigger flex items-center justify-between w-full px-4 py-3 text-sm font-medium text-left"
              @click="
                async (event) => {
                  activeTab = activeTab === 'description' ? '' : 'description';
                }
              "
            >
              {{ getLabel('description', 'Description')
              }}<svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                :class="`transition-transform ${isActive('description') ? 'rotate-180' : ''}`"
              >
                <path d="m6 9 6 6 6-6"></path>
              </svg>
            </button>
            <template v-if="isActive('description')">
              <div class="propeller-product-tabs__accordion-panel px-4 pb-4">
                <ProductDescription
                  :product="product"
                  :language="language"
                  :collapsed="descriptionCollapsed"
                  :maxLength="descriptionMaxLength"
                ></ProductDescription>
              </div>
            </template>
          </div>
        </template>

        <template v-if="isTabVisible('specifications')">
          <div>
            <button
              type="button"
              class="propeller-product-tabs__accordion-trigger flex items-center justify-between w-full px-4 py-3 text-sm font-medium text-left"
              @click="
                async (event) => {
                  if (activeTab.value !== 'specifications') {
                    onSpecificationsTabSelected();
                    activeTab.value = 'specifications';
                  } else {
                    activeTab.value = '';
                  }
                }
              "
            >
              {{ getLabel('specifications', 'Specifications')
              }}<svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                :class="`transition-transform ${isActive('specifications') ? 'rotate-180' : ''}`"
              >
                <path d="m6 9 6 6 6-6"></path>
              </svg>
            </button>
            <template v-if="specsVisited && isActive('specifications')">
              <div class="propeller-product-tabs__accordion-panel px-4 pb-4">
                <ProductSpecifications
                  :attributes="getSpecsAttributes()"
                  :language="language"
                  :layout="specificationsLayout"
                  :grouping="specificationsGrouping"
                ></ProductSpecifications>
              </div>
            </template>
          </div>
        </template>

        <template v-if="isTabVisible('downloads')">
          <div>
            <button
              type="button"
              class="propeller-product-tabs__accordion-trigger flex items-center justify-between w-full px-4 py-3 text-sm font-medium text-left"
              @click="
                async (event) => {
                  activeTab = activeTab === 'downloads' ? '' : 'downloads';
                }
              "
            >
              {{ getLabel('downloads', 'Downloads')
              }}<svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                :class="`transition-transform ${isActive('downloads') ? 'rotate-180' : ''}`"
              >
                <path d="m6 9 6 6 6-6"></path>
              </svg>
            </button>
            <template v-if="isActive('downloads')">
              <div class="propeller-product-tabs__accordion-panel px-4 pb-4">
                <ProductDownloads
                  :downloads="product.media?.documents"
                  :language="language || 'NL'"
                  :labels="downloadsLabels"
                ></ProductDownloads>
              </div>
            </template>
          </div>
        </template>

        <template v-if="isTabVisible('videos')">
          <div>
            <button
              type="button"
              class="propeller-product-tabs__accordion-trigger flex items-center justify-between w-full px-4 py-3 text-sm font-medium text-left"
              @click="
                async (event) => {
                  activeTab = activeTab === 'videos' ? '' : 'videos';
                }
              "
            >
              {{ getLabel('videos', 'Videos')
              }}<svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                :class="`transition-transform ${isActive('videos') ? 'rotate-180' : ''}`"
              >
                <path d="m6 9 6 6 6-6"></path>
              </svg>
            </button>
            <template v-if="isActive('videos')">
              <div class="propeller-product-tabs__accordion-panel px-4 pb-4">
                <ProductVideos
                  :videos="product.media?.videos"
                  :language="language || 'NL'"
                  :labels="videosLabels"
                ></ProductVideos>
              </div>
            </template>
          </div>
        </template>
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import {
  Product,
  GraphQLClient,
  PaginatedMediaDocumentResponse,
  PaginatedMediaVideoResponse,
  AttributeResult,
} from 'propeller-sdk-v2';
import ProductDescription from './ProductDescription.vue';
import ProductSpecifications from './ProductSpecifications.vue';
import ProductDownloads from './ProductDownloads.vue';
import ProductVideos from './ProductVideos.vue';
import { useProductSpecs } from '../../composables/useProductSpecs';
import { getLabel as _getLabel } from '../../composables/shared/utils/labelHelpers';
import { getLanguageString } from '../../composables/shared/utils/languageResolver';

export interface ProductTabsProps {
  /** Product for which to display the information. */
  product: Product;

  // ── Tab visibility ────────────────────────────────────────────────────────

  /** If true, displays the Description tab. Defaults to true. */
  showDescription?: boolean;

  /** If true, displays the Specifications tab. Defaults to true. */
  showSpecifications?: boolean;

  /** If true, displays the Downloads tab. Defaults to true. */
  showDownloads?: boolean;

  /** If true, displays the Videos tab. Defaults to true. */
  showVideos?: boolean;

  // ── Shared ────────────────────────────────────────────────────────────────

  /**
   * Language code passed to all sub-components.
   * Defaults to 'NL'.
   */
  language?: string;

  /**
   * Override the tab button labels.
   * Available keys: description, specifications, downloads, videos
   */
  labels?: Record<string, string>;

  // ── Description tab ───────────────────────────────────────────────────────

  /**
   * When true, the description is initially collapsed to `descriptionMaxLength` characters.
   * A "Read more" / "Read less" toggle is shown.
   * Passed as `collapsed` to ProductDescription. Defaults to false.
   */
  descriptionCollapsed?: boolean;

  /**
   * Maximum number of characters shown when the description is collapsed.
   * Passed as `maxLength` to ProductDescription. Defaults to 0 (no truncation).
   */
  descriptionMaxLength?: number;

  // ── Specifications tab ────────────────────────────────────────────────────

  /**
   * Initialised Propeller SDK GraphQL client.
   * Passed to ProductSpecifications for internal attribute fetching.
   */
  graphqlClient?: GraphQLClient;

  /**
   * Product ID to fetch attributes for.
   * Passed to ProductSpecifications for internal attribute fetching.
   */
  productId?: number;

  /**
   * Display layout for the specifications.
   * 'table' — two-column table (name | value). Default.
   * 'list'  — vertical label + value stacked rows.
   * Passed as `layout` to ProductSpecifications.
   */
  specificationsLayout?: string;

  /**
   * When true, groups specifications by their group field with a heading per section.
   * When false or omitted, displays a flat ungrouped table. Default: false.
   * Passed as `grouping` to ProductSpecifications.
   */
  specificationsGrouping?: boolean;

  // ── Downloads tab ─────────────────────────────────────────────────────────

  /**
   * Override UI strings for the Downloads section.
   * Available keys: title, download
   * Passed as `labels` to ProductDownloads.
   */
  downloadsLabels?: Record<string, string>;

  // ── Videos tab ───────────────────────────────────────────────────────────

  /**
   * Override UI strings for the Videos section.
   * Available key: title
   * Passed as `labels` to ProductVideos.
   */
  videosLabels?: Record<string, string>;

  // ── Root ─────────────────────────────────────────────────────────────────

  /** Extra CSS class applied to the root element. */
  className?: string;
}
interface ProductTabsState {
  activeTab: string;
  specsVisited: boolean;
  fetchedAttributes: AttributeResult[];
  hasDescription: boolean;
  isTabVisible: (tab: string) => boolean;
  isActive: (tab: string) => boolean;
  selectTab: (tab: string) => void;
  getLabel: (key: string, fallback: string) => string;
  getSpecsAttributes: () => AttributeResult[];
}

const props = withDefaults(defineProps<ProductTabsProps>(), {
  showDescription: true,
  showSpecifications: true,
  showDownloads: true,
  showVideos: true,
});
const activeTab = ref<ProductTabsState['activeTab']>('description');
const specsVisited = ref<ProductTabsState['specsVisited']>(false);

const { attributes: fetchedAttributes, fetchSpecs } = useProductSpecs({
  graphqlClient: props.graphqlClient as GraphQLClient,
  language: computed(() => props.language || 'NL'),
});

onMounted(() => {
  // Set the first visible tab as active
  if (props.showDescription !== false && hasDescription) {
    activeTab.value = 'description';
  } else if (props.showSpecifications !== false) {
    activeTab.value = 'specifications';
    specsVisited.value = true;
  } else if (props.showDownloads !== false) {
    activeTab.value = 'downloads';
  } else {
    activeTab.value = 'videos';
  }
});

const hasDescription = computed(() => {
  return !!getLanguageString(props.product?.descriptions, props.language || 'NL', '');
});

watch(
  () => [props.product, props.language],
  () => {
    // Re-evaluate first visible tab when product data or language changes
    if (props.showDescription !== false && hasDescription) {
      activeTab.value = 'description';
    }
  },
  { immediate: true }
);
function getSpecsAttributes(): ReturnType<ProductTabsState['getSpecsAttributes']> {
  return fetchedAttributes.value.length
    ? fetchedAttributes.value
    : (props.product?.attributes?.items as AttributeResult[]) || [];
}
function onSpecificationsTabSelected(): void {
  specsVisited.value = true;
  if (props.productId && !fetchedAttributes.value.length) {
    fetchSpecs(props.productId);
  }
}
function isTabVisible(tab: string): ReturnType<ProductTabsState['isTabVisible']> {
  if (tab === 'description') return props.showDescription !== false && hasDescription;
  if (tab === 'specifications') return props.showSpecifications !== false;
  if (tab === 'downloads') return props.showDownloads !== false;
  if (tab === 'videos') return props.showVideos !== false;
  return false;
}
function isActive(tab: string): ReturnType<ProductTabsState['isActive']> {
  return activeTab.value === tab;
}
function selectTab(tab: string): ReturnType<ProductTabsState['selectTab']> {
  if (tab === 'specifications') {
    onSpecificationsTabSelected();
  }
  activeTab.value = tab;
}
function getLabel(key: string, fallback: string): ReturnType<ProductTabsState['getLabel']> {
  return _getLabel(props.labels, key, fallback);
}
</script>
