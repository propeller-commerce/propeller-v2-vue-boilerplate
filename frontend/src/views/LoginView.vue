<template>
  <div class="min-h-[70vh] flex items-center justify-center py-12 px-4">
    <div class="w-full max-w-md">
      <LoginForm
        :labels="loginFormLabels"
        :cart="cartStore.cart as Cart | null"
        :afterLogin="(user: any, accessToken: any, refreshToken: any, expiresAt: any, anonymousCart: any) => handleLoginSuccess(user, accessToken, refreshToken, expiresAt, anonymousCart)"
        :onForgotPasswordClick="() => router.push(localizeHref('/forgot-password', languageStore.language))"
        :onRegisterClick="() => router.push(localizeHref('/register', languageStore.language))"
        :accountHeaderLoginForm="false"
        :displayGuestCheckoutLink="false"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { CartService } from '@propeller-commerce/propeller-sdk-v2'
import type { Cart, Contact, Customer } from '@propeller-commerce/propeller-sdk-v2'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { useCompanyStore } from '@/stores/company'
import { useLanguageStore } from '@/stores/language'
import { graphqlClient } from '@/lib/api'
import { configuration, localizeHref } from '@/lib/config'
import { mergeAnonymousCart } from '@propeller-commerce/propeller-v2-vue-ui'
import { useCart } from '@propeller-commerce/propeller-v2-vue-ui'
import type { AnyUser } from '@propeller-commerce/propeller-v2-vue-ui'
import { LoginForm } from '@propeller-commerce/propeller-v2-vue-ui';
import { useTranslations } from '@/lib/i18n/composable';

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const loginFormLabels = useTranslations('LoginForm')
const cartStore = useCartStore()
const companyStore = useCompanyStore()
const languageStore = useLanguageStore()

const { fetchActiveCart, resolveCart } = useCart({
  graphqlClient,
  user: computed(() => authStore.user as AnyUser),
  companyId: computed(() => companyStore.selectedCompany?.companyId ?? undefined),
  language: computed(() => languageStore.language),
  configuration,
})

async function handleLoginSuccess(
  user: Contact | Customer,
  accessToken?: string,
  refreshToken?: string,
  expiresAt?: string,
  anonymousCart?: Cart | null,
) {
  const cleanUser = user
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
    const merged = await mergeAnonymousCart({
      graphqlClient,
      targetCartId: targetCart.cartId,
      anonymousCart,
      language: languageStore.language,
      imageSearchFilters: configuration.imageSearchFiltersGrid,
      imageVariantFilters: configuration.imageVariantFiltersSmall,
    })
    if (merged) targetCart = merged

    if (anonymousCart.cartId && anonymousCart.cartId !== targetCart.cartId) {
      try {
        await new CartService(graphqlClient).deleteCart({ id: anonymousCart.cartId })
      } catch (e) {
        console.error('[auth] Failed to delete anonymous cart', e)
      }
    }
  }

  cartStore.setCart(targetCart ?? null)

  const redirect = (route.query.redirect as string) || localizeHref('/account', userLang || languageStore.language)
  router.push(redirect)
}
</script>
