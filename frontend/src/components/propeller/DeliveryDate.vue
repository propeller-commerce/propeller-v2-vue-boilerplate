<template>
  <div :class="containerClass">
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
      <template :key="index" v-for="(dateStr, index) in upcomingDates">
        <div
          @click="async (event) => handleSelect(dateStr)"
          :class="`cursor-pointer border border-gray-200 rounded-lg p-3 text-center transition-all ${
            selectedDate === dateStr
              ? 'border-secondary bg-secondary/5 shadow-sm'
              : 'hover:border-secondary/30'
          }`"
        >
          <div class="font-semibold">{{ formatDisplay(dateStr) }}</div>
        </div>
      </template>
      <template v-if="showDatePicker">
        <div
          @click="async (event) => openModal()"
          :class="`cursor-pointer border border-gray-200 rounded-lg p-3 text-center transition-all ${
            isCustomDateSelected
              ? 'border-secondary bg-secondary/5 shadow-sm'
              : 'hover:border-secondary/30'
          }`"
        >
          <template v-if="isCustomDateSelected">
            <div class="font-semibold">{{ formatDisplay(selectedDate) }}</div>
          </template>

          <template v-if="!isCustomDateSelected">
            <div class="font-semibold">
              {{ getLabel('pickDate', 'Other date...') }}
            </div>
          </template>
        </div>
      </template>
    </div>
    <template v-if="modalOpen">
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        @click="async (event) => handleBackdropClick(event)"
      >
        <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold">
              {{ getLabel('modalTitle', 'Select a delivery date') }}
            </h3>
            <button
              type="button"
              class="text-gray-400 hover:text-gray-600 transition-colors"
              @click="async (event) => closeModal()"
            >
              <svg
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                class="w-5 h-5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          <input
            type="date"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary focus:border-secondary"
            :min="minDate"
            :value="customDateValue"
            @change="async (event) => handleCustomDateChange(event.target.value)"
          />
          <div class="flex justify-end gap-3 mt-4">
            <button
              type="button"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              @click="async (event) => closeModal()"
            >
              {{ getLabel('cancel', 'Cancel') }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { Cart } from 'propeller-sdk-v2';

export interface DeliveryDateProps {
  /** The cart to use for the delivery date */
  cart: Cart;

  /** Show the upcoming N days in the date selector */
  showUpcomingDays?: number;

  /** Skip weekends in the date selector */
  skipWeekends?: boolean;

  /** Show date picker as an option in the date selector */
  showDatePicker?: boolean;

  /** Action when a delivery date is selected */
  onDateSelect?: (date: string) => void;

  /** Custom date display formatting function */
  formatDateDisplay?: (date: string) => string;

  /** Labels for the component */
  labels?: Record<string, string>;

  /** The CSS class for the container */
  containerClass?: string;

  /** Pre-selected date from cart (e.g. cart.postageData.requestDate: "2026-04-17T00:00:00.000Z") */
  initialDate?: string;
}
interface DeliveryDateState {
  selectedDate: string;
  modalOpen: boolean;
  customDateValue: string;
  upcomingDays: number;
  skipWeekends: boolean;
  showDatePicker: boolean;
  isCustomDateSelected: boolean;
  containerClass: string;
  upcomingDates: string[];
  minDate: string;
  getLabel: (key: string, fallback: string) => string;
  toApiDate: (date: Date) => string;
  formatDisplay: (isoDate: string) => string;
  handleSelect: (isoDate: string) => void;
  handleCustomDateChange: (value: string) => void;
  openModal: () => void;
  closeModal: () => void;
  handleBackdropClick: (event: Event) => void;
}

const props = defineProps<DeliveryDateProps>();
const selectedDate = ref<DeliveryDateState['selectedDate']>('');
const modalOpen = ref<DeliveryDateState['modalOpen']>(false);
const customDateValue = ref<DeliveryDateState['customDateValue']>('');

const upcomingDays = computed(() => {
  return props.showUpcomingDays !== undefined ? props.showUpcomingDays : 3;
});
const skipWeekends = computed(() => {
  return props.skipWeekends !== undefined ? props.skipWeekends : true;
});
const showDatePicker = computed(() => {
  return props.showDatePicker !== undefined ? props.showDatePicker : true;
});
const isCustomDateSelected = computed(() => {
  return selectedDate.value !== '' && upcomingDates.value.indexOf(selectedDate.value) === -1;
});
const containerClass = computed(() => {
  return props.containerClass || 'delivery-date';
});
const upcomingDates = computed(() => {
  const days: string[] = [];
  const today = new Date();
  const current = new Date(today);
  current.setDate(current.getDate() + 1);
  while (days.length < upcomingDays.value) {
    const dayOfWeek = current.getDay();
    if (!skipWeekends.value || (dayOfWeek !== 0 && dayOfWeek !== 6)) {
      days.push(toApiDate(current));
    }
    current.setDate(current.getDate() + 1);
  }
  return days;
});
const minDate = computed(() => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const y = tomorrow.getFullYear();
  const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const d = String(tomorrow.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
});

watch(
  () => [props.initialDate, props.cart],
  () => {
    if (props.initialDate && !selectedDate.value) {
      // Normalize cart format "2026-04-17T00:00:00.000Z" → "2026-04-17T00:00:00Z"
      const dot = props.initialDate.lastIndexOf('.');
      const normalized = dot !== -1 ? props.initialDate.substring(0, dot) + 'Z' : props.initialDate;
      selectedDate.value = normalized;
      if (props.onDateSelect) {
        props.onDateSelect(normalized);
      }
    }
  },
  { immediate: true }
);
function getLabel(key: string, fallback: string): ReturnType<DeliveryDateState['getLabel']> {
  return props.labels?.[key] || fallback;
}
function toApiDate(date: Date): ReturnType<DeliveryDateState['toApiDate']> {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d + 'T00:00:00Z';
}
function formatDisplay(isoDate: string): ReturnType<DeliveryDateState['formatDisplay']> {
  if (props.formatDateDisplay) {
    return props.formatDateDisplay(isoDate);
  }
  const date = new Date(isoDate);
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return weekday + ', ' + months[date.getMonth()] + ' ' + date.getDate();
}
function handleSelect(isoDate: string): ReturnType<DeliveryDateState['handleSelect']> {
  selectedDate.value = isoDate;
  modalOpen.value = false;
  if (props.onDateSelect) {
    props.onDateSelect(isoDate);
  }
}
function handleCustomDateChange(
  value: string
): ReturnType<DeliveryDateState['handleCustomDateChange']> {
  customDateValue.value = value;
  if (value) {
    const date = new Date(value + 'T00:00:00');
    const isoDate = toApiDate(date);
    handleSelect(isoDate);
  }
}
function openModal(): ReturnType<DeliveryDateState['openModal']> {
  modalOpen.value = true;
}
function closeModal(): ReturnType<DeliveryDateState['closeModal']> {
  modalOpen.value = false;
}
function handleBackdropClick(event: Event): ReturnType<DeliveryDateState['handleBackdropClick']> {
  if (event.target === event.currentTarget) {
    modalOpen.value = false;
  }
}
</script>
