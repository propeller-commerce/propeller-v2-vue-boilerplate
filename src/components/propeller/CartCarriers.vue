<template>
  <div :class="containerClass">
    <template v-if="carriers.length > 0">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <template :key="`${carrier.name}-${index}`" v-for="(carrier, index) in carriers">
          <div
            @click="async (event) => handleSelect(carrier)"
            :class="`cursor-pointer border border-gray-200 rounded-lg p-4 flex flex-col gap-2 transition-all ${
              selectedName === carrier.name
                ? 'border-secondary bg-secondary/5 shadow-sm'
                : 'hover:border-secondary/30'
            }`"
          >
            <div class="flex justify-between items-center">
              <div class="flex items-center gap-2">
                <template v-if="showLogo && getLogoUrl(carrier)">
                  <img class="h-6 w-auto" :src="getLogoUrl(carrier)" :alt="carrier.name" />
                </template>

                <span class="font-medium">{{ carrier.name }}</span>
              </div>
              <template v-if="showPrice !== false">
                <span class="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">{{
                  formatCarrierPrice(carrier.price)
                }}</span>
              </template>
            </div>
            <template v-if="carrier.deliveryDeadline">
              <p class="text-xs text-gray-500">
                {{ getLabel('deliveryDeadline', 'Delivery deadline:')
                }}{{ carrier.deliveryDeadline }}
              </p>
            </template>
          </div>
        </template>
      </div>
    </template>

    <template v-if="carriers.length === 0">
      <p class="text-gray-500 italic">
        {{ getLabel('noCarriers', 'No carriers available.') }}
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { Cart, CartCarrier } from 'propeller-sdk-v2';

export interface CartCarriersProps {
  /** Shopping cart object from which the carriers will be displayed */
  cart: Cart;

  /** The CSS class for the carriers container */
  carriersContainerClass?: string;

  /** Display the carrier logo */
  showCarrierLogo?: boolean;

  /** Action when a carrier is selected */
  onCarrierSelect?: (carrier: CartCarrier) => void;

  /** Custom price formatting function */
  formatPrice?: (price: number) => string;

  /** Show carrier price (default: true) */
  showPrice?: boolean;

  /** Labels for the component */
  labels?: Record<string, string>;
}
interface CartCarriersState {
  selectedName: string;
  containerClass: string;
  showLogo: boolean;
  carriers: CartCarrier[];
  getLabel: (key: string, fallback: string) => string;
  formatCarrierPrice: (price: number) => string;
  getLogoUrl: (carrier: CartCarrier) => string;
  handleSelect: (carrier: CartCarrier) => void;
}

const props = defineProps<CartCarriersProps>();
const selectedName = ref<CartCarriersState['selectedName']>('');

const containerClass = computed(() => {
  return props.carriersContainerClass || 'cart-carriers';
});
const showLogo = computed(() => {
  return props.showCarrierLogo !== undefined ? props.showCarrierLogo : true;
});
const carriers = computed(() => {
  return props.cart?.carriers || [];
});

watch(
  () => [props.cart],
  () => {
    if (!selectedName.value && props.cart?.postageData?.carrier) {
      selectedName.value = props.cart.postageData.carrier as string;
      if (props.onCarrierSelect) {
        const match = carriers.find((c: CartCarrier) => c.name === selectedName.value);
        if (match) props.onCarrierSelect(match);
      }
    }
  },
  { immediate: true }
);
function getLabel(key: string, fallback: string): ReturnType<CartCarriersState['getLabel']> {
  return props.labels?.[key] || fallback;
}
function formatCarrierPrice(price: number): ReturnType<CartCarriersState['formatCarrierPrice']> {
  if (props.formatPrice) {
    return props.formatPrice(price);
  }
  return '\u20AC' + Number(price || 0).toFixed(2);
}
function getLogoUrl(carrier: CartCarrier): ReturnType<CartCarriersState['getLogoUrl']> {
  return carrier.logo || '';
}
function handleSelect(carrier: CartCarrier): ReturnType<CartCarriersState['handleSelect']> {
  selectedName.value = carrier.name;
  if (props.onCarrierSelect) {
    props.onCarrierSelect(carrier);
  }
}
</script>
