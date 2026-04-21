<template>
  <div class="min-h-[70vh] flex items-center justify-center py-12 px-4">
    <div class="w-full max-w-md">
      <LoginForm
        :graphqlClient="graphqlClient"
        :afterLogin="(user: any, accessToken: any, refreshToken: any, expiresAt: any) => handleLoginSuccess(user, accessToken, refreshToken, expiresAt)"
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
import type { Contact, Customer } from 'propeller-sdk-v2'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { useCompanyStore } from '@/stores/company'
import { useLanguageStore } from '@/stores/language'
import { graphqlClient } from '@/lib/api'
import { configuration, localizeHref } from '@/lib/config'
import { stripLeadingUnderscores } from '@/shared/utils/userUtils'
import { useCart } from '@/composables/useCart'
import type { AnyUser } from '@/shared/utils/userIdentity'
import LoginForm from '@/components/propeller/LoginForm.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const cartStore = useCartStore()
const companyStore = useCompanyStore()
const languageStore = useLanguageStore()

const { fetchActiveCart } = useCart({
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

  const cart = await fetchActiveCart()
  if (cart) cartStore.setCart(cart)
  else cartStore.setCart(null)

  const redirect = (route.query.redirect as string) || localizeHref('/account', userLang || languageStore.language)
  router.push(redirect)
}
</script>
