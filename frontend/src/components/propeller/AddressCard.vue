<template>
  <div>
    <template v-if="showCard">
      <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-200 h-full flex flex-col">
        <div class="flex-grow">
          <template v-if="showCompanyName !== false && addr?.company">
            <div class="font-bold text-lg mb-1">{{ addr?.company }}</div>
          </template>

          <template v-if="showFullName !== false && (addr?.firstName || addr?.lastName)">
            <div class="font-medium mb-1">
              {{ [props.showSalutation !== false ? (addr?.gender === 'M' ? 'Mr.' : addr?.gender === 'F' ? 'Mrs.' : null) : null, addr?.firstName, addr?.middleName, addr?.lastName].filter(Boolean).join(' ') }}
            </div>
          </template>

          <template v-if="showStreet !== false && addr?.street">
            <div class="text-gray-600">
              {{ [addr?.street, showNumberExtension !== false ? addr?.number : null, showNumberExtension !== false ? addr?.numberExtension : null].filter(Boolean).join(' ') }}
            </div>
          </template>

          <template v-if="(showPostalCode !== false && addr?.postalCode) || (showCity !== false && addr?.city)">
            <div class="text-gray-600">
              {{ [showPostalCode !== false ? addr?.postalCode : null, showCity !== false ? addr?.city : null].filter(Boolean).join(' ') }}
            </div>
          </template>

          <template v-if="showCountry !== false && addr?.country">
            <div class="text-gray-600">{{ getCountryName(addr?.country) }}</div>
          </template>

          <template v-if="!!showEmail && addr?.email">
            <div class="text-gray-600">{{ addr?.email }}</div>
          </template>

          <template v-if="!!showPhone && addr?.phone">
            <div class="text-gray-600">{{ addr?.phone }}</div>
          </template>

          <template v-if="showDefaultBadge === true && addr?.isDefault === 'Y'">
            <div class="mt-2">
              <span class="bg-secondary/10 text-secondary text-xs px-2 py-1 rounded-full">
                Default {{ addr?.type }} Address
              </span>
            </div>
          </template>
        </div>
        <template v-if="enableActions !== false">
          <div class="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-2">
            <template v-if="enableEdit !== false">
              <button
                class="text-primary hover:text-primary/80 text-sm font-medium"
                @click="async (event) => openEditModal()"
              >
                {{ getLabel('edit', 'Edit') }}
              </button>
            </template>

            <template v-if="enableDelete !== false">
              <button
                class="text-gray-600 hover:text-gray-800 text-sm font-medium"
                @click="
                  async (event) => {
                    showDeleteConfirm = true;
                  }
                "
              >
                {{ getLabel('delete', 'Delete') }}
              </button>
            </template>

            <template v-if="enableSetDefault !== false && addr?.isDefault !== 'Y'">
              <button
                class="text-primary hover:text-primary/80 text-sm font-medium ml-auto"
                @click="async (event) => handleSetDefault()"
              >
                {{ getLabel('setDefault', 'Set Default') }}
              </button>
            </template>
          </div>
        </template>
      </div>
    </template>

    <template v-if="inline && showEditModal">
      <div class="bg-white p-6 rounded-lg border">
        <form @submit="async (e) => handleSaveEdit(e)">
          <template v-if="!!formTitle">
            <h3 class="text-xl font-bold mb-4">{{ formTitle }}</h3>
          </template>

          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium mb-1">{{
                  getLabel('gender', 'Gender')
                }}</label
                ><select
                  class="w-full h-10 px-3 rounded-md border border-gray-300 bg-white"
                  :value="editGender"
                  @change="
                    async (e) => {
                      editGender = (e.target as HTMLInputElement | HTMLSelectElement).value as Enums.Gender;
                    }
                  "
                >
                  <option value="M">
                    {{ getLabel('genderMale', 'Male') }}
                  </option>
                  <option value="F">
                    {{ getLabel('genderFemale', 'Female') }}
                  </option>
                  <option value="U">
                    {{ getLabel('genderOther', 'Other') }}
                  </option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">{{
                  getLabel('company', 'Company')
                }}</label
                ><input
                  type="text"
                  class="w-full h-10 px-3 rounded-md border border-gray-300"
                  :value="editCompany"
                  @change="
                    async (e) => {
                      editCompany = (e.target as HTMLInputElement | HTMLSelectElement).value;
                    }
                  "
                />
              </div>
            </div>
            <div class="grid grid-cols-3 gap-4">
              <div>
                <label class="block text-sm font-medium mb-1"
                  >{{ getLabel('firstName', 'First Name') }} *</label
                ><input
                  type="text"
                  class="w-full h-10 px-3 rounded-md border border-gray-300"
                  :value="editFirstName"
                  @change="
                    async (e) => {
                      editFirstName = (e.target as HTMLInputElement | HTMLSelectElement).value;
                    }
                  "
                  :required="true"
                />
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">{{
                  getLabel('middleName', 'Middle Name')
                }}</label
                ><input
                  type="text"
                  class="w-full h-10 px-3 rounded-md border border-gray-300"
                  :value="editMiddleName"
                  @change="
                    async (e) => {
                      editMiddleName = (e.target as HTMLInputElement | HTMLSelectElement).value;
                    }
                  "
                />
              </div>
              <div>
                <label class="block text-sm font-medium mb-1"
                  >{{ getLabel('lastName', 'Last Name') }} *</label
                ><input
                  type="text"
                  class="w-full h-10 px-3 rounded-md border border-gray-300"
                  :value="editLastName"
                  @change="
                    async (e) => {
                      editLastName = (e.target as HTMLInputElement | HTMLSelectElement).value;
                    }
                  "
                  :required="true"
                />
              </div>
            </div>
            <div class="grid grid-cols-12 gap-4">
              <div class="col-span-8">
                <label class="block text-sm font-medium mb-1"
                  >{{ getLabel('street', 'Street') }} *</label
                ><input
                  type="text"
                  class="w-full h-10 px-3 rounded-md border border-gray-300"
                  :value="editStreet"
                  @change="
                    async (e) => {
                      editStreet = (e.target as HTMLInputElement | HTMLSelectElement).value;
                    }
                  "
                  :required="true"
                />
              </div>
              <div class="col-span-2">
                <label class="block text-sm font-medium mb-1"
                  >{{ getLabel('number', 'Number') }} *</label
                ><input
                  type="text"
                  class="w-full h-10 px-3 rounded-md border border-gray-300"
                  :value="editNumber"
                  @change="
                    async (e) => {
                      editNumber = (e.target as HTMLInputElement | HTMLSelectElement).value;
                    }
                  "
                  :required="true"
                />
              </div>
              <div class="col-span-2">
                <label class="block text-sm font-medium mb-1">{{
                  getLabel('numberExtension', 'Ext')
                }}</label
                ><input
                  type="text"
                  class="w-full h-10 px-3 rounded-md border border-gray-300"
                  :value="editNumberExtension"
                  @change="
                    async (e) => {
                      editNumberExtension = (e.target as HTMLInputElement | HTMLSelectElement).value;
                    }
                  "
                />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium mb-1"
                  >{{ getLabel('postalCode', 'Postal Code') }} *</label
                ><input
                  type="text"
                  class="w-full h-10 px-3 rounded-md border border-gray-300"
                  :value="editPostalCode"
                  @change="
                    async (e) => {
                      editPostalCode = (e.target as HTMLInputElement | HTMLSelectElement).value;
                    }
                  "
                  :required="true"
                />
              </div>
              <div>
                <label class="block text-sm font-medium mb-1"
                  >{{ getLabel('city', 'City') }} *</label
                ><input
                  type="text"
                  class="w-full h-10 px-3 rounded-md border border-gray-300"
                  :value="editCity"
                  @change="
                    async (e) => {
                      editCity = (e.target as HTMLInputElement | HTMLSelectElement).value;
                    }
                  "
                  :required="true"
                />
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1"
                >{{ getLabel('country', 'Country') }} *</label
              ><select
                class="w-full h-10 px-3 rounded-md border border-gray-300 bg-white"
                :value="editCountry"
                @change="
                  async (e) => {
                    editCountry = (e.target as HTMLInputElement | HTMLSelectElement).value;
                  }
                "
                :required="true"
              >
                <option value="">
                  {{ getLabel('selectCountry', 'Select country') }}
                </option>
                <template :key="c.code" v-for="(c, index) in countries || []">
                  <option :value="c.code">{{ c.name }}</option>
                </template>
              </select>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium mb-1"
                  >{{ getLabel('email', 'Email') }} *</label
                ><input
                  type="email"
                  class="w-full h-10 px-3 rounded-md border border-gray-300"
                  :value="editEmail"
                  @change="
                    async (e) => {
                      editEmail = (e.target as HTMLInputElement | HTMLSelectElement).value;
                    }
                  "
                  :required="true"
                />
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">{{
                  getLabel('phone', 'Phone')
                }}</label
                ><input
                  type="tel"
                  class="w-full h-10 px-3 rounded-md border border-gray-300"
                  :value="editPhone"
                  @change="
                    async (e) => {
                      editPhone = (e.target as HTMLInputElement | HTMLSelectElement).value;
                    }
                  "
                />
              </div>
            </div>
            <template v-if="!!showIcp">
              <div class="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="icp-inline"
                  class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  :checked="editIcp === Enums.YesNo.Y"
                  @change="
                    async (e) => {
                      editIcp = (e.target as HTMLInputElement).checked ? Enums.YesNo.Y : Enums.YesNo.N;
                    }
                  "
                /><label for="icp-inline" class="text-sm font-medium">{{
                  getLabel('icp', 'ICP/ICS (Intra-Community Supply)')
                }}</label>
              </div>
            </template>
          </div>
          <div class="flex justify-end gap-3 pt-4 mt-4 border-t">
            <template v-if="!isNew">
              <button
                type="button"
                class="px-4 py-2 border rounded hover:bg-gray-100 disabled:opacity-50"
                @click="async (event) => closeEditModal()"
                :disabled="saving"
              >
                {{ getLabel('cancel', 'Cancel') }}
              </button>
            </template>

            <template v-if="isNew && !!onCancel">
              <button
                type="button"
                class="px-4 py-2 border rounded hover:bg-gray-100 disabled:opacity-50"
                @click="async (event) => closeEditModal()"
                :disabled="saving"
              >
                {{ getLabel('cancel', 'Cancel') }}
              </button>
            </template>

            <button
              type="submit"
              class="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50"
              :disabled="saving"
            >
              <template v-if="saving">
                {{ getLabel('saving', 'Saving...') }}
              </template>

              <template v-else>
                {{ getLabel('save', 'Save') }}
              </template>
            </button>
          </div>
        </form>
      </div>
    </template>

    <template v-if="!inline && showEditModal">
      <div
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-10"
      >
        <div class="bg-white p-6 rounded-lg max-w-2xl w-full mx-4 shadow-xl">
          <form @submit="async (e) => handleSaveEdit(e)">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-xl font-bold">{{ formTitle }}</h3>
              <button
                type="button"
                class="text-gray-500 hover:text-gray-700 text-xl leading-none"
                @click="async (event) => closeEditModal()"
              >
                &times;
              </button>
            </div>
            <div class="space-y-4">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium mb-1">{{
                    getLabel('gender', 'Gender')
                  }}</label
                  ><select
                    class="w-full h-10 px-3 rounded-md border border-gray-300 bg-white"
                    :value="editGender"
                    @change="
                      async (e) => {
                        editGender = (e.target as HTMLInputElement | HTMLSelectElement).value as Enums.Gender;
                      }
                    "
                  >
                    <option value="M">
                      {{ getLabel('genderMale', 'Male') }}
                    </option>
                    <option value="F">
                      {{ getLabel('genderFemale', 'Female') }}
                    </option>
                    <option value="U">
                      {{ getLabel('genderOther', 'Other') }}
                    </option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1">{{
                    getLabel('company', 'Company')
                  }}</label
                  ><input
                    type="text"
                    class="w-full h-10 px-3 rounded-md border border-gray-300"
                    :value="editCompany"
                    @change="
                      async (e) => {
                        editCompany = (e.target as HTMLInputElement | HTMLSelectElement).value;
                      }
                    "
                  />
                </div>
              </div>
              <div class="grid grid-cols-3 gap-4">
                <div>
                  <label class="block text-sm font-medium mb-1"
                    >{{ getLabel('firstName', 'First Name') }} *</label
                  ><input
                    type="text"
                    class="w-full h-10 px-3 rounded-md border border-gray-300"
                    :value="editFirstName"
                    @change="
                      async (e) => {
                        editFirstName = (e.target as HTMLInputElement | HTMLSelectElement).value;
                      }
                    "
                    :required="true"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1">{{
                    getLabel('middleName', 'Middle Name')
                  }}</label
                  ><input
                    type="text"
                    class="w-full h-10 px-3 rounded-md border border-gray-300"
                    :value="editMiddleName"
                    @change="
                      async (e) => {
                        editMiddleName = (e.target as HTMLInputElement | HTMLSelectElement).value;
                      }
                    "
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1"
                    >{{ getLabel('lastName', 'Last Name') }} *</label
                  ><input
                    type="text"
                    class="w-full h-10 px-3 rounded-md border border-gray-300"
                    :value="editLastName"
                    @change="
                      async (e) => {
                        editLastName = (e.target as HTMLInputElement | HTMLSelectElement).value;
                      }
                    "
                    :required="true"
                  />
                </div>
              </div>
              <div class="grid grid-cols-12 gap-4">
                <div class="col-span-8">
                  <label class="block text-sm font-medium mb-1"
                    >{{ getLabel('street', 'Street') }} *</label
                  ><input
                    type="text"
                    class="w-full h-10 px-3 rounded-md border border-gray-300"
                    :value="editStreet"
                    @change="
                      async (e) => {
                        editStreet = (e.target as HTMLInputElement | HTMLSelectElement).value;
                      }
                    "
                    :required="true"
                  />
                </div>
                <div class="col-span-2">
                  <label class="block text-sm font-medium mb-1"
                    >{{ getLabel('number', 'Number') }} *</label
                  ><input
                    type="text"
                    class="w-full h-10 px-3 rounded-md border border-gray-300"
                    :value="editNumber"
                    @change="
                      async (e) => {
                        editNumber = (e.target as HTMLInputElement | HTMLSelectElement).value;
                      }
                    "
                    :required="true"
                  />
                </div>
                <div class="col-span-2">
                  <label class="block text-sm font-medium mb-1">{{
                    getLabel('numberExtension', 'Ext')
                  }}</label
                  ><input
                    type="text"
                    class="w-full h-10 px-3 rounded-md border border-gray-300"
                    :value="editNumberExtension"
                    @change="
                      async (e) => {
                        editNumberExtension = (e.target as HTMLInputElement | HTMLSelectElement).value;
                      }
                    "
                  />
                </div>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium mb-1"
                    >{{ getLabel('postalCode', 'Postal Code') }} *</label
                  ><input
                    type="text"
                    class="w-full h-10 px-3 rounded-md border border-gray-300"
                    :value="editPostalCode"
                    @change="
                      async (e) => {
                        editPostalCode = (e.target as HTMLInputElement | HTMLSelectElement).value;
                      }
                    "
                    :required="true"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1"
                    >{{ getLabel('city', 'City') }} *</label
                  ><input
                    type="text"
                    class="w-full h-10 px-3 rounded-md border border-gray-300"
                    :value="editCity"
                    @change="
                      async (e) => {
                        editCity = (e.target as HTMLInputElement | HTMLSelectElement).value;
                      }
                    "
                    :required="true"
                  />
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium mb-1"
                  >{{ getLabel('country', 'Country') }} *</label
                ><select
                  class="w-full h-10 px-3 rounded-md border border-gray-300 bg-white"
                  :value="editCountry"
                  @change="
                    async (e) => {
                      editCountry = (e.target as HTMLInputElement | HTMLSelectElement).value;
                    }
                  "
                  :required="true"
                >
                  <option value="">
                    {{ getLabel('selectCountry', 'Select country') }}
                  </option>
                  <template :key="c.code" v-for="(c, index) in countries || []">
                    <option :value="c.code">{{ c.name }}</option>
                  </template>
                </select>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium mb-1"
                    >{{ getLabel('email', 'Email') }} *</label
                  ><input
                    type="email"
                    class="w-full h-10 px-3 rounded-md border border-gray-300"
                    :value="editEmail"
                    @change="
                      async (e) => {
                        editEmail = (e.target as HTMLInputElement | HTMLSelectElement).value;
                      }
                    "
                    :required="true"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1">{{
                    getLabel('phone', 'Phone')
                  }}</label
                  ><input
                    type="tel"
                    class="w-full h-10 px-3 rounded-md border border-gray-300"
                    :value="editPhone"
                    @change="
                      async (e) => {
                        editPhone = (e.target as HTMLInputElement | HTMLSelectElement).value;
                      }
                    "
                  />
                </div>
              </div>
              <template v-if="!!showIcp">
                <div class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="icp-modal"
                    class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    :checked="editIcp === Enums.YesNo.Y"
                    @change="
                      async (e) => {
                        editIcp = (e.target as HTMLInputElement).checked ? Enums.YesNo.Y : Enums.YesNo.N;
                      }
                    "
                  /><label for="icp-modal" class="text-sm font-medium">{{
                    getLabel('icp', 'ICP/ICS (Intra-Community Supply)')
                  }}</label>
                </div>
              </template>
            </div>
            <div class="flex justify-end gap-3 pt-4 mt-4 border-t">
              <button
                type="button"
                class="px-4 py-2 border rounded hover:bg-gray-100 disabled:opacity-50"
                @click="async (event) => closeEditModal()"
                :disabled="saving"
              >
                {{ getLabel('cancel', 'Cancel') }}</button
              ><button
                type="submit"
                class="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50"
                :disabled="saving"
              >
                <template v-if="saving">
                  {{ getLabel('saving', 'Saving...') }}
                </template>

                <template v-else>
                  {{ getLabel('save', 'Save') }}
                </template>
              </button>
            </div>
          </form>
        </div>
      </div>
    </template>

    <template v-if="showDeleteConfirm">
      <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div class="bg-white p-6 rounded-lg max-w-sm w-full mx-4">
          <h3 class="text-xl font-bold mb-4">
            {{ getLabel('confirmDeleteTitle', 'Confirm Delete') }}
          </h3>
          <p class="mb-6 text-gray-600">
            {{ getLabel('confirmDeleteMessage', 'Are you sure you want to delete this address?') }}
          </p>
          <div class="flex justify-end gap-4">
            <button
              class="px-4 py-2 border rounded hover:bg-gray-100"
              @click="
                async (event) => {
                  showDeleteConfirm = false;
                }
              "
            >
              {{ getLabel('cancel', 'Cancel') }}</button
            ><button
              class="px-4 py-2 bg-primary text-white rounded hover:bg-primary/80"
              @click="async (event) => confirmDelete()"
            >
              {{ getLabel('delete', 'Delete') }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import {
  GraphQLClient,
  Address,
  CartAddress,
  WarehouseAddress,
  OrderAddress,
  Enums,
} from 'propeller-sdk-v2';
import { getLabel as _getLabel } from '../../shared/utils/labelHelpers';

export interface AddressCardProps {
  /** GraphQL client for the Propeller SDK (only needed when editing) */
  graphqlClient?: GraphQLClient;

  /** The address to display (Address | CartAddress | WarehouseAddress | OrderAddress) */
  address: Address | CartAddress | WarehouseAddress | OrderAddress | null;

  /** Display company name @default true */
  showCompanyName?: boolean;

  /** Display salutation (Mr./Mrs.) @default true */
  showSalutation?: boolean;

  /** Display full name @default true */
  showFullName?: boolean;

  /** Display street @default true */
  showStreet?: boolean;

  /** Display house number and extension @default true */
  showNumberExtension?: boolean;

  /** Display postal code @default true */
  showPostalCode?: boolean;

  /** Display city @default true */
  showCity?: boolean;

  /** Display country name @default true */
  showCountry?: boolean;

  /** Display email @default false */
  showEmail?: boolean;

  /** Display phone @default false */
  showPhone?: boolean;

  /** Display action buttons (edit, delete, set default) @default true */
  enableActions?: boolean;

  /** Display Edit button @default true */
  enableEdit?: boolean;

  /** Display Delete button @default true */
  enableDelete?: boolean;

  /** Display Set Default button @default true */
  enableSetDefault?: boolean;

  /** Display the "Default ... Address" badge @default false */
  showDefaultBadge?: boolean;

  /** Called when address is edited; receives the updated address object */
  onEdit?: (address: Address) => void | Promise<void>;

  /** Called after address edit completes */
  afterEdit?: (address: Address) => void | Promise<void>;

  /** Called when address is deleted; receives the address ID */
  onDelete?: (addressId: Address) => void;

  /** Called after address deletion completes */
  afterDelete?: (addressId: Address) => void;

  /** Called when address is set as default */
  onSetDefault?: (address: Address) => void;

  /** Called after address is set as default */
  afterSetDefault?: (address: Address) => void;

  /** List of countries for the country dropdown [{code: 'NL', name: 'Netherlands'}, ...] */
  countries?: {
    code: string;
    name: string;
  }[];

  /** When true, renders in "new address" mode: auto-opens the edit form, hides the card body */
  isNew?: boolean;

  /** Called when the form is cancelled in new mode */
  onCancel?: () => void;

  /** When true, renders the form inline instead of in a modal overlay. @default false */
  inline?: boolean;

  /** Address type for new addresses (e.g., 'DELIVERY', 'INVOICE'). Used when creating, not editing. */
  addressType?: string;

  /** Show ICP/ICS (intra-community supply) checkbox. @default false */
  showIcp?: boolean;

  /** Title for the form or section */
  title?: string;

  /** Labels for form fields and buttons */
  labels?: Record<string, string>;

  /** Called before save starts */
  beforeSave?: () => void;
}
interface AddressCardState {
  showEditModal: boolean;
  showDeleteConfirm: boolean;
  localAddress: any;
  editCompany: string;
  editGender: Enums.Gender;
  editFirstName: string;
  editMiddleName: string;
  editLastName: string;
  editStreet: string;
  editNumber: string;
  editNumberExtension: string;
  editPostalCode: string;
  editCity: string;
  editCountry: string;
  editEmail: string;
  editPhone: string;
  editNotes: string;
  editIcp: Enums.YesNo;
  saving: boolean;
  getLabel: (key: string, fallback: string) => string;
  getCountryName: (code: string) => string;
  addr: any;
  showCard: boolean;
  formTitle: string;
  openEditModal: () => void;
  handleSaveEdit: (e: any) => Promise<void>;
  confirmDelete: () => void;
  handleSetDefault: () => void;
  closeEditModal: () => void;
}

const props = withDefaults(defineProps<AddressCardProps>(), {
  showCompanyName: true,
  showSalutation: true,
  showFullName: true,
  showStreet: true,
  showNumberExtension: true,
  showPostalCode: true,
  showCity: true,
  showCountry: true,
  showEmail: false,
  showPhone: false,
  enableActions: true,
  enableEdit: true,
  enableDelete: true,
  enableSetDefault: true,
  showDefaultBadge: false,
  isNew: false,
  inline: false,
  showIcp: false,
});
const showEditModal = ref<AddressCardState['showEditModal']>(false);
const showDeleteConfirm = ref<AddressCardState['showDeleteConfirm']>(false);
const saving = ref<AddressCardState['saving']>(false);
const localAddress = ref<AddressCardState['localAddress']>(null);
const editCompany = ref<AddressCardState['editCompany']>('');
const editGender = ref<AddressCardState['editGender']>(Enums.Gender.U);
const editFirstName = ref<AddressCardState['editFirstName']>('');
const editMiddleName = ref<AddressCardState['editMiddleName']>('');
const editLastName = ref<AddressCardState['editLastName']>('');
const editStreet = ref<AddressCardState['editStreet']>('');
const editNumber = ref<AddressCardState['editNumber']>('');
const editNumberExtension = ref<AddressCardState['editNumberExtension']>('');
const editPostalCode = ref<AddressCardState['editPostalCode']>('');
const editCity = ref<AddressCardState['editCity']>('');
const editCountry = ref<AddressCardState['editCountry']>('');
const editEmail = ref<AddressCardState['editEmail']>('');
const editPhone = ref<AddressCardState['editPhone']>('');
const editNotes = ref<AddressCardState['editNotes']>('');
const editIcp = ref<AddressCardState['editIcp']>(Enums.YesNo.N);

onMounted(() => {
  if (props.isNew || (props.inline && !props.address)) {
    openEditModal();
  }
});

const addr = computed(() => {
  return localAddress.value || props.address;
});
const showCard = computed(() => {
  if (props.isNew) return false;
  if (props.inline && !props.address) return false;
  return true;
});
const formTitle = computed(() => {
  if (props.title) return props.title;
  if (props.isNew) return getLabel('newTitle', 'New Address');
  return getLabel('editTitle', 'Edit Address');
});

watch(
  () => [props.address],
  () => {
    localAddress.value = null;
  },
  { immediate: true }
);
function getLabel(key: string, fallback: string): ReturnType<AddressCardState['getLabel']> {
  return _getLabel(props.labels, key, fallback);
}
function getCountryName(code: string): ReturnType<AddressCardState['getCountryName']> {
  if (!code) return '';
  const list = props.countries || [];
  for (let i = 0; i < list.length; i++) {
    if (list[i].code === code) return list[i].name;
  }
  return code;
}
function openEditModal(): ReturnType<AddressCardState['openEditModal']> {
  const a = addr.value;
  editCompany.value = a?.company || '';
  editGender.value = a?.gender || 'M';
  editFirstName.value = a?.firstName || '';
  editMiddleName.value = a?.middleName || '';
  editLastName.value = a?.lastName || '';
  editStreet.value = a?.street || '';
  editNumber.value = a?.number || '';
  editNumberExtension.value = a?.numberExtension || '';
  editPostalCode.value = a?.postalCode || '';
  editCity.value = a?.city || '';
  editCountry.value = a?.country || '';
  editEmail.value = a?.email || '';
  editPhone.value = a?.phone || '';
  editNotes.value = a?.notes || '';
  editIcp.value = a?.icp || Enums.YesNo.N;
  showEditModal.value = true;
}
async function handleSaveEdit(e: any): ReturnType<AddressCardState['handleSaveEdit']> {
  e.preventDefault();
  if (saving.value) return;
  saving.value = true;
  if (props.beforeSave) {
    props.beforeSave();
  }
  const editedAddress = {
    id: addr.value?.id,
    type: addr.value?.type || props.addressType || '',
    isDefault: addr.value?.isDefault,
    company: editCompany.value,
    gender: editGender.value,
    firstName: editFirstName.value,
    middleName: editMiddleName.value,
    lastName: editLastName.value,
    street: editStreet.value,
    number: editNumber.value,
    numberExtension: editNumberExtension.value,
    postalCode: editPostalCode.value,
    city: editCity.value,
    country: editCountry.value,
    email: editEmail.value,
    phone: editPhone.value,
    notes: editNotes.value,
    icp: editIcp.value as Enums.YesNo,
  } as unknown as Address;
  localAddress.value = editedAddress;
  try {
    if (props.onEdit) {
      await props.onEdit(editedAddress);
    }
    showEditModal.value = false;
    if (props.afterEdit) {
      await props.afterEdit(editedAddress);
    }
  } finally {
    saving.value = false;
  }
}
function confirmDelete(): ReturnType<AddressCardState['confirmDelete']> {
  const id = addr.value?.id;
  if (id != null) {
    if (props.onDelete) {
      props.onDelete(addr.value);
    }
    showDeleteConfirm.value = false;
    if (props.afterDelete) {
      props.afterDelete(addr.value);
    }
  } else {
    showDeleteConfirm.value = false;
  }
}
function handleSetDefault(): ReturnType<AddressCardState['handleSetDefault']> {
  if (props.onSetDefault) {
    props.onSetDefault(addr.value);
  }
  if (props.afterSetDefault) {
    props.afterSetDefault(addr.value);
  }
}
function closeEditModal(): ReturnType<AddressCardState['closeEditModal']> {
  showEditModal.value = false;
  if (props.isNew && props.onCancel) {
    props.onCancel();
  }
}
</script>
