<template>
  <div :class="containerClass">
    <template v-if="payMethods.length > 0">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <template :key="method.code" v-for="(method, index) in payMethods">
          <div
            @click="async (event) => handleSelect(method)"
            :class="`cursor-pointer border border-gray-200 rounded-lg p-4 flex flex-col gap-2 transition-all ${
              selectedCode === method.code
                ? 'border-secondary bg-secondary/5 shadow-sm'
                : 'hover:border-secondary/30'
            }`"
          >
            <div class="flex justify-between items-center">
              <div class="flex items-center gap-2">
                <span class="font-medium">{{ method.name || method.code }}</span>
              </div>
              <template v-if="method.price > 0">
                <span class="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">{{
                  formatMethodPrice(method.price)
                }}</span>
              </template>
            </div>
          </div>
        </template>
      </div>
    </template>

    <template v-if="payMethods.length === 0">
      <p class="text-gray-500 italic">
        {{ getLabel('noMethods', 'No payment methods available.') }}
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { Cart, CartPaymethod, Contact, Customer } from 'propeller-sdk-v2';

export interface CartPaymethodsProps {
  /** Shopping cart object from which the payment methods will be displayed */
  cart: Cart;

  /** Authenticated user — used for cart creation / lookup. */
  user: Contact | Customer | null;

  /** The CSS class for the payment methods container */
  paymentsContainerClass?: string;

  /** Display the on account payment method for anonymous users */
  showOnAccountForGuests?: boolean;

  /** Action when a payment method is selected */
  onPaymethodSelect?: (paymethod: CartPaymethod) => void;

  /** Custom price formatting function */
  formatPrice?: (price: number) => string;

  /** Labels for the component */
  labels?: Record<string, string>;
}
interface CartPaymethodsState {
  selectedCode: string;
  containerClass: string;
  showOnAccountForGuests: boolean;
  isGuest: boolean;
  payMethods: CartPaymethod[];
  isOnAccountMethod: (method: CartPaymethod) => boolean;
  getLabel: (key: string, fallback: string) => string;
  formatMethodPrice: (price: number) => string;
  handleSelect: (method: CartPaymethod) => void;
}

const props = withDefaults(defineProps<CartPaymethodsProps>(), {
  showOnAccountForGuests: false,
});
const selectedCode = ref<CartPaymethodsState['selectedCode']>('');

const containerClass = computed(() => {
  return props.paymentsContainerClass || 'cart-paymethods';
});
const showOnAccountForGuests = computed(() => {
  return props.showOnAccountForGuests !== undefined ? props.showOnAccountForGuests : false;
});
const isGuest = computed(() => {
  return !props.user;
});
const payMethods = computed(() => {
  const methods: CartPaymethod[] = props.cart?.payMethods || [];
  return methods.filter((m: CartPaymethod) => {
    if (!m?.code) return false;
    if (!showOnAccountForGuests && isGuest && isOnAccountMethod(m)) {
      return false;
    }
    return true;
  });
});

watch(
  () => [props.cart],
  () => {
    if (!selectedCode.value && props.cart?.paymentData?.method) {
      selectedCode.value = props.cart.paymentData.method as string;
      if (props.onPaymethodSelect) {
        const match = payMethods.value.find((m: CartPaymethod) => m.code === selectedCode.value);
        if (match) props.onPaymethodSelect(match);
      }
    }
  },
  { immediate: true }
);
function isOnAccountMethod(
  method: CartPaymethod
): ReturnType<CartPaymethodsState['isOnAccountMethod']> {
  const code = (method.code || '').toLowerCase();
  return code === 'on_account' || code === 'onaccount' || code === 'on-account';
}
function getLabel(key: string, fallback: string): ReturnType<CartPaymethodsState['getLabel']> {
  return props.labels?.[key] || fallback;
}
function formatMethodPrice(price: number): ReturnType<CartPaymethodsState['formatMethodPrice']> {
  if (props.formatPrice) {
    return props.formatPrice(price);
  }
  return '\u20AC' + Number(price || 0).toFixed(2);
}
function handleSelect(method: CartPaymethod): ReturnType<CartPaymethodsState['handleSelect']> {
  selectedCode.value = method.code;
  if (props.onPaymethodSelect) {
    props.onPaymethodSelect(method);
  }
}
</script>
