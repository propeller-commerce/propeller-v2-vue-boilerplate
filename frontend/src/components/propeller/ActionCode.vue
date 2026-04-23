<template>
  <div class="propeller-action-code w-full bg-card p-6 rounded-[var(--radius-container)] shadow space-y-3">
    <h2 class="text-lg font-bold">{{ title }}</h2>
    <template v-if="isMounted">
      <template v-if="hasAppliedCode">
        <div
          class="flex items-center justify-between bg-secondary/5 border border-secondary/20 rounded-[var(--radius-control)] px-3 py-2"
        >
          <div class="flex items-center gap-2">
            <svg
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              class="w-4 h-4 text-secondary"
              :strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path></svg
            ><span class="text-sm font-medium text-secondary">{{ appliedCode }}</span>
          </div>
          <template v-if="showRemoveCode">
            <button
              type="button"
              class="text-secondary hover:text-secondary text-sm font-medium transition-colors disabled:opacity-50"
              @click="async (event) => handleRemove()"
              :disabled="loading"
            >
              {{ getLabel('remove', 'Remove') }}
            </button>
          </template>
        </div>
      </template>

      <template v-if="!hasAppliedCode">
        <div class="flex gap-2">
          <input
            type="text"
            class="propeller-action-code__input flex-1 text-sm border border-input rounded-[var(--radius-control)] px-3 py-2 focus:ring-2 focus:ring-secondary focus:border-transparent disabled:opacity-50"
            :value="code"
            @change="
              async (e) => {
                code = e.target.value;
              }
            "
            @keydown="async (e) => handleKeyDown(e)"
            :placeholder="getLabel('placeholder', 'Enter action code')"
            :disabled="loading"
          /><button
            type="button"
            class="propeller-action-code__submit bg-secondary text-white text-sm font-medium px-4 py-2 rounded-[var(--radius-control)] hover:bg-secondary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            @click="async (event) => handleApply()"
            :disabled="loading || !code.trim()"
          >
            <template v-if="loading">
              {{ getLabel('applying', 'Applying...') }}
            </template>

            <template v-if="!loading">
              {{ getLabel('apply', 'Apply') }}
            </template>
          </button>
        </div>
      </template>

      <template v-if="!!error">
        <p class="propeller-action-code__error text-sm text-destructive">{{ error }}</p>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { GraphQLClient, Cart } from 'propeller-sdk-v2';
import { useCart } from '../../composables/useCart';
import { getLabel as _getLabel } from '../../composables/shared/utils/labelHelpers';

export interface ActionCodeProps {
  /** GraphQL client for the Propeller SDK */
  graphqlClient: GraphQLClient;

  /** The shopping cart used to populate the cart summary data */
  cart: Cart;

  /** Action code block title */
  title?: string;

  /** Labels for the component */
  labels?: Record<string, string>;

  /** Display the option to remove the action code of the shopping cart. Defaults to true. */
  showRemoveCode?: boolean;

  /** Action handler when action code is added to the cart */
  onActionCodeApply?: (code: string, cart: Cart) => void;

  /** Action handler when action code is removed from the cart */
  onActionCodeRemove?: (code: string, cart: Cart) => void;

  /** Action callback method after action code is applied */
  afterActionCodeApply?: (cart: Cart) => void;

  /** Action callback method after action code is removed */
  afterActionCodeRemove?: (cart: Cart) => void;

  /** Configuration object for image filters */
  configuration?: any;

  /** Language code for CartService operations. Defaults to 'NL'. */
  language?: string;
}
interface ActionCodeState {
  code: string;
  isMounted: boolean;
  getLabel: (key: string, fallback: string) => string;
  title: string;
  showRemoveCode: boolean;
  appliedCode: string;
  hasAppliedCode: boolean;
  handleApply: () => Promise<void>;
  handleRemove: () => Promise<void>;
  handleKeyDown: (e: any) => void;
}

const props = withDefaults(defineProps<ActionCodeProps>(), {
  showRemoveCode: true,
});
const code = ref<ActionCodeState['code']>('');
const isMounted = ref<ActionCodeState['isMounted']>(false);

const userRef = computed(() => null as any);
const { loading, error, addActionCode, removeActionCode } = useCart({
  graphqlClient: props.graphqlClient,
  user: userRef,
  cartId: props.cart?.cartId,
  configuration: {
    imageSearchFiltersGrid: props.configuration?.imageSearchFiltersGrid ?? ({} as any),
    imageVariantFiltersSmall: props.configuration?.imageVariantFiltersSmall ?? ({} as any),
  },
});


onMounted(() => {
  isMounted.value = true;
});

const title = computed(() => {
  return props.title || 'Action code';
});
const showRemoveCode = computed(() => {
  return props.showRemoveCode !== undefined ? props.showRemoveCode : true;
});
const appliedCode = computed(() => {
  return props.cart?.actionCode || '';
});
const hasAppliedCode = computed(() => {
  return !!props.cart?.actionCode;
});

function getLabel(key: string, fallback: string): ReturnType<ActionCodeState['getLabel']> {
  return _getLabel(props.labels, key, fallback);
}
async function handleApply(): ReturnType<ActionCodeState['handleApply']> {
  if (!code.value.trim() || loading.value) return;
  error.value = '';
  if (props.onActionCodeApply) {
    props.onActionCodeApply(code.value.trim(), props.cart);
    return;
  }
  const updatedCart = await addActionCode(code.value.trim());
  if (updatedCart) {
    code.value = '';
    if (props.afterActionCodeApply) {
      props.afterActionCodeApply(updatedCart);
    }
  } else if (!error.value) {
    error.value = getLabel('errorApply', 'Failed to apply action code. Please try again.');
  }
}
async function handleRemove(): ReturnType<ActionCodeState['handleRemove']> {
  if (loading.value || !hasAppliedCode.value) return;
  error.value = '';
  const currentCode = appliedCode.value;
  if (props.onActionCodeRemove) {
    props.onActionCodeRemove(currentCode, props.cart);
    return;
  }
  const updatedCart = await removeActionCode(currentCode);
  if (updatedCart) {
    if (props.afterActionCodeRemove) {
      props.afterActionCodeRemove(updatedCart);
    }
  } else if (!error.value) {
    error.value = getLabel('errorRemove', 'Failed to remove action code. Please try again.');
  }
}
function handleKeyDown(e: any): ReturnType<ActionCodeState['handleKeyDown']> {
  if (e.key === 'Enter') {
    handleApply();
  }
}
</script>
