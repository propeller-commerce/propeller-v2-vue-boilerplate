<template>
  <div
    :class="`propeller-cart-item flex flex-wrap md:flex-nowrap items-center gap-4 bg-card p-4 rounded-[var(--radius-container)] shadow-sm border border-border ${
      className || ''
    }`"
    :data-bundle="isBundleItem() ? 'true' : 'false'"
    :data-loading="loading ? 'true' : 'false'"
  >
    <div
      class="propeller-cart-item__media w-20 h-20 md:w-24 md:h-24 flex-shrink-0 bg-surface-hover flex items-center justify-center overflow-hidden relative"
    >
      <template v-if="!!getProductImageUrl()">
        <img
          class="propeller-cart-item__image w-full h-full object-contain p-1"
          :src="getProductImageUrl()"
          :alt="getProductName()"
        />
      </template>

      <template v-if="!getProductImageUrl()">
        <svg
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          class="propeller-cart-item__image-placeholder w-8 h-8 text-foreground-subtle"
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
    <div class="propeller-cart-item__body flex-1 min-w-0">
      <template
        v-if="!isBundleItem() && showSku !== false && !!getProductSku()"
      >
        <p
          class="propeller-cart-item__sku font-mono text-xs text-foreground-subtle"
        >
          {{ getProductSku() }}
        </p>
      </template>

      <template v-if="isBundleItem()">
        <span
          class="propeller-cart-item__title font-semibold text-sm md:text-base text-foreground line-clamp-2"
          >{{ getBundleName() }}</span
        >
      </template>

      <template v-if="!isBundleItem()">
        <template v-if="titleLinkable !== false">
          <a
            class="propeller-cart-item__title font-semibold text-sm md:text-base text-foreground hover:text-foreground transition-colors line-clamp-2"
            :href="getProductUrl()"
            >{{ getProductName() }}</a
          >
        </template>

        <template v-if="titleLinkable === false">
          <span
            class="propeller-cart-item__title font-semibold text-sm md:text-base text-foreground line-clamp-2"
            >{{ getProductName() }}</span
          >
        </template>
      </template>

      <template v-if="showStockComponent === true && !!getInventory()">
        <div class="mt-1">
          <div
            data-cart-item-stock="true"
            :data-inventory="JSON.stringify(getInventory())"
          ></div>
        </div>
      </template>

      <template v-if="isBundleItem()">
        <div
          class="propeller-cart-item__bundle mt-3 space-y-1.5 border-l-2 border-border pl-3"
        >
          <template v-if="!!getBundleLeaderName()">
            <div
              class="propeller-cart-item__bundle-leader flex flex-wrap gap-x-2 text-sm text-muted-foreground"
            >
              <span class="font-semibold text-foreground">{{
                getBundleLeaderName()
              }}</span>
              <template v-if="!!getBundleLeaderPrice()">
                <div
                  class="flex-1 border-b border-dotted border-input mx-1 mb-1"
                ></div>
                <span class="font-semibold text-foreground">{{
                  getBundleLeaderPrice()
                }}</span>
              </template>
            </div>
          </template>

          <template
            :key="idx"
            v-for="(bundleItem, idx) in getBundleNonLeaders()"
          >
            <div
              class="propeller-cart-item__bundle-item flex flex-wrap gap-x-2 text-sm text-muted-foreground"
            >
              <span class="font-medium">{{
                getBundleItemName(bundleItem)
              }}</span>
              <template v-if="!!getBundleItemPrice(bundleItem)">
                <div
                  class="flex-1 border-b border-dotted border-input mx-1 mb-1"
                ></div>
                <span class="font-semibold text-foreground">{{
                  getBundleItemPrice(bundleItem)
                }}</span>
              </template>
            </div>
          </template>
        </div>
      </template>

      <template
        v-if="
          !!cartItem.clusterId &&
          !!cartItem.childItems &&
          cartItem.childItems.length > 0
        "
      >
        <div
          class="propeller-cart-item__options mt-3 space-y-1.5 border-l-2 border-border pl-3"
        >
          <p
            class="propeller-cart-item__options-label text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1"
          >
            {{ getLabel("includedOptions", "Included Options:") }}
          </p>
          <template
            :key="idx"
            v-for="(child, idx) in cartItem.childItems || []"
          >
            <div
              class="propeller-cart-item__option flex flex-wrap gap-x-2 text-sm text-muted-foreground"
            >
              <span class="font-medium">{{
                child.product.names?.[0]?.value || "Option"
              }}</span
              ><span class="text-foreground-subtle hidden sm:inline">-</span
              ><span class="text-foreground-subtle text-xs self-center">{{
                child.product.sku
              }}</span>
              <div
                class="flex-1 border-b border-dotted border-input mx-1 mb-1"
              ></div>
              <span class="font-semibold text-foreground"
                >€{{ child.totalSum.toFixed(2) }}</span
              >
            </div>
          </template>
        </div>
      </template>

      <template v-if="showCartItemNotesField === true">
        <div class="propeller-cart-item__notes mt-3">
          <label
            class="propeller-cart-item__notes-label text-xs font-medium text-muted-foreground block mb-1"
            >{{ getLabel("notes", "Notes") }}</label
          ><textarea
            class="propeller-cart-item__notes-input w-full text-sm border border-input rounded-[var(--radius-control)] px-3 py-2 focus:ring-2 focus:ring-secondary focus:border-transparent resize-none"
            :value="notes"
            @change="async (e) => handleNoteChange(e.target.value)"
            :placeholder="
              getLabel('notesPlaceholder', 'Add a note for this item...')
            "
            :rows="2"
          ></textarea>
        </div>
      </template>

      <template v-if="getVisibleCrossupsells().length > 0">
        <div
          class="propeller-cart-item__crossupsells mt-3 pt-3 border-t border-border"
        >
          <p
            class="propeller-cart-item__crossupsells-label text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2"
          >
            {{ getLabel("crossupsellTitle", "You might also like") }}
          </p>
          <div class="flex flex-col gap-2">
            <template
              :key="idx"
              v-for="(item, idx) in getVisibleCrossupsells()"
            >
              <div
                class="propeller-cart-item__crossupsell flex items-center gap-2 p-2 rounded-[var(--radius-control)] border border-border hover:border-input hover:bg-surface-hover transition-colors"
              >
                <a
                  class="propeller-cart-item__crossupsell-link flex items-center gap-2 flex-1 min-w-0"
                  :href="getCrossupsellUrl(item)"
                  @click="
                    async (e) => {
                      if (onCrossupsellClick) {
                        e.preventDefault();
                        onCrossupsellClick(item.productTo || item.clusterTo);
                      }
                    }
                  "
                >
                  <template v-if="!!getCrossupsellImageUrl(item)">
                    <img
                      class="propeller-cart-item__crossupsell-image w-10 h-10 object-contain rounded flex-shrink-0"
                      :src="getCrossupsellImageUrl(item)"
                      :alt="getCrossupsellName(item)"
                    />
                  </template>

                  <div class="min-w-0">
                    <span
                      class="propeller-cart-item__crossupsell-title text-xs font-medium text-muted-foreground line-clamp-2"
                      >{{ getCrossupsellName(item) }}</span
                    >
                    <template v-if="!!getCrossupsellPrice(item)">
                      <span
                        class="propeller-cart-item__crossupsell-price text-xs font-bold text-foreground block"
                        >{{ getCrossupsellPrice(item) }}</span
                      >
                    </template>
                  </div></a
                ><button
                  type="button"
                  class="propeller-cart-item__crossupsell-btn flex-shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-[var(--radius-control)] bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                  :title="getLabel('addToCart', 'Add to cart')"
                  :disabled="
                    addingCrossupsellId === getCrossupsellProductId(item)
                  "
                  @click="
                    async (e) => {
                      e.stopPropagation();
                      handleAddCrossupsellToCart(item);
                    }
                  "
                >
                  <template
                    v-if="addingCrossupsellId === getCrossupsellProductId(item)"
                  >
                    <div
                      class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"
                    ></div>
                  </template>

                  <template
                    v-if="addingCrossupsellId !== getCrossupsellProductId(item)"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="8" cy="21" r="1"></circle>
                      <circle cx="19" cy="21" r="1"></circle>
                      <path
                        d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"
                      ></path>
                    </svg>
                  </template>
                </button>
              </div>
            </template>
          </div>
        </div>
      </template>
    </div>
    <div
      class="propeller-cart-item__footer w-full md:w-auto flex items-center gap-3 md:gap-4 border-t md:border-t-0 border-border-subtle pt-2 md:pt-0 flex-shrink-0"
    >
      <template v-if="isBundleItem() && !!getBundlePrice()">
        <p
          class="propeller-cart-item__price text-sm md:text-base font-bold text-foreground whitespace-nowrap"
        >
          {{ getBundlePrice() }}
        </p>
      </template>

      <template v-if="!isBundleItem()">
        <p
          class="propeller-cart-item__price text-sm md:text-base font-bold text-foreground whitespace-nowrap"
        >
          {{ getFormattedPrice() }}
        </p>
      </template>

      <template v-if="enableIncrementDecrement !== false">
        <div
          class="propeller-cart-item__stepper flex items-center border border-input rounded-[var(--radius-control)] bg-card h-9"
        >
          <button
            type="button"
            class="propeller-cart-item__decrement px-2.5 h-full text-muted-foreground hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-l-[var(--radius-control)] select-none"
            @click="async (event) => handleQuantityChange(quantity - 1)"
            :disabled="quantity <= 1 || loading"
          >
            -</button
          ><input
            type="number"
            class="propeller-cart-item__quantity w-10 text-center text-sm bg-transparent border-x border-input h-full focus:ring-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            :min="1"
            :value="quantity"
            @change="
              async (e) => {
                const val = parseInt(e.target.value, 10);
                if (val >= 1) handleQuantityChange(val);
              }
            "
          /><button
            type="button"
            class="propeller-cart-item__increment px-2.5 h-full text-muted-foreground hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-r-[var(--radius-control)] select-none"
            @click="async (event) => handleQuantityChange(quantity + 1)"
            :disabled="loading"
          >
            +
          </button>
        </div>
      </template>

      <template v-if="enableIncrementDecrement === false">
        <input
          type="number"
          class="propeller-cart-item__quantity w-14 h-9 text-center text-sm border border-input rounded-[var(--radius-control)] focus:ring-2 focus:ring-primary focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          :min="1"
          :value="quantity"
          @change="
            async (e) => {
              const val = parseInt(e.target.value, 10);
              if (val >= 1) handleQuantityChange(val);
            }
          "
        />
      </template>

      <template v-if="loading">
        <span
          class="propeller-cart-item__updating text-xs text-foreground-subtle"
          >{{ getLabel("updating", "Updating...") }}</span
        >
      </template>

      <button
        type="button"
        class="propeller-cart-item__delete h-8 w-8 p-0 ml-auto inline-flex items-center justify-center rounded-[var(--radius-control)] text-foreground-subtle hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
        @click="async (event) => handleDelete()"
        :disabled="deleting"
      >
        <template v-if="deleting">
          <div
            class="w-4 h-4 border-2 border-input border-t-transparent rounded-full animate-spin"
          ></div>
        </template>

        <template v-if="!deleting">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18"></path>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
          </svg>
        </template>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch, computed } from "vue";
import {
  GraphQLClient,
  CartMainItem,
  CartBaseItem,
  BundleItem,
  Cart,
  ProductInventory,
  type CrossupsellSearchInput,
  Crossupsell,
  Product,
  Cluster,
  Enums,
  type CrossupsellsQueryVariables,
  Contact,
  Customer,
  type MediaImageProductSearchInput,
  type TransformationsInput,
} from "propeller-sdk-v2";
import { useCart } from "../../composables/useCart";
import { getLabel as _getLabel } from "../../composables/shared/utils/labelHelpers";
import {
  getProductImageUrl as _getProductImageUrl,
  getProductSku as _getProductSku,
} from "../../composables/shared/utils/productHelpers";
import { formatPrice as _formatPrice } from "../../composables/shared/utils/formatting";

export interface CartItemProps {
  /** GraphQL client for the Propeller SDK */
  graphqlClient: GraphQLClient;

  /** The shopping cart unique identifier */
  cartId: string;

  /** Tax zone for price calculations */
  taxZone?: string;

  /** Authenticated user for cart operations */
  user?: Contact | Customer | null;

  /** A shopping cart item */
  cartItem: CartMainItem;

  /** Should the item title be a link to the PDP. Defaults to true. */
  titleLinkable?: boolean;

  /** Should the stock be displayed in the cart item. Defaults to false. */
  showStockComponent?: boolean;

  /** Display the SKU of the cart item beneath the item name. Defaults to true. */
  showSku?: boolean;

  /** +/- buttons on left and right of quantity input. Defaults to true. */
  enableIncrementDecrement?: boolean;

  /** Should the cart item notes field be displayed. Defaults to false. */
  showCartItemNotesField?: boolean;

  /** Action callback when a cart item quantity is changed */
  onQuantityChange?: (item: CartMainItem, quantity: number) => void;

  /** Action callback when a cart item note is changed */
  onNoteChange?: (item: CartMainItem, note: string) => void;

  /** Action callback when a cart item is deleted */
  onDelete?: (item: CartMainItem) => void;

  /** Callback with the updated cart after any cart mutation */
  afterCartUpdate?: (cart: Cart) => void;

  /** Label overrides for UI strings
   *
   * Available keys: remove, notes, notesPlaceholder, includedOptions, updating, deleting
   */
  labels?: Record<string, string>;

  /** Language code for CartService operations. Defaults to 'NL'. */
  language?: string;

  /** Configuration object for image filters and URL generation */
  configuration?: {
    language?: string;
    imageSearchFiltersGrid?: MediaImageProductSearchInput;
    imageVariantFiltersSmall?: TransformationsInput;
    imageVariantFiltersMedium?: TransformationsInput;
    urls?: { getProductUrl: (product: Product, language?: string) => string };
  };

  /** Show cross-sell/upsell product suggestions below the item. Defaults to false. */
  showCrossupsells?: boolean;

  /** Which cross-sell types to fetch. Defaults to ['ACCESSORIES']. Values: 'ACCESSORIES', 'ALTERNATIVES', 'OPTIONS', 'PARTS', 'RELATED' */
  crossupsellTypes?: string[];

  /** Maximum number of cross-sell products to display. Defaults to 3. */
  crossupsellLimit?: number;

  /** Callback when a cross-sell product is clicked */
  onCrossupsellClick?: (product: Product | Cluster) => void;

  /** Additional CSS class for the root element */
  className?: string;

  /** Include tax in price. Defaults to false. */
  includeTax?: boolean;

  /** Active company ID for PAC lookup. */
  companyId?: number;
}
interface CartItemState {
  quantity: number;
  notes: string;
  loading: boolean;
  deleting: boolean;
  notesTimeout: any;
  crossupsells: Crossupsell[];
  crossupsellsLoading: boolean;
  getLabel: (key: string, fallback: string) => string;
  getProductName: () => string;
  getProductUrl: () => string;
  getProductImageUrl: () => string;
  getProductSku: () => string;
  getInventory: () => ProductInventory | null;
  getFormattedPrice: () => string;
  isBundleItem: () => boolean;
  getBundleName: () => string;
  getBundlePrice: () => string;
  getBundleLeaderName: () => string;
  getBundleLeaderPrice: () => string;
  getBundleNonLeaders: () => BundleItem[];
  getBundleItemName: (bundleItem: BundleItem) => string;
  getBundleItemPrice: (bundleItem: BundleItem) => string;
  handleQuantityChange: (newQuantity: number) => void;
  handleNoteChange: (note: string) => void;
  handleDelete: () => void;
  fetchCrossupsells: () => void;
  getCrossupsellName: (item: Crossupsell) => string;
  getCrossupsellImageUrl: (item: Crossupsell) => string;
  getCrossupsellUrl: (item: Crossupsell) => string;
  getVisibleCrossupsells: () => Crossupsell[];
  getCrossupsellProductId: (item: Crossupsell) => number | undefined;
  getCrossupsellPrice: (item: Crossupsell) => string;
  addingCrossupsellId: number | null;
  handleAddCrossupsellToCart: (item: Crossupsell) => void;
}

const props = withDefaults(defineProps<CartItemProps>(), {
  showSku: true,
  titleLinkable: true,
  enableIncrementDecrement: true,
});

const userRef = computed(() => props.user ?? null);

const {
  loading,
  updateItemQuantity,
  updateItemNotes,
  deleteItem,
  getCrossupsells,
  addItem,
} = useCart({
  graphqlClient: props.graphqlClient,
  user: userRef,
  cartId: props.cartId,
  configuration: {
    imageSearchFiltersGrid:
      props.configuration?.imageSearchFiltersGrid ?? ({} as any),
    imageVariantFiltersSmall:
      props.configuration?.imageVariantFiltersSmall ?? ({} as any),
  },
});

const quantity = ref<CartItemState["quantity"]>(1);
const notes = ref<CartItemState["notes"]>("");
const deleting = ref<CartItemState["deleting"]>(false);
const crossupsells = ref<CartItemState["crossupsells"]>([]);
const crossupsellsLoading = ref<CartItemState["crossupsellsLoading"]>(false);
const addingCrossupsellId = ref<CartItemState["addingCrossupsellId"]>(null);

onMounted(() => {
  quantity.value = props.cartItem.quantity || 1;
  notes.value = props.cartItem.notes || "";
  fetchCrossupsells();
});

watch(
  () => [props.cartItem],
  () => {
    quantity.value = props.cartItem.quantity || 1;
    notes.value = props.cartItem.notes || "";
  },
  { immediate: true },
);
function getLabel(
  key: string,
  fallback: string,
): ReturnType<CartItemState["getLabel"]> {
  return _getLabel(props.labels, key, fallback);
}
function getProductName(): ReturnType<CartItemState["getProductName"]> {
  return props.cartItem.product?.names?.[0]?.value || "Product";
}
function getProductUrl(): ReturnType<CartItemState["getProductUrl"]> {
  if (props.configuration?.urls && props.cartItem.product) {
    return props.configuration.urls.getProductUrl(
      props.cartItem.product as Product,
      props.language,
    );
  }
  return "#";
}
function getProductImageUrl(): ReturnType<CartItemState["getProductImageUrl"]> {
  return _getProductImageUrl(props.cartItem.product as Product);
}
function getProductSku(): ReturnType<CartItemState["getProductSku"]> {
  return _getProductSku(props.cartItem.product as Product);
}
function getInventory(): ReturnType<CartItemState["getInventory"]> {
  const inv = props.cartItem.product?.inventory;
  return inv || null;
}
function getFormattedPrice(): ReturnType<CartItemState["getFormattedPrice"]> {
  const item = props.cartItem;
  const price = props.includeTax ? item?.totalSumNet || 0 : item?.totalSum || 0;
  return _formatPrice(Number(price), { symbol: "€" });
}
function isBundleItem(): ReturnType<CartItemState["isBundleItem"]> {
  return !!props.cartItem.bundle;
}
function getBundleName(): ReturnType<CartItemState["getBundleName"]> {
  return props.cartItem.bundle?.name || "Bundle";
}
function getBundlePrice(): ReturnType<CartItemState["getBundlePrice"]> {
  const price = props.cartItem.bundle?.price?.net;
  if (price === undefined || price === null) return "";
  return _formatPrice(Number(price), { symbol: "€" });
}
function getBundleLeaderName(): ReturnType<
  CartItemState["getBundleLeaderName"]
> {
  const items = props.cartItem.bundle?.items;
  if (!items) return "";
  const leader = items.find((bi: BundleItem) => bi.isLeader === Enums.YesNo.Y);
  if (!leader) return "";
  return leader.product.names?.[0]?.value || "Product";
}
function getBundleLeaderPrice(): ReturnType<
  CartItemState["getBundleLeaderPrice"]
> {
  const items = props.cartItem.bundle?.items;
  if (!items) return "";
  const leader = items.find((bi: BundleItem) => bi.isLeader === Enums.YesNo.Y);
  if (!leader) return "";
  const price = leader.price?.net;
  if (price === undefined || price === null) return "";
  return _formatPrice(Number(price), { symbol: "€" });
}
function getBundleNonLeaders(): ReturnType<
  CartItemState["getBundleNonLeaders"]
> {
  const items = props.cartItem.bundle?.items;
  if (!items) return [];
  return items.filter((bi: BundleItem) => bi.isLeader !== Enums.YesNo.Y);
}
function getBundleItemName(
  bundleItem: BundleItem,
): ReturnType<CartItemState["getBundleItemName"]> {
  return bundleItem.product.names?.[0]?.value || "Product";
}
function getBundleItemPrice(
  bundleItem: BundleItem,
): ReturnType<CartItemState["getBundleItemPrice"]> {
  const price = bundleItem.price?.net;
  if (price === undefined || price === null) return "";
  return _formatPrice(Number(price), { symbol: "€" });
}
async function handleQuantityChange(
  newQuantity: number,
): ReturnType<CartItemState["handleQuantityChange"]> {
  if (newQuantity < 1 || loading.value) return;
  quantity.value = newQuantity;
  if (props.onQuantityChange) {
    props.onQuantityChange(props.cartItem, newQuantity);
    return;
  }
  const updatedCart = await updateItemQuantity(
    props.cartItem.itemId,
    newQuantity,
  );
  if (updatedCart && props.afterCartUpdate) {
    props.afterCartUpdate(updatedCart);
  }
}
function handleNoteChange(
  note: string,
): ReturnType<CartItemState["handleNoteChange"]> {
  notes.value = note;
  if (props.onNoteChange) {
    props.onNoteChange(props.cartItem, note);
    return;
  }
  updateItemNotes(props.cartItem.itemId, note, 500);
}
async function handleDelete(): ReturnType<CartItemState["handleDelete"]> {
  if (deleting.value) return;
  deleting.value = true;
  if (props.onDelete) {
    props.onDelete(props.cartItem);
    deleting.value = false;
    return;
  }
  const updatedCart = await deleteItem(props.cartItem.itemId);
  deleting.value = false;
  if (updatedCart && props.afterCartUpdate) {
    props.afterCartUpdate(updatedCart);
  }
}
async function fetchCrossupsells(): ReturnType<
  CartItemState["fetchCrossupsells"]
> {
  if (!props.showCrossupsells) return;
  const productId = props.cartItem?.productId;
  const clusterId = props.cartItem?.clusterId;
  if (!productId && !clusterId) return;
  crossupsellsLoading.value = true;
  try {
    const items = await getCrossupsells({
      productId,
      clusterId,
      types: props.crossupsellTypes || [Enums.CrossupsellType.ACCESSORIES],
      taxZone: props.taxZone || "NL",
      imageVariantFilters: props.configuration?.imageVariantFiltersMedium,
    });
    crossupsells.value = items;
  } catch {
    crossupsells.value = [];
  } finally {
    crossupsellsLoading.value = false;
  }
}
function getVisibleCrossupsells(): ReturnType<
  CartItemState["getVisibleCrossupsells"]
> {
  const items = crossupsells.value || [];
  const limit = props.crossupsellLimit || 3;
  return items.slice(0, limit);
}
function getCrossupsellName(
  item: Crossupsell,
): ReturnType<CartItemState["getCrossupsellName"]> {
  const product = item?.productTo || item?.clusterTo;
  return product?.names?.[0]?.value || "Product";
}
function getCrossupsellImageUrl(
  item: Crossupsell,
): ReturnType<CartItemState["getCrossupsellImageUrl"]> {
  const product = (item?.productTo || item?.clusterTo) as Product | undefined;
  return product?.media?.images?.items?.[0]?.imageVariants?.[0]?.url || "";
}
function getCrossupsellUrl(
  item: Crossupsell,
): ReturnType<CartItemState["getCrossupsellUrl"]> {
  const product = item?.productTo || item?.clusterTo;
  if (props.configuration?.urls && product) {
    return props.configuration.urls.getProductUrl(
      product as Product,
      props.language,
    );
  }
  return "#";
}
function getCrossupsellProductId(
  item: Crossupsell,
): ReturnType<CartItemState["getCrossupsellProductId"]> {
  const product = (item?.productTo || item?.clusterTo) as Product | undefined;
  return (product as Product)?.productId || product?.id;
}
function getCrossupsellPrice(
  item: Crossupsell,
): ReturnType<CartItemState["getCrossupsellPrice"]> {
  const product = (item?.productTo || item?.clusterTo) as Product | undefined;
  const price = product?.price;
  if (!price) return "";
  const value = props.includeTax ? price.net : price.gross;
  if (value === undefined || value === null) return "";
  return _formatPrice(Number(value), { symbol: "€" });
}
async function handleAddCrossupsellToCart(
  item: Crossupsell,
): ReturnType<CartItemState["handleAddCrossupsellToCart"]> {
  if (!props.cartId || addingCrossupsellId.value) return;
  const productId = getCrossupsellProductId(item);
  if (!productId) return;
  addingCrossupsellId.value = productId;
  const product = (item.productTo || item.clusterTo) as Product;
  const result = await addItem({
    product,
    quantity: 1,
    cartId: props.cartId,
    createCart: false,
  });
  addingCrossupsellId.value = null;
  if (result.success && result.cart && props.afterCartUpdate) {
    props.afterCartUpdate(result.cart);
  }
}
</script>
