<template>
  <div
    class="propeller-cart-icon relative"
    :data-sidebar-open="sidebarOpen ? 'true' : 'false'"
  >
    <div
      class="propeller-cart-icon__trigger-wrapper relative"
      @mouseenter="
        async (event) => {
          isHovered = true;
        }
      "
      @mouseleave="
        async (event) => {
          isHovered = false;
        }
      "
    >
      <button
        type="button"
        @click="async (event) => handleIconClick()"
        :aria-label="getLabel('cartIconLabel', 'Shopping cart')"
        :class="`propeller-cart-icon__trigger relative inline-flex items-center justify-center p-2 rounded-[var(--radius-control)] transition-colors text-foreground${
          iconClassName ? ' ' + iconClassName : ''
        }`"
      >
        <svg
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          class="propeller-cart-icon__icon w-6 h-6"
          :strokeWidth="1.5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z"
          ></path>
        </svg>
        <template
          v-if="isMounted && showBadge !== false && getTotalItems() > 0"
        >
          <span
            class="propeller-cart-icon__badge absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold pointer-events-none"
            >{{ getTotalItems() }}</span
          >
        </template>
      </button>
      <template v-if="showTotals && isHovered && getTotalItems() > 0">
        <div
          class="propeller-cart-icon__popover absolute top-full right-0 mt-1 z-40 bg-card border border-border rounded-[var(--radius-container)] shadow-lg px-3 py-2 min-w-[140px] text-sm whitespace-nowrap"
        >
          <div class="flex justify-between gap-4">
            <span
              class="propeller-cart-icon__popover-label text-muted-foreground"
              >{{ getLabel("totalLabel", "Total") }}</span
            ><span
              class="propeller-cart-icon__popover-total font-semibold text-foreground"
              >{{ getTotalPrice() }}</span
            >
          </div>
          <div
            class="propeller-cart-icon__popover-count text-xs text-foreground-subtle mt-0.5"
          >
            {{ getTotalItems() }}{{ getLabel("itemsLabel", "item(s)") }}
          </div>
        </div>
      </template>
    </div>
    <template v-if="sidebarOpen">
      <div
        aria-hidden="true"
        class="propeller-cart-icon__backdrop fixed inset-0 bg-black/80 backdrop-blur-sm z-[70]"
        @click="async (event) => closeSidebar()"
      ></div>
    </template>

    <div
      role="dialog"
      aria-modal="true"
      :aria-label="getSidebarTitle()"
      :data-open="sidebarOpen ? 'true' : 'false'"
      :class="`propeller-cart-icon__sidebar fixed inset-y-0 right-0 z-[70] w-full max-w-md bg-card shadow-2xl transform transition-transform duration-300 ease-in-out border-l border-border${
        sidebarOpen ? ' translate-x-0' : ' translate-x-full'
      }${sidebarClassName ? ' ' + sidebarClassName : ''}`"
    >
      <div class="flex flex-col h-full">
        <template v-if="isMounted">
          <div
            class="propeller-cart-icon__sidebar-header flex items-center justify-between px-5 py-4 border-b border-border"
          >
            <div class="flex items-center gap-2">
              <svg
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                class="w-5 h-5 text-muted-foreground"
                :strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z"
                ></path>
              </svg>
              <h2
                class="propeller-cart-icon__sidebar-title text-base font-semibold text-foreground"
              >
                {{ getSidebarTitle() }}
              </h2>
              <span
                class="propeller-cart-icon__sidebar-count inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-secondary/10 text-secondary text-xs font-bold"
                >{{ getTotalItems() }}</span
              >
            </div>
            <button
              type="button"
              class="propeller-cart-icon__sidebar-close p-1 rounded-[var(--radius-control)] text-foreground-subtle hover:text-muted-foreground hover:bg-surface-hover transition-colors"
              @click="async (event) => closeSidebar()"
              :aria-label="getLabel('closeLabel', 'Close')"
            >
              <svg
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                class="w-5 h-5"
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
          <div
            class="propeller-cart-icon__sidebar-body flex-1 overflow-y-auto px-5 py-4 space-y-4"
          >
            <template v-if="getItems().length === 0">
              <div
                class="propeller-cart-icon__empty flex flex-col items-center justify-center h-full text-center space-y-4 py-16"
              >
                <svg
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  class="propeller-cart-icon__empty-icon w-12 h-12 text-foreground-subtle"
                  :strokeWidth="1.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z"
                  ></path>
                </svg>
                <p
                  class="propeller-cart-icon__empty-message text-sm text-muted-foreground"
                >
                  {{ getLabel("emptyCart", "Your cart is empty.") }}
                </p>
                <button
                  type="button"
                  class="propeller-cart-icon__empty-action text-sm text-secondary hover:underline"
                  @click="async (event) => closeSidebar()"
                >
                  {{ getLabel("continueShopping", "Continue Shopping") }}
                </button>
              </div>
            </template>

            <template v-if="getItems().length > 0">
              <template :key="item.itemId" v-for="(item, index) in getItems()">
                <div
                  class="propeller-cart-icon__item flex gap-3"
                  :data-bundle="isBundleItem(item) ? 'true' : 'false'"
                >
                  <div
                    class="propeller-cart-icon__item-media w-20 h-20 flex-shrink-0 bg-surface-hover rounded-[var(--radius-control)] overflow-hidden border border-border-subtle flex items-center justify-center"
                  >
                    <template v-if="!!getItemImageUrl(item)">
                      <img
                        class="propeller-cart-icon__item-image w-full h-full object-contain p-2"
                        :src="getItemImageUrl(item)"
                        :alt="getItemName(item)"
                      />
                    </template>

                    <template v-if="!getItemImageUrl(item)">
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
                    </template>
                  </div>
                  <div
                    class="propeller-cart-icon__item-body flex-1 min-w-0 flex flex-col justify-between py-1"
                  >
                    <template v-if="isBundleItem(item)">
                      <div>
                        <div class="flex justify-between items-start gap-2">
                          <span
                            class="propeller-cart-icon__item-title text-sm font-medium leading-tight text-foreground line-clamp-2"
                            >{{ getBundleName(item) }}</span
                          >
                          <template v-if="!!getBundlePrice(item)">
                            <span
                              class="propeller-cart-icon__item-price font-semibold text-sm text-foreground whitespace-nowrap"
                              >{{ getBundlePrice(item) }}</span
                            >
                          </template>
                        </div>
                        <div
                          class="propeller-cart-icon__item-bundle mt-1.5 space-y-1 border-l-2 border-secondary/10 pl-2"
                        >
                          <template v-if="!!getBundleLeaderName(item)">
                            <div
                              class="propeller-cart-icon__item-bundle-leader flex justify-between items-center text-xs"
                            >
                              <span class="font-medium text-muted-foreground">{{
                                getBundleLeaderName(item)
                              }}</span>
                              <template v-if="!!getBundleLeaderPrice(item)">
                                <span
                                  class="text-muted-foreground whitespace-nowrap ml-2"
                                  >{{ getBundleLeaderPrice(item) }}</span
                                >
                              </template>
                            </div>
                          </template>

                          <template
                            :key="idx"
                            v-for="(bundleItem, idx) in getBundleNonLeaders(
                              item,
                            )"
                          >
                            <div
                              class="propeller-cart-icon__item-bundle-item flex justify-between items-center text-xs text-muted-foreground"
                            >
                              <span class="line-clamp-1">{{
                                getBundleItemName(bundleItem)
                              }}</span>
                              <template v-if="!!getBundleItemPrice(bundleItem)">
                                <span
                                  class="text-foreground-subtle whitespace-nowrap ml-2"
                                  >{{ getBundleItemPrice(bundleItem) }}</span
                                >
                              </template>
                            </div>
                          </template>
                        </div>
                      </div>
                      <div
                        class="propeller-cart-icon__item-qty flex items-center text-xs text-foreground-subtle mt-1"
                      >
                        <span
                          >{{ getLabel("qty", "Qty") }}:
                          {{ item.quantity }}</span
                        >
                      </div>
                    </template>

                    <template v-if="!isBundleItem(item)">
                      <div>
                        <div class="flex justify-between items-start gap-2">
                          <router-link
                            class="propeller-cart-icon__item-title text-sm font-medium leading-tight text-foreground hover:text-secondary transition-colors line-clamp-2"
                            :to="getItemProductUrl(item)"
                            @click="async (event) => closeSidebar()"
                            >{{ getItemName(item) }}</router-link
                          ><span
                            class="propeller-cart-icon__item-price font-semibold text-sm text-foreground whitespace-nowrap"
                          >
                            &euro;{{ item.totalSumNet.toFixed(2) }}</span
                          >
                        </div>
                        <p
                          class="propeller-cart-icon__item-sku text-xs text-foreground-subtle mt-0.5"
                        >
                          SKU: {{ item.product?.sku || "N/A" }}
                        </p>
                        <template v-if="getItemChildItems(item).length > 0">
                          <div
                            class="propeller-cart-icon__item-options mt-1.5 space-y-1 border-l-2 border-border-subtle pl-2"
                          >
                            <template
                              :key="idx"
                              v-for="(child, idx) in getItemChildItems(item)"
                            >
                              <div
                                class="propeller-cart-icon__item-option flex justify-between items-center text-xs text-muted-foreground"
                              >
                                <span class="line-clamp-1">{{
                                  child.product.names?.[0]?.value || "Option"
                                }}</span
                                ><span
                                  class="text-foreground-subtle whitespace-nowrap ml-2"
                                  >&euro;{{ child.totalSum.toFixed(2) }}</span
                                >
                              </div>
                            </template>
                          </div>
                        </template>
                      </div>
                      <div
                        class="propeller-cart-icon__item-qty flex items-center text-xs text-foreground-subtle"
                      >
                        <span
                          >{{ getLabel("qty", "Qty") }}:
                          {{ item.quantity }}</span
                        >
                      </div>
                    </template>
                  </div>
                </div>
              </template>
            </template>
          </div>

          <template v-if="getItems().length > 0">
            <div
              class="propeller-cart-icon__sidebar-footer px-5 py-4 border-t border-border space-y-3 bg-surface-hover"
            >
              <div
                class="propeller-cart-icon__total-row flex justify-between items-center"
              >
                <span
                  class="propeller-cart-icon__total-label text-sm font-medium text-muted-foreground"
                  >{{ getLabel("total", "Total") }}</span
                ><span
                  class="propeller-cart-icon__total-value text-base font-bold text-foreground"
                  >{{ getTotalPrice() }}</span
                >
              </div>
              <template
                v-if="showCheckoutButton() && !showRequestAuthorizationButton()"
              >
                <button
                  type="button"
                  class="propeller-cart-icon__checkout-btn w-full inline-flex justify-center items-center px-4 py-2.5 rounded-[var(--radius-control)] bg-secondary text-primary-foreground text-sm font-medium hover:bg-secondary/90 transition-colors"
                  @click="async (event) => handleCheckoutClick()"
                >
                  {{ getLabel("checkoutButton", "Checkout") }}
                </button>
              </template>

              <template v-if="showRequestAuthorizationButton()">
                <button
                  type="button"
                  class="propeller-cart-icon__authorization-btn w-full inline-flex justify-center items-center px-4 py-2.5 rounded-[var(--radius-control)] bg-secondary text-primary-foreground text-sm font-medium hover:bg-secondary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  @click="async (event) => handleRequestAuthorizationClick()"
                  :disabled="requestLoading"
                >
                  <template v-if="requestLoading">
                    {{ getLabel("requestingAuthorization", "Requesting...") }}
                  </template>

                  <template v-if="!requestLoading">
                    {{
                      getLabel(
                        "requestAuthorizationButton",
                        "Request Authorization",
                      )
                    }}
                  </template>
                </button>
              </template>

              <template
                v-if="
                  !showRequestAuthorizationButton() &&
                  !!onRequestQuoteClick &&
                  !!user &&
                  'contactId' in user
                "
              >
                <button
                  type="button"
                  class="propeller-cart-icon__quote-btn w-full inline-flex justify-center items-center px-4 py-2.5 rounded-[var(--radius-control)] border border-secondary bg-card text-secondary text-sm font-medium hover:bg-secondary/5 transition-colors"
                  @click="
                    async (event) => {
                      closeSidebar();
                      onRequestQuoteClick && onRequestQuoteClick(cart as Cart);
                    }
                  "
                >
                  {{ getLabel("requestQuoteButton", "Request a Quote") }}
                </button>
              </template>

              <template v-if="cartPageButton !== false">
                <button
                  type="button"
                  class="propeller-cart-icon__view-cart-btn w-full inline-flex justify-center items-center px-4 py-2.5 rounded-[var(--radius-control)] border border-input bg-card text-muted-foreground text-sm font-medium hover:bg-surface-hover transition-colors"
                  @click="async (event) => handleCartPageClick()"
                >
                  {{ getLabel("cartPageButton", "View Cart Details") }}
                </button>
              </template>
            </div>
          </template>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import { BundleItem, Cart, CartBaseItem, CartMainItem, Contact, Customer, GraphQLClient, ProductClass, PurchaseRole, YesNo } from "propeller-sdk-v2";
import { useCart } from "../../composables/useCart";
import { getLabel as _getLabel } from "../../composables/shared/utils/labelHelpers";
import { formatPrice as _formatPrice } from "../../composables/shared/utils/formatting";
import { localizeHref as _localizeHref } from "@/lib/config";

export interface CartIconAndSidebarProps {
  /**
   * Shopping cart that this component will operate with.
   * Should be passed from a cart state.
   */
  cart: Cart | null;

  /**
   * Icon for the cart icon in header.
   * @default 'default-cart-icon'
   */
  icon?: string;

  /**
   * Shows item count badge on the cart icon.
   * @default true
   */
  showBadge?: boolean;

  /**
   * Shows the totals of the shopping cart beneath the icon when hovered.
   * @default false
   */
  showTotals?: boolean;

  /**
   * Show cart sidebar at the right side of the screen when cart icon is clicked.
   * If false it will fire onCartIconClick() instead.
   * @default true
   */
  showCartSidebarOnClick?: boolean;

  /**
   * Fires a click event when showCartSidebarOnClick is set to false.
   */
  onCartIconClick?: (cart: Cart) => void;

  /**
   * Title for the shopping cart sidebar.
   * @default 'Shopping cart'
   */
  cartSidebarTitle?: string;

  /**
   * Show checkout button in cart sidebar for immediate checkout.
   * @default true
   */
  cartCheckoutButton?: boolean;

  /**
   * Fires a click event when the checkout button in the sidebar is clicked.
   */
  onCheckoutButtonClick?: (cart: Cart) => void;

  /**
   * Show shopping cart page button in cart sidebar.
   * @default true
   */
  cartPageButton?: boolean;

  /**
   * Fires a click event when the shopping cart button in the sidebar is clicked.
   */
  onCartPageButtonClick?: (cart: Cart) => void;

  /**
   * Labels for the component.
   * Available keys: cartIconLabel, totalLabel, itemsLabel, emptyCart,
   * continueShopping, qty, total, checkoutButton, cartPageButton, closeLabel
   */
  labels?: Record<string, string>;

  /** Logged-in user — used to determine purchaser role and authorization limit */
  user?: Contact | Customer;

  /** Active company ID — used to look up the user's PAC for this company */
  companyId?: number;

  /** Action handler when the "Request a Quote" button is clicked */
  onRequestQuoteClick?: (cart: Cart) => void;

  /** GraphQL client — used for internal CartService calls (e.g. purchase authorization) */
  graphqlClient?: GraphQLClient;

  /** Override the internal request purchase authorization call */
  onRequestAuthorization?: (cart: Cart) => void;

  /** Fires after a successful purchase authorization request with the updated cart */
  afterRequestAuthorization?: (cart: Cart) => void;

  /** Error handler for authorization request failures */
  onError?: (error: Error) => void;

  /**
   * Additional class name for the shopping cart icon.
   */
  iconClassName?: string;

  /**
   * Additional class name for the shopping cart sidebar.
   */
  sidebarClassName?: string;

  /** Configuration object for image filters */
  configuration?: any;

  /** Language used to build localized URLs for cart-item links. Defaults to 'NL'. */
  language?: string;
}
interface CartIconAndSidebarState {
  isMounted: boolean;
  sidebarOpen: boolean;
  isHovered: boolean;
  getTotalItems: () => number;
  getTotalPrice: () => string;
  getItems: () => CartMainItem[];
  getItemName: (item: CartMainItem) => string;
  getItemImageUrl: (item: CartMainItem) => string;
  getItemProductUrl: (item: CartMainItem) => string;
  handleIconClick: () => void;
  openSidebar: () => void;
  closeSidebar: () => void;
  handleCheckoutClick: () => void;
  handleCartPageClick: () => void;
  getLabel: (key: string, fallback: string) => string;
  getSidebarTitle: () => string;
  getItemChildItems: (item: CartMainItem) => CartBaseItem[];
  isBundleItem: (item: CartMainItem) => boolean;
  getBundleName: (item: CartMainItem) => string;
  getBundlePrice: (item: CartMainItem) => string;
  getBundleLeaderName: (item: CartMainItem) => string;
  getBundleLeaderPrice: (item: CartMainItem) => string;
  getBundleNonLeaders: (item: CartMainItem) => BundleItem[];
  getBundleItemName: (bundleItem: BundleItem) => string;
  getBundleItemPrice: (bundleItem: BundleItem) => string;
  showCheckoutButton: () => boolean;
  showRequestAuthorizationButton: () => boolean;
  requestLoading: boolean;
  handleRequestAuthorizationClick: () => Promise<void>;
}

const props = withDefaults(defineProps<CartIconAndSidebarProps>(), {
  showBadge: true,
  cartPageButton: true,
  showCartSidebarOnClick: true,
});
const isMounted = ref<CartIconAndSidebarState["isMounted"]>(false);
const sidebarOpen = ref<CartIconAndSidebarState["sidebarOpen"]>(false);
const isHovered = ref<CartIconAndSidebarState["isHovered"]>(false);
const requestLoading = ref<CartIconAndSidebarState["requestLoading"]>(false);

const userRef = computed(() => props.user ?? null);
const companyRef = computed(() => props.companyId);
const cartIdRef = computed(() => props.cart?.cartId);
const { requestAuthorization } = useCart({
  graphqlClient: props.graphqlClient!,
  user: userRef,
  cartId: cartIdRef,
  companyId: companyRef,
  configuration: {
    imageSearchFiltersGrid:
      props.configuration?.imageSearchFiltersGrid ?? ({} as any),
    imageVariantFiltersSmall:
      props.configuration?.imageVariantFiltersSmall ?? ({} as any),
  },
});

onMounted(() => {
  isMounted.value = true;
});

function getCartItems(): CartMainItem[] {
  const cart = props.cart as any;
  return cart?.items ?? cart?.mainItems?.items ?? [];
}
function getTotalItems(): ReturnType<CartIconAndSidebarState["getTotalItems"]> {
  return getCartItems().reduce((sum, item) => sum + (item.quantity || 0), 0);
}
function getTotalPrice(): ReturnType<CartIconAndSidebarState["getTotalPrice"]> {
  const total = props.cart?.total?.totalNet;
  return _formatPrice(total ?? 0, { symbol: "€" });
}
function getItems(): ReturnType<CartIconAndSidebarState["getItems"]> {
  return getCartItems().filter((item: CartMainItem) => item && item.product);
}
function getItemName(
  item: CartMainItem,
): ReturnType<CartIconAndSidebarState["getItemName"]> {
  return item.product?.names?.[0]?.value || "Unnamed Product";
}
function getItemImageUrl(
  item: CartMainItem,
): ReturnType<CartIconAndSidebarState["getItemImageUrl"]> {
  const url = item.product?.media?.images?.items?.[0]?.imageVariants?.[0]?.url;
  return url && url.startsWith("http") ? url : "";
}
function getItemProductUrl(
  item: CartMainItem,
): ReturnType<CartIconAndSidebarState["getItemProductUrl"]> {
  const product = item.product;
  if (!product) return "#";
  if (product.class === ProductClass.PRODUCT) {
    const slug = product.slugs?.[0]?.value || "";
    return _localizeHref(`/product/${product.productId}/${slug}`, props.language);
  } else if (product.class === ProductClass.CLUSTER) {
    const slug = product.slugs?.[0]?.value || "";
    return _localizeHref(`/cluster/${product.clusterId || product.productId}/${slug}`, props.language);
  }
  return "#";
}
function handleIconClick(): ReturnType<
  CartIconAndSidebarState["handleIconClick"]
> {
  if (props.showCartSidebarOnClick !== false) {
    sidebarOpen.value = true;
  } else {
    if (props.onCartIconClick) props.onCartIconClick(props.cart as Cart);
  }
}
function openSidebar(): ReturnType<CartIconAndSidebarState["openSidebar"]> {
  sidebarOpen.value = true;
}
function closeSidebar(): ReturnType<CartIconAndSidebarState["closeSidebar"]> {
  sidebarOpen.value = false;
}
function handleCheckoutClick(): ReturnType<
  CartIconAndSidebarState["handleCheckoutClick"]
> {
  sidebarOpen.value = false;
  if (props.onCheckoutButtonClick)
    props.onCheckoutButtonClick(props.cart as Cart);
}
function handleCartPageClick(): ReturnType<
  CartIconAndSidebarState["handleCartPageClick"]
> {
  sidebarOpen.value = false;
  if (props.onCartPageButtonClick)
    props.onCartPageButtonClick(props.cart as Cart);
}
function getLabel(
  key: string,
  fallback: string,
): ReturnType<CartIconAndSidebarState["getLabel"]> {
  return _getLabel(props.labels, key, fallback);
}
function getSidebarTitle(): ReturnType<
  CartIconAndSidebarState["getSidebarTitle"]
> {
  return (
    props.cartSidebarTitle ||
    props.labels?.["cartSidebarTitle"] ||
    "Shopping cart"
  );
}
function getItemChildItems(
  item: CartMainItem,
): ReturnType<CartIconAndSidebarState["getItemChildItems"]> {
  const children = item.childItems;
  if (!children || !Array.isArray(children)) return [];
  return children;
}
function isBundleItem(
  item: CartMainItem,
): ReturnType<CartIconAndSidebarState["isBundleItem"]> {
  return !!item.bundle;
}
function getBundleName(
  item: CartMainItem,
): ReturnType<CartIconAndSidebarState["getBundleName"]> {
  return item.bundle?.name || "Bundle";
}
function getBundlePrice(
  item: CartMainItem,
): ReturnType<CartIconAndSidebarState["getBundlePrice"]> {
  const price = item.bundle?.price?.net;
  if (price === undefined || price === null) return "";
  return _formatPrice(Number(price), { symbol: "€" });
}
function getBundleLeaderName(
  item: CartMainItem,
): ReturnType<CartIconAndSidebarState["getBundleLeaderName"]> {
  const items = item.bundle?.items;
  if (!items) return "";
  const leader = items.find((bi: BundleItem) => bi.isLeader === YesNo.Y);
  if (!leader) return "";
  return leader.product.names?.[0]?.value || "Product";
}
function getBundleLeaderPrice(
  item: CartMainItem,
): ReturnType<CartIconAndSidebarState["getBundleLeaderPrice"]> {
  const items = item.bundle?.items;
  if (!items) return "";
  const leader = items.find((bi: BundleItem) => bi.isLeader === YesNo.Y);
  if (!leader) return "";
  const price = leader.price?.net;
  if (price === undefined || price === null) return "";
  return _formatPrice(Number(price), { symbol: "€" });
}
function getBundleNonLeaders(
  item: CartMainItem,
): ReturnType<CartIconAndSidebarState["getBundleNonLeaders"]> {
  const items = item.bundle?.items;
  if (!items) return [];
  return items.filter((bi: BundleItem) => bi.isLeader !== YesNo.Y);
}
function getBundleItemName(
  bundleItem: BundleItem,
): ReturnType<CartIconAndSidebarState["getBundleItemName"]> {
  return bundleItem.product.names?.[0]?.value || "Product";
}
function getBundleItemPrice(
  bundleItem: BundleItem,
): ReturnType<CartIconAndSidebarState["getBundleItemPrice"]> {
  const price = bundleItem.price?.net;
  if (price === undefined || price === null) return "";
  return _formatPrice(Number(price), { symbol: "€" });
}
function showCheckoutButton(): ReturnType<
  CartIconAndSidebarState["showCheckoutButton"]
> {
  if (props.cartCheckoutButton === false) return false;
  if (!props.user || !("contactId" in props.user)) return true;
  if (!props.companyId) return true;
  const pacData = (props.user as Contact).purchaseAuthorizationConfigs;
  const items: any[] =
    (pacData as any)?.items ?? (pacData as any)?._items ?? [];
  const purchaserPAC = items.find((pac: any) => {
    const role = pac.purchaseRole ?? pac._purchaseRole;
    const pacCompanyId =
      pac.company?.companyId ??
      pac.company?._companyId ??
      pac._company?.companyId ??
      pac._company?._companyId;
    return (
      role === PurchaseRole.PURCHASER && pacCompanyId === props.companyId
    );
  });
  if (!purchaserPAC) return true;
  const limit =
    purchaserPAC.authorizationLimit ?? purchaserPAC._authorizationLimit ?? 0;
  const totalGross = (props.cart as any)?.total?.totalGross ?? 0;
  return totalGross <= limit;
}
function showRequestAuthorizationButton(): ReturnType<
  CartIconAndSidebarState["showRequestAuthorizationButton"]
> {
  if (!props.user || !("contactId" in props.user)) return false;
  if (!props.companyId) return false;
  const pacData = (props.user as Contact).purchaseAuthorizationConfigs;
  const items: any[] =
    (pacData as any)?.items ?? (pacData as any)?._items ?? [];
  const purchaserPAC = items.find((pac: any) => {
    const role = pac.purchaseRole ?? pac._purchaseRole;
    const pacCompanyId =
      pac.company?.companyId ??
      pac.company?._companyId ??
      pac._company?.companyId ??
      pac._company?._companyId;
    return (
      role === PurchaseRole.PURCHASER && pacCompanyId === props.companyId
    );
  });
  if (!purchaserPAC) return false;
  const limit =
    purchaserPAC.authorizationLimit ?? purchaserPAC._authorizationLimit ?? 0;
  const totalGross = (props.cart as any)?.total?.totalGross ?? 0;
  return totalGross > limit;
}
async function handleRequestAuthorizationClick(): ReturnType<
  CartIconAndSidebarState["handleRequestAuthorizationClick"]
> {
  requestLoading.value = true;
  try {
    if (props.onRequestAuthorization) {
      props.onRequestAuthorization(props.cart as Cart);
    } else {
      const result = await requestAuthorization();
      if (!result.success && props.onError) {
        props.onError(
          new Error(result.error || "Failed to request authorization"),
        );
      }
    }
    if (props.afterRequestAuthorization) {
      props.afterRequestAuthorization(props.cart as Cart);
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
