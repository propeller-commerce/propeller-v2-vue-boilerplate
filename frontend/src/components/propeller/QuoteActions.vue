<template>
  <div class="quote-actions space-y-4">
    <template v-if="showTermsAndConditions">
      <div class="flex items-center space-x-2 pt-2">
        <input
          type="checkbox"
          id="quote-actions-terms"
          class="propeller-quote-actions__checkbox h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          :checked="termsAccepted"
          @change="async (event) => handleTermsChange(event.target.checked)"
        /><label for="quote-actions-terms" class="text-sm leading-none"
          >{{ getLabel('termsPrefix', 'I agree to the')
          }}<a
            href="#"
            class="text-primary hover:underline font-medium"
            @click="async (event) => handleTermsLinkClick(event)"
            >{{ getLabel('termsLink', 'Terms and Conditions') }}</a
          ></label
        >
      </div>
    </template>

    <button
      type="button"
      class="propeller-quote-actions__submit flex items-center justify-center gap-2 w-full bg-primary text-white text-center py-3 rounded-lg hover:bg-primary/80 transition font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed mt-2"
      @click="async (event) => handleAcceptClick()"
      :disabled="isAcceptDisabled"
    >
      <template v-if="loading">
        <div
          class="propeller-quote-actions__spinner w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"
        ></div>
      </template>

      <template v-if="loading">
        {{ getLabel('processing', 'Processing...') }}
      </template>

      <template v-if="!loading">
        {{ getLabel('acceptButton', 'Accept Quotation') }}
      </template>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import { Order, GraphQLClient, Enums } from 'propeller-sdk-v2';
import { useOrders } from '../../composables/useOrders';
import { getLabel as _getLabel } from '../../composables/shared/utils/labelHelpers';

export interface QuoteActionsProps {
  /** GraphQL client for the Propeller SDK */
  graphqlClient?: GraphQLClient;

  /** The quotation for which the actions will take place */
  quote: Order;

  /** Labels used in the quote actions component */
  labels?: Record<string, string>;

  /** Action function triggered when the "Accept quotation" button is clicked.
   *  If not provided, the base implementation calls setOrderStatus on the SDK. */
  onAccept?: (quote: Order) => void;

  /** Action function triggered after the quote is accepted. Usually for navigating towards the thank you page. */
  afterAccept?: (quote: Order) => void;

  /** Show the terms and conditions acceptance */
  showTermsAndConditions?: boolean;

  /** Action when the "Terms and conditions" link is clicked */
  onTermsAndConditionsClick?: () => void;
}
interface QuoteActionsState {
  termsAccepted: boolean;
  loading: boolean;
  showTermsAndConditions: boolean;
  isAcceptDisabled: boolean;
  getLabel: (key: string, fallback: string) => string;
  handleTermsChange: (checked: boolean) => void;
  handleTermsLinkClick: (event: Event) => void;
  handleAcceptClick: () => Promise<void>;
}

const props = withDefaults(defineProps<QuoteActionsProps>(), {
  showTermsAndConditions: true,
});
const termsAccepted = ref<QuoteActionsState['termsAccepted']>(false);
const loading = ref<QuoteActionsState['loading']>(false);

const userRef = computed(() => null as any);
const companyRef = computed(() => undefined);
const { setQuoteStatus } = useOrders({
  graphqlClient: props.graphqlClient!,
  user: userRef,
  companyId: companyRef,
});

const showTermsAndConditions = computed(() => {
  return props.showTermsAndConditions !== undefined ? props.showTermsAndConditions : true;
});
const isAcceptDisabled = computed(() => {
  if (showTermsAndConditions && !termsAccepted.value) return true;
  if (loading.value) return true;
  return false;
});

function getLabel(key: string, fallback: string): ReturnType<QuoteActionsState['getLabel']> {
  return _getLabel(props.labels, key, fallback);
}
function handleTermsChange(checked: boolean): ReturnType<QuoteActionsState['handleTermsChange']> {
  termsAccepted.value = checked;
}
function handleTermsLinkClick(event: Event): ReturnType<QuoteActionsState['handleTermsLinkClick']> {
  event.preventDefault();
  if (props.onTermsAndConditionsClick) {
    props.onTermsAndConditionsClick();
  }
}
async function handleAcceptClick(): ReturnType<QuoteActionsState['handleAcceptClick']> {
  if (isAcceptDisabled.value) return;
  loading.value = true;
  try {
    if (props.onAccept) {
      props.onAccept(props.quote);
    } else if (props.quote?.id) {
      await setQuoteStatus(props.quote.id, { isQuoteAccepted: true });
    }
    if (props.afterAccept) {
      props.afterAccept(props.quote);
    }
  } finally {
    loading.value = false;
  }
}
</script>
