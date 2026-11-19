import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { type Contact, type Customer, PurchaseRole, UserService, type ViewerVariables } from '@propeller-commerce/propeller-sdk-v2';
import { endSession, graphqlClient, startSession } from '@/lib/api'
import { isBrowser, safeStorage } from '@/lib/ssr'
import { configuration } from '@/lib/config'
import { track } from '@/lib/tracking/bus'
import { clearTrackingIdentity } from '@/lib/tracking/bootstrap'

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

// Cross-tab auth signal. A same-document CustomEvent never crosses tabs, so
// logging out (or in) in one tab left others showing stale auth UI until their
// next 401. BroadcastChannel reaches every same-origin tab. Null under SSR /
// older browsers; every use is optional-chained.
const authChannel: BroadcastChannel | null =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('auth')
    : null

function loadUserFromStorage(): User | null {
  try {
    const stored = safeStorage.getItem('user') || safeStorage.getItem('auth_user')
    if (!stored) return null
    return sanitizeUser(JSON.parse(stored))
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  // On the server `safeStorage` returns null → the store starts anonymous; the
  // SSR seed (hydrateFromServer) and __INITIAL_STATE__ carry the real state.
  const user = ref<User | null>(loadUserFromStorage())
  // Whether this browser holds a session cookie. The token itself is httpOnly
  // (see lib/api.ts): set by the server, never readable here.
  const hasSession = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => hasSession.value && !!user.value)

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

  // Inactivity tracking is a browser-only concern — skip the listener wiring
  // entirely under SSR (no `window`), the client re-runs this after hydration.
  watch(isAuthenticated, (authenticated) => {
    if (!isBrowser) return
    if (authenticated) {
      activityEvents.forEach(e => window.addEventListener(e, handleActivity))
      resetSessionTimer()
    } else {
      if (sessionTimer) clearTimeout(sessionTimer)
      activityEvents.forEach(e => window.removeEventListener(e, handleActivity))
    }
  }, { immediate: true })

  function setUser(u: User | null) {
    // Always sanitize so the store never holds the SDK's underscore-prefixed
    // private-field representation. Without this, any caller that forgets to
    // strip the underscores can poison the store and break code that reads
    // `purchaseAuthorizationConfigs.items`, `company.companyId`, etc. on the
    // canonical (non-underscored) keys — e.g. useCart.checkoutAllowed silently
    // returns true for users who actually need authorization.
    const clean = u ? sanitizeUser(u) : null
    user.value = clean
    if (clean) safeStorage.setItem('user', JSON.stringify(clean))
    else safeStorage.removeItem('user')
    safeStorage.removeItem('auth_user')
  }

  /**
   * Start the session for the tokens a login or registration just returned: the
   * server stores them in httpOnly cookies. GraphQL calls made meanwhile wait for
   * that write (lib/api.ts), so they already run as the new user.
   */
  function setSession(accessToken: string, refreshToken?: string) {
    hasSession.value = true
    void startSession(accessToken, refreshToken)
  }

  function clearError() {
    error.value = null
  }

  function updateUser(userData: Partial<User>) {
    if (!user.value) return
    user.value = { ...user.value, ...userData } as User
    safeStorage.setItem('user', JSON.stringify(user.value))
  }

  function logout() {
    // Before the storage wipe, so the event still carries the outgoing
    // identity. Emitted explicitly here rather than from a watcher on
    // `isAuthenticated` — that watcher fires on every store construction.
    track('logout', {}, `logout:${Date.now()}`)
    clearTrackingIdentity()

    user.value = null
    hasSession.value = false
    error.value = null

    // Clear localStorage except menuData
    const menuData = safeStorage.getItem('menuData')
    safeStorage.clear()
    if (menuData) safeStorage.setItem('menuData', menuData)

    // The session cookies are httpOnly: only the server can drop them.
    void endSession()

    if (isBrowser) {
      window.dispatchEvent(new CustomEvent('userLoggedOut'))
      // Cross-tab: reaches other tabs, which the same-document event does not.
      authChannel?.postMessage('logout')
    }
  }

  async function refreshUser(): Promise<void> {
    if (!hasSession.value) return
    try {
      const userService = new UserService(graphqlClient)
      // Request the tracked company/customer attributes so the machines root can
      // read MY_INSTALLATIONS off the hydrated company. Mirrors propeller-next's
      // AuthContext.refreshUser.
      const viewerData = await userService.getViewer({
        companyAttributesInput: { attributeDescription: { names: configuration.companyTrackAttributes } },
        customerAttributesInput: { attributeDescription: { names: configuration.customerTrackAttributes } },
        contactPAConfigInput: configuration.contactPAConfigInput,
        contactCompaniesSearchInput: configuration.contactCompaniesSearchInput,
      } as ViewerVariables)
      if (viewerData) {
        const plain = sanitizeUser(JSON.parse(JSON.stringify(viewerData, (_k, v) => v)))
        safeStorage.setItem('user', JSON.stringify(plain))
        user.value = plain
        // Re-point the company store at the fresh company copy. The dashboard
        // reads addresses + company info off `companyStore.selectedCompany`, a
        // separate snapshot — without this, an address edit (which calls
        // refreshUser) updates `user` but leaves the dashboard showing the old
        // addresses. Lazy import avoids a store-module cycle.
        const { useCompanyStore } = await import('@/stores/company')
        useCompanyStore().syncFromUser(plain)
      }
    } catch (e) {
      console.error('refreshUser failed', e)
      // If getViewer() failed with an auth error, the session is dead (token
      // present but no longer valid). Swallowing it would leave the app
      // painting logged-in from stored user/token while every data call 401s,
      // with no recovery. Fall back to a clean logged-out state. Non-auth
      // failures (network blip) are left alone so a transient error doesn't
      // sign the user out.
      const msg = (e instanceof Error ? e.message : String(e)).toLowerCase()
      if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('forbidden') || msg.includes('403')) {
        logout()
      }
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
      return role === PurchaseRole.AUTHORIZATION_MANAGER && pacCompanyId === companyId
    })
  }

  // Sync with other tabs / components via custom events. Browser-only —
  // there are no other tabs, and no `window`, during a server render.
  if (isBrowser) {
    const onLoggedIn = () => {
      const storedUser = safeStorage.getItem('user')
      if (storedUser) {
        try {
          user.value = sanitizeUser(JSON.parse(storedUser))
          // The session cookie is shared by every tab of this origin.
          hasSession.value = true
        } catch (e) {
          console.error('Failed to parse stored user on userLoggedIn event:', e)
        }
      }
    }
    const onLoggedOut = () => {
      user.value = null
      hasSession.value = false
    }

    // The same-document `userLoggedIn` event fires only in the tab that logged
    // in — rehydrate here AND broadcast to other tabs. The channel receiver
    // below calls onLoggedIn directly (not via this event), so it never
    // re-broadcasts: no loop.
    window.addEventListener('userLoggedIn', () => {
      onLoggedIn()
      authChannel?.postMessage('login')
    })
    window.addEventListener('userLoggedOut', onLoggedOut)

    // Cross-tab: another tab logged in/out. Route to the same handlers. The
    // logged-in tab reads freshly-written localStorage (login/register persist
    // the user before broadcasting), so onLoggedIn rehydrates here.
    authChannel?.addEventListener('message', (e: MessageEvent) => {
      if (e.data === 'logout') onLoggedOut()
      else if (e.data === 'login') onLoggedIn()
    })
  }

  /**
   * Seed the store from the SSR-resolved viewer. Called only by the server
   * prefetch loaders: the server reads the `access_token` cookie and resolves
   * the user via the SDK's `getViewer`, then hands the result here so the
   * server render of the catalog shell is already personalised (contact
   * pricing, account menu state). Unlike `setUser`/`setSession` this writes NO
   * storage/cookie — it only sets the in-memory refs, which then serialize
   * into `__INITIAL_STATE__` and hydrate the client identically. The token
   * itself never enters the store, so it never reaches the page.
   */
  function hydrateFromServer(u: User | null) {
    user.value = u ? sanitizeUser(u) : null
    hasSession.value = !!u
  }

  return {
    user, hasSession, isLoading, error, isAuthenticated,
    setUser, setSession, clearError, updateUser, logout, refreshUser,
    isAuthManagerForCompany, hydrateFromServer,
  }
})
