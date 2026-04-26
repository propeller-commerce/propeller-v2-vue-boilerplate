import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useLanguageStore } from '@/stores/language'
import { DEFAULT_LANGUAGE, PREFIXED_LANGUAGES, localizeHref } from '@/lib/config'

// Regex segment of all non-default supported languages, lowercased.
// Update this list when adding languages — keep in sync with SUPPORTED_LANGUAGES in @/lib/config.
const langSegmentRegex = PREFIXED_LANGUAGES.map((l) => l.toLowerCase()).join('|')

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    {
      // Optional language prefix. Default-language URLs (NL) stay unprefixed;
      // /en/... routes match this with params.lang = 'en'.
      path: `/:lang(${langSegmentRegex})?`,
      component: () => import('@/components/layout/AppLayout.vue'),
      children: [
        { path: '', name: 'home', component: () => import('@/views/HomeView.vue') },
        { path: 'login', name: 'login', component: () => import('@/views/LoginView.vue') },
        { path: 'register', name: 'register', component: () => import('@/views/RegisterView.vue') },
        { path: 'forgot-password', name: 'forgot-password', component: () => import('@/views/ForgotPasswordView.vue') },
        { path: 'terms-conditions', name: 'terms', component: () => import('@/views/TermsView.vue') },

        // Product
        { path: 'product/:productId/:slug', name: 'product', component: () => import('@/views/ProductDetailView.vue') },

        // Category & Search
        { path: 'category/:id/:slug', name: 'category', component: () => import('@/views/CategoryView.vue') },
        { path: 'search/:term*', name: 'search', component: () => import('@/views/SearchView.vue') },

        // Cluster
        { path: 'cluster/:clusterId/:slug', name: 'cluster', component: () => import('@/views/ClusterView.vue') },

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
        { path: 'blog', name: 'blog', component: () => import('@/views/blog/BlogView.vue') },
        { path: 'blog/:slug', name: 'blog-post', component: () => import('@/views/blog/BlogPostView.vue') },

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
            { path: 'invoices', name: 'account-invoices', component: () => import('@/views/account/InvoicesView.vue') },
            { path: 'price-requests', name: 'account-price-requests', component: () => import('@/views/account/PriceRequestsView.vue') },
            { path: 'authorization-requests', name: 'account-authorization-requests', component: () => import('@/views/account/AuthorizationRequestsView.vue') },
            { path: 'authorization-settings', name: 'account-authorization-settings', component: () => import('@/views/account/AuthorizationSettingsView.vue') },
          ],
        },

        // CMS catch-all (must be last child so it doesn't shadow named routes).
        // Lives inside the :lang group, so /en/<slug> also resolves to a CMS page.
        { path: ':slug+', name: 'cms-page', component: () => import('@/views/CmsPageView.vue') },
      ],
    },
  ],
})

router.beforeEach((to) => {
  // Sync the language store with the URL's :lang param. When the user deep-links
  // to /en/cart, the store flips to EN before the component mounts so GraphQL
  // queries fire in the right language.
  const language = useLanguageStore()
  const urlLang = (to.params.lang as string | undefined)?.toUpperCase()
  const targetLang = urlLang || DEFAULT_LANGUAGE
  if (language.language !== targetLang) {
    language.setLanguage(targetLang)
  }

  // Auth gate for protected routes — preserves the original redirect behavior
  // and prefixes the redirect target so /en/account doesn't lose the language.
  if (to.meta.requiresAuth) {
    const auth = useAuthStore()
    if (!auth.isAuthenticated) {
      return {
        path: localizeHref('/login', targetLang),
        query: { redirect: to.fullPath },
      }
    }
  }
})

export default router
