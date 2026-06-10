<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-3xl font-bold tracking-tight">Authorization Settings</h1>
    </div>
    <PurchaseAuthorizationConfigurator
      v-if="authStore.user && isContact(authStore.user) && companyStore.companyId"
      :labels="purchaseAuthorizationConfiguratorLabels"
    />
  </div>
</template>

<script setup lang="ts">
import { Contact, Customer } from '@propeller-commerce/propeller-sdk-v2'
import { useAuthStore } from '@/stores/auth'
import { useCompanyStore } from '@/stores/company'
import { orderEditorGraphqlClient } from '@/lib/api'
import { useTranslations } from '@/lib/i18n/composable'
import { PurchaseAuthorizationConfigurator } from '@propeller-commerce/propeller-v2-vue-ui';

const authStore = useAuthStore()
const companyStore = useCompanyStore()
const purchaseAuthorizationConfiguratorLabels = useTranslations('PurchaseAuthorizationConfigurator')

function isContact(u: Contact | Customer | null): u is Contact {
  return u !== null && 'contactId' in u
}
</script>
