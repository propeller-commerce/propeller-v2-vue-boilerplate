<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h1 class="text-3xl font-bold tracking-tight">Addresses</h1>
    </div>

    <!-- Default Addresses -->
    <div class="space-y-4 pb-10">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Default Billing -->
        <div class="space-y-2">
          <h2 class="font-semibold text-md">Default Billing Address</h2>
          <AddressCard
            v-if="defaultAddresses.invoice"
            :key="`inv-${defaultAddresses.invoice.id}`"
            :graphqlClient="graphqlClient"
            :address="defaultAddresses.invoice"
            :enableDelete="false"
            :onEdit="handleEditAddress"
            :onDelete="handleDeleteAddress"
            :onSetDefault="handleSetDefault"
            :countries="COUNTRIES"
          />
          <div v-else class="border border-dashed rounded-[var(--radius-container)] p-6 flex flex-col items-center justify-center text-center space-y-2">
            <p class="text-sm text-muted-foreground">No default invoice address</p>
            <button type="button" class="text-primary text-sm hover:underline" @click="handleAddAddress(Enums.AddressType.invoice)">Add One</button>
          </div>
        </div>
        <!-- Default Delivery -->
        <div class="space-y-2">
          <h2 class="font-semibold text-md">Default Delivery Address</h2>
          <AddressCard
            v-if="defaultAddresses.delivery"
            :key="`del-${defaultAddresses.delivery.id}`"
            :graphqlClient="graphqlClient"
            :address="defaultAddresses.delivery"
            :enableDelete="false"
            :onEdit="handleEditAddress"
            :onDelete="handleDeleteAddress"
            :onSetDefault="handleSetDefault"
            :countries="COUNTRIES"
          />
          <div v-else class="border border-dashed rounded-[var(--radius-container)] p-6 flex flex-col items-center justify-center text-center space-y-2">
            <p class="text-sm text-muted-foreground">No default delivery address</p>
            <button type="button" class="text-primary text-sm hover:underline" @click="handleAddAddress(Enums.AddressType.delivery)">Add One</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Additional Billing Addresses -->
    <div class="space-y-5">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-semibold">Additional Billing Addresses</h2>
        <button type="button" class="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors" @click="handleAddAddress(Enums.AddressType.invoice)">
          + Add New
        </button>
      </div>
      <div v-if="billingAddresses.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AddressCard
          v-for="address in billingAddresses"
          :key="address.id"
          :graphqlClient="graphqlClient"
          :address="address"
          :onEdit="handleEditAddress"
          :onDelete="handleDeleteAddress"
          :onSetDefault="handleSetDefault"
          :countries="COUNTRIES"
        />
      </div>
      <p v-else class="text-muted-foreground italic text-sm">No additional billing addresses.</p>
    </div>

    <!-- Additional Delivery Addresses -->
    <div class="space-y-5">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-semibold">Additional Delivery Addresses</h2>
        <button type="button" class="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors" @click="handleAddAddress(Enums.AddressType.delivery)">
          + Add New
        </button>
      </div>
      <div v-if="deliveryAddresses.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AddressCard
          v-for="address in deliveryAddresses"
          :key="address.id"
          :graphqlClient="graphqlClient"
          :address="address"
          :onEdit="handleEditAddress"
          :onDelete="handleDeleteAddress"
          :onSetDefault="handleSetDefault"
          :countries="COUNTRIES"
        />
      </div>
      <p v-else class="text-muted-foreground italic text-sm">No additional delivery addresses.</p>
    </div>

    <!-- Add New Address Modal -->
    <AddressCard
      v-if="showAddModal"
      :graphqlClient="graphqlClient"
      :address="null"
      :addressType="addModalType"
      :isNew="true"
      :enableActions="false"
      :onEdit="handleSaveNewAddress"
      :onCancel="() => { showAddModal = false }"
      :countries="COUNTRIES"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { type Address, type Company, Enums } from 'propeller-sdk-v2'
import type { Contact, Customer } from 'propeller-sdk-v2'
import { useAuthStore } from '@/stores/auth'
import { useCompanyStore } from '@/stores/company'
import { graphqlClient } from '@/lib/api'
import { useAddress } from '@/composables/useAddress'
import type { AddressInput } from '@/composables/useAddress'
import type { AnyUser } from '@/composables/shared/utils/userIdentity'
import AddressCard from '@/components/propeller/AddressCard.vue'
import { COUNTRIES } from "@/composables/shared/utils/countries";

const authStore = useAuthStore()
const companyStore = useCompanyStore()

// COUNTRIES imported from shared utils
const showAddModal = ref(false)
const addModalType = ref<Enums.AddressType>(Enums.AddressType.invoice)

const userRef = computed(() => authStore.user as AnyUser)
const companyIdRef = computed(() => companyStore.selectedCompany?.companyId)

const { createAddress, updateAddress, deleteAddress, setDefaultAddress } = useAddress({
  graphqlClient,
  user: userRef,
  companyId: companyIdRef,
})

// ── Display helpers (read-only, no SDK) ──────────────────────────────────────

function isContact(u: Contact | Customer | null): u is Contact {
  return u !== null && 'contactId' in u
}

function isCustomer(u: Contact | Customer | null): u is Customer {
  return u !== null && 'customerId' in u
}

function getActiveCompany(): Company | null {
  const u = userRef.value
  if (!u || !isContact(u as Contact)) return null
  const targetId = companyStore.selectedCompany?.companyId
  if (targetId) {
    const companiesRaw = (u as any).companies
    const items = (companiesRaw?.items ?? companiesRaw) as Company[] | undefined
    if (Array.isArray(items)) {
      const found = items.find((c: Company) => c.companyId === targetId)
      if (found) return found
    }
    if ((u as Contact).company?.companyId === targetId) return (u as Contact).company as Company
  }
  return ((u as Contact).company as Company | undefined) ?? null
}

function getAllAddresses(): Address[] {
  const u = userRef.value
  if (!u) return []
  if (isContact(u as Contact)) return getActiveCompany()?.addresses || []
  if (isCustomer(u as Customer)) return (u as Customer).addresses || []
  return []
}

const defaultAddresses = computed(() => {
  const addresses = getAllAddresses()
  return {
    invoice: addresses.find((a: Address) => a.type === Enums.AddressType.invoice && a.isDefault === Enums.YesNo.Y),
    delivery: addresses.find((a: Address) => a.type === Enums.AddressType.delivery && a.isDefault === Enums.YesNo.Y),
  }
})

const billingAddresses = computed(() =>
  getAllAddresses().filter((a: Address) => a.type === Enums.AddressType.invoice && a.isDefault === Enums.YesNo.N)
)

const deliveryAddresses = computed(() =>
  getAllAddresses().filter((a: Address) => a.type === Enums.AddressType.delivery && a.isDefault === Enums.YesNo.N)
)

// ── Handlers ─────────────────────────────────────────────────────────────────

function handleAddAddress(type: Enums.AddressType) {
  addModalType.value = type
  showAddModal.value = true
}

async function handleEditAddress(address: Address) {
  await updateAddress(Number(address.id), address as Partial<AddressInput>)
  await authStore.refreshUser()
}

async function handleDeleteAddress(address: Address) {
  await deleteAddress(Number(address.id))
  await authStore.refreshUser()
}

async function handleSetDefault(address: Address) {
  if (!address.id) return
  await setDefaultAddress(Number(address.id))
  await authStore.refreshUser()
}

async function handleSaveNewAddress(address: any) {
  await createAddress({
    company: address.company || undefined,
    gender: address.gender || undefined,
    firstName: address.firstName || undefined,
    middleName: address.middleName || undefined,
    lastName: address.lastName || undefined,
    email: address.email || undefined,
    street: address.street || '',
    number: address.number || undefined,
    numberExtension: address.numberExtension || undefined,
    postalCode: address.postalCode || '',
    city: address.city || '',
    country: address.country || 'NL',
    notes: address.notes || undefined,
    isDefault: (address.isDefault as Enums.YesNo) || Enums.YesNo.N,
    type: addModalType.value,
  })
  await authStore.refreshUser()
  showAddModal.value = false
}
</script>
