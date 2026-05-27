/**
 * Universal app factory — shared by the client and server entries.
 *
 * SSR requires a *fresh* app, router and Pinia per request: a singleton would
 * leak one user's auth/cart/navigation state into the next request's render.
 * So this exports a factory, never a mounted instance.
 *
 * `createSSRApp` (not `createApp`) is mandatory — it produces markup the
 * client can hydrate. The client entry calls this then `app.mount('#app')`;
 * the server entry calls this then `renderToString(app)`.
 */
import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import { createHead } from '@unhead/vue/client'
import { createHead as createServerHead } from '@unhead/vue/server'
import type { RouterHistory } from 'vue-router'
import App from './App.vue'
import { createAppRouter } from './router'
import { propellerVue } from 'propeller-v2-vue-ui'
import { graphqlClient, services } from './lib/api'
import { configuration } from './lib/config'

export function createApp(history?: RouterHistory) {
  const app = createSSRApp(App)

  const pinia = createPinia()
  app.use(pinia)

  const router = createAppRouter(history)
  app.use(router)

  // Tier 1 — install app-wide infrastructure (GraphQL client + SDK services
  // bundle + branding). Per-scope state (user / companyId / language /
  // includeTax / portalMode) is bound by <PropellerProvider> in App.vue.
  app.use(propellerVue, {
    graphqlClient,
    services,
    currency: '€',
    configuration,
  })

  // Unhead manages <head> tags for SSR + hydration. The server build collects
  // rendered tags into the HTML template; the client build takes them over.
  const head = import.meta.env.SSR ? createServerHead() : createHead()
  app.use(head)

  return { app, router, pinia, head }
}
