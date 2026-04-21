<template>
  <div :class="`mb-8 ${className || ''}`">
    <div class="flex items-baseline gap-3 mb-3">
      <template v-if="headingLevel === 'h2'">
        <h2 class="text-3xl sm:text-4xl font-bold tracking-tight">
          {{ title }}
        </h2>
      </template>

      <template v-if="headingLevel !== 'h2'">
        <h1 class="text-3xl sm:text-4xl font-bold tracking-tight">
          {{ title }}
        </h1>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface GridTitleProps {
  // ── Required ────────────────────────────────────────────────────────────

  /**
   * The main heading text to display.
   * Typically the category name, search term, or brand name.
   */
  title: string;

  /**
   * Language code for the content.
   * Defaults to 'NL'.
   */
  language: string;

  // ── Optional ────────────────────────────────────────────────────────────

  /**
   * Override the heading tag level.
   * Defaults to 'h1'. Use 'h2' when the grid is embedded inside
   * a page that already has an h1.
   */
  headingLevel?: string;

  /** Extra CSS class applied to the root element. */
  className?: string;
}

const props = defineProps<GridTitleProps>();
</script>
