<template>
  <template v-if="!!html">
    <div
      :class="`propeller-category-description mb-6 ${className || ''}`"
      :data-expanded="expanded ? 'true' : 'false'"
      :data-truncatable="shouldTruncate() ? 'true' : 'false'"
    >
      <template v-if="!shouldTruncate() || expanded">
        <div
          class="propeller-category-description__content prose prose-slate max-w-none text-muted-foreground"
          v-html="html"
        ></div>
      </template>

      <template v-if="shouldTruncate() && !expanded">
        <p class="propeller-category-description__truncated text-muted-foreground">{{ getTruncated() }}</p>
      </template>

      <template v-if="shouldTruncate()">
        <button
          class="propeller-category-description__toggle mt-2 text-sm font-medium text-primary hover:underline"
          @click="async (event) => toggle()"
        >
          <template v-if="expanded"> Read less </template>

          <template v-if="!expanded"> Read more </template>
        </button>
      </template>
    </div>
  </template>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

import type { Category } from 'propeller-sdk-v2';
import { getLanguageString } from '../../composables/shared/utils/languageResolver';

export interface CategoryDescriptionProps {
  // ── Required ────────────────────────────────────────────────────────────

  /**
   * Language code used to resolve the correct localised description
   * from `category.description`.
   */
  language: string;

  // ── Optional ────────────────────────────────────────────────────────────

  /**
   * Propeller Category object.
   * The component reads `category.description` (an array of LocalizedString)
   * and renders the matching language entry as HTML.
   */
  category?: Category | null;

  /**
   * When `true` (default), the description is truncated to `maxLength`
   * characters and a "Read more" / "Read less" toggle is shown.
   */
  collapsed?: boolean;

  /**
   * Maximum number of characters to display before truncating.
   * Only applies when `collapsed` is `true`.
   * Defaults to 200.
   */
  maxLength?: number;

  /** Extra CSS class applied to the root element. */
  className?: string;
}
interface CategoryDescriptionState {
  expanded: boolean;
  /** Cached resolved HTML — updated via onUpdate whenever category/language changes. */
  html: string;
  getDescription(): string;
  getMaxLen(): number;
  shouldTruncate(): boolean;
  getTruncated(): string;
  toggle(): void;
}

const props = defineProps<CategoryDescriptionProps>();
const expanded = ref<CategoryDescriptionState['expanded']>(false);
const html = ref<CategoryDescriptionState['html']>('');

watch(
  () => [props.category, props.language],
  () => {
    html.value = getDescription();
  },
  { immediate: true }
);
function getDescription(): ReturnType<CategoryDescriptionState['getDescription']> {
  return getLanguageString(props.category?.description, props.language || 'NL', '');
}
function getMaxLen(): ReturnType<CategoryDescriptionState['getMaxLen']> {
  return props.maxLength || 200;
}
function shouldTruncate(): ReturnType<CategoryDescriptionState['shouldTruncate']> {
  if (props.collapsed === false) return false;
  return html.value.length > getMaxLen();
}
function getTruncated(): ReturnType<CategoryDescriptionState['getTruncated']> {
  const plain = html.value.replace(/<[^>]*>/g, '');
  if (plain.length <= getMaxLen()) return html.value;
  const truncated = plain.substring(0, getMaxLen());
  return truncated.substring(0, truncated.lastIndexOf(' ')) + '…';
}
function toggle(): ReturnType<CategoryDescriptionState['toggle']> {
  expanded.value = !expanded.value;
}
</script>
