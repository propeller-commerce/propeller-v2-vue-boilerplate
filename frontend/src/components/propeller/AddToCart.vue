<template>
  <div
    :class="`propeller-add-to-cart ${className || ''}`"
    :data-loading="loading ? 'true' : 'false'"
  >
    <div class="propeller-add-to-cart__controls flex items-center gap-2 w-full">
      <template v-if="allowIncrDecr !== false">
        <div
          class="propeller-add-to-cart__stepper flex items-center border border-input rounded-[var(--radius-control)] bg-card h-10"
        >
          <button
            type="button"
            class="propeller-add-to-cart__decrement px-3 h-full text-muted-foreground hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-l-[var(--radius-control)] select-none"
            @click="async (event) => decrement()"
            :disabled="quantity <= getMinQuantity(props.product) || loading"
          >
            -</button
          ><input
            type="number"
            class="propeller-add-to-cart__quantity w-12 text-center text-sm bg-transparent border-none focus:ring-0 focus:outline-none h-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            :min="getMinQuantity(props.product)"
            :step="getStep(props.product)"
            :value="quantity"
            @change="
              async (e) => {
                const val = parseInt(e.target.value, 10);
                const min = getMinQuantity(props.product);
                const step = getStep(props.product);
                if (!isNaN(val) && val >= min) {
                  quantity = Math.round((val - min) / step) * step + min;
                }
              }
            "
          /><button
            type="button"
            class="propeller-add-to-cart__increment px-3 h-full text-muted-foreground hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-r-[var(--radius-control)] select-none"
            @click="async (event) => increment()"
            :disabled="loading"
          >
            +
          </button>
        </div>
      </template>

      <template v-if="allowIncrDecr === false">
        <input
          type="number"
          class="propeller-add-to-cart__quantity w-16 h-10 text-center text-sm border border-input rounded-[var(--radius-control)] focus:ring-2 focus:ring-secondary focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          :min="getMinQuantity(props.product)"
          :step="getStep(props.product)"
          :value="quantity"
          @change="
            async (e) => {
              const val = parseInt(e.target.value, 10);
              const min = getMinQuantity(props.product);
              const step = getStep(props.product);
              if (!isNaN(val) && val >= min) {
                quantity = Math.round((val - min) / step) * step + min;
              }
            }
          "
        />
      </template>

      <button
        type="button"
        class="propeller-add-to-cart__submit flex-1 inline-flex justify-center items-center h-10 px-6 border border-transparent text-sm font-medium rounded-[var(--radius-control)] text-primary-foreground bg-secondary hover:bg-secondary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        @click="async (event) => handleAddToCart()"
        :disabled="loading"
      >
        <template v-if="loading">
          {{ getLabel("adding", "Adding...") }}
        </template>

        <template v-if="!loading">
          {{ getLabel("add", "Add") }}
        </template>
      </button>
    </div>
    <template v-if="toastVisible">
      <div
        :class="`propeller-add-to-cart__toast fixed top-4 right-4 z-50 flex items-start gap-3 w-80 rounded-[var(--radius-container)] shadow-lg p-4 ${
          toastType === 'success'
            ? 'bg-success/10 border border-success'
            : 'bg-destructive/10 border border-destructive'
        }`"
        :data-toast-type="toastType"
      >
        <div
          :class="`propeller-add-to-cart__toast-icon flex-shrink-0 w-5 h-5 mt-0.5 ${
            toastType === 'success' ? 'text-success' : 'text-destructive'
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
          :class="`propeller-add-to-cart__toast-message flex-1 text-sm font-medium ${
            toastType === 'success' ? 'text-success' : 'text-destructive'
          }`"
        >
          {{ toastMessage }}
        </p>
        <button
          type="button"
          @click="async (event) => dismissToast()"
          :class="`propeller-add-to-cart__toast-close flex-shrink-0 rounded focus:outline-none ${
            toastType === 'success'
              ? 'text-success hover:text-success'
              : 'text-destructive hover:text-destructive'
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
        class="propeller-add-to-cart__modal fixed inset-0 z-50 flex items-center justify-center px-4"
      >
        <div
          class="propeller-add-to-cart__modal-backdrop fixed inset-0 bg-foreground/20"
          @click="async (event) => closeModal()"
        ></div>
        <div
          class="propeller-add-to-cart__modal-content relative w-full max-w-lg bg-card rounded-[var(--radius-container)] shadow-2xl overflow-hidden"
        >
          <div
            class="propeller-add-to-cart__modal-header flex items-center gap-3 px-6 py-4 border-b border-border-subtle"
          >
            <svg
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              class="propeller-add-to-cart__modal-success-icon h-5 w-5 flex-shrink-0 text-success"
              :strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              ></path>
            </svg>
            <h3
              class="propeller-add-to-cart__modal-title flex-1 text-base font-semibold text-foreground"
            >
              {{ getLabel("modalTitle", "Added to cart") }}
            </h3>
            <button
              type="button"
              class="propeller-add-to-cart__modal-close flex-shrink-0 text-foreground-subtle hover:text-muted-foreground focus:outline-none"
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
          <div class="propeller-add-to-cart__modal-body px-6 py-5">
            <div
              class="propeller-add-to-cart__modal-product flex items-start gap-4"
            >
              <template v-if="!!getModalImageUrl()">
                <img
                  class="propeller-add-to-cart__modal-image w-16 h-16 object-contain rounded border border-border-subtle flex-shrink-0"
                  :src="getModalImageUrl()"
                  :alt="getModalName()"
                />
              </template>

              <template v-if="!getModalImageUrl()">
                <div
                  class="propeller-add-to-cart__modal-image-placeholder w-16 h-16 flex items-center justify-center rounded border border-border-subtle flex-shrink-0 bg-surface-hover"
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
                <router-link
                  class="propeller-add-to-cart__modal-product-title text-sm font-medium text-secondary leading-tight hover:underline line-clamp-2"
                  :to="getProductUrl()"
                  >{{ getModalName() }}</router-link
                >
                <template v-if="!!getModalSku()">
                  <p
                    class="propeller-add-to-cart__modal-sku text-xs text-foreground-subtle mt-0.5"
                  >
                    SKU: {{ getModalSku() }}
                  </p>
                </template>
              </div>
              <div class="flex-shrink-0 text-right">
                <p
                  class="propeller-add-to-cart__modal-quantity text-xs text-muted-foreground"
                >
                  {{ getLabel("quantity", "Quantity") }}: {{ quantity }}
                </p>
                <template v-if="!!getModalPrice()">
                  <p
                    class="propeller-add-to-cart__modal-price text-sm font-semibold text-foreground mt-0.5"
                  >
                    {{ getModalPrice() }}
                  </p>
                </template>
              </div>
            </div>
            <template v-if="getChildItems().length > 0">
              <div
                class="propeller-add-to-cart__modal-children mt-3 ml-20 space-y-1 border-l-2 border-border-subtle pl-2"
              >
                <template :key="idx" v-for="(child, idx) in getChildItems()">
                  <div
                    class="propeller-add-to-cart__modal-child flex justify-between items-center text-xs text-muted-foreground"
                  >
                    <span class="line-clamp-1">{{
                      child.product?.names?.[0]?.value || "Option"
                    }}</span
                    ><span
                      class="text-foreground-subtle whitespace-nowrap ml-2"
                      >{{
                        "\u20AC" +
                        (((includeTax !== undefined ? !!includeTax : includeTax)
                          ? child.totalSumNet
                          : child.totalSum
                        )?.toFixed(2) || "0.00")
                      }}</span
                    >
                  </div>
                </template>
              </div>
            </template>
          </div>
          <div
            class="propeller-add-to-cart__modal-actions flex gap-3 px-6 py-4 border-t border-border-subtle"
          >
            <button
              type="button"
              class="propeller-add-to-cart__modal-continue flex-1 inline-flex justify-center rounded-[var(--radius-control)] border border-input bg-card px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2"
              @click="async (event) => closeModal()"
            >
              {{ getLabel("continueShopping", "Continue shopping") }}
            </button>
            <template
              v-if="
                checkoutAllowed &&
                !!onRequestQuoteClick &&
                !!user &&
                'contactId' in user
              "
            >
              <button
                type="button"
                class="propeller-add-to-cart__modal-quote flex-1 inline-flex justify-center rounded-[var(--radius-control)] border border-secondary bg-card px-4 py-2 text-sm font-medium text-secondary hover:bg-secondary/5 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2"
                @click="
                  async (event) => {
                    closeModal();
                    if (onRequestQuoteClick && cart) onRequestQuoteClick(cart);
                  }
                "
              >
                {{ getLabel("requestQuoteButton", "Request a Quote") }}
              </button>
            </template>

            <template v-if="checkoutAllowed">
              <button
                type="button"
                class="propeller-add-to-cart__modal-checkout flex-1 inline-flex justify-center rounded-[var(--radius-control)] border border-transparent bg-secondary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-secondary/90 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2"
                @click="
                  async (event) => {
                    closeModal();
                    if (onProceedToCheckout) onProceedToCheckout();
                  }
                "
              >
                {{ getLabel("proceedToCheckout", "Proceed to checkout") }}
              </button>
            </template>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from "vue";

import {
  CartChildItemInput,
  GraphQLClient,
  Product,
  Cart,
  Contact,
  Customer,
  TransformationsInput,
  MediaImageProductSearchInput,
  Enums,
  CartMainItem,
  CartBaseItem,
  Cluster,
  PurchaseAuthorizationConfig,
} from "propeller-sdk-v2";
import { useCart } from "../../composables/useCart";
import { getLabel as _getLabel } from "../../composables/shared/utils/labelHelpers";
import {
  getProductImageUrl as _getProductImageUrl,
  getProductSku as _getProductSku,
} from "../../composables/shared/utils/productHelpers";
import { formatPrice as _formatPrice } from "../../composables/shared/utils/formatting";

export interface AddToCartProps {
  /** GraphQL client for the Propeller SDK */
  graphqlClient: GraphQLClient;

  /** The authenticated user (Contact or Customer) */
  user: Contact | Customer | null;

  /** The product to be added to cart */
  product: Product;

  /** Cart ID — required when onAddToCart is not provided */
  cartId?: string;

  /** The cluster to be added to cart */
  cluster?: Cluster;

  /** IDs of the cluster child items, e.g. cluster options */
  childItems?: number[];

  /** Called before adding to cart. Return false to abort (e.g. failed validation). */
  beforeAddToCart?: () => boolean;

  /** Notes for the cart item */
  notes?: string;

  /** Custom price for the product (overrides calculated price) */
  price?: number;

  /** Label overrides for UI strings
   *
   * available labels:
   * - outOfStock
   * - noCartId
   * - errorAdding
   * - addedToCart
   * - modalTitle
   * - quantity
   * - continueShopping
   * - proceedToCheckout
   * - requestQuoteButton
   * - add
   * - adding
   */
  labels?: Record<string, string>;

  /**
   * If true a new cart is created if no cart ID is provided.
   * Defaults to false.
   */
  createCart?: boolean;

  /**
   * Callback to handle a new cart being created.
   * WARNING: If not provided the component create new carts on every add-to-cart.
   */
  onCartCreated?: (cart: Cart) => void;

  /**
   * Callback to handle adding the product to cart.
   * If not provided the component calls CartService.addItemToCart internally.
   */
  onAddToCart?: (
    product: Product,
    clusterId?: number,
    quantity?: number,
    childItems?: CartChildItemInput[],
    notes?: string,
    price?: number,
    showModal?: boolean,
  ) => Cart;

  /**
   * Callback triggered after adding the product to cart.
   */
  afterAddToCart?: (cart: Cart, item?: CartMainItem) => void;

  /**
   * When true a modal popup is shown after a successful add-to-cart
   * with buttons to continue shopping or proceed to checkout.
   * Defaults to false (only a brief inline success message is shown).
   */
  showModal?: boolean;

  /**
   * Renders − and + buttons beside the quantity input.
   * Defaults to true.
   */
  allowIncrDecr?: boolean;

  /**
   * Validates available stock via InventoryService before adding.
   * Defaults to false.
   */
  enableStockValidation?: boolean;

  /** Language code passed to CartService operations. Defaults to 'en'. */
  language?: string;

  /** Additional CSS class for the root element */
  className?: string;

  /** Callback fired when the "Proceed to checkout" modal button is clicked */
  onProceedToCheckout?: () => void;

  /** Callback fired when the "Request a Quote" modal button is clicked */
  onRequestQuoteClick?: (cart: Cart) => void;

  /** Configuration object passed to the component */
  configuration?: {
    language?: string;
    imageSearchFiltersGrid?: MediaImageProductSearchInput;
    imageVariantFiltersSmall?: TransformationsInput;
    urls?: { getProductUrl: (product: Product, language?: string) => string };
  };

  /** Active company ID from the company switcher. Overrides user's default company for cart creation and lookup. */
  companyId?: number;

  /**
   * When true, tax-inclusive price (net) is shown.
   * When false, tax-exclusive price (gross) is shown.
   * Defaults to false.
   */
  includeTax?: boolean;
}

/**
 * Cart query variables interface Variables for the cart query
 */
/**
 * Cart query variables interface Variables for the cart query
 */
export interface CartQueryVariables {
  /** Cart ID to fetch */
  cartId: string;
  /** Language for localized content */
  language: string;
  /** Image search filters */
  imageSearchFilters: MediaImageProductSearchInput;
  /** Image transformation filters */
  imageVariantFilters: TransformationsInput;
}
/**
 * Cart query variables interface Variables for the cart query
 */

interface AddToCartState {
  quantity: number;
  loading: boolean;
  success: boolean;
  modalVisible: boolean;
  activeCartId: string;
  toastMessage: string;
  toastType: string;
  toastVisible: boolean;
  includeTax: boolean;
  priceListener: any;
  getMinQuantity: () => number;
  getStep: () => number;
  increment: () => void;
  decrement: () => void;
  showToast: (message: string, type: string) => void;
  dismissToast: () => void;
  getProductName: () => string;
  getProductUrl: () => string;
  getProductImageUrl: () => string;
  getProductSku: () => string;
  getProductPrice: () => string;
  addedCartItem: CartMainItem | null;
  activeFullCart: Cart | null;
  checkoutAllowed: () => boolean;
  getModalImageUrl: () => string;
  getModalName: () => string;
  getModalPrice: () => string;
  getModalSku: () => string;
  getChildItems: () => CartBaseItem[];
  initCart: () => Promise<string>;
  handleAddToCart: () => Promise<void>;
  closeModal: () => void;
  getLabel: (key: string, fallback: string) => string;
}

const props = withDefaults(defineProps<AddToCartProps>(), {
  allowIncrDecr: true,
});

const userRef = computed(() => props.user ?? null);
const companyRef = computed(() => props.companyId);

const { cart, loading, checkoutAllowed, addItem, getMinQuantity, getStep } =
  useCart({
    graphqlClient: props.graphqlClient,
    user: userRef,
    companyId: companyRef,
    cartId: props.cartId,
    configuration: {
      imageSearchFiltersGrid:
        props.configuration?.imageSearchFiltersGrid ?? ({} as any),
      imageVariantFiltersSmall:
        props.configuration?.imageVariantFiltersSmall ?? ({} as any),
      language: props.configuration?.language,
    },
    onCartCreated: props.onCartCreated,
  });

const quantity = ref<AddToCartState["quantity"]>(1);
const success = ref<AddToCartState["success"]>(false);
const modalVisible = ref<AddToCartState["modalVisible"]>(false);
const toastMessage = ref<AddToCartState["toastMessage"]>("");
const toastType = ref<AddToCartState["toastType"]>("");
const toastVisible = ref<AddToCartState["toastVisible"]>(false);
const addedCartItem = ref<AddToCartState["addedCartItem"]>(null);
const includeTax = ref<AddToCartState["includeTax"]>(false);
const priceListener = ref<AddToCartState["priceListener"]>(null);

onMounted(() => {
  quantity.value = getMinQuantity(props.product);
});

function increment(): ReturnType<AddToCartState["increment"]> {
  quantity.value = quantity.value + getStep(props.product);
}
function decrement(): ReturnType<AddToCartState["decrement"]> {
  const min = getMinQuantity(props.product);
  const step = getStep(props.product);
  if (quantity.value - step >= min) {
    quantity.value = quantity.value - step;
  }
}
function showToast(
  message: string,
  type: string,
): ReturnType<AddToCartState["showToast"]> {
  toastMessage.value = message;
  toastType.value = type;
  toastVisible.value = true;
  setTimeout(() => {
    toastVisible.value = false;
  }, 3000);
}
function dismissToast(): ReturnType<AddToCartState["dismissToast"]> {
  toastVisible.value = false;
}
function getProductName(): ReturnType<AddToCartState["getProductName"]> {
  return (props.product as Product)?.names?.[0]?.value || "Product";
}
function getProductUrl(): ReturnType<AddToCartState["getProductUrl"]> {
  return (
    props.configuration?.urls?.getProductUrl(props.product, props.language) ??
    "#"
  );
}
function getProductImageUrl(): ReturnType<
  AddToCartState["getProductImageUrl"]
> {
  return _getProductImageUrl(props.product as Product);
}
function getProductSku(): ReturnType<AddToCartState["getProductSku"]> {
  return _getProductSku(props.product as Product);
}
function getProductPrice(): ReturnType<AddToCartState["getProductPrice"]> {
  const price =
    props.price !== undefined
      ? props.price
      : (props.product as Product)?.price?.gross;
  if (!price && price !== 0) return "";
  return _formatPrice(Number(price), { symbol: "€" });
}
async function handleAddToCart(): ReturnType<
  AddToCartState["handleAddToCart"]
> {
  if (!props.graphqlClient) return;
  if (props.beforeAddToCart && !props.beforeAddToCart()) return;
  success.value = false;
  const result = await addItem({
    product: props.product,
    cluster: props.cluster,
    childItems: props.childItems,
    quantity: quantity.value,
    notes: props.notes,
    price: props.price,
    cartId: props.cartId,
    enableStockValidation: props.enableStockValidation,
    onAddToCart: props.onAddToCart as any,
    createCart: props.createCart,
    afterAddToCart: (resultCart, item) => {
      addedCartItem.value = item ?? null;
      props.afterAddToCart?.(resultCart, item ?? undefined);
    },
  });
  if (!result.success) {
    showToast(
      getLabel(
        result.error === "Insufficient stock available"
          ? "outOfStock"
          : "errorAdding",
        result.error || "Failed to add item to cart",
      ),
      "error",
    );
    return;
  }
  success.value = true;
  if (props.showModal) {
    modalVisible.value = true;
  } else {
    showToast(
      `${getProductName()} ${getLabel("addedToCart", "added to cart")}`,
      "success",
    );
  }
}
function getModalImageUrl(): ReturnType<AddToCartState["getModalImageUrl"]> {
  if (addedCartItem.value) {
    const img =
      addedCartItem.value.product?.media?.images?.items?.[0]?.imageVariants?.[0]
        ?.url;
    if (img) return img;
  }
  return getProductImageUrl();
}
function getModalName(): ReturnType<AddToCartState["getModalName"]> {
  if (addedCartItem.value) {
    return addedCartItem.value.product?.names?.[0]?.value || getProductName();
  }
  return getProductName();
}
function getModalPrice(): ReturnType<AddToCartState["getModalPrice"]> {
  if (addedCartItem.value) {
    const useTax: boolean =
      props.includeTax !== undefined ? !!props.includeTax : includeTax.value;
    const price = useTax
      ? addedCartItem.value.totalSumNet
      : addedCartItem.value.totalSum;
    return _formatPrice(Number(price), { symbol: "€" });
  }
  return getProductPrice();
}
function getModalSku(): ReturnType<AddToCartState["getModalSku"]> {
  if (addedCartItem.value) return addedCartItem.value.product?.sku || "";
  return getProductSku();
}
function getChildItems(): ReturnType<AddToCartState["getChildItems"]> {
  const children = addedCartItem.value?.childItems;
  if (!children || !Array.isArray(children)) return [];
  return children;
}
function closeModal(): ReturnType<AddToCartState["closeModal"]> {
  modalVisible.value = false;
  success.value = false;
  addedCartItem.value = null;
}
function getLabel(
  key: string,
  fallback: string,
): ReturnType<AddToCartState["getLabel"]> {
  return _getLabel(props.labels, key, fallback);
}
</script>
