import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Company } from 'propeller-sdk-v2'
import { isBrowser, safeStorage } from '@/lib/ssr'

const STORAGE_KEY = 'selected_company'

function loadCompanyFromStorage(): Company | null {
  try {
    const stored = safeStorage.getItem(STORAGE_KEY)
    return stored ? (JSON.parse(stored) as Company) : null
  } catch {
    return null
  }
}

export const useCompanyStore = defineStore('company', () => {
  const selectedCompany = ref<Company | null>(loadCompanyFromStorage())

  const companyId = computed(() => selectedCompany.value?.companyId ?? null)

  function setSelectedCompany(company: Company) {
    selectedCompany.value = company
    safeStorage.setItem(STORAGE_KEY, JSON.stringify(company))
    if (isBrowser) {
      window.dispatchEvent(new CustomEvent('companySwitched', { detail: company }))
    }
  }

  function clearSelectedCompany() {
    selectedCompany.value = null
    safeStorage.removeItem(STORAGE_KEY)
  }

  // Cross-tab sync + logout reset — browser-only.
  if (isBrowser) {
    window.addEventListener('companySwitched', (e) => {
      const company = (e as CustomEvent<Company>).detail
      selectedCompany.value = company
    })
    window.addEventListener('userLoggedOut', () => clearSelectedCompany())
  }

  return { selectedCompany, companyId, setSelectedCompany, clearSelectedCompany }
})
