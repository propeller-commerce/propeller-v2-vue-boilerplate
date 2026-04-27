<template>
  <!-- Top Info Bar — outside sticky header, scrolls away naturally -->
  <div
    v-if="topBarEnabled"
    data-topbar
    class="relative h-10"
    style="background: #242526"
  >
    <div class="container-width h-full">
      <div class="flex items-center justify-between h-full text-xs font-medium text-white">
        <!-- Left: Phone + Announcement -->
        <div class="flex items-center gap-4">
          <div v-if="topBarPhone" class="flex items-center gap-2">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" :stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <span>{{ topBarPhone }}</span>
          </div>
          <span v-if="topBarAnnouncementEnabled && topBarAnnouncement" class="hidden sm:inline text-white/80">
            {{ topBarAnnouncement }}
          </span>
        </div>

        <!-- Right: Company Switcher + VAT Toggle + Language Switcher -->
        <div class="flex items-center gap-4">
          <!-- Company Switcher — Contact users with multiple companies only -->
          <CompanySwitcher
            v-if="isContactWithMultipleCompanies"
            :graphqlClient="graphqlClient"
            :user="(authStore.user as Contact)"
            :selectedCompanyId="companyStore.companyId ?? undefined"
            :language="languageStore.language"
            :onCompanyChange="handleCompanyChange"
          />

          <PriceToggle
            v-if="showVatToggle"
            :includeTax="priceStore.includeTax"
            :onToggle="(val: boolean) => { priceStore.includeTax = val }"
            :inclExclVatSwitched="(val: boolean) => { priceStore.includeTax = val }"
            :language="languageStore.language"
          />

          <div v-if="showLanguageSwitcher && availableLanguages.length > 1" class="flex items-center gap-1.5 hover:text-white/80 transition-colors cursor-pointer">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" :stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
            <select
              :value="languageStore.language"
              @change="(e) => switchLanguage((e.target as HTMLSelectElement).value)"
              class="bg-transparent border-none focus:ring-0 p-0 text-xs font-medium cursor-pointer"
            >
              <option v-for="lang in availableLanguages" :key="lang" :value="lang">{{ lang }}</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  </div>

  <header ref="headerRef" class="w-full z-50 bg-background shadow-sm sticky top-0">
    <!-- Middle Section (dark bar) -->
    <div style="background-color: #242526">
      <div class="container-width">
        <div class="flex items-center justify-between h-16 sm:h-20 gap-4 sm:gap-8">
          <!-- Mobile hamburger -->
          <button
            type="button"
            class="md:hidden text-white p-2 -ml-2"
            @click="showMobileMenu = !showMobileMenu"
          >
            <svg v-if="showMobileMenu" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
            <MenuIcon v-else class="w-6 h-6 text-white" />
          </button>

          <!-- Logo -->
          <router-link :to="localizeHref('/', languageStore.language)" class="flex-shrink-0 relative h-10 sm:h-12 w-auto">
            <img
              v-if="logoSrc"
              :src="logoSrc"
              :alt="logoAlt"
              class="h-full w-auto object-contain"
            />
            <span v-else class="font-bold text-xl text-white">Propeller</span>
          </router-link>

          <!-- Search Bar (desktop only) -->
          <div v-if="showSearch" class="hidden lg:block flex-1 max-w-2xl">
            <SearchBar
              :graphqlClient="graphqlClient"
              :language="languageStore.language"
              :onSubmit="handleSearch"
              :onViewAllClick="handleSearch"
              :onResultClick="(result) => { if (result.url) router.push(result.url) }"
              :configuration="configuration"
            />
          </div>

          <!-- Right Section -->
          <div class="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            <AccountIconAndMenu
              v-if="showAccount"
              :graphqlClient="graphqlClient"
              :user="authStore.user as Contact | Customer"
              :cart="cartStore.cart as Cart"
              :language="languageStore.language"
              :afterLogin="handleAfterLogin"
              :onMenuItemClick="(href: string) => router.push(href)"
              :onLogoutClick="handleLogout"
              :onForgotPasswordClick="() => router.push(localizeHref('/forgot-password', languageStore.language))"
              :onRegisterClick="() => router.push(localizeHref('/register', languageStore.language))"
              :accountHeaderLoginForm="true"
              :menuLinks="accountMenuLinks"
              iconClassName="text-white hover:text-white hover:bg-white/10"
            />

            <CartIconAndSidebar
              v-if="showCart"
              :graphqlClient="graphqlClient"
              :user="authStore.user as Contact | Customer"
              :cart="cartStore.cart as Cart"
              :language="languageStore.language"
              :includeTax="priceStore.includeTax"
              :companyId="companyStore.companyId || undefined"
              :cartCheckoutButton="true"
              :onCheckoutButtonClick="() => router.push(localizeHref('/checkout', languageStore.language))"
              :onCartPageButtonClick="() => router.push(localizeHref('/cart', languageStore.language))"
              :onRequestQuoteClick="() => router.push(localizeHref('/checkout?mode=quote', languageStore.language))"
              :afterRequestAuthorization="handleAfterRequestAuthorization"
              :onError="(err: Error) => console.error('Authorization request failed:', err)"
              :showTotals="true"
              :configuration="configuration"
              iconClassName="text-white hover:text-white hover:bg-white/10"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Navigation — desktop only -->
    <div class="hidden md:block border-t border-border bg-background h-12">
      <div class="container-width h-full">
        <nav class="flex items-center h-full">
          <!-- Categories Dropdown (hover-triggered) -->
          <div
            v-if="showCategoriesMenu"
            ref="mainMenuRef"
            class="relative h-full"
            @mouseleave="showMainMenu = false"
          >
            <button
              class="h-full flex items-center gap-2 px-4 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors border-l border-r border-transparent hover:border-border"
              @mouseenter="showMainMenu = true"
            >
              <MenuIcon class="w-5 h-5" />
              <span>{{ categoriesMenuLabel }}</span>
            </button>

            <div
              :class="['absolute left-0 top-full z-50', showMainMenu ? 'visible opacity-100' : 'invisible opacity-0 pointer-events-none h-0 overflow-hidden']"
            >
              <PropellerMenu
                :graphqlClient="graphqlClient"
                :categoryId="configuration.baseCategoryId"
                :depth="configuration.menuDepth"
                :language="languageStore.language"
                :onMenuItemClick="handleCategoryClick"
                :configuration="configuration"
                menuStyle="dropdown-vertical"
              />
            </div>
          </div>

          <!-- Horizontal nav links -->
          <div :class="['flex items-center gap-6 text-sm font-medium text-muted-foreground', showCategoriesMenu ? 'ml-6' : 'ml-0']">
            <router-link
              v-for="link in navLinks"
              :key="link.url"
              :to="localizeHref(link.url, languageStore.language)"
              :class="['hover:text-foreground transition-colors', link.highlight ? 'text-destructive' : '']"
            >
              {{ link.label }}
            </router-link>
          </div>
        </nav>
      </div>
    </div>

    <!-- Mobile slide-down menu -->
    <div v-if="showMobileMenu" class="md:hidden bg-background border-t border-border overflow-y-auto max-h-[calc(100vh-64px)]">
      <!-- Mobile search -->
      <div v-if="showSearch" class="p-4 border-b border-border">
        <SearchBar
          :graphqlClient="graphqlClient"
          :language="languageStore.language"
          :onSubmit="(term: string) => { showMobileMenu = false; handleSearch(term) }"
          :onViewAllClick="(term: string) => { showMobileMenu = false; handleSearch(term) }"
          :onResultClick="(result) => { showMobileMenu = false; if (result.url) router.push(result.url) }"
          :configuration="configuration"
        />
      </div>

      <!-- Mobile categories -->
      <PropellerMenu
        v-if="showCategoriesMenu"
        :graphqlClient="graphqlClient"
        :categoryId="configuration.baseCategoryId"
        :depth="configuration.menuDepth"
        :language="languageStore.language"
        :onMenuItemClick="handleCategoryClick"
        :configuration="configuration"
        menuStyle="dropdown-vertical"
      />

      <!-- Mobile nav links -->
      <div class="border-t border-border divide-y divide-border">
        <router-link
          v-for="link in navLinks"
          :key="link.url"
          :to="localizeHref(link.url, languageStore.language)"
          :class="['block px-4 py-3 text-sm font-medium text-foreground', link.highlight ? 'text-destructive' : '']"
          @click="showMobileMenu = false"
        >
          {{ link.label }}
        </router-link>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Menu as MenuIcon } from 'lucide-vue-next'
import { CartService, Enums } from 'propeller-sdk-v2'
import type { Cart, Category, Company, Contact, Customer } from 'propeller-sdk-v2'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { useCompanyStore } from '@/stores/company'
import { usePriceStore } from '@/stores/price'
import { useLanguageStore } from '@/stores/language'
import { graphqlClient } from '@/lib/api'
import { useCart } from '@/composables/useCart'
import type { AnyUser } from '@/composables/shared/utils/userIdentity'
import { configuration, localizeHref, stripLanguagePrefix } from '@/lib/config'
import { stripLeadingUnderscores } from '@/composables/shared/utils/userUtils'
import { mergeAnonymousCart } from '@/composables/shared/utils/mergeAnonymousCart'

import SearchBar from '@/components/propeller/SearchBar.vue'
import PropellerMenu from '@/components/propeller/Menu.vue'
import PriceToggle from '@/components/propeller/PriceToggle.vue'
import CartIconAndSidebar from '@/components/propeller/CartIconAndSidebar.vue'
import AccountIconAndMenu from '@/components/propeller/AccountIconAndMenu.vue'
import CompanySwitcher from '@/components/propeller/CompanySwitcher.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const cartStore = useCartStore()
const companyStore = useCompanyStore()
const priceStore = usePriceStore()
const languageStore = useLanguageStore()

const { fetchActiveCart, resolveCart } = useCart({
  graphqlClient,
  user: computed(() => authStore.user as AnyUser),
  companyId: computed(() => companyStore.selectedCompany?.companyId ?? undefined),
  language: computed(() => languageStore.language),
  configuration,
})

const headerRef = ref<HTMLElement | null>(null)
const mainMenuRef = ref<HTMLDivElement | null>(null)
const showMainMenu = ref(false)
const showMobileMenu = ref(false)

// CMS settings — replace with a global store when CMS integration is added
const topBarEnabled = ref(true)
const topBarPhone = import.meta.env.VITE_TOP_BAR_PHONE || ''
const topBarAnnouncement = import.meta.env.VITE_TOP_BAR_ANNOUNCEMENT || ''
const topBarAnnouncementEnabled = !!topBarAnnouncement
const showVatToggle = ref(true)
const showLanguageSwitcher = ref(true)
const availableLanguages = ref(['EN', 'NL'])
const showSearch = ref(true)
const showAccount = ref(true)
const showCart = ref(true)
const showCategoriesMenu = ref(true)
const categoriesMenuLabel = ref('Browse Categories')
const navLinks = ref([
  { label: 'New Arrivals', url: '/new-arrivals', highlight: false },
  { label: 'Best Sellers', url: '/best-sellers', highlight: false },
  { label: 'Sale', url: '/sale', highlight: true },
])

// Logo: env var or fallback
const logoSrc = import.meta.env.VITE_LOGO_URL || '/propeller_logo.webp'
const logoAlt = import.meta.env.VITE_LOGO_ALT || import.meta.env.VITE_SITE_NAME || 'Logo'

const isContactWithMultipleCompanies = computed(() => {
  const user = authStore.user
  return !!(
    user &&
    'contactId' in user &&
    (user as Contact).companies &&
    ((user as Contact).companies!.items?.length || 0) > 1
  )
})

const isAuthManagerForCurrentCompany = computed(() => {
  const user = authStore.user
  const companyId = companyStore.companyId
  if (!user || !companyId || !('contactId' in user)) return false
  const pacData = (user as any).purchaseAuthorizationConfigs
  const items: any[] = pacData?.items ?? pacData?._items ?? []
  return items.some((pac: any) => {
    const role = pac.purchaseRole ?? pac._purchaseRole
    const pacCompanyId =
      pac.company?.companyId ?? pac.company?._companyId ??
      pac._company?.companyId ?? pac._company?._companyId
    return role === Enums.PurchaseRole.AUTHORIZATION_MANAGER && pacCompanyId === companyId
  })
})

const accountMenuLinks = computed(() => {
  const lang = languageStore.language
  const links = [
    { label: 'Dashboard', href: localizeHref('/account', lang) },
    { label: 'Addresses', href: localizeHref('/account/addresses', lang) },
    { label: 'Orders', href: localizeHref('/account/orders', lang) },
    { label: 'Quotes', href: localizeHref('/account/quotes', lang) },
    { label: 'Quote requests', href: localizeHref('/account/quote-requests', lang) },
    { label: 'Favorites', href: localizeHref('/account/favorites', lang) },
  ]
  if (isAuthManagerForCurrentCompany.value) {
    links.push(
      { label: 'Authorization settings', href: localizeHref('/account/authorization-settings', lang) },
      { label: 'Authorization requests', href: localizeHref('/account/authorization-requests', lang) },
    )
  }
  return links
})

async function handleAfterLogin(
  user: Contact | Customer,
  accessToken?: string,
  refreshToken?: string,
  expiresAt?: string,
  anonymousCart?: Cart | null
) {
  const cleanUser = stripLeadingUnderscores(user) as Contact | Customer
  authStore.setUser(cleanUser)
  if (accessToken) {
    authStore.setToken(accessToken)
    localStorage.setItem('accessToken', accessToken)
  }
  if (refreshToken) localStorage.setItem('refreshToken', refreshToken)
  if (expiresAt) localStorage.setItem('expiresAt', expiresAt)

  window.dispatchEvent(new CustomEvent('userLoggedIn'))

  const contactCompany = (cleanUser as Contact).company
  if (contactCompany?.companyId) {
    companyStore.setSelectedCompany(contactCompany)
  }

  const userLang = (cleanUser as any).primaryLanguage
  if (userLang && userLang !== languageStore.language) {
    languageStore.setLanguage(userLang)
  }

  let targetCart = await fetchActiveCart()

  if (anonymousCart?.items?.length) {
    if (!targetCart) {
      targetCart = await resolveCart()
    }
    await mergeAnonymousCart({
      graphqlClient,
      targetCartId: targetCart.cartId,
      anonymousCart,
      language: languageStore.language,
      imageSearchFilters: configuration.imageSearchFiltersGrid,
      imageVariantFilters: configuration.imageVariantFiltersSmall,
    })

    if (anonymousCart.cartId && anonymousCart.cartId !== targetCart.cartId) {
      try {
        await new CartService(graphqlClient).deleteCart({ id: anonymousCart.cartId })
      } catch (e) {
        console.error('[auth] Failed to delete anonymous cart', e)
      }
    }

    targetCart = await fetchActiveCart()
  }

  cartStore.setCart(targetCart ?? null)

  router.push(localizeHref('/account', userLang || languageStore.language))
}

async function handleCompanyChange(company: Company) {
  companyStore.setSelectedCompany(company)
  if (authStore.user) {
    const newCart = await fetchActiveCart()
    cartStore.setCart(newCart ?? null)
  }
}

function handleAfterRequestAuthorization(cart: Cart) {
  cartStore.setCart(null)
  router.push(localizeHref(`/authorization-request-sent/${cart.cartId}`, languageStore.language))
}

function handleSearch(term: string) {
  router.push(localizeHref(term ? `/search/${encodeURIComponent(term)}` : '/search/', languageStore.language))
}

function switchLanguage(lang: string) {
  // Update the store first so the next navigation has the right language for
  // any URL builders called during render. The router guard would also do this
  // post-navigation, but updating now avoids a one-frame mismatch.
  languageStore.setLanguage(lang)
  // Compute "the same page in the new language" by stripping any existing prefix
  // off the current path, then re-applying via localizeHref. Preserve query/hash.
  const canonical = stripLanguagePrefix(route.path)
  const target = localizeHref(canonical, lang)
  router.push({ path: target, query: route.query, hash: route.hash })
}

function handleCategoryClick(category: Category) {
  showMainMenu.value = false
  showMobileMenu.value = false
  router.push(configuration.urls.getCategoryUrl(category, languageStore.language))
}

function handleLogout() {
  authStore.logout()
  cartStore.setCart(null)
  router.push('/')
}

onMounted(() => {
  if (localStorage.getItem('price_include_tax') === null) {
    priceStore.setIncludeTax(import.meta.env.VITE_INCLUDE_VAT === 'true')
  }
})

onUnmounted(() => {
  // cleanup if needed
})
</script>
