<template>
  <div
    :class="`propeller-price-toggle flex items-center gap-2 ${className || ''}`"
    :data-state="isOn ? 'on' : 'off'"
  >
    <span class="propeller-price-toggle__label hidden sm:inline text-xs">{{ getLabel() }}</span
    ><button
      type="button"
      role="switch"
      class="propeller-price-toggle__switch hover:opacity-80 transition-opacity text-xs font-medium"
      :aria-checked="isOn"
      @click="async (event) => handleToggle()"
    >
      {{ getStatusText() }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

export interface PriceToggleProps {
  /**
   * Label text shown beside the toggle.
   * Defaults to 'Prices:'.
   */
  label?: string;

  /**
   * Initial state of the toggle.
   * Defaults to true (incl. VAT).
   */
  initialState?: boolean;

  /**
   * Required callback fired when the toggle is switched.
   * Receives the new state: true = incl. VAT, false = excl. VAT.
   */
  inclExclVatSwitched: (on: boolean) => void;

  /** Extra CSS class applied to the root element. */
  className?: string;
}
interface PriceToggleState {
  isOn: boolean;
  getLabel: () => string;
  getStatusText: () => string;
  handleToggle: () => void;
}

const props = defineProps<PriceToggleProps>();
const isOn = ref<PriceToggleState['isOn']>(props.initialState ?? true);

onMounted(() => {
  if (typeof window !== 'undefined') {
    isOn.value = props.initialState ?? true;
  }
});

function getLabel(): ReturnType<PriceToggleState['getLabel']> {
  return (props.label as string) || 'Prices:';
}
function getStatusText(): ReturnType<PriceToggleState['getStatusText']> {
  return isOn.value ? 'Incl. VAT' : 'Excl. VAT';
}
function handleToggle(): ReturnType<PriceToggleState['handleToggle']> {
  const newValue = !isOn.value;
  isOn.value = newValue;
  if (props.inclExclVatSwitched) {
    props.inclExclVatSwitched(newValue);
  }
  window.dispatchEvent(
    new CustomEvent('priceToggleChanged', {
      detail: newValue,
    })
  );
}
</script>
