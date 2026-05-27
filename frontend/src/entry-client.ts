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
import { useCartStore } from './stores/cart'
import { useCompanyStore } from './stores/company'

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

  // Re-read the persisted cart from localStorage. The state transfer above
  // clobbers it (the server rendered with no localStorage, so its `cart: null`
  // snapshot wins), and the anonymous cart lives only in localStorage. Run this
  // AFTER mount, NOT before: cart pages that render cart contents directly
  // (cart, checkout, authorization-request-sent) are NOT mount-gated, so a
  // pre-mount restore makes the client's first render (cart populated) differ
  // from the server's (cart empty) → "Hydration completed but contains
  // mismatches". Post-mount, the first render matches the server and the cart
  // populates immediately after — the header badge is `isMounted`-gated so it
  // appears post-mount regardless. The authenticated reconcile below then
  // overrides this with the live server cart.
  useCartStore().hydrateFromStorage()

  // Post-hydration auth reconcile. The server may have rendered anonymously
  // (no auth cookie, or an expired one) while localStorage still holds a valid
  // session. Run this AFTER mount so it never perturbs the hydration render —
  // it only updates client state for subsequent interaction. `refreshUser`
  // re-validates the token against the API and refreshes the profile.
  if (storedToken) {
    import('./stores/auth').then(({ useAuthStore }) => {
      const auth = useAuthStore()
      if (!auth.token) auth.setToken(storedToken)
      if (!auth.user) void auth.refreshUser()
    })
  }

  // Post-hydration company reconcile. The server seeded the contact's DEFAULT
  // company so the dashboard renders addresses/company on first paint; a
  // multi-company contact may have an explicit selection in localStorage that
  // differs. Re-read it AFTER mount so it can't perturb the hydration render —
  // the server-seeded default matches the first client render, and this only
  // corrects to the user's actual selection for subsequent interaction.
  useCompanyStore().hydrateFromStorage()
})
