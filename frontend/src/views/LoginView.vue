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
import { useRouter, useRoute } from 'vue-router'
import type { Cart, Contact, Customer } from '@propeller-commerce/propeller-sdk-v2'
import { useCartStore } from '@/stores/cart'
import { useLanguageStore } from '@/stores/language'
import { localizeHref } from '@/lib/config'
import { LoginForm } from '@propeller-commerce/propeller-v2-vue-ui';
import { useTranslations } from '@/lib/i18n/composable';
import { useAfterLogin } from '@/composables/useAfterLogin'

const router = useRouter()
const route = useRoute()
const loginFormLabels = useTranslations('LoginForm')
const cartStore = useCartStore()
const languageStore = useLanguageStore()
// Shared post-login sequence, reused by MagicLoginView. See composables/useAfterLogin.
const runAfterLogin = useAfterLogin()

async function handleLoginSuccess(
  user: Contact | Customer,
  accessToken?: string,
  refreshToken?: string,
  expiresAt?: string,
  anonymousCart?: Cart | null,
) {
  const { effectiveLanguage } = await runAfterLogin(user, accessToken, refreshToken, expiresAt, anonymousCart)
  const redirect = (route.query.redirect as string) || localizeHref('/account', effectiveLanguage)
  router.push(redirect)
}
</script>
