/**
 * Client entry — runs in the browser, hydrates the server-rendered markup.
 *
 * Hydration contract: the DOM must already contain the server's output (the
 * Node server injected it into `<div id="app">`), and `createSSRApp` +
 * `app.mount` will *adopt* that DOM rather than re-create it. For that to be
 * mismatch-free, the Pinia state must be restored from `window.__INITIAL_STATE__`
 * (what the server serialized) BEFORE mount, and the router must be `isReady()`.
 */
import 'propeller-v2-vue-ui/styles.css'
import './style.css'
import { createApp } from './app'
import { graphqlClient } from './lib/api'
import { setCookie } from './lib/ssr'
import { configuration } from './lib/config'
import { fetchActiveCart } from 'propeller-v2-vue-ui'
import { useCartStore } from './stores/cart'
import { useCompanyStore } from './stores/company'
import { useAuthStore } from './stores/auth'
import { useLanguageStore } from './stores/language'

// Restore the access token so authenticated API calls work after a reload.
// Client-only: this is the localStorage half of the two-stage auth model.
const storedToken =
  localStorage.getItem('accessToken') || localStorage.getItem('auth_token')
if (storedToken) {
  graphqlClient.setAccessToken(storedToken)
  // Re-mirror the token into the SSR cookie. This also migrates users who
  // logged in before the cookie existed: their next navigation server-renders
  // personalised HTML instead of waiting for a re-login.
  setCookie('access_token', storedToken)
}

const { app, router, pinia } = createApp()

// Rehydrate Pinia with the exact state the server rendered against, so the
// first client render is identical to the server's — no hydration mismatch.
const initialState = (window as unknown as { __INITIAL_STATE__?: unknown })
  .__INITIAL_STATE__
if (initialState) {
  pinia.state.value = initialState as typeof pinia.state.value
}

// Wait for the router to resolve the current route (and run async lazy
// components) before mounting, so `app.mount` adopts a fully-resolved tree.
router.isReady().then(() => {
  app.mount('#app')

  // All three client-only reconciles below run AFTER mount so they never
  // perturb the hydration render (the server rendered with no localStorage; the
  // first client render must match it). ORDER MATTERS: company first, then cart.

  // 1. Company reconcile. The server seeded the contact's DEFAULT company; a
  // multi-company contact may have an explicit selection in localStorage that
  // differs. Restore it FIRST so the cart reconcile below is scoped to the
  // user's actual selected company — otherwise a refresh fetches the cart for
  // the default company and shows the wrong company's cart.
  useCompanyStore().hydrateFromStorage()

  // 2. Auth reconcile. The server may have rendered anonymously (no/expired auth
  // cookie) while localStorage still holds a valid session. `refreshUser`
  // re-validates the token and refreshes the profile.
  if (storedToken) {
    const auth = useAuthStore()
    if (!auth.token) auth.setToken(storedToken)
    if (!auth.user) void auth.refreshUser()
  }

  // 3. Cart reconcile. For an AUTHENTICATED user, fetch the server's active cart
  // scoped to the (now-correct) selected company and use that — the persisted
  // localStorage cartId can be stale (server cart processed/deleted/replaced) or
  // belong to a different company, so re-fetching guarantees a live, correctly
  // scoped cart. For an ANONYMOUS user there's no server cart, so re-read the
  // localStorage cart instead. Either way this is post-mount, so cart pages that
  // render contents directly (cart/checkout/authorization-request-sent) first
  // render empty (matching the server) and populate immediately after.
  const authStore = useAuthStore()
  const companyStore = useCompanyStore()
  const cartStore = useCartStore()
  if (authStore.isAuthenticated && authStore.user) {
    void fetchActiveCart({
      graphqlClient,
      user: authStore.user,
      companyId: companyStore.selectedCompany?.companyId ?? undefined,
      language: useLanguageStore().language,
      imageSearchFilters: configuration.imageSearchFiltersGrid,
      imageVariantFilters: configuration.imageVariantFiltersSmall,
    }).then((serverCart) => cartStore.setCart(serverCart ?? null))
  } else {
    cartStore.hydrateFromStorage()
  }
})
