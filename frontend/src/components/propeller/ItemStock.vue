<template>
  <template v-if="hasInventory()">
    <div :class="`flex flex-wrap items-center gap-1.5 ${className || ''}`">
      <template v-if="showAvailability !== false">
        <span
          :class="`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${getAvailabilityClass()}`"
          ><span
            :class="`h-1.5 w-1.5 flex-shrink-0 rounded-full ${getAvailabilityDotClass()}`"
          ></span
          >{{ getAvailabilityLabel() }}</span
        >
      </template>

      <template v-if="showStock !== false && !!getStockStatusLabel()">
        <span
          :class="`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${getStockStatusClass()}`"
          >{{ getStockStatusLabel() }}
          <template v-if="getTotalQuantity() > 0">
            <span class="opacity-70">
              ({{ getTotalQuantity() }}{{ getLabel('pieces', 'pcs') }})
            </span>
          </template>
        </span>
      </template>
    </div>
  </template>
</template>

<script setup lang="ts">
import { ProductInventory } from 'propeller-sdk-v2';
import { getLabel as _getLabel } from '../../composables/shared/utils/labelHelpers';

export interface ItemStockProps {
  /**
   * Product inventory to display stock and availability for.
   * Required — drives all stock calculations and display logic.
   */
  inventory: ProductInventory;

  /**
   * Shows whether the product is available or not available.
   * Defaults to true.
   */
  showAvailability?: boolean;

  /**
   * Shows the actual stock quantity (`inventory.totalQuantity`).
   * Defaults to true.
   */
  showStock?: boolean;

  /**
   * UI string overrides.
   * Available keys: inStock, outOfStock, lowStock, available, notAvailable, pieces
   */
  labels?: Record<string, string>;

  /** Extra CSS class applied to the root element. */
  className?: string;
}

const props = withDefaults(defineProps<ItemStockProps>(), {
  showAvailability: true,
  showStock: true,
});

function getLabel(key: string, fallback: string): string {
  return _getLabel(props.labels, key, fallback);
}
function getTotalQuantity(): number {
  const qty = (props.inventory as ProductInventory)?.totalQuantity;
  return qty !== undefined && qty !== null ? qty : -1;
}
function isAvailable(): boolean {
  return getTotalQuantity() > 0;
}
function getStockStatusLabel(): string {
  const qty = getTotalQuantity();
  if (qty < 0) return '';
  if (qty === 0) return getLabel('outOfStock', 'Out of stock');
  if (qty <= 5) return getLabel('lowStock', 'Low stock');
  return getLabel('inStock', 'In stock');
}
function getStockStatusClass(): string {
  const qty = getTotalQuantity();
  if (qty <= 0) return 'text-red-600 bg-red-50 border-red-100';
  if (qty <= 5) return 'text-amber-600 bg-amber-50 border-amber-100';
  return 'text-green-600 bg-green-50 border-green-100';
}
function getAvailabilityLabel(): string {
  return isAvailable()
    ? getLabel('available', 'Available')
    : getLabel('notAvailable', 'Not available');
}
function getAvailabilityClass(): string {
  return isAvailable()
    ? 'text-green-600 bg-green-50 border-green-100'
    : 'text-red-600 bg-red-50 border-red-100';
}
function getAvailabilityDotClass(): string {
  return isAvailable() ? 'bg-green-500' : 'bg-red-500';
}
function hasInventory(): boolean {
  return !!(props.inventory as ProductInventory) && getTotalQuantity() >= 0;
}
</script>
