<template>
  <div
    :class="`propeller-order-list ${className || ''}`"
    :data-loading="loading ? 'true' : 'false'"
  >
    <template v-if="enableSearch && searchFields.length > 0">
      <div
        class="propeller-order-list__filters mb-6 bg-card p-4 rounded-[var(--radius-container)] shadow space-y-4"
      >
        <template v-if="searchFields.includes('term')">
          <div class="propeller-order-list__search-field w-full">
            <label
              class="propeller-order-list__filter-label block text-sm font-medium text-muted-foreground capitalize mb-1"
              >{{ getColumnLabel("term") }}</label
            ><input
              type="text"
              placeholder="Search..."
              class="propeller-order-list__search-input block w-full rounded-[var(--radius-control)] border-input shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 border"
              :value="searchForm.term || ''"
              @input="
                async (e) => {
                  searchForm = {
                    ...searchForm,
                    term: e.target.value,
                  };
                }
              "
              @keydown="
                async (e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    searchForm = {
                      ...searchForm,
                      term: e.target.value,
                    };
                    fetchOrders(1);
                  }
                }
              "
            />
          </div>
        </template>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
          <template
            :key="field"
            v-for="(field, index) in searchFields.filter((f) => f !== 'term')"
          >
            <div class="space-y-1">
              <label
                class="propeller-order-list__filter-label block text-sm font-medium text-muted-foreground capitalize"
                >{{ getColumnLabel(field) }}</label
              >
              <template v-if="field === 'createdAt'">
                <div class="flex space-x-2 w-full">
                  <input
                    type="date"
                    placeholder="From"
                    :min="dateMin"
                    :max="dateMax"
                    class="propeller-order-list__filter-input block w-0 flex-1 min-w-0 rounded-[var(--radius-control)] border-input shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 border"
                    :value="
                      searchForm.createdAt?.greaterThan
                        ? searchForm.createdAt.greaterThan.split('T')[0]
                        : ''
                    "
                    @change="
                      async (e) => {
                        const current = searchForm.createdAt || {};
                        const sanitized = sanitizeDateInput(e.target.value);
                        if (e.target.value && !sanitized) {
                          e.target.value = current.greaterThan
                            ? current.greaterThan.split('T')[0]
                            : '';
                          return;
                        }
                        searchForm = {
                          ...searchForm,
                          createdAt: {
                            ...current,
                            greaterThan: sanitized ? `${sanitized}T00:00:00Z` : undefined,
                          },
                        };
                      }
                    "
                  /><input
                    type="date"
                    placeholder="To"
                    :min="dateMin"
                    :max="dateMax"
                    class="propeller-order-list__filter-input block w-0 flex-1 min-w-0 rounded-[var(--radius-control)] border-input shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 border"
                    :value="
                      searchForm.createdAt?.lessThan
                        ? searchForm.createdAt.lessThan.split('T')[0]
                        : ''
                    "
                    @change="
                      async (e) => {
                        const current = searchForm.createdAt || {};
                        const sanitized = sanitizeDateInput(e.target.value);
                        if (e.target.value && !sanitized) {
                          e.target.value = current.lessThan
                            ? current.lessThan.split('T')[0]
                            : '';
                          return;
                        }
                        searchForm = {
                          ...searchForm,
                          createdAt: {
                            ...current,
                            lessThan: sanitized ? `${sanitized}T23:59:59Z` : undefined,
                          },
                        };
                      }
                    "
                  />
                </div>
              </template>

              <template v-if="field === 'lastModifiedAt'">
                <div class="flex space-x-2 w-full">
                  <input
                    type="date"
                    placeholder="From"
                    :min="dateMin"
                    :max="dateMax"
                    class="propeller-order-list__filter-input block w-0 flex-1 min-w-0 rounded-[var(--radius-control)] border-input shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 border"
                    :value="
                      searchForm.lastModifiedAt?.greaterThan
                        ? searchForm.lastModifiedAt.greaterThan.split('T')[0]
                        : ''
                    "
                    @change="
                      async (e) => {
                        const current = searchForm.lastModifiedAt || {};
                        const sanitized = sanitizeDateInput(e.target.value);
                        if (e.target.value && !sanitized) {
                          e.target.value = current.greaterThan
                            ? current.greaterThan.split('T')[0]
                            : '';
                          return;
                        }
                        searchForm = {
                          ...searchForm,
                          lastModifiedAt: {
                            ...current,
                            greaterThan: sanitized ? `${sanitized}T00:00:00Z` : undefined,
                          },
                        };
                      }
                    "
                  /><input
                    type="date"
                    placeholder="To"
                    :min="dateMin"
                    :max="dateMax"
                    class="propeller-order-list__filter-input block w-0 flex-1 min-w-0 rounded-[var(--radius-control)] border-input shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 border"
                    :value="
                      searchForm.lastModifiedAt?.lessThan
                        ? searchForm.lastModifiedAt.lessThan.split('T')[0]
                        : ''
                    "
                    @change="
                      async (e) => {
                        const current = searchForm.lastModifiedAt || {};
                        const sanitized = sanitizeDateInput(e.target.value);
                        if (e.target.value && !sanitized) {
                          e.target.value = current.lessThan
                            ? current.lessThan.split('T')[0]
                            : '';
                          return;
                        }
                        searchForm = {
                          ...searchForm,
                          lastModifiedAt: {
                            ...current,
                            lessThan: sanitized ? `${sanitized}T23:59:59Z` : undefined,
                          },
                        };
                      }
                    "
                  />
                </div>
              </template>

              <template v-if="field === 'price'">
                <div class="flex space-x-2 w-full">
                  <input
                    type="number"
                    placeholder="Min"
                    class="propeller-order-list__filter-input block w-0 flex-1 min-w-0 rounded-[var(--radius-control)] border-input shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 border"
                    :value="searchForm.price?.greaterThan || ''"
                    @change="
                      async (e) => {
                        const current = searchForm.price || {};
                        searchForm = {
                          ...searchForm,
                          price: {
                            ...current,
                            greaterThan: parseFloat(e.target.value),
                          },
                        };
                      }
                    "
                  /><input
                    type="number"
                    placeholder="Max"
                    class="propeller-order-list__filter-input block w-0 flex-1 min-w-0 rounded-[var(--radius-control)] border-input shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 border"
                    :value="searchForm.price?.lessThan || ''"
                    @change="
                      async (e) => {
                        const current = searchForm.price || {};
                        searchForm = {
                          ...searchForm,
                          price: {
                            ...current,
                            lessThan: parseFloat(e.target.value),
                          },
                        };
                      }
                    "
                  />
                </div>
              </template>

              <template v-if="field === 'sortInput'">
                <div class="flex space-x-2 w-full">
                  <select
                    class="propeller-order-list__filter-input block w-0 flex-1 min-w-0 rounded-[var(--radius-control)] border-input shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 border"
                    :value="searchForm.sortInput?.field || ''"
                    @change="
                      async (e) => {
                        const current = searchForm.sortInput || {};
                        searchForm = {
                          ...searchForm,
                          sortInput: {
                            ...current,
                            field: e.target.value,
                          },
                        };
                      }
                    "
                  >
                    <option value="">Sort Field</option>
                    <template
                      :key="sortField"
                      v-for="(sortField, index) in Object.values(
                        Enums.OrderSortField,
                      )"
                    >
                      <option :value="sortField">{{ sortField }}</option>
                    </template></select
                  ><select
                    class="propeller-order-list__filter-input block w-0 flex-1 min-w-0 rounded-[var(--radius-control)] border-input shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 border"
                    :value="searchForm.sortInput?.order || ''"
                    @change="
                      async (e) => {
                        const current = searchForm.sortInput || {};
                        searchForm = {
                          ...searchForm,
                          sortInput: {
                            ...current,
                            order: e.target.value,
                          },
                        };
                      }
                    "
                  >
                    <option value="">Order</option>
                    <template
                      :key="order"
                      v-for="(order, index) in Object.values(Enums.SortOrder)"
                    >
                      <option :value="order">{{ order }}</option>
                    </template>
                  </select>
                </div>
              </template>

              <template v-if="field === 'type'">
                <div class="flex space-x-2">
                  <select
                    class="propeller-order-list__filter-input block w-full rounded-[var(--radius-control)] border-input shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 border"
                    :value="searchForm.type || ''"
                    @change="
                      async (e) => {
                        searchForm = {
                          ...searchForm,
                          type: e.target.value,
                        };
                      }
                    "
                  >
                    <option value="">Type</option>
                    <template
                      :key="type"
                      v-for="(type, index) in Object.values(Enums.OrderType)"
                    >
                      <option :value="type">{{ type }}</option>
                    </template>
                  </select>
                </div>
              </template>
            </div>
          </template>
        </div>
        <div
          class="propeller-order-list__filter-actions flex justify-end space-x-2"
        >
          <button
            class="propeller-order-list__clear-btn inline-flex items-center px-4 py-2 border border-input text-sm font-medium rounded-[var(--radius-control)] shadow-sm text-muted-foreground bg-card hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            @click="
              async (event) => {
                resetSearch();
              }
            "
          >
            Clear</button
          ><button
            class="propeller-order-list__search-btn inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-[var(--radius-control)] shadow-sm text-primary-foreground bg-primary hover:bg-primary/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            @click="async (event) => fetchOrders(1)"
          >
            Search
          </button>
        </div>
      </div>
    </template>

    <template v-if="!loading || orders.length > 0">
      <template v-if="orders.length > 0">
        <div
          class="propeller-order-list__results bg-card rounded-[var(--radius-container)] shadow overflow-hidden"
        >
          <div class="overflow-x-auto">
            <table
              class="propeller-order-list__table min-w-full divide-y divide-gray-200"
            >
              <thead class="propeller-order-list__thead bg-surface-hover">
                <tr>
                  <template :key="col" v-for="(col, index) in columns">
                    <th
                      :data-column="col"
                      :class="`propeller-order-list__th px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider ${
                        col === 'action' || col === 'total' ? 'text-right' : ''
                      }`"
                    >
                      {{ getColumnLabel(col) }}
                    </th>
                  </template>
                </tr>
              </thead>
              <tbody
                class="propeller-order-list__tbody bg-card divide-y divide-gray-200"
              >
                <template :key="order.id" v-for="(order, index) in orders">
                  <tr
                    class="propeller-order-list__row hover:bg-surface-hover"
                    :data-clickable="rowsClickable ? 'true' : 'false'"
                    @click="
                      async (event) => rowsClickable && onOrderClick(order.id)
                    "
                  >
                    <template :key="col" v-for="(col, index) in columns">
                      <td
                        :data-column="col"
                        :class="`propeller-order-list__cell px-6 py-4 whitespace-nowrap text-sm ${
                          col === 'id' || col === 'action'
                            ? 'font-medium'
                            : 'text-muted-foreground'
                        } ${col === 'action' || col === 'total' ? 'text-right' : ''}`"
                      >
                        <template v-if="col === 'id'">
                          <span
                            class="propeller-order-list__order-id text-foreground"
                            >{{ order.id }}</span
                          >
                        </template>

                        <template v-if="col === 'date'">
                          {{ formatDate(order.date || order.createdAt || "") }}
                        </template>

                        <template v-if="col === 'status'">
                          <span
                            :data-status="order.status"
                            :class="`propeller-order-list__status px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                              order.status,
                            )}`"
                            >{{ order.status }}</span
                          >
                        </template>

                        <template v-if="col === 'total'">
                          {{ formatPrice(order.total?.net) }}
                        </template>

                        <template v-if="col === 'action' && !rowsClickable">
                          <button
                            class="propeller-order-list__action-btn text-primary hover:text-primary/70 cursor-pointer"
                            @click="
                              async (event) => {
                                event.preventDefault();
                                onOrderClick(order.id);
                              }
                            "
                          >
                            {{ getLabel("view", "View") }}
                          </button>
                        </template>

                        <template v-if="col === 'validUntil'">
                          {{ formatDate(order.validUntil || "") }}
                        </template>

                        <template
                          v-if="
                            ![
                              'id',
                              'date',
                              'status',
                              'total',
                              'action',
                              'validUntil',
                            ].includes(col)
                          "
                        >
                          {{ order[col] }}
                        </template>
                      </td>
                    </template>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
          <template v-if="!hidePagination && totalPages > 1">
            <div
              class="propeller-order-list__pagination bg-card px-4 py-3 flex items-center justify-between border-t border-border sm:px-6"
            >
              <div
                class="propeller-order-list__pagination-mobile flex-1 flex justify-between sm:hidden"
              >
                <button
                  class="propeller-order-list__pagination-btn relative inline-flex items-center px-4 py-2 border border-input text-sm font-medium rounded-[var(--radius-control)] text-muted-foreground bg-card hover:bg-surface-hover disabled:opacity-50"
                  @click="async (event) => goToPage(currentPage - 1)"
                  :disabled="currentPage === 1"
                >
                  {{ getLabel("previous", "Previous") }}</button
                ><button
                  class="propeller-order-list__pagination-btn ml-3 relative inline-flex items-center px-4 py-2 border border-input text-sm font-medium rounded-[var(--radius-control)] text-muted-foreground bg-card hover:bg-surface-hover disabled:opacity-50"
                  @click="async (event) => goToPage(currentPage + 1)"
                  :disabled="currentPage === totalPages"
                >
                  {{ getLabel("next", "Next") }}
                </button>
              </div>
              <div
                class="propeller-order-list__pagination-desktop hidden sm:flex-1 sm:flex sm:items-center sm:justify-between"
              >
                <div>
                  <p
                    class="propeller-order-list__pagination-summary text-sm text-muted-foreground"
                  >
                    {{ getLabel("showingPage", "Showing page") }}&nbsp;<span
                      class="font-medium"
                      >{{ currentPage }}</span
                    >&nbsp;{{ getLabel("of", "of") }}&nbsp;<span
                      class="font-medium"
                      >{{ totalPages }}</span
                    >
                  </p>
                </div>
                <div>
                  <nav
                    aria-label="Pagination"
                    class="propeller-order-list__pagination-nav relative z-0 inline-flex rounded-[var(--radius-control)] shadow-sm -space-x-px"
                  >
                    <button
                      class="propeller-order-list__pagination-btn relative inline-flex items-center px-2 py-2 rounded-l-[var(--radius-control)] border border-input bg-card text-sm font-medium text-muted-foreground hover:bg-surface-hover disabled:opacity-50"
                      @click="async (event) => goToPage(currentPage - 1)"
                      :disabled="currentPage === 1"
                    >
                      {{ getLabel("previous", "Previous") }}</button
                    ><button
                      class="propeller-order-list__pagination-btn relative inline-flex items-center px-2 py-2 rounded-r-[var(--radius-control)] border border-input bg-card text-sm font-medium text-muted-foreground hover:bg-surface-hover disabled:opacity-50"
                      @click="async (event) => goToPage(currentPage + 1)"
                      :disabled="currentPage === totalPages"
                    >
                      {{ getLabel("next", "Next") }}
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          </template>
        </div>
      </template>

      <template v-else>
        <div
          class="propeller-order-list__empty bg-card rounded-[var(--radius-container)] shadow p-8 text-center"
        >
          <p class="text-muted-foreground mb-4">
            {{ getLabel("noOrders", "No orders found.") }}
          </p>
        </div>
      </template>
    </template>

    <template v-else>
      <div
        class="propeller-order-list__loading p-8 text-center text-muted-foreground"
      >
        {{ getLabel("loading", "Loading orders...") }}
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import {
  Order,
  Contact,
  Customer,
  GraphQLClient,
  Enums,
} from "propeller-sdk-v2";

import { useOrders } from "../../composables/useOrders";
import { formatPrice as _formatPrice } from "../../composables/shared/utils/formatting";
import { getLabel as _getLabel } from "../../composables/shared/utils/labelHelpers";

export interface OrderListProps {
  /** The authenticated user (Contact or Customer) */
  user: Contact | Customer | null;

  /** The initialized GraphQL Client instance */
  graphqlClient: GraphQLClient;

  /** Callback when an order is clicked */
  onOrderClick: (orderId: number) => void;

  /** Columns to display. Defaults to ['id', 'date', 'status', 'total', 'action'] */
  columns?: string[];

  /** Label mapping for columns */
  columnConfig?: Record<string, string>;

  /** Enable searching */
  enableSearch?: boolean;

  /** Fields enabled for searching (UI inputs) */
  searchFields?: string[];

  /** Term fields configuration (backend) */
  termFields?: any[]; // Using any[] to avoid strict enum import issues in Mitosis for now, effectively OrderSearchFields[]

  /** Override company ID for order filtering (respects company switcher) */
  companyId?: number;

  /** Filter orders by these statuses */
  orderStatus?: string[];

  /** Override base styles */
  className?: string;

  /** Items per page default */
  initialItemsPerPage?: number;

  /** Rows are clickable */
  rowsClickable?: boolean;

  /** Show company orders */
  showCompanyOrders?: boolean;

  /** Hide pagination controls. Defaults to false. */
  hidePagination?: boolean;

  /** Filter orders by channel IDs */
  channelIds?: number[];

  /** Format price */
  formatPrice?: (price: number) => string;

  /** Format date */
  formatDate?: (dateString: string) => string;

  /** Get status color */
  getStatusColor?: (status: string) => string;

  /** Localization labels */
  labels?: {
    view?: string;
    previous?: string;
    next?: string;
    showingPage?: string;
    of?: string;
    noOrders?: string;
    loading?: string;
    order?: string;
    date?: string;
    status?: string;
    total?: string;
    action?: string;
  };

  /** Callback when a new cart is created during re-order */
  onCartCreated?: (cart: any) => void;

  /** Callback fired after all re-order items have been added */
  afterReorder?: (cart: any) => void;

  /** Configuration object (imageSearchFiltersGrid, imageVariantFiltersSmall, etc.) */
  configuration?: any;
}

interface OrderListState {
  columns: string[];
  rowsClickable: boolean;
  searchFields: string[];
  formatDate: (dateString: string) => string;
  formatPrice: (price: any) => string;
  getStatusColor: (status: string) => string;
  getColumnLabel: (col: string) => string;
  getLabel: (key: string, fallback: string) => string;
}

const props = defineProps<OrderListProps>();

const userRef = computed(() => props.user ?? null);
const companyRef = computed(() => props.companyId);

const {
  orders,
  loading,
  error,
  searchForm,
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  fetchOrders,
  goToPage,
  resetSearch,
} = useOrders({
  graphqlClient: props.graphqlClient,
  user: userRef,
  companyId: companyRef,
  itemsPerPage: props.initialItemsPerPage,
  orderStatuses: props.orderStatus,
  configuration: props.configuration,
  channelIds: props.channelIds,
  onCartCreated: props.onCartCreated,
  afterReorder: props.afterReorder,
});

const columns = ref<OrderListState["columns"]>(
  props.columns || ["id", "date", "status", "total"],
);
const rowsClickable = ref<OrderListState["rowsClickable"]>(
  props.rowsClickable || false,
);

const searchFields = computed(() => {
  const fields = props.searchFields || [];
  if (props.enableSearch && !(fields as string[]).includes("term")) {
    return ["term", ...fields] as string[];
  }
  return fields;
});

const dateMin = "1970-01-01";
const dateMax = computed(() => new Date().toISOString().split("T")[0]);

// Returns a YYYY-MM-DD string only when the input value is a valid date in the
// allowed range; otherwise returns null. Native <input type="date"> happily
// accepts year-6 inputs ("0006-05-04") via keyboard, so we guard at the model layer.
function sanitizeDateInput(value: string): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  if (year < 1970 || year > new Date().getFullYear()) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return value;
}

function formatDate(
  dateString: string,
): ReturnType<OrderListState["formatDate"]> {
  if (props.formatDate) return props.formatDate(dateString);
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString();
}
function formatPrice(price: number): ReturnType<OrderListState["formatPrice"]> {
  if (props.formatPrice) return props.formatPrice(price);
  if (!price) return "-";
  return _formatPrice(price, { symbol: "€" });
}
function getStatusColor(
  status: string,
): ReturnType<OrderListState["getStatusColor"]> {
  if (props.getStatusColor) return props.getStatusColor(status);
  switch (status) {
    case "COMPLETE":
    case "QUOTE_ACCEPTED":
      return "bg-secondary/10 text-secondary";
    case "CANCELLED":
    case "QUOTE_REJECTED":
      return "bg-destructive/10 text-destructive";
    default:
      return "bg-warning/10 text-warning";
  }
}
function getColumnLabel(
  col: string,
): ReturnType<OrderListState["getColumnLabel"]> {
  if (props.columnConfig && props.columnConfig[col]) {
    return props.columnConfig[col];
  }
  // Fallback: Capitalize first letter
  return col.charAt(0).toUpperCase() + col.slice(1);
}
function getLabel(
  key: string,
  fallback: string,
): ReturnType<OrderListState["getLabel"]> {
  return _getLabel(props.labels, key, fallback);
}
</script>
