<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-3xl font-bold tracking-tight">Authorization Settings</h1>
    </div>
    <PurchaseAuthorizationConfigurator
      v-if="authStore.user && isContact(authStore.user) && companyStore.companyId"
      :labels="{
        title: 'Purchase Authorization Settings',
        addContact: 'Add contact',
        addContactTitle: 'Add Contact',
        colId: 'ID',
        colName: 'Name',
        colRole: 'Role',
        colLimit: 'Limit',
        colActions: 'Actions',
        selectRole: '— Select role —',
        rolePurchaser: 'Purchaser',
        roleManager: 'Authorization Manager',
        limitPlaceholder: '0.00',
        save: 'Save',
        create: 'Create',
        delete: 'Delete',
        previous: 'Previous',
        next: 'Next',
        page: 'Page',
        of: 'of',
        companyName: 'Company',
        gender: 'Gender',
        selectGender: '— Select —',
        genderM: 'Male',
        genderF: 'Female',
        genderU: 'Unspecified',
        email: 'Email',
        firstName: 'First name',
        middleName: 'Middle',
        lastName: 'Last name',
        phone: 'Phone',
        cancel: 'Cancel',
        addContactSubmit: 'Add Contact',
      }"
    />
  </div>
</template>

<script setup lang="ts">
import { Contact, Customer } from 'propeller-sdk-v2'
import { useAuthStore } from '@/stores/auth'
import { useCompanyStore } from '@/stores/company'
import { orderEditorGraphqlClient } from '@/lib/api'
import { PurchaseAuthorizationConfigurator } from 'propeller-v2-vue-ui';

const authStore = useAuthStore()
const companyStore = useCompanyStore()

function isContact(u: Contact | Customer | null): u is Contact {
  return u !== null && 'contactId' in u
}
</script>
