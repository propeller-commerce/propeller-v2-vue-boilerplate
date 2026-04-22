import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Company } from 'propeller-sdk-v2'
import { stripLeadingUnderscores } from '@/composables/shared/utils/userUtils'

const STORAGE_KEY = 'selected_company'

function loadCompanyFromStorage(): Company | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? (stripLeadingUnderscores(JSON.parse(stored)) as Company) : null
  } catch {
    return null
  }
}

export const useCompanyStore = defineStore('company', () => {
  const selectedCompany = ref<Company | null>(loadCompanyFromStorage())

  const companyId = computed(() => selectedCompany.value?.companyId ?? null)

  function setSelectedCompany(company: Company) {
    selectedCompany.value = company
    localStorage.setItem(STORAGE_KEY, JSON.stringify(company))
    window.dispatchEvent(new CustomEvent('companySwitched', { detail: company }))
  }

  function clearSelectedCompany() {
    selectedCompany.value = null
    localStorage.removeItem(STORAGE_KEY)
  }

  // Cross-tab sync
  window.addEventListener('companySwitched', (e) => {
    const company = (e as CustomEvent<Company>).detail
    selectedCompany.value = company
  })

  // Clear on logout
  window.addEventListener('userLoggedOut', () => clearSelectedCompany())

  return { selectedCompany, companyId, setSelectedCompany, clearSelectedCompany }
})
