<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-3xl font-bold tracking-tight">{{ t.authorizationSettingsTitle }}</h1>
    </div>
    <PurchaseAuthorizationConfigurator
      v-if="authStore.user && isContact(authStore.user) && companyStore.companyId"
      :afterPurchaseAuthorizationCreate="(pac: PurchaseAuthorizationConfig) => trackPac('created', pac)"
      :afterPurchaseAuthorizationUpdate="(pac: PurchaseAuthorizationConfig) => trackPac('updated', pac)"
      :afterPurchaseAuthorizationDelete="() => trackPac('deleted', null)"
      :labels="purchaseAuthorizationConfiguratorLabels"
    />
  </div>
</template>

<script setup lang="ts">
import { Contact, Customer, type PurchaseAuthorizationConfig } from '@propeller-commerce/propeller-sdk-v2'
import { useAuthStore } from '@/stores/auth'
import { useCompanyStore } from '@/stores/company'
import { orderEditorGraphqlClient } from '@/lib/api'
import { useTranslations } from '@/lib/i18n/composable'
import { PurchaseAuthorizationConfigurator } from '@propeller-commerce/propeller-v2-vue-ui';
import { track } from '@/lib/tracking/bus'

/**
 * Who may approve what, and up to which amount — a config change here silently
 * changes who can spend. One event with an `action` beats three names: the
 * question a rep asks is "did the approval rules move", not which verb it was.
 */
function trackPac(action: string, pac: PurchaseAuthorizationConfig | null) {
  track(
    'propeller.purchase_authorization_config_changed',
    {
      action,
      role: pac?.purchaseRole ?? null,
      limit: pac?.authorizationLimit ?? null,
    },
    `pac_changed:${action}:${pac?.id ?? ''}:${Math.floor(Date.now() / 2000)}`,
  )
}

const authStore = useAuthStore()
const companyStore = useCompanyStore()
const purchaseAuthorizationConfiguratorLabels = useTranslations('PurchaseAuthorizationConfigurator')
const t = useTranslations('Account')

function isContact(u: Contact | Customer | null): u is Contact {
  return u !== null && 'contactId' in u
}
</script>
