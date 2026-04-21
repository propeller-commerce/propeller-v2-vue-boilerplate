<template>
  <tbody>
    <tr :class="isChildItem ? 'border-0' : 'hover:bg-gray-50 transition'">
      <td :class="isChildItem ? 'px-6 py-2 pl-28' : 'px-6 py-4'">
        <div class="flex items-center gap-4">
          <template v-if="showImage">
            <template v-if="productImage">
              <div class="relative w-16 h-16 flex-shrink-0 rounded overflow-hidden">
                <img class="object-cover w-full h-full" :src="productImage" :alt="productName" />
              </div>
            </template>

            <template v-if="!productImage">
              <div
                class="w-16 h-16 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs"
              >
                No Img
              </div>
            </template>
          </template>

          <div>
            <template v-if="titleLinkable && productUrl && !isChildItem">
              <a
                class="font-medium text-foreground hover:text-primary hover:underline"
                :href="productUrl"
                >{{ productName }}</a
              >
            </template>

            <template v-if="!titleLinkable || !productUrl || isChildItem">
              <span :class="isChildItem ? 'text-sm text-gray-700' : 'font-medium'">{{
                productName
              }}</span>
            </template>

            <template v-if="showSku && productSku">
              <p class="text-sm text-gray-500 mt-1">SKU: {{ productSku }}</p>
            </template>

            <template v-if="showItemNotes && notes">
              <p class="text-sm text-gray-400 mt-1 italic">{{ notes }}</p>
            </template>

            <template v-if="showStockComponent">
              <p class="text-xs text-gray-400 mt-1">Stock info</p>
            </template>
          </div>
        </div>
      </td>
      <template v-if="showQuantity">
        <td
          :class="
            isChildItem ? 'px-6 py-2 text-center text-sm text-gray-600' : 'px-6 py-4 text-center'
          "
        >
          {{ quantity }}
        </td>
      </template>

      <template v-if="showDiscount">
        <td
          :class="
            isChildItem
              ? 'px-6 py-2 text-right text-sm text-gray-600'
              : 'px-6 py-4 text-right whitespace-nowrap text-orange-600'
          "
        >
          <template v-if="discount > 0">
            {{ formatDiscountDisplay() }}
          </template>
        </td>
      </template>

      <template v-if="showPrice">
        <td
          :class="
            isChildItem
              ? 'px-6 py-2 text-right whitespace-nowrap text-sm text-gray-600'
              : 'px-6 py-4 text-right whitespace-nowrap'
          "
        >
          {{ formatItemPrice(priceTotal) }}
        </td>
      </template>
    </tr>
    <template v-if="hasChildren">
      <template :key="child.id || child.uuid" v-for="(child, index) in childItems || []">
        <tr class="border-0">
          <td class="px-6 py-2 pl-28">
            <span class="text-sm text-gray-700">{{
              child.product?.names?.[0]?.value || child.name || 'Unknown'
            }}</span>
          </td>
          <template v-if="showQuantity">
            <td class="px-6 py-2 text-center text-sm text-gray-600">
              {{ child.quantity || 0 }}
            </td>
          </template>

          <template v-if="showDiscount">
            <td class="px-6 py-2 text-right text-sm text-gray-600"></td>
          </template>

          <template v-if="showPrice">
            <td class="px-6 py-2 text-right whitespace-nowrap text-sm text-gray-600">
              {{ formatItemPrice(child.priceTotal || 0) }}
            </td>
          </template>
        </tr>
      </template>
    </template>
  </tbody>
</template>

<script setup lang="ts">
import type { OrderItem } from 'propeller-sdk-v2';
import { computed } from 'vue';

export interface OrderItemCardProps {
  /** The order item to display */
  orderItem: OrderItem;

  /** Child order items (rendered as indented sub-rows beneath the parent) */
  childItems?: OrderItem[];

  /** Should the item title be a link to the PDP */
  titleLinkable?: boolean;

  /** Display a small thumbnail of the order item */
  showImage?: boolean;

  /** Should stock info be displayed */
  showStockComponent?: boolean;

  /** Display the SKU of the order item beneath the item name */
  showSku?: boolean;

  /** Display the quantity of the order item */
  showQuantity?: boolean;

  /** Display the price of the order item */
  showPrice?: boolean;

  /** Display the discount column */
  showDiscount?: boolean;

  /** Should the order item notes field be displayed */
  showItemNotes?: boolean;

  /** Render as a child/sub-item (indented, no image) */
  isChildItem?: boolean;

  /** Custom price formatting function */
  formatPrice?: (price: number) => string;
}
interface OrderItemCardState {
  titleLinkable: boolean;
  showImage: boolean;
  showSku: boolean;
  showQuantity: boolean;
  showPrice: boolean;
  showDiscount: boolean;
  showStockComponent: boolean;
  showItemNotes: boolean;
  isChildItem: boolean;
  productName: string;
  productSku: string;
  productImage: string;
  productId: number | undefined;
  productSlug: string;
  productUrl: string;
  quantity: number;
  price: number;
  priceTotal: number;
  discount: number;
  originalPrice: number;
  discountPercentage: number;
  notes: string;
  hasChildren: boolean;
  formatItemPrice: (price: number) => string;
  formatDiscountDisplay: () => string;
}

const props = withDefaults(defineProps<OrderItemCardProps>(), {
  titleLinkable: true,
  showImage: true,
  showSku: true,
  showQuantity: true,
  showPrice: true,
  showDiscount: false,
  showStockComponent: false,
  showItemNotes: false,
  isChildItem: false,
});

const titleLinkable = computed(() => {
  return props.titleLinkable !== undefined ? props.titleLinkable : true;
});
const showImage = computed(() => {
  if (props.isChildItem) return false;
  return props.showImage !== undefined ? props.showImage : true;
});
const showSku = computed(() => {
  if (props.isChildItem) return false;
  return props.showSku !== undefined ? props.showSku : true;
});
const showQuantity = computed(() => {
  return props.showQuantity !== undefined ? props.showQuantity : true;
});
const showPrice = computed(() => {
  return props.showPrice !== undefined ? props.showPrice : true;
});
const showDiscount = computed(() => {
  return props.showDiscount !== undefined ? props.showDiscount : false;
});
const showStockComponent = computed(() => {
  return props.showStockComponent !== undefined ? props.showStockComponent : false;
});
const showItemNotes = computed(() => {
  return props.showItemNotes !== undefined ? props.showItemNotes : false;
});
const isChildItem = computed(() => {
  return props.isChildItem || false;
});
const productName = computed(() => {
  const item = props.orderItem;
  return item?.product?.names?.[0]?.value || item?.name || 'Unknown Product';
});
const productSku = computed(() => {
  return props.orderItem?.product?.sku || props.orderItem?.sku || '';
});
const productImage = computed(() => {
  return props.orderItem?.product?.media?.images?.items?.[0]?.imageVariants?.[0]?.url || '';
});
const productId = computed(() => {
  return props.orderItem?.product?.productId;
});
const productSlug = computed(() => {
  return props.orderItem?.product?.slugs?.[0]?.value || '';
});
const productUrl = computed(() => {
  if (productId && productSlug) {
    return '/product/' + productId + '/' + productSlug;
  }
  return '';
});
const quantity = computed(() => {
  return props.orderItem?.quantity || 0;
});
const price = computed(() => {
  return props.orderItem?.price || 0;
});
const priceTotal = computed(() => {
  return props.orderItem?.priceTotal || 0;
});
const discount = computed(() => {
  return props.orderItem?.discount || 0;
});
const originalPrice = computed(() => {
  return props.orderItem?.originalPrice || 0;
});
const discountPercentage = computed(() => {
  if (originalPrice.value > 0 && discount.value > 0) {
    return (discount.value / originalPrice.value) * 100;
  }
  return 0;
});
const notes = computed(() => {
  return props.orderItem?.notes || '';
});
const hasChildren = computed(() => {
  return (props.childItems || []).length > 0;
});

function formatItemPrice(price: number): ReturnType<OrderItemCardState['formatItemPrice']> {
  if (props.formatPrice) {
    return props.formatPrice(price);
  }
  if (!price && price !== 0) return '-';
  return '€' + Number(price).toFixed(2);
}
function formatDiscountDisplay(): ReturnType<OrderItemCardState['formatDiscountDisplay']> {
  const discountStr = formatItemPrice(discount.value);
  if (discountPercentage.value > 0) {
    return discountStr + ' (' + discountPercentage.value.toFixed(2).replace('.', ',') + '%)';
  }
  return discountStr;
}
</script>
