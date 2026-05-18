<template>
  <div class="propeller-cart-summary w-full bg-card space-y-3">
    <h2 class="propeller-cart-summary__title text-xl font-bold mb-4">{{ title }}</h2>
    <template v-if="showSubtotal">
      <div class="propeller-cart-summary__row flex justify-between text-muted-foreground" data-row="subtotal">
        <span class="propeller-cart-summary__label">{{ getLabel('subtotal', 'Subtotal:') }}</span
        ><span class="propeller-cart-summary__value">{{ formatItemPrice(subtotal) }}</span>
      </div>
    </template>

    <template v-if="showDiscount && hasDiscount">
      <div class="propeller-cart-summary__row flex justify-between text-success" data-row="discount">
        <span class="propeller-cart-summary__label">{{ getLabel('discount', 'Discount:') }}</span
        ><span class="propeller-cart-summary__value">-{{ formatItemPrice(discountAmount) }}</span>
      </div>
    </template>

    <template v-if="showShippingCosts && hasShippingCosts">
      <div class="propeller-cart-summary__row flex justify-between text-muted-foreground" data-row="shipping-costs">
        <span class="propeller-cart-summary__label">{{ getLabel('shippingCosts', 'Shipping costs:') }}</span
        ><span class="propeller-cart-summary__value">{{ formatItemPrice(shippingCosts) }}</span>
      </div>
    </template>

    <template v-if="showTotalExclVat">
      <div class="propeller-cart-summary__row flex justify-between text-muted-foreground pt-2 border-t" data-row="total-excl-vat">
        <span class="propeller-cart-summary__label">{{ getLabel('totalExclVat', 'Total excl. VAT:') }}</span
        ><span class="propeller-cart-summary__value">{{ formatItemPrice(totalExclVat) }}</span>
      </div>
    </template>

    <template v-if="showVATs && taxLevels.length > 0">
      <template :key="index" v-for="(tax, index) in taxLevels">
        <div class="propeller-cart-summary__row flex justify-between text-muted-foreground text-sm" data-row="vat-line">
          <span class="propeller-cart-summary__label">{{ tax.taxPercentage }}% {{ getLabel('vat', 'VAT') }}:</span
          ><span class="propeller-cart-summary__value">{{ formatItemPrice(Number(tax.price)) }}</span>
        </div>
      </template>
    </template>

    <template v-if="showTotalVat && totalVat > 0">
      <div class="propeller-cart-summary__row flex justify-between text-muted-foreground text-sm" data-row="total-vat">
        <span class="propeller-cart-summary__label">{{ getLabel('totalVat', 'Total VAT:') }}</span
        ><span class="propeller-cart-summary__value">{{ formatItemPrice(totalVat) }}</span>
      </div>
    </template>

    <div class="propeller-cart-summary__row propeller-cart-summary__row--total flex justify-between text-xl font-bold pt-4 border-t text-foreground mt-2" data-row="total">
      <span class="propeller-cart-summary__label">{{ getLabel('total', 'Total:') }}</span
      ><span class="propeller-cart-summary__value">{{ formatItemPrice(totalInclVat) }}</span>
    </div>
    <template v-if="showCheckoutButton && !showRequestAuthorizationButton">
      <button
        type="button"
        class="propeller-cart-summary__checkout-btn block w-full bg-secondary text-primary-foreground text-center py-3 rounded-[var(--radius-container)] hover:bg-secondary/90 transition font-semibold mt-4"
        @click="async (event) => handleCheckoutClick()"
      >
        {{ getLabel('checkoutButton', 'Continue to Checkout') }}
      </button>

      <template v-if="!!onRequestQuoteClick && !!user && 'contactId' in user">
        <button
          type="button"
          class="propeller-cart-summary__quote-btn block w-full bg-card border border-secondary text-secondary text-center py-3 rounded-[var(--radius-container)] hover:bg-secondary/5 transition font-semibold mt-2"
          @click="async (event) => onRequestQuoteClick && onRequestQuoteClick(cart)"
        >
          {{ getLabel('requestQuoteButton', 'Request a Quote') }}
        </button>
      </template>
    </template>

    <template v-if="showRequestAuthorizationButton">
      <button
        type="button"
        class="propeller-cart-summary__authorization-btn block w-full bg-secondary text-primary-foreground text-center py-3 rounded-[var(--radius-container)] hover:bg-secondary/90 transition font-semibold mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
        @click="async (event) => handleRequestAuthorizationClick()"
        :disabled="requestLoading"
      >
        <template v-if="requestLoading">
          {{ getLabel('requestingAuthorization', 'Requesting...') }}
        </template>

        <template v-if="!requestLoading">
          {{ getLabel('requestAuthorizationButton', 'Request Authorization') }}
        </template>
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import { Cart, Contact, Customer, GraphQLClient, PurchaseRole } from 'propeller-sdk-v2';
import { useCart } from '../../composables/useCart';
import { getLabel as _getLabel } from '../../composables/shared/utils/labelHelpers';
import { formatPrice as _formatPrice } from '../../composables/shared/utils/formatting';

export interface CartSummaryProps {
  /** The shopping cart used to populate the cart summary data */
  cart: Cart;

  /** Cart summary block title */
  title?: string;

  /** Labels for the component */
  labels?: Record<string, string>;

  /** Display the subtotal of the shopping cart */
  showSubtotal?: boolean;

  /** Display the total discount of the shopping cart */
  showDiscount?: boolean;

  /** Display the shipping costs of the shopping cart */
  showShippingCosts?: boolean;

  /** Display all VATs of the shopping cart */
  showVATs?: boolean;

  /** Display the total of the shopping cart excluding the VAT */
  showTotalExclVat?: boolean;

  /** Display the total VAT of the shopping cart */
  showTotalVat?: boolean;

  /** Display the checkout button */
  showCheckoutButton?: boolean;

  /** Action handler when the checkout button is clicked */
  onCheckoutButtonClick?: (cart: Cart) => void;

  /** Custom price formatting function */
  formatPrice?: (price: number) => string;

  /** GraphQL client — required for the default requestPurchaseAuthorization handler */
  graphqlClient?: GraphQLClient;

  /** Logged-in user — used to determine purchaser role and authorization limit */
  user?: Contact | Customer;

  /** Active company ID — used to look up the user's PAC for this company */
  companyId?: number;

  /**
   * Override the default CartService.requestPurchaseAuthorization() call.
   * Note: when this override is used, afterRequestAuthorization receives the original cart.
   */
  onRequestAuthorization?: (cart: Cart) => void;

  /** Fires after authorization request is sent; receives the updated cart */
  afterRequestAuthorization?: (cart: Cart) => void;

  /** Called when requestPurchaseAuthorization fails; receives the error */
  onError?: (err: Error) => void;

  /** Action handler when the "Request a Quote" button is clicked */
  onRequestQuoteClick?: (cart: Cart) => void;

  /** Configuration object for image filters */
  configuration?: any;
}
interface CartSummaryState {
  title: string;
  showSubtotal: boolean;
  showDiscount: boolean;
  showShippingCosts: boolean;
  showVATs: boolean;
  showTotalExclVat: boolean;
  showTotalVat: boolean;
  showCheckoutButton: boolean;
  showRequestAuthorizationButton: boolean;
  requestLoading: boolean;
  getLabel: (key: string, fallback: string) => string;
  formatItemPrice: (price: number) => string;
  subtotal: number;
  hasDiscount: boolean;
  discountAmount: number;
  hasShippingCosts: boolean;
  shippingCosts: number;
  totalExclVat: number;
  taxLevels: NonNullable<Cart['taxLevels']>;
  totalVat: number;
  totalInclVat: number;
  handleCheckoutClick: () => void;
  handleRequestAuthorizationClick: () => Promise<void>;
}

const props = withDefaults(defineProps<CartSummaryProps>(), {
  showSubtotal: true,
  showDiscount: true,
  showShippingCosts: true,
  showTotalExclVat: true,
  showVATs: true,
  showTotalVat: true,
  showCheckoutButton: true,
});
const requestLoading = ref<CartSummaryState['requestLoading']>(false);

const userRef = computed(() => props.user ?? null);
const companyRef = computed(() => props.companyId);
const { requestAuthorization } = useCart({
  graphqlClient: props.graphqlClient!,
  user: userRef,
  cartId: props.cart?.cartId,
  companyId: companyRef,
  configuration: {
    imageSearchFiltersGrid: props.configuration?.imageSearchFiltersGrid ?? ({} as any),
    imageVariantFiltersSmall: props.configuration?.imageVariantFiltersSmall ?? ({} as any),
  },
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
const showCheckoutButton = computed(() => {
  return props.showCheckoutButton !== undefined ? props.showCheckoutButton : true;
});
const subtotal = computed(() => {
  return props.cart?.total?.subTotal || 0;
});
const hasDiscount = computed(() => {
  const total = props.cart?.total;
  return (total?.discount || 0) > 0;
});
const discountAmount = computed(() => {
  return props.cart?.total?.discount || 0;
});
const hasShippingCosts = computed(() => {
  return (props.cart?.postageData?.price || 0) > 0;
});
const shippingCosts = computed(() => {
  return Number(props.cart?.postageData?.price || 0);
});
const totalExclVat = computed(() => {
  return props.cart?.total?.totalGross || 0;
});
const taxLevels = computed(() => {
  const levels = props.cart?.taxLevels || [];
  return levels.filter((t) => t.taxPercentage > 0 && t.price > 0);
});
const totalVat = computed(() => {
  const net = props.cart?.total?.totalNet || 0;
  const gross = props.cart?.total?.totalGross || 0;
  return net - gross;
});
const totalInclVat = computed(() => {
  return props.cart?.total?.totalNet || 0;
});
// Compute inline against props.cart instead of useCart.checkoutAllowed:
// useCart's `cart` ref is internal to the composable instance and stays null
// when CartSummary just consumes the computed (we never call addItem/resolveCart
// here). That made checkoutAllowed always return true in CartView, putting the
// "Continue to Checkout" button up even when the user was over their auth limit.
// Mirrors the field-tolerant lookup used in CartIconAndSidebar so the cart page
// and the header sidebar always agree.
const showRequestAuthorizationButton = computed(() => {
  const u = props.user as any;
  if (!u || !('contactId' in u)) return false;
  if (!props.companyId) return false;
  if (!props.cart) return false;
  const pacData = u.purchaseAuthorizationConfigs ?? u._purchaseAuthorizationConfigs;
  const items: any[] = pacData?.items ?? pacData?._items ?? [];
  const purchaserPac = items.find((pac: any) => {
    const role = pac.purchaseRole ?? pac._purchaseRole;
    const pacCompanyId =
      pac.company?.companyId
      ?? pac.company?._companyId
      ?? pac._company?.companyId
      ?? pac._company?._companyId;
    return role === PurchaseRole.PURCHASER && pacCompanyId === props.companyId;
  });
  if (!purchaserPac) return false;
  const limit = (purchaserPac as any).authorizationLimit ?? (purchaserPac as any)._authorizationLimit ?? 0;
  const totalGross = (props.cart as any)?.total?.totalGross ?? (props.cart as any)?._total?._totalGross ?? 0;
  return totalGross > limit;
});

function getLabel(key: string, fallback: string): ReturnType<CartSummaryState['getLabel']> {
  return _getLabel(props.labels, key, fallback);
}
function formatItemPrice(price: number): ReturnType<CartSummaryState['formatItemPrice']> {
  if (props.formatPrice) {
    return props.formatPrice(price);
  }
  return _formatPrice(price || 0, { symbol: '€' });
}
function handleCheckoutClick(): ReturnType<CartSummaryState['handleCheckoutClick']> {
  if (props.onCheckoutButtonClick) {
    props.onCheckoutButtonClick(props.cart);
  }
}
async function handleRequestAuthorizationClick(): ReturnType<
  CartSummaryState['handleRequestAuthorizationClick']
> {
  requestLoading.value = true;
  try {
    if (props.onRequestAuthorization) {
      props.onRequestAuthorization(props.cart);
    } else {
      const result = await requestAuthorization();
      if (!result.success && props.onError) {
        props.onError(new Error(result.error || 'Failed to request authorization'));
      }
    }
    if (props.afterRequestAuthorization) {
      props.afterRequestAuthorization(props.cart);
    }
  } catch (err: any) {
    if (props.onError) {
      props.onError(err instanceof Error ? err : new Error(String(err)));
    }
  } finally {
    requestLoading.value = false;
  }
}
</script>
