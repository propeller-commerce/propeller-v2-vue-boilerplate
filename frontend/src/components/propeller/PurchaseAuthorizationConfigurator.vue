<template>
  <div
    :class="`propeller-purchase-authorization-configurator ${className || ''}`"
  >
    <template v-if="isAuthManager">
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-semibold">
            {{ getLabel("title", "Purchase Authorization Settings") }}
          </h2>
          <template v-if="allowContactCreate !== false">
            <button
              type="button"
              class="propeller-purchase-authorization-configurator__add-btn flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-[var(--radius-container)] hover:bg-primary/80 transition text-sm font-medium"
              @click="async (event) => openAddContactModal()"
            >
              {{ getLabel("addContact", "Add contact") }}
            </button>
          </template>
        </div>
        <template v-if="loading">
          <div class="flex items-center justify-center py-12">
            <div
              class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"
            ></div>
          </div>
        </template>

        <template v-if="!loading">
          <div
            class="overflow-x-auto rounded-[var(--radius-container)] border border-border bg-card shadow-sm"
          >
            <table class="w-full text-sm">
              <thead class="bg-surface-hover/50 border-b border-border">
                <tr>
                  <th
                    class="text-left px-4 py-3 font-medium text-muted-foreground"
                  >
                    {{ getLabel("colId", "ID") }}
                  </th>
                  <th
                    class="text-left px-4 py-3 font-medium text-muted-foreground"
                  >
                    {{ getLabel("colName", "Name") }}
                  </th>
                  <th
                    class="text-left px-4 py-3 font-medium text-muted-foreground"
                  >
                    {{ getLabel("colRole", "Role") }}
                  </th>
                  <th
                    class="text-left px-4 py-3 font-medium text-muted-foreground"
                  >
                    {{ getLabel("colLimit", "Limit") }}
                  </th>
                  <th
                    class="text-left px-4 py-3 font-medium text-muted-foreground"
                  >
                    {{ getLabel("colActions", "Actions") }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                <template
                  :key="contact.contactId"
                  v-for="(contact, index) in getContacts()"
                >
                  <tr class="hover:bg-surface-hover/30 transition-colors">
                    <td class="px-4 py-3 text-muted-foreground">
                      {{ contact.contactId }}
                    </td>
                    <td class="px-4 py-3">
                      <div class="font-medium">
                        {{
                          [
                            contact.firstName,
                            contact.middleName,
                            contact.lastName,
                          ]
                            .filter(Boolean)
                            .join(" ")
                        }}
                      </div>
                      <div class="text-xs text-muted-foreground mt-0.5">
                        {{ contact.email }}
                      </div>
                    </td>
                    <td class="px-4 py-3">
                      <select
                        class="border border-input rounded-[var(--radius-control)] px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        :value="getRowRole(contact.contactId)"
                        :disabled="isCurrentUser(contact.contactId)"
                        @change="
                          async (e) =>
                            handleRoleChange(contact.contactId, e.target.value)
                        "
                      >
                        <option value="">
                          {{ getLabel("selectRole", "— Select role —") }}
                        </option>
                        <option :value="PurchaseRole.PURCHASER">
                          {{ getLabel("rolePurchaser", "Purchaser") }}
                        </option>
                        <option
                          :value="PurchaseRole.AUTHORIZATION_MANAGER"
                        >
                          {{ getLabel("roleManager", "Authorization Manager") }}
                        </option>
                      </select>
                    </td>
                    <td class="px-4 py-3">
                      <template
                        v-if="
                          getRowRole(contact.contactId) ===
                          PurchaseRole.PURCHASER
                        "
                      >
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          class="w-28 border border-input rounded-[var(--radius-control)] px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                          :value="getRowLimit(contact.contactId) ?? ''"
                          :disabled="isCurrentUser(contact.contactId)"
                          @change="
                            async (e) =>
                              handleLimitChange(
                                contact.contactId,
                                e.target.value,
                              )
                          "
                          :placeholder="getLabel('limitPlaceholder', '0.00')"
                        />
                      </template>
                    </td>
                    <td class="px-4 py-3">
                      <div class="flex items-center gap-2">
                        <template
                          v-if="
                            hasPac(contact.contactId) &&
                            isRowDirty(contact.contactId)
                          "
                        >
                          <button
                            type="button"
                            class="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-[var(--radius-control)] hover:bg-primary/80 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            :disabled="isRowLoading(contact.contactId)"
                            @click="
                              async (event) => handleSave(contact.contactId)
                            "
                          >
                            <template v-if="isRowLoading(contact.contactId)">
                              <span
                                class="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"
                              ></span>
                            </template>

                            {{ getLabel("save", "Save") }}
                          </button>
                        </template>

                        <template v-if="!hasPac(contact.contactId)">
                          <button
                            type="button"
                            class="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-[var(--radius-control)] hover:bg-primary/80 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            :disabled="
                              isRowLoading(contact.contactId) ||
                              !getRowRole(contact.contactId)
                            "
                            @click="
                              async (event) => handleCreate(contact.contactId)
                            "
                          >
                            <template v-if="isRowLoading(contact.contactId)">
                              <span
                                class="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"
                              ></span>
                            </template>

                            {{ getLabel("create", "Create") }}
                          </button>
                        </template>

                        <template v-if="hasPac(contact.contactId)">
                          <button
                            type="button"
                            class="text-xs border border-border px-3 py-1.5 rounded-[var(--radius-control)] hover:bg-surface-hover transition disabled:opacity-50 disabled:cursor-not-allowed"
                            :disabled="
                              isRowLoading(contact.contactId) ||
                              isCurrentUser(contact.contactId)
                            "
                            @click="
                              async (event) => handleDelete(contact.contactId)
                            "
                          >
                            <template v-if="isRowLoading(contact.contactId)">
                              <span
                                class="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"
                              ></span>
                            </template>

                            {{ getLabel("delete", "Delete") }}
                          </button>
                        </template>
                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>

          <template v-if="getTotalPages() > 1">
            <div class="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                class="text-sm px-3 py-1.5 border border-border rounded-[var(--radius-control)] hover:bg-surface-hover transition disabled:opacity-40 disabled:cursor-not-allowed"
                :disabled="currentPage <= 1"
                @click="async (event) => handlePageChange(currentPage - 1)"
              >
                {{ getLabel("previous", "Previous") }}</button
              ><span class="text-sm text-muted-foreground"
                >{{ getLabel("page", "Page") }}{{ currentPage
                }}{{ getLabel("of", "of") }}{{ getTotalPages() }}</span
              ><button
                type="button"
                class="text-sm px-3 py-1.5 border border-border rounded-[var(--radius-control)] hover:bg-surface-hover transition disabled:opacity-40 disabled:cursor-not-allowed"
                :disabled="currentPage >= getTotalPages()"
                @click="async (event) => handlePageChange(currentPage + 1)"
              >
                {{ getLabel("next", "Next") }}
              </button>
            </div>
          </template>
        </template>
      </div>

      <template v-if="showAddContactModal">
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          @click="async (event) => closeAddContactModal()"
        >
          <div
            class="bg-background rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4"
            @click="async (e) => e.stopPropagation()"
          >
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold">
                {{ getLabel("addContactTitle", "Add Contact") }}
              </h3>
              <button
                type="button"
                class="text-muted-foreground hover:text-foreground transition"
                @click="async (event) => closeAddContactModal()"
              >
                ✕
              </button>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">{{
                getLabel("companyName", "Company")
              }}</label
              ><input
                type="text"
                class="w-full border border-input rounded-[var(--radius-control)] px-3 py-2 text-sm bg-surface-hover cursor-not-allowed"
                :readOnly="true"
                :value="company?.name ?? ''"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">{{
                getLabel("gender", "Gender")
              }}</label
              ><select
                class="w-full border border-input rounded-[var(--radius-control)] px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                :value="addContactForm.gender"
                @change="
                  async (e) => {
                    addContactForm = {
                      ...addContactForm,
                      gender: e.target.value,
                    };
                  }
                "
              >
                <option value="">
                  {{ getLabel("selectGender", "— Select —") }}
                </option>
                <option :value="Gender.M">
                  {{ getLabel("genderM", "Male") }}
                </option>
                <option :value="Gender.F">
                  {{ getLabel("genderF", "Female") }}
                </option>
                <option :value="Gender.U">
                  {{ getLabel("genderU", "Unspecified") }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1"
                >{{ getLabel("email", "Email") }} * </label
              ><input
                type="email"
                class="w-full border border-input rounded-[var(--radius-control)] px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                :value="addContactForm.email"
                @change="
                  async (e) => {
                    addContactForm = {
                      ...addContactForm,
                      email: e.target.value,
                    };
                  }
                "
              />
            </div>
            <div class="grid grid-cols-3 gap-3">
              <div>
                <label class="block text-sm font-medium mb-1">{{
                  getLabel("firstName", "First name")
                }}</label
                ><input
                  type="text"
                  class="w-full border border-input rounded-[var(--radius-control)] px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  :value="addContactForm.firstName"
                  @change="
                    async (e) => {
                      addContactForm = {
                        ...addContactForm,
                        firstName: e.target.value,
                      };
                    }
                  "
                />
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">{{
                  getLabel("middleName", "Middle")
                }}</label
                ><input
                  type="text"
                  class="w-full border border-input rounded-[var(--radius-control)] px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  :value="addContactForm.middleName"
                  @change="
                    async (e) => {
                      addContactForm = {
                        ...addContactForm,
                        middleName: e.target.value,
                      };
                    }
                  "
                />
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">{{
                  getLabel("lastName", "Last name")
                }}</label
                ><input
                  type="text"
                  class="w-full border border-input rounded-[var(--radius-control)] px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  :value="addContactForm.lastName"
                  @change="
                    async (e) => {
                      addContactForm = {
                        ...addContactForm,
                        lastName: e.target.value,
                      };
                    }
                  "
                />
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">{{
                getLabel("phone", "Phone")
              }}</label
              ><input
                type="tel"
                class="w-full border border-input rounded-[var(--radius-control)] px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                :value="addContactForm.phone"
                @change="
                  async (e) => {
                    addContactForm = {
                      ...addContactForm,
                      phone: e.target.value,
                    };
                  }
                "
              />
            </div>
            <template v-if="!!addContactError">
              <p class="text-sm text-destructive">{{ addContactError }}</p>
            </template>

            <div class="flex justify-end gap-3 pt-2">
              <button
                type="button"
                class="px-4 py-2 text-sm border border-border rounded-[var(--radius-control)] hover:bg-surface-hover transition"
                @click="async (event) => closeAddContactModal()"
              >
                {{ getLabel("cancel", "Cancel") }}</button
              ><button
                type="button"
                class="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-[var(--radius-control)] hover:bg-primary/80 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                :disabled="addContactLoading || !addContactForm.email"
                @click="async (event) => handleAddContactSubmit()"
              >
                <template v-if="addContactLoading">
                  <span
                    class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                  ></span>
                </template>

                {{ getLabel("addContactSubmit", "Add Contact") }}
              </button>
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { usePurchaseAuthorizationConfigurator } from "../../composables/usePurchaseAuthorization";

import { Contact, Customer, Gender, GraphQLClient, PurchaseAuthorizationConfig, PurchaseAuthorizationConfigCreateInput, PurchaseRole, RegisterContactInput } from "propeller-sdk-v2";
import { getLabel as _getLabel } from "../../composables/shared/utils/labelHelpers";

export interface PurchaseAuthorizationConfiguratorProps {
  /** GraphQL client for the Propeller SDK */
  graphqlClient: GraphQLClient;

  /** The logged-in user */
  user: Contact | Customer;

  /** The companyId of the current selected company */
  companyId: number;

  /**
   * Adds a button "Add contact" above the contacts list and enables registering contacts
   * @default true
   */
  allowContactCreate?: boolean;

  /** Fires before a contact is added to the company */
  beforeContactCreate?: (input: RegisterContactInput) => void;

  /** Override: fires instead of the default UserService.registerContact() call */
  onContactCreate?: (input: RegisterContactInput) => void;

  /** Fires after a contact is registered. If not provided, refreshes contacts list. */
  afterContactCreate?: (contact: Contact) => void;

  /** Override: fires instead of the default PurchaseAuthorizationConfigCreateInput() call */
  onPurchaseAuthorizationCreate?: (
    pac: PurchaseAuthorizationConfigCreateInput,
  ) => void;

  /** Fires after a PAC is created. If not provided, refreshes contacts list. */
  afterPurchaseAuthorizationCreate?: (pac: PurchaseAuthorizationConfig) => void;

  /** Override: fires instead of the default updatePurchaseAuthorizationConfig() call */
  onPurchaseAuthorizationUpdate?: (pac: PurchaseAuthorizationConfig) => void;

  /** Fires after a PAC is updated. If not provided, refreshes contacts list. */
  afterPurchaseAuthorizationUpdate?: (pac: PurchaseAuthorizationConfig) => void;

  /** Override: fires instead of the default deletePurchaseAuthorizationConfig() call */
  onPurchaseAuthorizationDelete?: (pac: PurchaseAuthorizationConfig) => void;

  /** Fires after a PAC is deleted. If not provided, refreshes contacts list. */
  afterPurchaseAuthorizationDelete?: (deleted: boolean) => void;

  /** Labels for the component */
  labels?: Record<string, string>;

  /** Custom CSS class for the component */
  className?: string;

  /** Configuration object from the application */
  configuration?: Record<string, any>;

  /** Rows per page for contacts pagination */
  pageOffset?: number;
}

const props = withDefaults(
  defineProps<PurchaseAuthorizationConfiguratorProps>(),
  {
    allowContactCreate: true,
  },
);

const userRef = computed(() => props.user ?? null);
const companyRef = computed(() => props.companyId as number);

const {
  company,
  loading,
  contacts,
  totalPages,
  currentPage,
  isAuthManager,
  rowEdits,
  pacMap,
  actionLoading,
  showAddContactModal,
  addContactForm,
  addContactLoading,
  addContactError,
  hasPac,
  isCurrentUser,
  isRowDirty,
  getRowRole,
  getRowLimit,
  isRowLoading,
  loadCompany,
  handleRoleChange,
  handleLimitChange,
  handleCreate,
  handleSave,
  handleDelete,
  handlePageChange,
  openAddContactModal,
  closeAddContactModal,
  handleAddContactSubmit,
} = usePurchaseAuthorizationConfigurator({
  graphqlClient: props.graphqlClient,
  user: userRef,
  companyId: companyRef,
  pageOffset: props.pageOffset,
  beforeContactCreate: props.beforeContactCreate,
  onContactCreate: props.onContactCreate,
  afterContactCreate: props.afterContactCreate,
  onPurchaseAuthorizationCreate: props.onPurchaseAuthorizationCreate,
  afterPurchaseAuthorizationCreate: props.afterPurchaseAuthorizationCreate,
  onPurchaseAuthorizationUpdate: props.onPurchaseAuthorizationUpdate,
  afterPurchaseAuthorizationUpdate: props.afterPurchaseAuthorizationUpdate,
  onPurchaseAuthorizationDelete: props.onPurchaseAuthorizationDelete,
  afterPurchaseAuthorizationDelete: props.afterPurchaseAuthorizationDelete,
});

// Wrapper functions to preserve template's function-call style
function getContacts(): Contact[] {
  return contacts.value;
}

function getTotalPages(): number {
  return totalPages.value;
}

function getLabel(key: string, fallback: string): string {
  return _getLabel(props.labels, key, fallback);
}
</script>
