<template>
  <template v-if="!!html">
    <div :class="`propeller-category-short-description mb-6 ${className || ''}`">
      <div
        class="propeller-category-short-description__content prose prose-slate max-w-none text-muted-foreground"
        v-html="html"
      ></div>
    </div>
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import type { Category } from 'propeller-sdk-v2';
import { getLanguageString } from '../../composables/shared/utils/languageResolver';

export interface CategoryShortDescriptionProps {
  // ── Required ────────────────────────────────────────────────────────────

  /**
   * Language code used to resolve the correct localised short description
   * from `category.shortDescription`.
   */
  language: string;

  // ── Optional ────────────────────────────────────────────────────────────

  /**
   * Propeller Category object.
   * The component reads `category.shortDescription` (an array of LocalizedString)
   * and renders the matching language entry as HTML.
   */
  category?: Category;

  /** Extra CSS class applied to the root element. */
  className?: string;
}
interface CategoryShortDescriptionState {
  html: string;
}

const props = defineProps<CategoryShortDescriptionProps>();

const html = computed(() => {
  return getLanguageString(props.category?.shortDescription, props.language || 'NL', '');
});
</script>
