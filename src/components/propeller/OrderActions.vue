<template>
  <div :class="className">
    <div class="flex flex-row items-center gap-3 flex-shrink-0">
      <button
        type="button"
        class="text-primary hover:text-primary/80 text-sm font-medium hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
        @click="async (event) => handleDownloadPDF()"
        :disabled="downloading"
      >
        <template v-if="downloading">
          {{ getLabel('downloadingPdf', 'Downloading...') }}
        </template>

        <template v-if="!downloading">
          {{ getLabel('downloadPdf', 'Order confirmation (PDF)') }}
        </template></button
      ><button
        type="button"
        class="text-primary hover:text-primary/80 text-sm font-medium hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
        @click="async (event) => handleReorder()"
        :disabled="reordering"
      >
        <template v-if="reordering">
          {{ getLabel('reordering', 'Adding items...') }}
        </template>

        <template v-if="!reordering">
          {{ getLabel('reorder', 'Order again') }}
        </template>
      </button>
    </div>
    <template v-if="toastVisible">
      <div
        :class="`fixed top-4 right-4 z-50 flex items-start gap-3 w-80 rounded-lg shadow-lg p-4 ${
          toastType === 'success'
            ? 'bg-green-50 border border-green-200'
            : 'bg-red-50 border border-red-200'
        }`"
      >
        <div
          :class="`flex-shrink-0 w-5 h-5 mt-0.5 ${
            toastType === 'success' ? 'text-green-500' : 'text-red-500'
          }`"
        >
          <template v-if="toastType === 'success'">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" :strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path>
            </svg>
          </template>

          <template v-if="toastType === 'error'">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" :strokeWidth="2">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              ></path>
            </svg>
          </template>
        </div>
        <p
          :class="`flex-1 text-sm font-medium ${
            toastType === 'success' ? 'text-green-800' : 'text-red-800'
          }`"
        >
          {{ toastMessage }}
        </p>
        <button
          type="button"
          @click="async (event) => dismissToast()"
          :class="`flex-shrink-0 rounded focus:outline-none ${
            toastType === 'success'
              ? 'text-green-400 hover:text-green-600'
              : 'text-red-400 hover:text-red-600'
          }`"
        >
          <svg
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            class="h-4 w-4"
            :strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

import {
  GraphQLClient,
  Order,
  Cart,
  Contact,
  Customer,
} from 'propeller-sdk-v2';

import { useOrders } from '../../composables/useOrders';

export interface OrderActionsProps {
  /** GraphQL client for the Propeller SDK */
  graphqlClient: GraphQLClient;
  /** The order to act upon */
  order: Order;
  /** The authenticated user */
  user: Contact | Customer | null;
  /** Cart ID — if provided, re-order adds items to this cart */
  cartId?: string;
  /** Active company ID from the company switcher */
  companyId?: number;
  /** Configuration object (imageSearchFiltersGrid, imageVariantFiltersSmall, etc.) */
  configuration?: any;
  /** Label overrides for UI strings */
  labels?: Record<string, string>;
  /** Additional CSS class for the root element */
  className?: string;
  /** Callback when a new cart is created during re-order */
  onCartCreated?: (cart: Cart) => void;
  /** Callback fired after all re-order items have been added */
  afterReorder?: (cart: Cart) => void;
}

interface OrderActionsState {
  reordering: boolean;
  downloading: boolean;
  toastMessage: string;
  toastType: string;
  toastVisible: boolean;
  showToast: (message: string, type: string) => void;
  dismissToast: () => void;
  getLabel: (key: string, fallback: string) => string;
  handleDownloadPDF: () => Promise<void>;
  handleReorder: () => Promise<void>;
}

const props = defineProps<OrderActionsProps>();

const userRef    = computed(() => props.user ?? null);
const companyRef = computed(() => props.companyId);

const { downloadPdf, reorder } = useOrders({
  graphqlClient: props.graphqlClient,
  user: userRef,
  companyId: companyRef,
  configuration: props.configuration,
  onCartCreated: props.onCartCreated,
  afterReorder: props.afterReorder,
});

const reordering = ref<OrderActionsState['reordering']>(false);
const downloading = ref<OrderActionsState['downloading']>(false);
const toastMessage = ref<OrderActionsState['toastMessage']>('');
const toastType = ref<OrderActionsState['toastType']>('');
const toastVisible = ref<OrderActionsState['toastVisible']>(false);

function showToast(message: string, type: string): ReturnType<OrderActionsState['showToast']> {
  toastMessage.value = message;
  toastType.value = type;
  toastVisible.value = true;
  setTimeout(() => {
    toastVisible.value = false;
  }, 3000);
}
function dismissToast(): ReturnType<OrderActionsState['dismissToast']> {
  toastVisible.value = false;
}
function getLabel(key: string, fallback: string): ReturnType<OrderActionsState['getLabel']> {
  return (props.labels as any)?.[key] || fallback;
}
async function handleDownloadPDF(): ReturnType<OrderActionsState['handleDownloadPDF']> {
  if (!props.order?.id) return;
  downloading.value = true;
  try {
    const result = await downloadPdf(props.order);
    if (result.success) {
      showToast(getLabel('pdfSuccess', 'PDF downloaded successfully'), 'success');
    } else {
      showToast(getLabel('pdfError', 'Failed to download PDF'), 'error');
    }
  } catch (error) {
    console.error('Error downloading PDF:', error);
    showToast(getLabel('pdfError', 'Failed to download PDF'), 'error');
  } finally {
    downloading.value = false;
  }
}
async function handleReorder(): ReturnType<OrderActionsState['handleReorder']> {
  if (!props.order?.items) return;
  reordering.value = true;
  try {
    const result = await reorder(props.order, props.cartId);
    if (result.success) {
      showToast(getLabel('reorderSuccess', 'All items added to cart'), 'success');
    } else {
      showToast(getLabel('reorderError', result.error || 'Failed to add items to cart'), 'error');
    }
  } catch (error) {
    console.error('Error during re-order:', error);
    showToast(getLabel('reorderError', 'Failed to add items to cart'), 'error');
  } finally {
    reordering.value = false;
  }
}
</script>
