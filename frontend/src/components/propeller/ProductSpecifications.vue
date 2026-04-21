<template>
  <template v-if="!loading && hasPublicAttributes()">
    <div :class="`product-specifications ${className || ''}`">
      <template v-if="!grouping">
        <template v-if="layout !== 'list'">
          <div class="overflow-hidden rounded-lg border border-border">
            <table class="w-full text-sm">
              <tbody class="divide-y divide-border">
                <template :key="i" v-for="(attr, i) in getAttributes()">
                  <tr class="odd:bg-white even:bg-muted/20">
                    <td class="px-4 py-2 font-medium text-foreground w-1/2">
                      {{ getAttributeLabel(attr) }}
                    </td>
                    <td class="px-4 py-2 text-muted-foreground">
                      {{ getAttributeValue(attr) }}
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </template>

        <template v-if="layout === 'list'">
          <div class="space-y-3">
            <template :key="i" v-for="(attr, i) in getAttributes()">
              <div class="flex flex-col gap-0.5">
                <span class="text-xs font-medium text-muted-foreground uppercase tracking-wide">{{
                  getAttributeLabel(attr)
                }}</span
                ><span class="text-sm text-foreground">{{ getAttributeValue(attr) }}</span>
              </div>
            </template>
          </div>
        </template>
      </template>

      <template v-if="!!grouping">
        <template :key="group" v-for="(group, index) in getGroups()">
          <div class="mb-6">
            <template v-if="!!group">
              <h4 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {{ group }}
              </h4>
            </template>

            <template v-if="layout !== 'list'">
              <div class="overflow-hidden rounded-lg border border-border">
                <table class="w-full text-sm">
                  <tbody class="divide-y divide-border">
                    <template :key="i" v-for="(attr, i) in getAttributesByGroup(group)">
                      <tr class="odd:bg-white even:bg-muted/20">
                        <td class="px-4 py-2 font-medium text-foreground w-1/2">
                          {{ getAttributeLabel(attr) }}
                        </td>
                        <td class="px-4 py-2 text-muted-foreground">
                          {{ getAttributeValue(attr) }}
                        </td>
                      </tr>
                    </template>
                  </tbody>
                </table>
              </div>
            </template>

            <template v-if="layout === 'list'">
              <div class="space-y-3">
                <template :key="i" v-for="(attr, i) in getAttributesByGroup(group)">
                  <div class="flex flex-col gap-0.5">
                    <span
                      class="text-xs font-medium text-muted-foreground uppercase tracking-wide"
                      >{{ getAttributeLabel(attr) }}</span
                    ><span class="text-sm text-foreground">{{ getAttributeValue(attr) }}</span>
                  </div>
                </template>
              </div>
            </template>
          </div>
        </template>
      </template>
    </div>
  </template>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';

import {
  GraphQLClient,
  AttributeResult,
  LocalizedString,
  Enums,
} from 'propeller-sdk-v2';
import { useProductSpecs } from '../../composables/useProductSpecs';
import { getLanguageString, getLanguageUri } from '../../shared/utils/languageResolver';

export interface ProductSpecificationsProps {
  /**
   * Initialised Propeller SDK GraphQL client.
   * Required when `productId` is set — used to fetch public attributes.
   */
  graphqlClient?: GraphQLClient;

  /**
   * Product ID to fetch attributes for.
   */
  productId?: number;

  /**
   * Pre-fetched attribute result items used as fallback when `productId` is not provided.
   * When `productId` is provided the component fetches its own data and this prop is ignored.
   */
  attributes?: AttributeResult[];

  /**
   * Language code used to resolve localised attribute labels.
   * Defaults to 'NL'.
   */
  language?: string;

  /**
   * Display layout for the specifications.
   * 'table' — two-column table (name | value). Default.
   * 'list'  — vertical label + value stacked rows.
   */
  layout?: string;

  /**
   * When true, groups attributes by their group field with a heading per section.
   * When false or omitted, displays a flat ungrouped table/list. Default: false.
   */
  grouping?: boolean;

  /** Extra CSS class applied to the root element. */
  className?: string;
}

const props = defineProps<ProductSpecificationsProps>();

const langRef = computed(() => props.language || 'NL');

const { attributes, loading, fetchSpecs } = useProductSpecs({
  graphqlClient: props.graphqlClient as GraphQLClient,
  language: langRef,
});

onMounted(() => {
  if (props.productId) fetchSpecs(props.productId);
});

watch(
  () => props.productId,
  (id) => {
    if (id) fetchSpecs(id);
  }
);

function getAttributes(): AttributeResult[] {
  // Prefer fetched attributes; fall back to props.attributes
  const attrs = attributes.value.length
    ? attributes.value
    : (props.attributes as AttributeResult[]) || [];
  return attrs.filter(
    (a: AttributeResult) =>
      a.attributeDescription?.isPublic === true &&
      getAttributeValue(a) !== '' &&
      getAttributeValue(a) !== null &&
      getAttributeValue(a) !== '0'
  );
}
function getGroups(): string[] {
  const attrs = getAttributes();
  const seen: string[] = [];
  attrs.forEach((a: AttributeResult) => {
    const group = a.attributeDescription?.group || '';
    if (!seen.includes(group)) seen.push(group);
  });
  return seen;
}
function getAttributesByGroup(group: string): AttributeResult[] {
  return getAttributes().filter(
    (a: AttributeResult) => (a.attributeDescription?.group || '') === group
  );
}
function getAttributeLabel(attr: AttributeResult): string {
  const descs = attr.attributeDescription?.descriptions || [];
  return getLanguageString(descs, props.language || 'NL', attr.attributeDescription?.name || '');
}
function getAttributeValue(attr: AttributeResult): string {
  const v = attr.value;
  if (!v) return '';
  const lang = (props.language as string) || 'NL';
  if (v.type === Enums.AttributeType.TEXT) {
    const entry = (v as any).textValues?.find((tv: any) => tv.language === lang);
    const vals = (entry?.values || []).filter(Boolean);
    return vals.join(', ');
  }
  if (v.type === Enums.AttributeType.ENUM) {
    const vals = ((v as any).enumValues || []).filter(Boolean);
    return vals.join(', ');
  }
  if (v.type === Enums.AttributeType.INT) {
    const val = (v as any).intValue;
    return val !== null && val !== undefined ? String(val) : '';
  }
  if (v.type === Enums.AttributeType.DECIMAL) {
    const val = (v as any).decimalValue;
    return val !== null && val !== undefined ? String(val) : '';
  }
  if (v.type === Enums.AttributeType.DATETIME) {
    return (v as any).dateTimeValue || '';
  }
  if (v.type === Enums.AttributeType.COLOR) {
    return (v as any).colorValue || '';
  }
  const fallback = v.value;
  if (fallback === null || fallback === undefined) return '';
  if (typeof fallback === 'boolean') return fallback ? 'Yes' : 'No';
  return String(fallback);
}
function hasPublicAttributes(): boolean {
  return getAttributes().length > 0;
}
</script>
