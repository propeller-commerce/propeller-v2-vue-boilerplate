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

  // Client-only re-hydration after SSR state transfer. The server can't read
  // localStorage, so this store renders with `selectedCompany: null` and that
  // null is what `entry-client.ts` restores wholesale (`pinia.state.value =
  // initialState`) — clobbering the value the setup initializer read from
  // localStorage. Without this, a contact's selected company (and therefore the
  // dashboard's addresses + company info, which read `activeCompany`) vanishes
  // on every refresh. localStorage is the source of truth for the *selected*
  // company; the server seeds the default via `hydrateFromServer` below.
  function hydrateFromStorage() {
    if (!isBrowser) return
    const stored = loadCompanyFromStorage()
    if (stored) selectedCompany.value = stored
  }

  // SSR seed — set the in-memory ref only (no storage write), so the value
  // serializes into `__INITIAL_STATE__` and the server render already has the
  // active company. Called from `entry-server.ts` with the viewer's default
  // company when no explicit selection exists yet.
  function hydrateFromServer(company: Company | null) {
    selectedCompany.value = company
  }

  // Re-point the selected company at the FRESH copy carried on a just-refreshed
  // user, keeping the same companyId. `selectedCompany` holds its own snapshot
  // of the company (the dashboard reads addresses + company info off it, not off
  // `user.company`), so after an address mutation + `refreshUser` it would
  // otherwise stay stale — old addresses on the dashboard. Match the current
  // selection by id (multi-company contacts), else fall back to the user's
  // default company. Persist so the refreshed copy also survives a reload.
  function syncFromUser(user: unknown): void {
    const u = user as { company?: Company; companies?: { items?: Company[] } } | null
    if (!u) return
    const targetId = selectedCompany.value?.companyId
    const candidates: Company[] = [
      ...(u.companies?.items ?? []),
      ...(u.company ? [u.company] : []),
    ]
    const next =
      (targetId != null && candidates.find((c) => c?.companyId === targetId)) ||
      u.company ||
      null
    if (!next) return
    selectedCompany.value = next
    safeStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  // Cross-tab sync + logout reset — browser-only.
  if (isBrowser) {
    window.addEventListener('companySwitched', (e) => {
      const company = (e as CustomEvent<Company>).detail
      selectedCompany.value = company
    })
    window.addEventListener('userLoggedOut', () => clearSelectedCompany())
  }

  return {
    selectedCompany, companyId,
    setSelectedCompany, clearSelectedCompany, hydrateFromStorage, hydrateFromServer, syncFromUser,
  }
})
