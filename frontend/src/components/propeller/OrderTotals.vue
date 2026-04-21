<template>
  <div class="w-full md:w-80 bg-white p-6 rounded-lg shadow space-y-3">
    <template v-if="showSubtotal">
      <div class="flex justify-between text-gray-600">
        <span>{{ getLabel('subtotal', 'Subtotal:') }}</span
        ><span>{{ formatItemPrice(subtotal) }}</span>
      </div>
    </template>

    <template v-if="showDiscount && hasDiscount">
      <div class="flex justify-between text-secondary">
        <span>{{ getLabel('discount', 'Discount:') }}</span
        ><span>{{ discountDisplay }}</span>
      </div>
      <div class="flex justify-between text-gray-600 border-t pt-2 border-dashed">
        <span>{{ getLabel('subtotalWithDiscount', 'Subtotal with discount:') }}</span
        ><span>{{ formatItemPrice(subtotalWithDiscount) }}</span>
      </div>
    </template>

    <template v-if="hasTransactionCosts">
      <div class="flex justify-between text-gray-600">
        <span>{{ getLabel('transactionCosts', 'Transaction costs:') }}</span
        ><span>{{ formatItemPrice(transactionCosts) }}</span>
      </div>
    </template>

    <template v-if="showShippingCosts && hasShippingCosts">
      <div class="flex justify-between text-gray-600">
        <span>{{ getLabel('shippingCosts', 'Shipping costs:') }}</span
        ><span>{{ formatItemPrice(shippingCosts) }}</span>
      </div>
    </template>

    <template v-if="showTotalExclVat">
      <div class="flex justify-between text-gray-600 pt-2 border-t">
        <span>{{ getLabel('totalExclVat', 'Total excl. VAT:') }}</span
        ><span>{{ formatItemPrice(totalExclVat) }}</span>
      </div>
    </template>

    <template v-if="showVATs && taxPercentages.length > 0">
      <template :key="index" v-for="(tax, index) in taxPercentages">
        <div class="flex justify-between text-gray-600 text-sm">
          <span>{{ tax.percentage }}% {{ getLabel('vat', 'VAT') }}:</span
          ><span>{{ formatItemPrice(Number(tax.total)) }}</span>
        </div>
      </template>
    </template>

    <template v-if="showTotalVat">
      <div class="flex justify-between text-gray-600 text-sm">
        <span>{{ getLabel('totalVat', 'Total VAT:') }}</span
        ><span>{{ formatItemPrice(totalVat) }}</span>
      </div>
    </template>

    <div class="flex justify-between text-xl font-bold pt-4 border-t text-gray-900 mt-2">
      <span>{{ getLabel('total', 'Total:') }}</span
      ><span>{{ formatItemPrice(totalInclVat) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { Order, Enums } from 'propeller-sdk-v2';

export interface OrderTotalsProps {
  /** The order/quote used to populate the summary data */
  order: Order;

  /** Order summary block title */
  title?: string;

  /** Labels for the component */
  labels?: Record<string, string>;

  /** Display the subtotal of the order/quote */
  showSubtotal?: boolean;

  /** Display the total discount of the order/quote */
  showDiscount?: boolean;

  /** Display the shipping costs of the order/quote */
  showShippingCosts?: boolean;

  /** Display all VATs of the order/quote */
  showVATs?: boolean;

  /** Display the total of the order/quote excluding the VAT */
  showTotalExclVat?: boolean;

  /** Display the total VAT of the order/quote */
  showTotalVat?: boolean;

  /** Custom price formatting function */
  formatPrice?: (price: number) => string;
}
interface OrderTotalsState {
  title: string;
  showSubtotal: boolean;
  showDiscount: boolean;
  showShippingCosts: boolean;
  showVATs: boolean;
  showTotalExclVat: boolean;
  showTotalVat: boolean;
  getLabel: (key: string, fallback: string) => string;
  formatItemPrice: (price: number) => string;
  subtotal: number;
  hasDiscount: boolean;
  discountDisplay: string;
  subtotalWithDiscount: number;
  hasTransactionCosts: boolean;
  transactionCosts: number;
  hasShippingCosts: boolean;
  shippingCosts: number;
  totalExclVat: number;
  taxPercentages: any[];
  totalInclVat: number;
  totalVat: number;
}

const props = withDefaults(defineProps<OrderTotalsProps>(), {
  showSubtotal: true,
  showDiscount: true,
  showShippingCosts: true,
  showVATs: true,
  showTotalExclVat: true,
  showTotalVat: true,
});

const title = computed(() => {
  return props.title || 'Order summary';
});
const showSubtotal = computed(() => {
  return props.showSubtotal !== undefined ? props.showSubtotal : true;
});
const showDiscount = computed(() => {
  return props.showDiscount !== undefined ? props.showDiscount : true;
});
const showShippingCosts = computed(() => {
  return props.showShippingCosts !== undefined ? props.showShippingCosts : true;
});
const showVATs = computed(() => {
  return props.showVATs !== undefined ? props.showVATs : true;
});
const showTotalExclVat = computed(() => {
  return props.showTotalExclVat !== undefined ? props.showTotalExclVat : true;
});
const showTotalVat = computed(() => {
  return props.showTotalVat !== undefined ? props.showTotalVat : true;
});
const subtotal = computed(() => {
  return (props.order as any)?.total?.gross || 0;
});
const hasDiscount = computed(() => {
  const total = (props.order as any)?.total;
  return (
    total?.discountType &&
    total.discountType !== Enums.OrderDiscountType.N &&
    total.discountValue > 0
  );
});
const discountDisplay = computed(() => {
  const total = (props.order as any)?.total;
  if (!total) return '';
  if (total.discountType === Enums.OrderDiscountType.A) {
    return '-' + formatItemPrice(total.discountValue);
  }
  if (total.discountType === Enums.OrderDiscountType.P) {
    return '- ' + total.discountValue + '%';
  }
  return '-' + formatItemPrice(total.discountValue);
});
const subtotalWithDiscount = computed(() => {
  const total = (props.order as any)?.total;
  return (total?.gross || 0) - (total?.discountValue || 0);
});
const hasTransactionCosts = computed(() => {
  return (props.order as any)?.paymentData?.gross > 0;
});
const transactionCosts = computed(() => {
  return Number((props.order as any)?.paymentData?.gross || 0);
});
const hasShippingCosts = computed(() => {
  return (props.order as any)?.postageData?.gross > 0;
});
const shippingCosts = computed(() => {
  return Number((props.order as any)?.postageData?.gross || 0);
});
const totalExclVat = computed(() => {
  return (props.order as any)?.total?.gross || 0;
});
const taxPercentages = computed(() => {
  const taxes = (props.order as any)?.total?.taxPercentages || [];
  return taxes.filter((tax: any) => tax.percentage > 0 && tax.total > 0);
});
const totalInclVat = computed(() => {
  return (props.order as any)?.total?.net || 0;
});
const totalVat = computed(() => {
  let sum = 0;
  const taxes = taxPercentages;
  for (let i = 0; i < taxes.length; i++) {
    sum += Number(taxes[i].total || 0);
  }
  return sum;
});

function getLabel(key: string, fallback: string): ReturnType<OrderTotalsState['getLabel']> {
  return props.labels?.[key] || fallback;
}
function formatItemPrice(price: number): ReturnType<OrderTotalsState['formatItemPrice']> {
  if (props.formatPrice) {
    return props.formatPrice(price);
  }
  return '€' + Number(price || 0).toFixed(2);
}
</script>
