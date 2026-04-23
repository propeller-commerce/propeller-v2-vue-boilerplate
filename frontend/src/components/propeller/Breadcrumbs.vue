<template>
  <nav aria-label="Breadcrumb" :class="`propeller-breadcrumbs ${className || ''}`">
    <ol class="propeller-breadcrumbs__list flex flex-wrap items-center text-sm text-muted-foreground">
      <template v-if="showHome !== false">
        <li class="propeller-breadcrumbs__item flex items-center" data-home="true">
          <a class="propeller-breadcrumbs__link hover:text-foreground transition-colors" :href="homeUrl || '/'">{{
            getLabel('home', 'Home')
          }}</a>
        </li>
      </template>

      <template :key="cat.categoryId || index" v-for="(cat, index) in getDisplayItems()">
        <li
          class="propeller-breadcrumbs__item flex items-center"
          :data-current="isCurrentItem(index) ? 'true' : 'false'"
        >
          <template v-if="showSeparatorBefore(index)">
            <span aria-hidden="true" class="propeller-breadcrumbs__separator mx-2 select-none text-muted-foreground/40">{{
              getLabel('separator', '/')
            }}</span>
          </template>

          <template v-if="isCurrentItem(index)">
            <a class="propeller-breadcrumbs__link propeller-breadcrumbs__link--current hover:text-foreground transition-colors" :href="getCategoryUrl(cat, index)">{{
              getCategoryName(cat)
            }}</a>
          </template>

          <template v-if="!isCurrentItem(index)">
            <a class="propeller-breadcrumbs__link hover:text-foreground transition-colors" :href="getCategoryUrl(cat, index)">{{
              getCategoryName(cat)
            }}</a>
          </template>
        </li>
      </template>
    </ol>
  </nav>
</template>

<script setup lang="ts">
import { Category, LocalizedString } from 'propeller-sdk-v2';
import { getLabel as _getLabel } from '../../composables/shared/utils/labelHelpers';
import { getLanguageString, getLanguageUri } from '../../composables/shared/utils/languageResolver';

export interface BreadcrumbsProps {
  /**
   * The category path from the category, product or cluster response.
   * Obtain from `category.categoryPath` or `product.category.categoryPath`.
   */
  categoryPath: Category[];

  /**
   * When true (default), the last item in the path is displayed as the
   * current page (non-clickable, aria-current="page").
   * When false, the last item is omitted.
   */
  showCurrent?: boolean;

  /**
   * When true (default), a "Home" link is prepended to the trail.
   */
  showHome?: boolean;

  /**
   * URL for the Home link. Defaults to '/'.
   */
  homeUrl?: string;

  /**
   * Language code used to resolve localised category names and slugs.
   * Defaults to 'NL'.
   */
  language?: string;

  /**
   * Custom URL builder for category links.
   * Receives the Category object and its zero-based index in the path.
   * When omitted, URLs default to `/category/{categoryId}/{slug}`.
   */
  getUrl?: (category: Category, index: number) => string;

  /**
   * Override any UI string.
   * Available keys: home, separator
   */
  labels?: Record<string, string>;

  /** Extra CSS class applied to the root element. */
  className?: string;

  /** Configuration object passed to the component */
  configuration?: any;
}
interface BreadcrumbsState {
  getItems: () => Category[];
  getDisplayItems: () => Category[];
  getCategoryName: (cat: Category) => string;
  getCategorySlug: (cat: Category) => string;
  getCategoryUrl: (cat: Category, index: number) => string;
  isCurrentItem: (index: number) => boolean;
  showSeparatorBefore: (index: number) => boolean;
  getLabel: (key: string, fallback: string) => string;
}

const props = withDefaults(defineProps<BreadcrumbsProps>(), {
  showHome: true,
});

function getItems(): ReturnType<BreadcrumbsState['getItems']> {
  const path = (props.categoryPath as Category[]) || [];
  const baseId = props.configuration?.baseCategoryId;
  if (!baseId) return path;
  return path.filter((cat: Category) => cat.categoryId !== baseId);
}
function getDisplayItems(): ReturnType<BreadcrumbsState['getDisplayItems']> {
  const items = getItems();
  if (props.showCurrent === false && items.length > 0) {
    return items.slice(0, items.length - 1);
  }
  return items;
}
function getCategoryName(cat: Category): ReturnType<BreadcrumbsState['getCategoryName']> {
  return getLanguageString(cat.name, props.language || 'NL', '');
}
function getCategorySlug(cat: Category): ReturnType<BreadcrumbsState['getCategorySlug']> {
  return getLanguageString(cat.slug, props.language || 'NL', '');
}
function getCategoryUrl(
  cat: Category,
  index: number
): ReturnType<BreadcrumbsState['getCategoryUrl']> {
  if (props.getUrl) {
    return (props.getUrl as (cat: Category, index: number) => string)(cat, index);
  }
  return props.configuration.urls.getCategoryUrl(cat, props.language);
}
function isCurrentItem(index: number): ReturnType<BreadcrumbsState['isCurrentItem']> {
  if (props.showCurrent === false) return false;
  return index === getDisplayItems().length - 1;
}
function showSeparatorBefore(index: number): ReturnType<BreadcrumbsState['showSeparatorBefore']> {
  // Show separator when Home precedes this item, or when a previous category item exists.
  return props.showHome !== false || index > 0;
}
function getLabel(key: string, fallback: string): ReturnType<BreadcrumbsState['getLabel']> {
  return _getLabel(props.labels, key, fallback);
}
</script>
