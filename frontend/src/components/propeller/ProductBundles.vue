<template>
  <template v-if="isMounted && !isLoading && bundles.length > 0">
    <div :class="`propeller-product-bundles ${className || 'mb-12'}`">
      <template
        :key="bundle.id || bundleIdx"
        v-for="(bundle, bundleIdx) in bundles"
      >
        <div
          class="propeller-product-bundles__bundle border border-border rounded-xl bg-card shadow-sm mb-6 p-6"
          :data-layout="getLayout()"
        >
          <div class="flex flex-col lg:flex-row items-center gap-6">
            <template
              v-if="
                getShowItems() &&
                getLayout() !== 'compact' &&
                bundle.items &&
                bundle.items.length > 0
              "
            >
              <div
                class="propeller-product-bundles__items flex flex-wrap items-center justify-center gap-2 flex-1"
              >
                <template
                  :key="item.productId + '-' + idx"
                  v-for="(item, idx) in bundle.items"
                >
                  <div
                    class="propeller-product-bundles__item flex items-center gap-2"
                  >
                    <template v-if="idx > 0">
                      <div
                        class="propeller-product-bundles__plus flex-shrink-0 w-8 h-8 rounded-full bg-success flex items-center justify-center"
                      >
                        <svg
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          class="w-5 h-5 text-success-foreground"
                          :strokeWidth="2.5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 4.5v15m7.5-7.5h-15"
                          ></path>
                        </svg>
                      </div>
                    </template>

                    <div class="flex flex-col items-center text-center w-40">
                      <div
                        class="propeller-product-bundles__item-media w-32 h-32 bg-surface-hover rounded-[var(--radius-container)] overflow-hidden flex-shrink-0 mb-2"
                      >
                        <template v-if="getProductImage(item.product)">
                          <img
                            class="propeller-product-bundles__item-image w-full h-full object-contain p-2"
                            :src="getProductImage(item.product)"
                            :alt="getProductName(item.product)"
                          />
                        </template>
                      </div>
                      <div
                        class="propeller-product-bundles__item-name text-sm font-medium text-muted-foreground leading-tight mb-1"
                      >
                        {{
                          getProductName(item.product) ||
                          "Product " + item.productId
                        }}
                      </div>
                      <template v-if="!getHidePrices() && item.price">
                        <div
                          class="propeller-product-bundles__item-price text-sm font-semibold text-foreground"
                        >
                          {{ formatPrice(getItemPrice(item))
                          }}<span
                            class="text-xs font-normal text-muted-foreground ml-1"
                          >
                            <template v-if="getIncludeTax()">
                              {{ getLabel("inclTax", "incl. VAT") }}
                            </template>

                            <template v-else>
                              {{ getLabel("exclTax", "excl. VAT") }}
                            </template>
                          </span>
                        </div>
                      </template>
                    </div>
                  </div>
                </template>
              </div>
            </template>

            <div
              class="propeller-product-bundles__equals flex-shrink-0 w-8 h-8 rounded-full bg-success flex items-center justify-center"
            >
              <svg
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                class="w-5 h-5 text-success-foreground"
                :strokeWidth="2.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 12h16.5M3.75 7.5h16.5"
                ></path>
              </svg>
            </div>
            <div
              class="propeller-product-bundles__summary flex-shrink-0 w-full lg:w-72 pl-0 lg:pl-6"
            >
              <h3
                class="propeller-product-bundles__title text-xl font-bold text-foreground mb-1"
              >
                {{ bundle.name || getLabel("title", "Combo deal") }}
              </h3>
              <template v-if="bundle.description">
                <p
                  class="propeller-product-bundles__description text-sm text-muted-foreground mb-3"
                >
                  {{ bundle.description }}
                </p>
              </template>

              <template v-if="bundle.condition">
                <p
                  class="propeller-product-bundles__condition text-xs text-muted-foreground mb-3"
                >
                  <template
                    v-if="bundle.condition === BundleCondition.ALL"
                  >
                    {{ getLabel("condition_ALL", "Discount on all items") }}
                  </template>

                  <template v-else>
                    {{ getLabel("condition_EP", "Discount on extra items") }}
                  </template>
                </p>
              </template>

              <template v-if="!getHidePrices()">
                <div class="propeller-product-bundles__pricing mb-3">
                  <template v-if="hasDiscount(bundle)">
                    <span
                      class="propeller-product-bundles__original-price text-foreground-subtle line-through text-sm"
                      >{{ formatPrice(getOriginalPrice(bundle)) }}</span
                    >
                  </template>

                  <div class="flex items-baseline gap-2">
                    <span
                      class="propeller-product-bundles__price text-2xl font-bold text-foreground"
                      >{{ formatPrice(getBundlePrice(bundle)) }}</span
                    ><span class="text-xs text-muted-foreground">
                      <template v-if="getIncludeTax()">
                        {{ getLabel("inclTax", "incl. VAT") }}
                      </template>

                      <template v-else>
                        {{ getLabel("exclTax", "excl. VAT") }}
                      </template>
                    </span>
                  </div>
                  <template v-if="hasDiscount(bundle)">
                    <div
                      class="propeller-product-bundles__savings mt-2 inline-block bg-success/10 text-success text-sm font-medium px-3 py-1 rounded-[var(--radius-control)]"
                    >
                      {{ getLabel("youSave", "Your savings: ")
                      }}{{
                        formatPrice(
                          getOriginalPrice(bundle) - getBundlePrice(bundle),
                        )
                      }}
                    </div>
                  </template>
                </div>
                <button
                  class="propeller-product-bundles__submit w-full px-6 py-3 bg-primary text-primary-foreground rounded-[var(--radius-container)] font-semibold hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed text-base"
                  @click="async (event) => handleAddToCart(bundle)"
                  :disabled="addingBundleId === bundle.id"
                  :data-loading="
                    addingBundleId === bundle.id ? 'true' : 'false'
                  "
                >
                  <template v-if="addingBundleId === bundle.id">
                    {{ getLabel("adding", "Adding...") }}
                  </template>

                  <template v-else>
                    {{ getLabel("addToCart", "In cart") }}
                  </template>
                </button>
              </template>

              <template v-if="getHidePrices()">
                <div
                  class="propeller-product-bundles__login-prompt text-center text-sm text-muted-foreground py-2"
                >
                  {{
                    getLabel(
                      "loginToSeePrices",
                      "Log in to see prices and add to cart",
                    )
                  }}
                </div>
              </template>
            </div>
          </div>
        </div>
      </template>
      <template v-if="toastVisible">
        <div
          :class="`propeller-product-bundles__toast fixed top-4 right-4 z-50 flex items-start gap-3 w-80 rounded-[var(--radius-container)] shadow-lg p-4 ${
            toastType === 'success'
              ? 'bg-success border border-success text-success-foreground'
              : 'bg-destructive border border-destructive text-destructive-foreground'
          }`"
          :data-toast-type="toastType"
        >
          <div
            :class="`propeller-product-bundles__toast-icon flex-shrink-0 w-5 h-5 mt-0.5 ${
              toastType === 'success' ? 'text-success-foreground' : 'text-destructive-foreground'
            }`"
          >
            <template v-if="toastType === 'success'">
              <svg
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                :strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                ></path>
              </svg>
            </template>

            <template v-if="toastType === 'error'">
              <svg
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                :strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                ></path>
              </svg>
            </template>
          </div>
          <p
            :class="`propeller-product-bundles__toast-message flex-1 text-sm font-medium ${
              toastType === 'success' ? 'text-success-foreground' : 'text-destructive-foreground'
            }`"
          >
            {{ toastMessage }}
          </p>
          <button
            type="button"
            @click="async (event) => dismissToast()"
            :class="`propeller-product-bundles__toast-close flex-shrink-0 rounded focus:outline-none ${
              toastType === 'success'
                ? 'text-success-foreground hover:text-success-foreground/80'
                : 'text-destructive-foreground hover:text-destructive-foreground/80'
            }`"
          >
            <svg
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              class="h-4 w-4"
              :strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              ></path>
            </svg>
          </button>
        </div>
      </template>

      <template v-if="modalVisible">
        <div
          class="propeller-product-bundles__modal fixed inset-0 z-50 flex items-center justify-center px-4"
        >
          <div
            class="propeller-product-bundles__modal-backdrop fixed inset-0 bg-foreground/20"
            @click="async (event) => closeModal()"
          ></div>
          <div
            class="propeller-product-bundles__modal-content relative w-full max-w-lg bg-card rounded-[var(--radius-container)] shadow-2xl overflow-hidden"
          >
            <div
              class="propeller-product-bundles__modal-header flex items-center gap-3 px-6 py-4 border-b border-border-subtle"
            >
              <svg
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                class="propeller-product-bundles__modal-success-icon h-5 w-5 flex-shrink-0 text-success"
                :strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                ></path>
              </svg>
              <h3
                class="propeller-product-bundles__modal-title flex-1 text-base font-semibold text-foreground"
              >
                {{ getLabel("modalTitle", "Added to cart") }}
              </h3>
              <button
                type="button"
                class="propeller-product-bundles__modal-close flex-shrink-0 text-foreground-subtle hover:text-muted-foreground focus:outline-none"
                @click="async (event) => closeModal()"
              >
                <svg
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  class="h-5 w-5"
                  :strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  ></path>
                </svg>
              </button>
            </div>
            <div class="propeller-product-bundles__modal-body px-6 py-5">
              <div
                class="propeller-product-bundles__modal-product flex items-start gap-4"
              >
                <template
                  v-if="
                    lastAddedBundle &&
                    lastAddedBundle.items &&
                    lastAddedBundle.items.length > 0 &&
                    getProductImage(lastAddedBundle.items[0].product)
                  "
                >
                  <img
                    class="propeller-product-bundles__modal-image w-16 h-16 object-contain rounded border border-border-subtle flex-shrink-0"
                    :src="
                      lastAddedBundle?.items?.[0]
                        ? getProductImage(lastAddedBundle.items[0].product)
                        : ''
                    "
                    :alt="lastAddedBundle?.name || 'Bundle'"
                  />
                </template>

                <template
                  v-if="
                    !lastAddedBundle ||
                    !lastAddedBundle.items ||
                    lastAddedBundle.items.length === 0 ||
                    !getProductImage(lastAddedBundle.items[0].product)
                  "
                >
                  <div
                    class="propeller-product-bundles__modal-image-placeholder w-16 h-16 flex items-center justify-center rounded border border-border-subtle flex-shrink-0 bg-surface-hover"
                  >
                    <svg
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      class="w-8 h-8 text-foreground-subtle"
                      :strokeWidth="1.5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
                      ></path>
                    </svg>
                  </div>
                </template>

                <div class="flex-1 min-w-0">
                  <p
                    class="propeller-product-bundles__modal-name text-sm font-medium text-foreground"
                  >
                    {{ lastAddedBundle?.name || getLabel("title", "Bundle") }}
                  </p>
                </div>
                <div class="flex-shrink-0 text-right">
                  <p
                    class="propeller-product-bundles__modal-quantity text-xs text-muted-foreground"
                  >
                    {{ getLabel("quantity", "Quantity") }}: 1
                  </p>
                  <template v-if="!getHidePrices() && lastAddedBundle">
                    <p
                      class="propeller-product-bundles__modal-price text-sm font-semibold text-foreground mt-0.5"
                    >
                      {{ formatPrice(getBundlePrice(lastAddedBundle)) }}
                    </p>
                  </template>
                </div>
              </div>
              <template
                v-if="
                  lastAddedBundle &&
                  lastAddedBundle.items &&
                  lastAddedBundle.items.length > 0
                "
              >
                <div
                  class="propeller-product-bundles__modal-children mt-3 ml-20 space-y-1 border-l-2 border-secondary/10 pl-2"
                >
                  <template
                    :key="item.productId + '-' + idx"
                    v-for="(item, idx) in lastAddedBundle?.items"
                  >
                    <div
                      class="propeller-product-bundles__modal-child flex justify-between items-center text-xs text-muted-foreground"
                    >
                      <span class="line-clamp-1">{{
                        getProductName(item.product) || "Product"
                      }}</span>
                      <template v-if="!getHidePrices() && item.price">
                        <span
                          class="text-foreground-subtle whitespace-nowrap ml-2"
                          >{{ formatPrice(getItemPrice(item)) }}</span
                        >
                      </template>
                    </div>
                  </template>
                </div>
              </template>
            </div>
            <div
              class="propeller-product-bundles__modal-actions flex gap-3 px-6 py-4 border-t border-border-subtle"
            >
              <button
                type="button"
                class="propeller-product-bundles__modal-continue flex-1 inline-flex justify-center rounded-[var(--radius-control)] border border-input bg-card px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                @click="async (event) => closeModal()"
              >
                {{ getLabel("continueShopping", "Continue shopping") }}</button
              ><button
                type="button"
                class="propeller-product-bundles__modal-checkout flex-1 inline-flex justify-center rounded-[var(--radius-control)] border border-transparent bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                @click="
                  async (event) => {
                    closeModal();
                    if (onProceedToCheckout) onProceedToCheckout();
                  }
                "
              >
                {{ getLabel("proceedToCheckout", "Proceed to checkout") }}
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>
  </template>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import { Bundle, BundleCondition, BundleItem, Cart, Contact, Customer, GraphQLClient, Product } from "propeller-sdk-v2";
import { useProductBundles } from "../../composables/useProductBundles";
import { getLabel as _getLabel } from "../../composables/shared/utils/labelHelpers";
import { getProductImageUrl as _getProductImageUrl } from "../../composables/shared/utils/productHelpers";
import { formatPrice as _formatPrice } from "../../composables/shared/utils/formatting";

export interface ProductBundlesProps {
  // === Core ===

  /** GraphQL client instance used to fetch bundle data. */
  graphqlClient: GraphQLClient;

  /** ID of the product whose bundles should be fetched. */
  productId: number;

  /** Language code used for content (e.g. 'NL', 'EN'). */
  language: string;

  /** Tax zone code used for pricing (e.g. 'NL'). */
  taxZone: string;

  // === Pricing ===

  /**
   * When true, net price (incl. tax) is the leading price.
   * Note: in the Propeller SDK `price.gross` = excl. VAT, `price.net` = incl. VAT.
   */
  includeTax?: boolean;

  // === Portal / visibility ===

  /**
   * Controls portal visibility mode.
   * 'semi-closed' — prices and add-to-cart are hidden for anonymous users.
   * Defaults to 'open'.
   */
  portalMode?: string;

  /** Authenticated user — used for semi-closed visibility check. */
  user?: Contact | Customer | null;

  /** Active company ID from the company switcher.
   * Overrides user's default company for cart creation and lookup.
   * If not provided, the user's default company is used.
   */
  companyId?: number;

  /** Cart ID — required when onAddToCart is not provided */
  cartId?: string;

  /**
   * Callback to handle a new cart being created.
   * WARNING: If not provided the component create new carts on every add-to-cart.
   */
  onCartCreated?: (cart: Cart) => void;

  /**
   * If true a new cart is created if no cart ID is provided.
   * Defaults to false.
   */
  createCart?: boolean;

  // === Display options ===

  /** When true, stock availability is validated before adding to cart. */
  stockValidation?: boolean;

  /**
   * When true, the individual bundle items are listed inside each bundle card.
   * Defaults to true.
   */
  showIndividualItems?: boolean;

  /** Additional configuration object passed through to the component. */
  configuration?: any;

  /**
   * Layout variant for the bundle display.
   * - 'vertical' — stacked layout
   * - 'horizontal' — side-by-side (default)
   * - 'compact' — condensed, hides individual items
   */
  layout?: "vertical" | "horizontal" | "compact";

  /**
   * Override any UI string.
   * Available keys: title, condition_ALL, condition_EP, leaderItem,
   * youSave, adding, addToCart, loginToSeePrices, addedToCart,
   * modalTitle, continueShopping, proceedToCheckout, noCartId
   */
  labels?: Record<string, string>;

  // === Modal / feedback ===

  /**
   * When true a modal popup is shown after a successful add-to-cart
   * with buttons to continue shopping or proceed to checkout.
   * Defaults to false (only a brief inline toast is shown).
   */
  showModal?: boolean;

  /** Callback fired when the "Proceed to checkout" modal button is clicked */
  onProceedToCheckout?: () => void;

  // === Callbacks ===

  /**
   * Callback triggered before adding the bundle to cart.
   */
  beforeBundleAddToCart?: (bundleId: string, quantity: number) => boolean;

  /** Called when the user clicks "Add bundle to cart". Receives bundleId and quantity (always 1). */
  onAddBundleToCart?: (bundleId: string, quantity: number) => void;

  /**
   * Callback triggered after adding the bundle to cart.
   */
  afterBundleAddToCart?: (cart: Cart, bundle?: Bundle) => void;

  /** Extra CSS class applied to the root wrapper element. */
  className?: string;
}
interface ProductBundlesState {
  bundles: Bundle[];
  isLoading: boolean;
  includeTax: boolean;
  isMounted: boolean;
  addingBundleId: string | null;
  lastAddedBundle: Bundle | null;
  activeCartId: string;
  toastMessage: string;
  toastType: string;
  toastVisible: boolean;
  modalVisible: boolean;
  getIncludeTax: () => boolean;
  getShowItems: () => boolean;
  getLayout: () => string;
  getIsAnonymous: () => boolean;
  getHidePrices: () => boolean;
  getLabel: (key: string, fallback: string) => string;
  formatPrice: (value: number) => string;
  getBundlePrice: (bundle: Bundle) => number;
  getOriginalPrice: (bundle: Bundle) => number;
  getItemPrice: (item: BundleItem) => number;
  hasDiscount: (bundle: Bundle) => boolean;
  getDiscountPercentage: (bundle: Bundle) => number;
  getProductImage: (product: Product) => string;
  getProductName: (product: Product) => string;
  showToast: (message: string, type: string) => void;
  dismissToast: () => void;
  closeModal: () => void;
  fetchBundles: () => Promise<void>;
  handleAddToCart: (bundle: Bundle) => Promise<void>;
  initCart: () => Promise<string>;
}

const props = defineProps<ProductBundlesProps>();

const userRef = computed(() => props.user ?? null);
const companyRef = computed(() => props.companyId);
const langRef = computed(() => props.language || "NL");

const {
  bundles,
  loading: bundlesLoading,
  adding,
  cartId: composableCartId,
  fetchBundles,
  addBundleToCart,
} = useProductBundles({
  graphqlClient: props.graphqlClient,
  user: userRef,
  companyId: companyRef,
  language: langRef,
  configuration: props.configuration,
  onCartCreated: props.onCartCreated,
});

// Alias for template compatibility
const isLoading = bundlesLoading;

const includeTax = ref<ProductBundlesState["includeTax"]>(false);
const isMounted = ref<ProductBundlesState["isMounted"]>(false);
const addingBundleId = ref<ProductBundlesState["addingBundleId"]>(null);
const lastAddedBundle = ref<ProductBundlesState["lastAddedBundle"]>(null);
const toastMessage = ref<ProductBundlesState["toastMessage"]>("");
const toastType = ref<ProductBundlesState["toastType"]>("");
const toastVisible = ref<ProductBundlesState["toastVisible"]>(false);
const modalVisible = ref<ProductBundlesState["modalVisible"]>(false);

onMounted(() => {
  isMounted.value = true;
  fetchBundles(props.productId);
});
function getIncludeTax(): ReturnType<ProductBundlesState["getIncludeTax"]> {
  return props.includeTax !== undefined ? !!props.includeTax : includeTax.value;
}
function getShowItems(): ReturnType<ProductBundlesState["getShowItems"]> {
  return props.showIndividualItems !== undefined
    ? !!props.showIndividualItems
    : true;
}
function getLayout(): ReturnType<ProductBundlesState["getLayout"]> {
  return (props.layout as string) || "horizontal";
}
function getIsAnonymous(): ReturnType<ProductBundlesState["getIsAnonymous"]> {
  return !props.user;
}
function getHidePrices(): ReturnType<ProductBundlesState["getHidePrices"]> {
  return (props.portalMode as string) === "semi-closed" && getIsAnonymous();
}
function getLabel(
  key: string,
  fallback: string,
): ReturnType<ProductBundlesState["getLabel"]> {
  return _getLabel(props.labels, key, fallback);
}
function formatPrice(
  value: number,
): ReturnType<ProductBundlesState["formatPrice"]> {
  return _formatPrice(Number(value), { symbol: "€" });
}
function getBundlePrice(
  bundle: Bundle,
): ReturnType<ProductBundlesState["getBundlePrice"]> {
  return getIncludeTax() ? bundle.price?.net || 0 : bundle.price?.gross || 0;
}
function getOriginalPrice(
  bundle: Bundle,
): ReturnType<ProductBundlesState["getOriginalPrice"]> {
  return getIncludeTax()
    ? bundle.price?.originalNet || 0
    : bundle.price?.originalGross || 0;
}
function getItemPrice(
  item: BundleItem,
): ReturnType<ProductBundlesState["getItemPrice"]> {
  return getIncludeTax() ? item.price?.net || 0 : item.price?.gross || 0;
}
function hasDiscount(
  bundle: Bundle,
): ReturnType<ProductBundlesState["hasDiscount"]> {
  const current: number = getBundlePrice(bundle);
  const original: number = getOriginalPrice(bundle);
  return original > 0 && current < original;
}
function getDiscountPercentage(
  bundle: Bundle,
): ReturnType<ProductBundlesState["getDiscountPercentage"]> {
  const original: number = getOriginalPrice(bundle);
  if (original <= 0) return 0;
  return Math.round(((original - getBundlePrice(bundle)) / original) * 100);
}
function getProductImage(
  product: Product,
): ReturnType<ProductBundlesState["getProductImage"]> {
  return _getProductImageUrl(product);
}
function getProductName(
  product: Product,
): ReturnType<ProductBundlesState["getProductName"]> {
  return product?.names?.[0]?.value || "";
}
function showToast(
  message: string,
  type: string,
): ReturnType<ProductBundlesState["showToast"]> {
  toastMessage.value = message;
  toastType.value = type;
  toastVisible.value = true;
  setTimeout(() => {
    toastVisible.value = false;
  }, 3000);
}
function dismissToast(): ReturnType<ProductBundlesState["dismissToast"]> {
  toastVisible.value = false;
}
function closeModal(): ReturnType<ProductBundlesState["closeModal"]> {
  modalVisible.value = false;
  lastAddedBundle.value = null;
}
async function handleAddToCart(
  bundle: Bundle,
): ReturnType<ProductBundlesState["handleAddToCart"]> {
  if (addingBundleId.value || adding.value) return;
  addingBundleId.value = bundle.id;
  try {
    if (props.onAddBundleToCart) {
      props.onAddBundleToCart(bundle.id, 1);
    } else {
      if (props.beforeBundleAddToCart) {
        props.beforeBundleAddToCart(bundle.id, 1);
      }
      const existingCartId = props.cartId || composableCartId.value;
      const result = await addBundleToCart(
        bundle.id as unknown as number,
        existingCartId || undefined,
      );
      if (!result.success) {
        showToast(
          result.error ||
            getLabel("errorAdding", "Failed to add bundle to cart"),
          "error",
        );
        return;
      }
      if (result.cart && props.afterBundleAddToCart) {
        props.afterBundleAddToCart(result.cart, bundle);
      }
    }
    if (props.showModal) {
      lastAddedBundle.value = bundle;
      modalVisible.value = true;
    } else {
      const bundleName = bundle.name || getLabel("title", "Bundle");
      showToast(
        `${bundleName} ${getLabel("addedToCart", "added to cart")}`,
        "success",
      );
    }
  } catch (error) {
    console.error("Error adding bundle to cart:", error);
    showToast(getLabel("errorAdding", "Failed to add bundle to cart"), "error");
  } finally {
    addingBundleId.value = null;
  }
}
</script>
