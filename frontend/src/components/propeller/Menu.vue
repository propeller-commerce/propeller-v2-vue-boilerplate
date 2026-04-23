<template>
  <div :class="`propeller-menu ${className || ''}`" :data-variant="getMenuStyle()" :data-loading="isLoading ? 'true' : 'false'">
    <template v-if="isLoading">
      <div class="propeller-menu__loading flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
        <div
          class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
        ></div>
        <span>{{ getLabel('loading', 'Loading menu...') }}</span>
      </div>
    </template>

    <template v-if="!isLoading && hasError">
      <div class="propeller-menu__error px-4 py-3 text-sm text-destructive">
        {{ getLabel('error', 'Failed to load menu') }}
      </div>
    </template>

    <template
      v-if="
        !isLoading &&
        !hasError &&
        menuCategories.length === 0
      "
    >
      <div class="propeller-menu__empty px-4 py-3 text-sm text-muted-foreground">
        {{ getLabel('empty', 'No categories found') }}
      </div>
    </template>

    <template
      v-if="
        !isLoading &&
        !hasError &&
        menuCategories.length > 0 &&
        getMenuStyle() === 'dropdown-vertical'
      "
    >
      <nav :class="`propeller-menu__nav propeller-menu-dropdown hidden md:block ${menuClass || ''}`">
        <div class="flex bg-popover border border-border shadow-lg">
          <ul class="propeller-menu__list w-64 py-1 border-r border-border flex-shrink-0" data-level="1">
            <template
              :key="`l1-${l1.categoryId}-${idx}`"
              v-for="(l1, idx) in menuCategories"
            >
              <li class="propeller-menu__item" data-level="1" :data-active="hoveredL1Id === l1.categoryId ? 'true' : 'false'" @mouseenter="async (event) => setHoveredL1(l1.categoryId)">
                <a
                  :href="getCategoryUrl(l1)"
                  @click="async (e) => handleItemClick(l1, e)"
                  :class="`propeller-menu__link flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                    hoveredL1Id === l1.categoryId
                      ? 'bg-accent text-accent-foreground'
                      : 'text-foreground hover:bg-accent/50'
                  }`"
                  ><span class="propeller-menu__label font-medium truncate">{{ getCategoryName(l1) }}</span>
                  <template v-if="getSubCategories(l1).length > 0">
                    <svg
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      class="propeller-menu__chevron w-4 h-4 text-muted-foreground"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 5l7 7-7 7"
                        :strokeWidth="2"
                      ></path>
                    </svg>
                  </template>
                </a>
              </li>
            </template>
          </ul>
          <template :key="idx" v-for="(l1, idx) in menuCategories">
            <template v-if="hoveredL1Id === l1.categoryId && getSubCategories(l1).length > 0">
              <ul class="propeller-menu__list w-64 py-1 border-r border-border flex-shrink-0" data-level="2">
                <template :key="`l2-${l2.categoryId}-${idx2}`" v-for="(l2, idx2) in getSubCategories(l1)">
                  <li class="propeller-menu__item" data-level="2" :data-active="hoveredL2Id === l2.categoryId ? 'true' : 'false'" @mouseenter="async (event) => setHoveredL2(l2.categoryId)">
                    <a
                      :href="getCategoryUrl(l2)"
                      @click="async (e) => handleItemClick(l2, e)"
                      :class="`propeller-menu__link flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                        hoveredL2Id === l2.categoryId
                          ? 'bg-accent text-accent-foreground'
                          : 'text-foreground hover:bg-accent/50'
                      }`"
                      ><span class="propeller-menu__label truncate">{{ getCategoryName(l2) }}</span>
                      <template v-if="getSubCategories(l2).length > 0">
                        <svg
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          class="propeller-menu__chevron w-4 h-4 text-muted-foreground"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 5l7 7-7 7"
                            :strokeWidth="2"
                          ></path>
                        </svg>
                      </template>
                    </a>
                  </li>
                </template>
              </ul>
            </template> </template
          ><template :key="index" v-for="(l1, index) in menuCategories">
            <template v-if="hoveredL1Id === l1.categoryId">
              <template :key="index" v-for="(l2, index) in getSubCategories(l1)">
                <template v-if="hoveredL2Id === l2.categoryId && getSubCategories(l2).length > 0">
                  <ul class="propeller-menu__list w-64 py-1 flex-shrink-0" data-level="3">
                    <template
                      :key="`l3-${l3.categoryId}-${idx3}`"
                      v-for="(l3, idx3) in getSubCategories(l2)"
                    >
                      <li class="propeller-menu__item" data-level="3">
                        <a
                          class="propeller-menu__link block px-4 py-2.5 text-sm text-foreground hover:bg-accent/50 transition-colors"
                          :href="getCategoryUrl(l3)"
                          @click="async (e) => handleItemClick(l3, e)"
                          ><span class="propeller-menu__label">{{ getCategoryName(l3) }}</span></a
                        >
                      </li>
                    </template>
                  </ul>
                </template>
              </template>
            </template>
          </template>
        </div>
      </nav>
    </template>

    <template
      v-if="
        !isLoading &&
        !hasError &&

        menuCategories.length > 0 &&
        getMenuStyle() === 'jumbotron'
      "
    >
      <nav :class="`propeller-menu__nav propeller-menu-jumbotron hidden md:block ${menuClass || ''}`">
        <div class="propeller-menu__tabs flex items-center border-b border-border">
          <template :key="`l1-${l1.categoryId}-${idx}`" v-for="(l1, idx) in menuCategories">
            <button
              data-level="1"
              :data-active="hoveredL1Id === l1.categoryId ? 'true' : 'false'"
              @mouseenter="async (event) => setHoveredL1(l1.categoryId)"
              @click="async (e) => handleItemClick(l1, e)"
              :class="`propeller-menu__tab px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
                hoveredL1Id === l1.categoryId
                  ? 'border-primary text-primary'
                  : 'border-transparent text-foreground hover:text-primary hover:border-primary/50'
              }`"
            >
              <span class="propeller-menu__label">{{ getCategoryName(l1) }}</span>
            </button>
          </template>
        </div>
        <template :key="idx" v-for="(l1, idx) in menuCategories">
          <template v-if="hoveredL1Id === l1.categoryId && getSubCategories(l1).length > 0">
            <div
              class="propeller-menu__panel bg-popover border border-border border-t-0 shadow-lg p-6"
              @mouseenter="async (event) => setHoveredL1(l1.categoryId)"
              @mouseleave="async (event) => setHoveredL1(null)"
            >
              <div class="propeller-menu__panel-grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                <template :key="`l2-${l2.categoryId}-${idx2}`" v-for="(l2, idx2) in getSubCategories(l1)">
                  <div class="propeller-menu__group" data-level="2">
                    <a
                      class="propeller-menu__link text-sm font-semibold text-foreground hover:text-primary transition-colors"
                      :href="getCategoryUrl(l2)"
                      @click="async (e) => handleItemClick(l2, e)"
                      ><span class="propeller-menu__label">{{ getCategoryName(l2) }}</span></a
                    >
                    <template v-if="getSubCategories(l2).length > 0">
                      <ul class="propeller-menu__list mt-2 space-y-1" data-level="3">
                        <template
                          :key="`l3-${l3.categoryId}-${idx3}`"
                          v-for="(l3, idx3) in getSubCategories(l2)"
                        >
                          <li class="propeller-menu__item" data-level="3">
                            <a
                              class="propeller-menu__link text-sm text-muted-foreground hover:text-primary transition-colors"
                              :href="getCategoryUrl(l3)"
                              @click="async (e) => handleItemClick(l3, e)"
                              ><span class="propeller-menu__label">{{ getCategoryName(l3) }}</span></a
                            >
                          </li>
                        </template>
                      </ul>
                    </template>
                  </div>
                </template>
              </div>
            </div>
          </template>
        </template>
      </nav>
    </template>

    <template
      v-if="
        !isLoading &&
        !hasError &&

        menuCategories.length > 0
      "
    >
      <nav :class="`propeller-menu__nav propeller-menu-mobile md:hidden ${menuClass || ''}`">
        <ul class="propeller-menu__list divide-y divide-border" data-level="1">
          <template :key="`l1-mobile-${l1.categoryId}-${idx}`" v-for="(l1, idx) in menuCategories">
            <li class="propeller-menu__item" data-level="1" :data-expanded="expandedL1 === l1.categoryId ? 'true' : 'false'">
              <div class="flex items-center">
                <a
                  class="propeller-menu__link flex-1 px-4 py-3 text-sm font-medium text-foreground"
                  :href="getCategoryUrl(l1)"
                  @click="async (e) => handleItemClick(l1, e)"
                  ><span class="propeller-menu__label">{{ getCategoryName(l1) }}</span></a
                >
                <template v-if="getSubCategories(l1).length > 0">
                  <button
                    type="button"
                    class="propeller-menu__toggle px-4 py-3 text-muted-foreground"
                    @click="
                      async (event) => {
                        expandedL1 = expandedL1 === l1.categoryId ? null : l1.categoryId;
                      }
                    "
                  >
                    <svg
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      :class="`propeller-menu__chevron w-4 h-4 transition-transform ${
                        expandedL1 === l1.categoryId ? 'rotate-180' : ''
                      }`"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m6 9 6 6 6-6"
                        :strokeWidth="2"
                      ></path>
                    </svg>
                  </button>
                </template>
              </div>
              <template v-if="expandedL1 === l1.categoryId && getSubCategories(l1).length > 0">
                <ul class="propeller-menu__list bg-accent/30" data-level="2">
                  <template :key="`l2-mobile-${l2.categoryId}-${idx2}`" v-for="(l2, idx2) in getSubCategories(l1)">
                    <li class="propeller-menu__item" data-level="2" :data-expanded="expandedL2 === l2.categoryId ? 'true' : 'false'">
                      <div class="flex items-center">
                        <a
                          class="propeller-menu__link flex-1 pl-8 pr-4 py-2.5 text-sm text-foreground"
                          :href="getCategoryUrl(l2)"
                          @click="async (e) => handleItemClick(l2, e)"
                          ><span class="propeller-menu__label">{{ getCategoryName(l2) }}</span></a
                        >
                        <template v-if="getSubCategories(l2).length > 0">
                          <button
                            type="button"
                            class="propeller-menu__toggle px-4 py-2.5 text-muted-foreground"
                            @click="
                              async (event) => {
                                expandedL2 = expandedL2 === l2.categoryId ? null : l2.categoryId;
                              }
                            "
                          >
                            <svg
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              :class="`propeller-menu__chevron w-3.5 h-3.5 transition-transform ${
                                expandedL2 === l2.categoryId ? 'rotate-180' : ''
                              }`"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="m6 9 6 6 6-6"
                                :strokeWidth="2"
                              ></path>
                            </svg>
                          </button>
                        </template>
                      </div>
                      <template
                        v-if="expandedL2 === l2.categoryId && getSubCategories(l2).length > 0"
                      >
                        <ul class="propeller-menu__list bg-accent/20" data-level="3">
                          <template
                            :key="`l3-mobile-${l3.categoryId}-${idx3}`"
                            v-for="(l3, idx3) in getSubCategories(l2)"
                          >
                            <li class="propeller-menu__item" data-level="3">
                              <a
                                class="propeller-menu__link block pl-12 pr-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                :href="getCategoryUrl(l3)"
                                @click="async (e) => handleItemClick(l3, e)"
                                ><span class="propeller-menu__label">{{ getCategoryName(l3) }}</span></a
                              >
                            </li>
                          </template>
                        </ul>
                      </template>
                    </li>
                  </template>
                </ul>
              </template>
            </li>
          </template>
        </ul>
      </nav>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { Category, Contact, Customer, GraphQLClient } from 'propeller-sdk-v2';
import { useMenu, type MenuCategory } from '../../composables/useMenu';
import { getLabel as _getLabel } from '../../composables/shared/utils/labelHelpers';

export interface MenuProps {
  /**
   * Initialised Propeller SDK GraphQL client.
   * Used internally to fetch the category hierarchy.
   */
  graphqlClient: GraphQLClient;

  /**
   * Base category ID for fetching all categories.
   * This is the root of the menu tree.
   */
  categoryId: number;

  /**
   * Language code for fetching localised category names and slugs.
   */
  language: string;

  /**
   * Maximum nesting depth of the menu hierarchy.
   * Defaults to 3.
   */
  depth?: number;

  /**
   * CSS class applied to the menu container element.
   */
  menuClass?: string;

  /**
   * Main menu display type.
   * - 'dropdown-vertical': nested flyout panels on hover (default)
   * - 'jumbotron': full-width mega-menu panel showing all subcategories
   */
  menuStyle?: string;

  /**
   * URL pattern for category links.
   * Use `{categoryId}` and `{slug}` as placeholders.
   * Defaults to 'category/{categoryId}/{slug}'.
   */
  menuLinkFormat?: string;

  /**
   * Called when a menu item is clicked.
   * Use for SPA-style routing instead of full-page navigation.
   */
  onMenuItemClick: (category: Category) => void;

  /**
   * Override any UI string.
   * Available keys: loading, error, empty
   */
  labels?: Record<string, string>;

  /**
   * Authenticated user object. When user changes (login/logout),
   * the menu cache is cleared and the menu is re-fetched.
   */
  user?: Contact | Customer | null;

  /** Extra CSS class applied to the root element. */
  className?: string;

  /** Configuration object passed to the component */
  configuration?: any;
}
const props = defineProps<MenuProps>();

const languageRef = computed(() => props.language || 'NL');
const { categories: menuCategories, loading: isLoading, error: menuError, fetchMenu } = useMenu({
  graphqlClient: props.graphqlClient,
  language: languageRef,
  depth: props.depth,
});
const hasError = computed(() => menuError.value !== null);

// UI interaction state
const hoveredL1Id = ref<number | null>(null);
const hoveredL2Id = ref<number | null>(null);
const expandedL1 = ref<number | null>(null);
const expandedL2 = ref<number | null>(null);

function getUserKey(): string {
  if (!props.user) return '';
  if ('contactId' in (props.user as any)) return `c${(props.user as Contact).contactId}`;
  return `u${(props.user as Customer).customerId}`;
}

watch(
  () => [props.graphqlClient, props.categoryId, props.language, getUserKey()],
  () => {
    if (props.graphqlClient && props.categoryId) {
      fetchMenu(props.categoryId, getUserKey());
    }
  },
  { immediate: true }
);
function getCategoryName(cat: MenuCategory): string {
  return cat.name;
}
function getCategoryUrl(cat: MenuCategory): string {
  const lang = props.language || 'NL';
  return props.configuration?.urls?.getCategoryUrl(
    { categoryId: cat.categoryId, slug: [{ value: cat.slug, language: lang }] } as Category,
    lang
  ) ?? '#';
}
function getSubCategories(cat: MenuCategory): MenuCategory[] {
  return (cat.children || []).filter(sub => sub.name && sub.slug);
}
function handleItemClick(cat: MenuCategory, e: any): void {
  if (props.onMenuItemClick) {
    e.preventDefault();
    const lang = props.language || 'NL';
    props.onMenuItemClick({
      categoryId: cat.categoryId,
      name: [{ value: cat.name, language: lang }] as any,
      slug: [{ value: cat.slug, language: lang }] as any,
    } as Category);
  }
}
function setHoveredL1(id: number | null): void {
  hoveredL1Id.value = id;
  hoveredL2Id.value = null;
}
function setHoveredL2(id: number | null): void {
  hoveredL2Id.value = id;
}
function getLabel(key: string, fallback: string): string {
  return _getLabel(props.labels, key, fallback);
}
function getMenuStyle(): string {
  return (props.menuStyle as string) || 'dropdown-vertical';
}
</script>
