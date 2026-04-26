<template>
  <div :class="`propeller-cluster-options ${className || ''}`">
    <template v-if="getOptionsForRender().length > 0">
      <div class="propeller-cluster-options__content flex flex-col gap-6">
        <template
          :key="option.id"
          v-for="(option, index) in getOptionsForRender()"
        >
          <div
            class="propeller-cluster-options__group"
            :data-required="option.isRequired ? 'true' : 'false'"
            :data-error="option.hasError ? 'true' : 'false'"
          >
            <div
              class="propeller-cluster-options__label-row flex items-center gap-2 mb-2"
            >
              <h4
                class="propeller-cluster-options__label font-semibold text-sm text-muted-foreground"
              >
                {{ option.name }}
              </h4>
              <template v-if="option.isRequired">
                <span
                  class="propeller-cluster-options__required-badge inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive ring-1 ring-inset ring-destructive/10"
                  >{{ getLabel("required", "Required") }}</span
                >
              </template>
            </div>
            <select
              :value="option.selectedProductId"
              @change="
                async (e) => handleOptionChange(option.idStr, e.target.value)
              "
              :class="`propeller-cluster-options__select w-full rounded-[var(--radius-container)] border px-3 py-2 text-sm focus:outline-none focus:ring-2 cursor-pointer ${
                option.hasError
                  ? 'border-destructive focus:ring-destructive'
                  : option.isRequired
                    ? 'border-input focus:ring-secondary'
                    : 'border-border focus:ring-secondary'
              }`"
            >
              <option value="">
                <template v-if="option.isRequired">
                  {{ getLabel("selectRequired", "— Select an option —") }}
                </template>

                <template v-else>
                  {{ getLabel("selectOptional", "— None (Optional) —") }}
                </template>
              </option>
              <template
                :key="product.productId"
                v-for="(product, index) in option.products"
              >
                <option :value="product.productIdStr">
                  {{ product.label }}
                </option>
              </template>
            </select>
            <template v-if="option.hasError">
              <p
                class="propeller-cluster-options__error mt-1 text-xs text-destructive"
              >
                {{ getLabel("requiredError", "This option is required") }}
              </p>
            </template>

            <template v-if="option.hasSelection">
              <div
                class="propeller-cluster-options__preview mt-3 flex items-center gap-3 rounded-[var(--radius-container)] border border-border-subtle bg-surface-hover p-3"
              >
                <template v-if="!!option.previewImageUrl">
                  <img
                    class="propeller-cluster-options__preview-image h-12 w-12 flex-shrink-0 rounded border border-border-subtle bg-card object-contain"
                    :src="option.previewImageUrl"
                    :alt="option.previewName"
                  />
                </template>

                <template v-if="!option.previewImageUrl">
                  <div
                    class="propeller-cluster-options__preview-image-placeholder flex h-12 w-12 flex-shrink-0 items-center justify-center rounded border border-border bg-surface-hover"
                  >
                    <svg
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      class="h-5 w-5 text-foreground-subtle"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        :strokeWidth="1.5"
                      ></path>
                    </svg>
                  </div>
                </template>

                <div class="min-w-0 flex-1">
                  <p
                    class="propeller-cluster-options__preview-name truncate text-sm font-medium text-foreground"
                  >
                    {{ option.previewName }}
                  </p>
                  <p
                    class="propeller-cluster-options__preview-price text-sm font-semibold text-secondary"
                  >
                    {{ option.previewPrice }}
                  </p>
                </div>
              </div>
            </template>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

import { Product, ClusterOption, Enums } from "propeller-sdk-v2";
import { getLabel as _getLabel } from "../../composables/shared/utils/labelHelpers";
import { getProductImageUrl as _getProductImageUrl } from "../../composables/shared/utils/productHelpers";
import { formatPrice as _formatPrice } from "../../composables/shared/utils/formatting";

/**
 * Flattened render model for one product inside an option dropdown.
 */
interface RenderedOptionProduct {
  productId: number;
  productIdStr: string;
  /** Combined display label, e.g. "Product Name — €10.00" */
  label: string;
}

/**
 * Flattened render model for one cluster option group, precomputed
 * to avoid calling state methods with arguments inside JSX.
 */
/**
 * Flattened render model for one product inside an option dropdown.
 */

/**
 * Flattened render model for one cluster option group, precomputed
 * to avoid calling state methods with arguments inside JSX.
 */
interface RenderedOption {
  id: number;
  idStr: string;
  name: string;
  isRequired: boolean;
  selectedProductId: string;
  hasSelection: boolean;
  hasError: boolean;
  /** Image URL of the currently selected product (empty string if none). */
  previewImageUrl: string;
  previewName: string;
  previewPrice: string;
  products: RenderedOptionProduct[];
}
/**
 * Flattened render model for one product inside an option dropdown.
 */

/**
 * Flattened render model for one cluster option group, precomputed
 * to avoid calling state methods with arguments inside JSX.
 */

export interface ClusterOptionsProps {
  /**
   * The cluster ID this options selector belongs to.
   * @required
   */
  clusterId: number;

  /**
   * An array of options that belong to the cluster.
   * Hidden options (option.hidden === 'Y') are automatically filtered out.
   * @required
   */
  options: ClusterOption[];

  /**
   * Fired whenever the user selects a product within any option group.
   * Receives the full Product object of the chosen option product.
   * Usually used to trigger a price update on the parent page.
   */
  onOptionSelect?: (optionProduct: Product) => void;

  /**
   * Fired whenever the user clears an option (picks the empty/default entry
   * in a non-required dropdown). Receives the option's `id`. Parents should
   * remove that key from their `selectedOptionProducts` map so the price
   * display drops the option's add-on price.
   */
  onOptionClear?: (optionId: number) => void;

  /** Override any UI string. Available keys: required, selectRequired, selectOptional, requiredError */
  labels?: Record<string, string>;

  /** When true, required options with no selection are highlighted with a validation error. */
  showErrors?: boolean;

  /** Extra CSS class applied to the root element. */
  className?: string;
}
/**
 * Flattened render model for one product inside an option dropdown.
 */

/**
 * Flattened render model for one cluster option group, precomputed
 * to avoid calling state methods with arguments inside JSX.
 */

interface ClusterOptionsState {
  selectedProductIds: Record<string, string>;
  getLabel: (key: string, fallback: string) => string;
  formatPrice: (price: number) => string;
  getProductName: (product: Product) => string;
  getProductImageUrl: (product: Product) => string;
  getOptionsForRender: () => RenderedOption[];
  handleOptionChange: (optionIdStr: string, productIdStr: string) => void;
}

const props = defineProps<ClusterOptionsProps>();
const selectedProductIds = ref<ClusterOptionsState["selectedProductIds"]>({});

function getLabel(
  key: string,
  fallback: string,
): ReturnType<ClusterOptionsState["getLabel"]> {
  return _getLabel(props.labels, key, fallback);
}
function formatPrice(
  price: number,
): ReturnType<ClusterOptionsState["formatPrice"]> {
  return _formatPrice(price, { symbol: "\u20AC" });
}
function getProductName(
  product: Product,
): ReturnType<ClusterOptionsState["getProductName"]> {
  return (
    (product as Product).names?.[0]?.value ||
    `Product ${(product as Product).productId}`
  );
}
function getProductImageUrl(
  product: Product,
): ReturnType<ClusterOptionsState["getProductImageUrl"]> {
  return _getProductImageUrl(product);
}
function getOptionsForRender(): ReturnType<
  ClusterOptionsState["getOptionsForRender"]
> {
  const options = (props.options as ClusterOption[]) || [];
  const sel = selectedProductIds.value as Record<string, string>;
  return options
    .filter((option: ClusterOption) => option.hidden !== Enums.YesNo.Y)
    .map((option: ClusterOption) => {
      const idStr = option.id.toString();
      const selectedProductId = sel[idStr] || "";
      const products = (option.products || []).map((p: Product) => ({
        productId: p.productId,
        productIdStr: p.productId.toString(),
        label: `${getProductName(p)} \u2014 ${formatPrice(p.price?.gross || 0)}`,
      }));
      let previewImageUrl = "";
      let previewName = "";
      let previewPrice = "";
      if (selectedProductId) {
        const selectedProduct = (option.products || []).find(
          (p: Product) => p.productId.toString() === selectedProductId,
        );
        if (selectedProduct) {
          previewImageUrl = getProductImageUrl(selectedProduct);
          previewName = getProductName(selectedProduct);
          previewPrice = formatPrice(selectedProduct.price?.gross || 0);
        }
      }
      const isRequired = option.isRequired === Enums.YesNo.Y;
      return {
        id: option.id,
        idStr,
        name: option.names?.[0]?.value || `Option ${option.id}`,
        isRequired,
        selectedProductId,
        hasSelection: !!selectedProductId,
        hasError:
          isRequired && !selectedProductId && !!(props.showErrors as boolean),
        previewImageUrl,
        previewName,
        previewPrice,
        products,
      };
    });
}
function handleOptionChange(
  optionIdStr: string,
  productIdStr: string,
): ReturnType<ClusterOptionsState["handleOptionChange"]> {
  const newIds: Record<string, string> = {
    ...(selectedProductIds.value as Record<string, string>),
  };
  if (productIdStr) {
    newIds[optionIdStr] = productIdStr;
  } else {
    delete newIds[optionIdStr];
  }
  selectedProductIds.value = newIds;
  if (productIdStr && props.onOptionSelect) {
    const options = (props.options as ClusterOption[]) || [];
    const option = options.find(
      (o: ClusterOption) => o.id.toString() === optionIdStr,
    );
    const product = (option?.products || []).find(
      (p: Product) => p.productId.toString() === productIdStr,
    );
    if (product) {
      props.onOptionSelect(product);
    }
  } else if (!productIdStr && props.onOptionClear) {
    props.onOptionClear(parseInt(optionIdStr, 10));
  }
}
</script>
