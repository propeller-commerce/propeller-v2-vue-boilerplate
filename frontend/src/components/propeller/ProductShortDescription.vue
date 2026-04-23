<template>
  <template v-if="!!html">
    <div
      v-html="html"
      :class="`propeller-product-short-description prose prose-slate max-w-none text-muted-foreground ${
        className || ''
      }`"
    ></div>
  </template>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

import type { Product, Cluster, LocalizedString } from 'propeller-sdk-v2';
import { getLanguageString, getLanguageUri } from '../../composables/shared/utils/languageResolver';

export interface ProductShortDescriptionProps {
  /**
   * Product or Cluster object.
   * The component reads `product.shortDescriptions` (an array of LocalizedString)
   * and renders the matching language entry as HTML.
   */
  product: Product | Cluster;

  /**
   * Language code used to resolve the correct localised short description.
   * Defaults to 'NL'.
   */
  language?: string;

  /** Extra CSS class applied to the root element. */
  className?: string;
}
interface ProductShortDescriptionState {
  html: string;
  getShortDescription: () => string;
}

const props = defineProps<ProductShortDescriptionProps>();
const html = ref<ProductShortDescriptionState['html']>('');

watch(
  () => [props.product, props.language],
  () => {
    html.value = getShortDescription();
  },
  { immediate: true }
);
function getShortDescription(): ReturnType<ProductShortDescriptionState['getShortDescription']> {
  const product = props.product as Product;
  if (!product?.shortDescriptions) return '';
  return getLanguageString(product.shortDescriptions, props.language || 'NL', '');
}
</script>
