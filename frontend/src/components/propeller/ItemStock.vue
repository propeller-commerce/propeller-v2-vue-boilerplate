<template>
  <template v-if="hasInventory()">
    <div
      :class="`propeller-item-stock flex flex-wrap items-center gap-1.5 ${className || ''}`"
      :data-available="isAvailable() ? 'true' : 'false'"
      :data-stock="getStockStatusData()"
    >
      <template v-if="showAvailability !== false">
        <span
          :class="`propeller-item-stock__availability inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${getAvailabilityClass()}`"
          ><span
            :class="`propeller-item-stock__availability-dot h-1.5 w-1.5 flex-shrink-0 rounded-full ${getAvailabilityDotClass()}`"
          ></span
          >{{ getAvailabilityLabel() }}</span
        >
      </template>

      <template v-if="showStock !== false && !!getStockStatusLabel()">
        <span
          :class="`propeller-item-stock__status inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${getStockStatusClass()}`"
          >{{ getStockStatusLabel() }}
          <template v-if="getTotalQuantity() > 0">
            <span class="propeller-item-stock__count opacity-70">
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
  if (qty <= 0) return 'text-destructive bg-destructive/10 border-destructive';
  if (qty <= 5) return 'text-warning bg-warning/10 border-warning';
  return 'text-success bg-success/10 border-success';
}
function getStockStatusData(): string {
  const qty = getTotalQuantity();
  if (qty <= 0) return 'out';
  if (qty <= 5) return 'low';
  return 'in';
}
function getAvailabilityLabel(): string {
  return isAvailable()
    ? getLabel('available', 'Available')
    : getLabel('notAvailable', 'Not available');
}
function getAvailabilityClass(): string {
  return isAvailable()
    ? 'text-success bg-success/10 border-success'
    : 'text-destructive bg-destructive/10 border-destructive';
}
function getAvailabilityDotClass(): string {
  return isAvailable() ? 'bg-success' : 'bg-destructive';
}
function hasInventory(): boolean {
  return !!(props.inventory as ProductInventory) && getTotalQuantity() >= 0;
}
</script>
