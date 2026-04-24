<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-3xl font-bold tracking-tight">Dashboard</h1>
    </div>

    <UserDetails
      v-if="authStore.user"
      :graphqlClient="graphqlClient"
      :user="authStore.user as Contact | Customer"
      :language="languageStore.language"
      :activeCompany="companyStore.selectedCompany as Company"
      :showCompanyInfo="true"
      :listAllContactCompanies="false"
      :showDefaultInvoiceAddress="true"
      :showDefaultDeliveryAddress="true"
      :countries="COUNTRIES"
      :onUserUpdated="(user: any) => authStore.setUser(user)"
    />
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { useLanguageStore } from '@/stores/language'
import { useCompanyStore } from '@/stores/company'
import { graphqlClient } from '@/lib/api'
import UserDetails from '@/components/propeller/UserDetails.vue'
import type { Company, Contact, Customer } from 'propeller-sdk-v2'
import { COUNTRIES } from "@/composables/shared/utils/countries";

const authStore = useAuthStore()
const languageStore = useLanguageStore()
const companyStore = useCompanyStore()

// COUNTRIES imported from shared utils
</script>
