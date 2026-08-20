import {
  createRouter,
  createWebHistory,
  createMemoryHistory,
  type Router,
  type RouterHistory,
} from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useLanguageStore } from '@/stores/language'
import { DEFAULT_LANGUAGE, PREFIXED_LANGUAGES, localizeHref } from '@/lib/config'

// Regex segment of all non-default supported languages, lowercased.
// Update this list when adding languages — keep in sync with SUPPORTED_LANGUAGES in @/lib/config.
const langSegmentRegex = PREFIXED_LANGUAGES.map((l) => l.toLowerCase()).join('|')

/**
 * Build a fresh router. Each SSR request gets its own instance (sharing one
 * across requests would leak navigation state between users), so this is a
 * factory rather than a singleton.
 *
 * History is runtime-injected: the client passes `createWebHistory` (real URL
 * bar + browser history), the server passes `createMemoryHistory` (no DOM).
 * When `history` is omitted the factory picks the right one for the runtime.
 */
export function createAppRouter(history?: RouterHistory): Router {
  const router = createRouter({
    history:
      history ??
      (import.meta.env.SSR
        ? createMemoryHistory()
        : createWebHistory(import.meta.env.BASE_URL)),
    scrollBehavior: () => ({ top: 0 }),
    routes: buildRoutes(),
  })
  registerGuards(router)
  return router
}

function buildRoutes() {
  return [
    {
      // The bare language prefix (`/en`) needs its own record with a REQUIRED
      // `:lang` param. In the optional-prefix tree below, vue-router ranks the
      // CMS catch-all (`/:lang?/:slug+`, two segments) above the home child
      // (`/:lang?`, one segment), so `/en` matched cms-page with slug=['en'] —
      // a 404 shell, and the `beforeEach` guard below then read lang='' and
      // reset the store to the default language. Net effect: the language
      // switcher looked dead from the homepage (PWP-915). A required param
      // outranks the optional one, so this record wins for `/en` while
      // `/en/<slug>` still falls through to the catch-all.
      path: `/:lang(${langSegmentRegex})`,
      component: () => import('@/components/layout/AppLayout.vue'),
      children: [
        { path: '', name: 'home-localized', meta: { ssrKey: 'home' }, component: () => import('@/views/HomeView.vue') },
      ],
    },
    {
      // Optional language prefix. Default-language URLs (NL) stay unprefixed;
      // /en/... routes match this with params.lang = 'en'.
      path: `/:lang(${langSegmentRegex})?`,
      component: () => import('@/components/layout/AppLayout.vue'),
      children: [
        { path: '', name: 'home', meta: { ssrKey: 'home' }, component: () => import('@/views/HomeView.vue') },
        { path: 'login', name: 'login', component: () => import('@/views/LoginView.vue') },
        { path: 'register', name: 'register', component: () => import('@/views/RegisterView.vue') },
        { path: 'forgot-password', name: 'forgot-password', component: () => import('@/views/ForgotPasswordView.vue') },
        // Magic-token login (passwordless / punchout handoff) — anonymous entry, NOT requiresAuth.
        { path: 'magic-login', name: 'magic-login', component: () => import('@/views/MagicLoginView.vue') },
        { path: 'terms-conditions', name: 'terms', component: () => import('@/views/TermsView.vue') },

        // Product — hybrid SSR (meta.ssrKey selects the server prefetch loader,
        // resolved in entry-server.ts so the loader never enters the client bundle).
        { path: 'product/:productId/:slug', name: 'product', meta: { ssrKey: 'product' }, component: () => import('@/views/ProductDetailView.vue') },

        // Category & Search — hybrid SSR
        { path: 'category/:id/:slug', name: 'category', meta: { ssrKey: 'category' }, component: () => import('@/views/CategoryView.vue') },
        { path: 'search/:term*', name: 'search', meta: { ssrKey: 'search' }, component: () => import('@/views/SearchView.vue') },

        // Cluster — hybrid SSR
        { path: 'cluster/:clusterId/:slug', name: 'cluster', meta: { ssrKey: 'cluster' }, component: () => import('@/views/ClusterView.vue') },

        // Machines / spare parts (contact-only) — CSR; `:slug*` matches the root
        // (/machines) AND any drill-down (/machines/a/b/…). Guarded by requiresAuth.
        { path: 'machines/:slug*', name: 'machines', meta: { requiresAuth: true }, component: () => import('@/views/MachinesView.vue') },

        // Quick order (bulk SKU/qty add-to-cart + XLSX upload) — CSR, login-only.
        // The router's requiresAuth guard redirects direct/anonymous access to
        // /login; logging out while here navigates to '/' via AppHeader's logout.
        { path: 'quick-order', name: 'quick-order', meta: { requiresAuth: true }, component: () => import('@/views/QuickOrderView.vue') },

        // ──────────────────────────────────────────────────────────────────
        // Legacy CSR shadow routes — pre-SSR copies of the four catalog
        // pages, kept verbatim for side-by-side comparison with the canonical
        // hybrid-SSR routes above. Mirrors `propeller-next/app/csr/*`.
        // No `meta.ssrKey` → entry-server.ts runs no prefetch loader, and the
        // view fetches everything on mount as it did before SSR landed.
        // Do not add features here — change the SSR view.
        // ──────────────────────────────────────────────────────────────────
        { path: 'csr/category/:id/:slug', name: 'csr-category', component: () => import('@/views/csr/CategoryView.vue') },
        { path: 'csr/product/:productId/:slug', name: 'csr-product', component: () => import('@/views/csr/ProductDetailView.vue') },
        { path: 'csr/search/:term*', name: 'csr-search', component: () => import('@/views/csr/SearchView.vue') },
        { path: 'csr/cluster/:clusterId/:slug', name: 'csr-cluster', component: () => import('@/views/csr/ClusterView.vue') },

        // Cart
        { path: 'cart', name: 'cart', component: () => import('@/views/CartView.vue') },

        // Checkout
        {
          path: 'checkout',
          children: [
            { path: '', name: 'checkout', component: () => import('@/views/checkout/CheckoutView.vue') },
            { path: 'thank-you/:orderId', name: 'order-confirmation', component: () => import('@/views/checkout/OrderConfirmationView.vue') },
          ],
        },

        // Authorization Request
        { path: 'authorization-request-sent/:cartId', name: 'authorization-request-sent', component: () => import('@/views/AuthorizationRequestSentView.vue') },

        // Blog
        { path: 'blog', name: 'blog', meta: { ssrKey: 'blog' }, component: () => import('@/views/blog/BlogView.vue') },
        { path: 'blog/:slug', name: 'blog-post', meta: { ssrKey: 'blog-post' }, component: () => import('@/views/blog/BlogPostView.vue') },

        // Account (protected)
        {
          path: 'account',
          component: () => import('@/components/layout/AccountLayout.vue'),
          meta: { requiresAuth: true },
          children: [
            { path: '', name: 'account', component: () => import('@/views/account/AccountView.vue') },
            { path: 'addresses', name: 'account-addresses', component: () => import('@/views/account/AddressesView.vue') },
            { path: 'orders', name: 'account-orders', component: () => import('@/views/account/OrdersView.vue') },
            { path: 'orders/:id', name: 'account-order-detail', component: () => import('@/views/account/OrderDetailView.vue') },
            { path: 'quotes', name: 'account-quotes', component: () => import('@/views/account/QuotesView.vue') },
            { path: 'quotes/:id', name: 'account-quote-detail', component: () => import('@/views/account/QuoteDetailView.vue') },
            { path: 'quote-requests', name: 'account-quote-requests', component: () => import('@/views/account/QuoteRequestsView.vue') },
            { path: 'quote-requests/:id', name: 'account-quote-request-detail', component: () => import('@/views/account/QuoteDetailView.vue') },
            { path: 'favorites', name: 'account-favorites', component: () => import('@/views/account/FavoritesView.vue') },
            { path: 'favorites/:id', name: 'account-favorite-detail', component: () => import('@/views/account/FavoriteDetailView.vue') },
            { path: 'authorization-requests', name: 'account-authorization-requests', component: () => import('@/views/account/AuthorizationRequestsView.vue') },
            { path: 'authorization-settings', name: 'account-authorization-settings', component: () => import('@/views/account/AuthorizationSettingsView.vue') },
          ],
        },

        // CMS catch-all (must be last child so it doesn't shadow named routes).
        // Lives inside the :lang group, so /en/<slug> also resolves to a CMS page.
        { path: ':slug+', name: 'cms-page', meta: { ssrKey: 'cms' }, component: () => import('@/views/CmsPageView.vue') },
      ],
    },

    // Localized home — `/en` and nothing else. It needs its own record because
    // the group above resolves the home child to the bare `/:lang(...)?`
    // pattern, which vue-router ranks BELOW the `:slug+` CMS catch-all: `/en`
    // matched cms-page with slug=['en'] and no `lang` param, so the guard below
    // reset the language to the default and the page 404'd in Dutch. Every
    // deeper path (`/en/cart`) was unaffected — only the bare prefix lost.
    // A required (non-optional) `:lang` param outranks the catch-all and keeps
    // `params.lang`, which is what the guard reads. Its own name avoids the
    // duplicate-name warning; nothing navigates to 'home' by name.
    {
      path: `/:lang(${langSegmentRegex})`,
      component: () => import('@/components/layout/AppLayout.vue'),
      children: [
        { path: '', name: 'home-localized', meta: { ssrKey: 'home' }, component: () => import('@/views/HomeView.vue') },
      ],
    },
  ]
}

/**
 * Register the navigation guards on a router instance. Called by the factory
 * for every per-request router, so the guards close over that request's own
 * Pinia stores (via the active pinia, set up in `createApp`).
 */
function registerGuards(router: Router): void {
  router.beforeEach((to) => {
    // Sync the language store with the URL's :lang param. When the user deep-links
    // to /en/cart, the store flips to EN before the component mounts so GraphQL
    // queries fire in the right language — on the server this makes the render
    // itself language-correct.
    // Only a PREFIXED url is an explicit choice. An unprefixed path is the
    // default for that request, not a preference — syncing from it reset the
    // stored language on every navigation.
    const language = useLanguageStore()
    const urlLang = (to.params.lang as string | undefined)?.toUpperCase()
    if (urlLang && language.language !== urlLang) {
      language.setLanguage(urlLang)
    }

    // Auth gate for protected routes — preserves the original redirect behavior
    // and prefixes the redirect target so /en/account doesn't lose the language.
    if (to.meta.requiresAuth) {
      const auth = useAuthStore()
      if (!auth.isAuthenticated) {
        return {
          // The URL's own prefix wins over the store: a guard that redirected
          // to the stored language would drop a visitor who deep-linked to
          // /en/account onto the default-language login. `targetLang` was never
          // declared here — a latent ReferenceError on the first guarded route.
          path: localizeHref('/login', urlLang ?? language.language),
          query: { redirect: to.fullPath },
        }
      }
    }
  })
}
