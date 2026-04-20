import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { Enums, UserService, type Contact, type Customer } from 'propeller-sdk-v2'
import { graphqlClient } from '@/lib/api'

type User = Contact | Customer

function sanitizeUser(data: any): User {
  const strip = (obj: any): any => {
    if (obj === null || obj === undefined) return obj
    if (Array.isArray(obj)) return obj.map(strip)
    if (typeof obj === 'object') {
      const r: any = {}
      for (const [k, v] of Object.entries(obj)) {
        r[k.startsWith('_') ? k.slice(1) : k] = strip(v)
      }
      return r
    }
    return obj
  }
  return strip(data) as User
}

function loadUserFromStorage(): User | null {
  try {
    const stored = localStorage.getItem('user') || localStorage.getItem('auth_user')
    if (!stored) return null
    return sanitizeUser(JSON.parse(stored))
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(loadUserFromStorage())
  const token = ref<string | null>(localStorage.getItem('accessToken') || localStorage.getItem('auth_token'))
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => !!token.value && !!user.value)

  // Restore graphqlClient auth on init
  if (token.value) {
    graphqlClient.setAccessToken(token.value)
  }

  // Session timeout (30 min inactivity)
  let sessionTimer: ReturnType<typeof setTimeout> | null = null
  const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const

  function resetSessionTimer() {
    if (!isAuthenticated.value) return
    if (sessionTimer) clearTimeout(sessionTimer)
    sessionTimer = setTimeout(() => {
      console.log('Session expired due to inactivity')
      logout()
    }, 30 * 60 * 1000)
  }

  const handleActivity = () => resetSessionTimer()

  watch(isAuthenticated, (authenticated) => {
    if (authenticated) {
      activityEvents.forEach(e => window.addEventListener(e, handleActivity))
      resetSessionTimer()
    } else {
      if (sessionTimer) clearTimeout(sessionTimer)
      activityEvents.forEach(e => window.removeEventListener(e, handleActivity))
    }
  }, { immediate: true })

  function setUser(u: User | null) {
    user.value = u
    if (u) localStorage.setItem('user', JSON.stringify(u))
    else localStorage.removeItem('user')
    localStorage.removeItem('auth_user')
  }

  function setToken(t: string | null) {
    token.value = t
    if (t) {
      localStorage.setItem('accessToken', t)
      graphqlClient.setAccessToken(t)
    } else {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('auth_token')
    }
  }

  function clearError() {
    error.value = null
  }

  function updateUser(userData: Partial<User>) {
    if (!user.value) return
    user.value = { ...user.value, ...userData } as User
    localStorage.setItem('user', JSON.stringify(user.value))
  }

  function logout() {
    user.value = null
    token.value = null
    error.value = null

    // Clear localStorage except menuData
    const menuData = localStorage.getItem('menuData')
    localStorage.clear()
    if (menuData) localStorage.setItem('menuData', menuData)

    window.dispatchEvent(new CustomEvent('userLoggedOut'))
  }

  async function refreshUser(): Promise<void> {
    const storedToken = localStorage.getItem('accessToken')
    if (!storedToken) return
    try {
      graphqlClient.setAccessToken(storedToken)
      const userService = new UserService(graphqlClient)
      const viewerData = await userService.getViewer({})
      if (viewerData) {
        const plain = sanitizeUser(JSON.parse(JSON.stringify(viewerData, (_k, v) => v)))
        localStorage.setItem('user', JSON.stringify(plain))
        user.value = plain
        if (!token.value) token.value = storedToken
      }
    } catch (e) {
      console.error('refreshUser failed', e)
    }
  }

  function isAuthManagerForCompany(u: Contact | Customer | null, companyId: number | undefined): boolean {
    if (!u || !companyId || !('contactId' in u)) return false
    const pacData = (u as any).purchaseAuthorizationConfigs
    const items: any[] = pacData?.items ?? pacData?._items ?? []
    return items.some((pac: any) => {
      const role = pac.purchaseRole ?? pac._purchaseRole
      const pacCompanyId =
        pac.company?.companyId ?? pac.company?._companyId ??
        pac._company?.companyId ?? pac._company?._companyId
      return role === Enums.PurchaseRole.AUTHORIZATION_MANAGER && pacCompanyId === companyId
    })
  }

  // Sync with other tabs / components via custom events
  window.addEventListener('userLoggedIn', () => {
    const storedToken = localStorage.getItem('accessToken')
    const storedUser = localStorage.getItem('user')
    if (storedToken && storedUser) {
      try {
        user.value = sanitizeUser(JSON.parse(storedUser))
        token.value = storedToken
      } catch (e) {
        console.error('Failed to parse stored user on userLoggedIn event:', e)
      }
    }
  })

  window.addEventListener('userLoggedOut', () => {
    user.value = null
    token.value = null
  })

  return {
    user, token, isLoading, error, isAuthenticated,
    setUser, setToken, clearError, updateUser, logout, refreshUser, isAuthManagerForCompany,
  }
})
