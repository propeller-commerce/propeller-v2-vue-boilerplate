<template>
  <div :class="containerClass">
    <template v-if="title">
      <h2 class="text-xl font-bold mb-4">{{ title }}</h2>
    </template>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pb-5">
      <div class="space-y-2">
        <h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          {{ getLabel('invoiceAddress', 'Invoice Address') }}
        </h3>
        <template v-if="invoiceAddress && invoiceAddress.street">
          <div class="text-sm space-y-1">
            <template v-if="invoiceAddress.company">
              <p class="font-medium">{{ invoiceAddress.company }}</p>
            </template>

            <p>
              {{
                [invoiceAddress.firstName, invoiceAddress.middleName, invoiceAddress.lastName]
                  .filter(Boolean)
                  .join(' ')
              }}
            </p>
            <p>
              {{
                [invoiceAddress.street, invoiceAddress.number, invoiceAddress.numberExtension]
                  .filter(Boolean)
                  .join(' ')
              }}
            </p>
            <p>
              {{ [invoiceAddress.postalCode, invoiceAddress.city].filter(Boolean).join(' ') }}
            </p>
            <template v-if="invoiceAddress.country">
              <p>{{ invoiceAddress.country }}</p>
            </template>

            <template v-if="invoiceAddress.email">
              <p class="text-gray-500">{{ invoiceAddress.email }}</p>
            </template>
          </div>
        </template>
      </div>
      <div class="space-y-2">
        <h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          {{ getLabel('deliveryAddress', 'Delivery Address') }}
        </h3>
        <template v-if="deliveryAddress && deliveryAddress.street">
          <div class="text-sm space-y-1">
            <template v-if="deliveryAddress.company">
              <p class="font-medium">{{ deliveryAddress.company }}</p>
            </template>

            <p>
              {{
                [deliveryAddress.firstName, deliveryAddress.middleName, deliveryAddress.lastName]
                  .filter(Boolean)
                  .join(' ')
              }}
            </p>
            <p>
              {{
                [deliveryAddress.street, deliveryAddress.number, deliveryAddress.numberExtension]
                  .filter(Boolean)
                  .join(' ')
              }}
            </p>
            <p>
              {{ [deliveryAddress.postalCode, deliveryAddress.city].filter(Boolean).join(' ') }}
            </p>
            <template v-if="deliveryAddress.country">
              <p>{{ deliveryAddress.country }}</p>
            </template>

            <template v-if="deliveryAddress.email">
              <p class="text-gray-500">{{ deliveryAddress.email }}</p>
            </template>
          </div>
        </template>
      </div>
    </div>
    <div class="bg-gray-50 p-4 rounded-md border border-gray-200 space-y-2 text-sm">
      <template v-if="paymentMethod">
        <div class="flex justify-between">
          <span class="font-medium">{{ getLabel('payment', 'Payment:') }}</span
          ><span>{{ paymentMethod }}</span>
        </div>
      </template>

      <template v-if="carrierName">
        <div class="flex justify-between">
          <span class="font-medium">{{ getLabel('carrier', 'Carrier:') }}</span
          ><span>{{ carrierName }}</span>
        </div>
      </template>

      <template v-if="requestDate">
        <div class="flex justify-between">
          <span class="font-medium">{{ getLabel('deliveryDate', 'Delivery Date:') }}</span
          ><span>{{ requestDate }}</span>
        </div>
      </template>
    </div>
    <div class="space-y-4 mt-6">
      <template v-if="showReference">
        <div class="space-y-2">
          <label class="text-sm font-medium">{{
            getLabel('referenceLabel', 'Reference (Optional)')
          }}</label
          ><input
            type="text"
            class="flex w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-secondary"
            :value="reference"
            @change="async (event) => handleReferenceChange((event.target as HTMLInputElement | HTMLTextAreaElement).value)"
            :placeholder="getLabel('referencePlaceholder', 'Your reference number')"
            :maxLength="255"
          />
        </div>
      </template>

      <template v-if="showNotes">
        <div class="space-y-2">
          <label class="text-sm font-medium">{{
            getLabel('notesLabel', 'Order Notes (Optional)')
          }}</label
          ><textarea
            class="flex w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-secondary min-h-[80px]"
            :value="notes"
            @change="async (event) => handleNotesChange((event.target as HTMLInputElement | HTMLTextAreaElement).value)"
            :placeholder="getLabel('notesPlaceholder', 'Special instructions or comments')"
            :maxLength="255"
          ></textarea>
        </div>
      </template>

      <template v-if="showTermsAndConditions">
        <div class="flex items-center space-x-2 pt-2">
          <input
            type="checkbox"
            id="cart-overview-terms"
            class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            :checked="termsAccepted"
            @change="async (event) => handleTermsChange((event.target as HTMLInputElement).checked)"
          /><label for="cart-overview-terms" class="text-sm leading-none"
            >{{ getLabel('termsPrefix', 'I agree to the')
            }}<a
              href="#"
              class="text-primary hover:underline font-medium"
              @click="async (event) => handleTermsLinkClick(event)"
              >{{ getLabel('termsLink', 'Terms and Conditions') }}</a
            ></label
          >
        </div>
      </template>

      <template v-if="showPurchaseButton">
        <button
          type="button"
          class="flex items-center justify-center gap-2 w-full bg-primary text-white text-center py-3 rounded-lg hover:bg-primary/80 transition font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          @click="async (event) => handlePurchaseClick()"
          :disabled="isPurchaseDisabled"
        >
          <template v-if="loading">
            <div
              class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"
            ></div>
          </template>

          <template v-if="loading">
            {{ getLabel('processing', 'Processing...') }}
          </template>

          <template v-if="!loading">
            {{ getLabel('purchaseButton', 'Place Order') }}
          </template>
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import { Cart, CartAddress, GraphQLClient } from 'propeller-sdk-v2';
import { getLabel as _getLabel } from '../../shared/utils/labelHelpers';

export interface CartOverviewProps {
  /** GraphQL client for the Propeller SDK */
  graphqlClient: GraphQLClient;

  /** Shopping cart object from which the cart overview will be displayed */
  cart: Cart;

  /** The CSS class for the cart overview container */
  overviewContainerClass?: string;

  /** Title of the cart overview */
  title?: string;

  /** Labels for the cart overview form fields and buttons */
  labels?: Record<string, string>;

  /** Show the notes field for the cart */
  showNotes?: boolean;

  /** Show the reference field for the cart */
  showReference?: boolean;

  /** Show the terms and conditions acceptance */
  showTermsAndConditions?: boolean;

  /** Action when the "Terms and conditions" link is clicked */
  onTermsAndConditionsClick?: () => void;

  /** Show the "Purchase" button for placing an order */
  showPurchaseButton?: boolean;

  /** Action when the purchase button is clicked. Receives cart, reference, and notes */
  onPurchaseButtonClick?: (cart: Cart, reference: string, notes: string) => void;
}
interface CartOverviewState {
  reference: string;
  notes: string;
  termsAccepted: boolean;
  loading: boolean;
  containerClass: string;
  showNotes: boolean;
  showReference: boolean;
  showTermsAndConditions: boolean;
  showPurchaseButton: boolean;
  getLabel: (key: string, fallback: string) => string;
  invoiceAddress: CartAddress;
  deliveryAddress: CartAddress;
  formatAddress: (addr: CartAddress) => string;
  paymentMethod: string;
  carrierName: string;
  requestDate: string;
  handleReferenceChange: (value: string) => void;
  handleNotesChange: (value: string) => void;
  handleTermsChange: (checked: boolean) => void;
  handleTermsLinkClick: (event: Event) => void;
  isPurchaseDisabled: boolean;
  handlePurchaseClick: () => void;
}

const props = withDefaults(defineProps<CartOverviewProps>(), {
  showNotes: true,
  showReference: true,
  showTermsAndConditions: true,
  showPurchaseButton: true,
});
const reference = ref<CartOverviewState['reference']>('');
const notes = ref<CartOverviewState['notes']>('');
const termsAccepted = ref<CartOverviewState['termsAccepted']>(false);
const loading = ref<CartOverviewState['loading']>(false);

const containerClass = computed(() => {
  return props.overviewContainerClass || 'cart-overview';
});
const showNotes = computed(() => {
  return props.showNotes !== undefined ? props.showNotes : true;
});
const showReference = computed(() => {
  return props.showReference !== undefined ? props.showReference : true;
});
const showTermsAndConditions = computed(() => {
  return props.showTermsAndConditions !== undefined ? props.showTermsAndConditions : true;
});
const showPurchaseButton = computed(() => {
  return props.showPurchaseButton !== undefined ? props.showPurchaseButton : true;
});
const invoiceAddress = computed(() => {
  return props.cart?.invoiceAddress;
});
const deliveryAddress = computed(() => {
  return props.cart?.deliveryAddress;
});
const paymentMethod = computed(() => {
  return props.cart?.paymentData?.method || '';
});
const carrierName = computed(() => {
  return props.cart?.postageData?.carrier || '';
});
const requestDate = computed(() => {
  const date = props.cart?.postageData?.requestDate;
  if (!date) return '';
  try {
    return new Date(date).toLocaleDateString();
  } catch {
    return date;
  }
});
const isPurchaseDisabled = computed(() => {
  if (showTermsAndConditions.value && !termsAccepted.value) return true;
  if (loading.value) return true;
  return false;
});

function getLabel(key: string, fallback: string): ReturnType<CartOverviewState['getLabel']> {
  return _getLabel(props.labels, key, fallback);
}
function formatAddress(addr: CartAddress): ReturnType<CartOverviewState['formatAddress']> {
  if (!addr || !addr.street) return '';
  const parts: string[] = [];
  if (addr.company) parts.push(addr.company);
  const nameParts: string[] = [];
  if (addr.firstName) nameParts.push(addr.firstName);
  if (addr.middleName) nameParts.push(addr.middleName);
  if (addr.lastName) nameParts.push(addr.lastName);
  if (nameParts.length > 0) parts.push(nameParts.join(' '));
  const streetLine = [addr.street, addr.number, addr.numberExtension].filter(Boolean).join(' ');
  if (streetLine) parts.push(streetLine);
  const cityLine = [addr.postalCode, addr.city].filter(Boolean).join(' ');
  if (cityLine) parts.push(cityLine);
  if (addr.country) parts.push(addr.country);
  return parts.join(', ');
}
function handleReferenceChange(
  value: string
): ReturnType<CartOverviewState['handleReferenceChange']> {
  reference.value = value.slice(0, 255);
}
function handleNotesChange(value: string): ReturnType<CartOverviewState['handleNotesChange']> {
  notes.value = value.slice(0, 255);
}
function handleTermsChange(checked: boolean): ReturnType<CartOverviewState['handleTermsChange']> {
  termsAccepted.value = checked;
}
function handleTermsLinkClick(event: Event): ReturnType<CartOverviewState['handleTermsLinkClick']> {
  event.preventDefault();
  if (props.onTermsAndConditionsClick) {
    props.onTermsAndConditionsClick();
  }
}
function handlePurchaseClick(): ReturnType<CartOverviewState['handlePurchaseClick']> {
  if (isPurchaseDisabled.value) return;
  loading.value = true;
  if (props.onPurchaseButtonClick) {
    props.onPurchaseButtonClick(props.cart, reference.value, notes.value);
  }
}
</script>
