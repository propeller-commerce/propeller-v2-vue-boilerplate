<template>
  <div :class="`order-shipments ${className || ''}`">
    <template v-if="shipments.length > 0">
      <div class="space-y-4">
        <h2 class="text-xl font-semibold">
          {{ getLabel('title', 'Shipping details') }}
        </h2>
        <div class="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
          <table class="w-full text-sm">
            <thead class="bg-muted/50 border-b border-border">
              <tr>
                <th class="text-left px-4 py-3 font-medium text-muted-foreground">
                  {{ getLabel('colStatus', 'Status') }}
                </th>
                <th class="text-left px-4 py-3 font-medium text-muted-foreground">
                  {{ getLabel('colCreatedAt', 'Date') }}
                </th>
                <th class="text-left px-4 py-3 font-medium text-muted-foreground">
                  {{ getLabel('colExpectedDelivery', 'Expected delivery') }}
                </th>
                <th class="text-left px-4 py-3 font-medium text-muted-foreground">
                  {{ getLabel('colItems', 'Items') }}
                </th>
                <th class="text-right px-4 py-3 font-medium text-muted-foreground">
                  {{ getLabel('colActions', 'Actions') }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              <template :key="index" v-for="(shipment, index) in shipments">
                <tr class="hover:bg-muted/30 transition-colors">
                  <td class="px-4 py-3">
                    <template v-if="!!shipment.status">
                      <span
                        class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                        >{{ shipment.status }}</span
                      >
                    </template>

                    <template v-if="!shipment.status">
                      <span class="text-muted-foreground">-</span>
                    </template>
                  </td>
                  <td class="px-4 py-3 text-muted-foreground">
                    {{ formatDate(shipment.createdAt) }}
                  </td>
                  <td class="px-4 py-3 text-muted-foreground">
                    <template v-if="!!shipment.expectedDeliveryAt">
                      {{ formatDate(shipment.expectedDeliveryAt) }}
                    </template>

                    <template v-if="!shipment.expectedDeliveryAt"> - </template>
                  </td>
                  <td class="px-4 py-3 text-muted-foreground">
                    {{ (shipment.items || []).length }}
                  </td>
                  <td class="px-4 py-3 text-right">
                    <button
                      type="button"
                      class="text-primary hover:text-primary/80 text-sm font-medium hover:underline"
                      @click="async (event) => openModal(shipment)"
                    >
                      {{ getLabel('details', 'Details') }}
                    </button>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <template v-if="!!activeShipment">
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @click="async (event) => closeModal()"
      >
        <div class="absolute inset-0 bg-black/50"></div>
        <div
          class="relative z-10 w-full max-w-2xl max-h-[80vh] overflow-y-auto bg-white rounded-lg shadow-xl"
          @click="async (e) => e.stopPropagation()"
        >
          <div class="flex items-center justify-between px-6 py-4 border-b">
            <h3 class="text-lg font-semibold">
              {{ getLabel('modalTitle', 'Shipment details') }}
            </h3>
            <button
              type="button"
              class="text-muted-foreground hover:text-foreground transition-colors"
              @click="async (event) => closeModal()"
            >
              <svg
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                class="h-5 w-5"
                :strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          <div class="px-6 py-4 space-y-4">
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span class="font-medium text-muted-foreground">{{
                  getLabel('labelStatus', 'Status')
                }}</span>
                <p class="mt-0.5">
                  <template v-if="!!activeShipment?.status">
                    <span
                      class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >{{ activeShipment?.status }}</span
                    >
                  </template>

                  <template v-if="!activeShipment?.status">
                    <span>-</span>
                  </template>
                </p>
              </div>
              <div>
                <span class="font-medium text-muted-foreground">{{
                  getLabel('labelExpectedDelivery', 'Expected delivery')
                }}</span>
                <p class="mt-0.5">
                  <template v-if="!!activeShipment?.expectedDeliveryAt">
                    {{ formatDate(activeShipment?.expectedDeliveryAt) }}
                  </template>

                  <template v-if="!activeShipment?.expectedDeliveryAt"> - </template>
                </p>
              </div>
            </div>
            <div>
              <h4 class="text-sm font-semibold mb-2">
                {{ getLabel('itemsTitle', 'Items') }}
              </h4>
              <template v-if="(activeShipment?.items || []).length > 0">
                <div class="rounded-lg border border-border overflow-hidden">
                  <table class="w-full text-sm">
                    <thead class="bg-muted/50 border-b border-border">
                      <tr>
                        <th class="text-left px-4 py-2 font-medium text-muted-foreground">
                          {{ getLabel('colProduct', 'Product') }}
                        </th>
                        <th class="text-left px-4 py-2 font-medium text-muted-foreground">
                          {{ getLabel('colSku', 'SKU') }}
                        </th>
                        <th class="text-center px-4 py-2 font-medium text-muted-foreground">
                          {{ getLabel('colQuantity', 'Qty') }}
                        </th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-border">
                      <template
                        :key="idx"
                        v-for="(shipmentItem, idx) in activeShipment?.items || []"
                      >
                        <tr class="hover:bg-muted/20">
                          <td class="px-4 py-2">
                            <template v-if="!!shipmentItem.name">
                              {{ shipmentItem.name }}
                            </template>

                            <template v-if="!shipmentItem.name">
                              <template v-if="!!getOrderItemForShipmentItem(shipmentItem as ShipmentItem)">
                                {{ getOrderItemForShipmentItem(shipmentItem as ShipmentItem)?.name || '-' }}
                              </template>

                              <template v-if="!getOrderItemForShipmentItem(shipmentItem as ShipmentItem)">
                                -
                              </template>
                            </template>
                          </td>
                          <td class="px-4 py-2 text-muted-foreground">
                            <template v-if="!!shipmentItem.sku">
                              {{ shipmentItem.sku }}
                            </template>

                            <template v-if="!shipmentItem.sku">
                              <template v-if="!!getOrderItemForShipmentItem(shipmentItem as ShipmentItem)">
                                {{ getOrderItemForShipmentItem(shipmentItem as ShipmentItem)?.product?.sku || '-' }}
                              </template>

                              <template v-if="!getOrderItemForShipmentItem(shipmentItem as ShipmentItem)">
                                -
                              </template>
                            </template>
                          </td>
                          <td class="px-4 py-2 text-center">
                            {{ shipmentItem.quantity || '-' }}
                          </td>
                        </tr>
                      </template>
                    </tbody>
                  </table>
                </div>
              </template>

              <template v-if="(activeShipment?.items || []).length === 0">
                <p class="text-sm text-muted-foreground">
                  {{ getLabel('noItems', 'No items in this shipment') }}
                </p>
              </template>
            </div>
            <template v-if="(activeShipment?.trackAndTraces || []).length > 0">
              <div>
                <h4 class="text-sm font-semibold mb-2">
                  {{ getLabel('trackAndTraceTitle', 'Track & Trace') }}
                </h4>
                <div class="flex flex-wrap gap-2">
                  <template
                    :key="tatIdx"
                    v-for="(tat, tatIdx) in activeShipment?.trackAndTraces || []"
                  >
                    <template v-if="!!tat.carrier?.trackAndTraceURL">
                      <a
                        target="_blank"
                        rel="noopener noreferrer"
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-primary text-primary text-sm font-medium hover:bg-primary/5 transition-colors"
                        :href="buildTrackAndTraceUrl(tat as TrackAndTrace)"
                        ><svg
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          class="h-4 w-4"
                          :strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                          ></path>
                        </svg>
                        <template v-if="!!tat.carrier?.name">
                          {{ getLabel('trackAndTrace', 'Track & Trace') }}
                          -
                          {{ tat.carrier?.name }}
                        </template>

                        <template v-if="!tat.carrier?.name">
                          {{ getLabel('trackAndTrace', 'Track & Trace') }}
                          (
                          {{ tat.code }}
                          )
                        </template>
                      </a>
                    </template>
                  </template>
                </div>
              </div>
            </template>
          </div>
          <div class="flex justify-end px-6 py-4 border-t">
            <button
              type="button"
              class="px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-muted transition-colors"
              @click="async (event) => closeModal()"
            >
              {{ getLabel('close', 'Close') }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import { Order, Shipment, ShipmentItem, TrackAndTrace, OrderItem } from 'propeller-sdk-v2';
import { getLabel as _getLabel } from '../../composables/shared/utils/labelHelpers';

export interface OrderShipmentsProps {
  /** The current order the user is viewing */
  order: Order;

  /** Labels for the component */
  labels?: Record<string, string>;

  /** Additional CSS class for the root element */
  className?: string;
}
interface OrderShipmentsState {
  activeShipment: Shipment | null;
  getLabel: (key: string, fallback: string) => string;
  openModal: (shipment: Shipment) => void;
  closeModal: () => void;
  formatDate: (dateStr: string) => string;
  getOrderItemForShipmentItem: (shipmentItem: ShipmentItem) => OrderItem | null;
  buildTrackAndTraceUrl: (tat: TrackAndTrace) => string;
}

const props = defineProps<OrderShipmentsProps>();
const activeShipment = ref<OrderShipmentsState['activeShipment']>(null);
const shipments = computed(() => props.order.shipments || []);

function getLabel(key: string, fallback: string): ReturnType<OrderShipmentsState['getLabel']> {
  return _getLabel(props.labels, key, fallback);
}
function openModal(shipment: Shipment): ReturnType<OrderShipmentsState['openModal']> {
  activeShipment.value = shipment;
}
function closeModal(): ReturnType<OrderShipmentsState['closeModal']> {
  activeShipment.value = null;
}
function formatDate(dateStr: string): ReturnType<OrderShipmentsState['formatDate']> {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}
function getOrderItemForShipmentItem(
  shipmentItem: ShipmentItem
): ReturnType<OrderShipmentsState['getOrderItemForShipmentItem']> {
  if (!props.order?.items || !shipmentItem.orderItemId) return null;
  return (
    (props.order.items as OrderItem[]).find(
      (oi: OrderItem) => oi.id === shipmentItem.orderItemId
    ) || null
  );
}
function buildTrackAndTraceUrl(
  tat: TrackAndTrace
): ReturnType<OrderShipmentsState['buildTrackAndTraceUrl']> {
  const baseUrl = tat.carrier?.trackAndTraceURL || '';
  const code = tat.code || '';
  return `${baseUrl}${code}`;
}
</script>
