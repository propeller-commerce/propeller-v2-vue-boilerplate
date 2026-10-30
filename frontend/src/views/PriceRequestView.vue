<template>
  <div class="py-8 bg-background">
    <div class="container-width max-w-5xl">
      <p
        v-if="sendError"
        role="alert"
        class="mb-4 rounded border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
      >
        {{ sendError }}
      </p>
      <div class="bg-card rounded-[var(--radius-container)] shadow-sm p-6">
        <PriceRequestList
          :items="priceRequest.items.value"
          :submitting="priceRequest.submitting.value"
          :labels="t"
          :onRemove="priceRequest.remove"
          :onQuantityChange="priceRequest.setQuantity"
          :onSubmit="handleSubmit"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Price-request route — the quote basket for products whose price is not
 * published.
 *
 * Deliberately separate from the cart: a quoted product has no price to total
 * and cannot be paid for, so it must never reach checkout. Login-only via the
 * router's requiresAuth guard, because a quote is addressed to someone.
 */
import { onMounted, ref } from 'vue'
import { PriceRequestList, usePriceRequest, type PriceRequestSubmitExtras } from '@propeller-commerce/propeller-v2-vue-ui'
import { useAuthStore } from '@/stores/auth'
import { useLanguageStore } from '@/stores/language'
import { useTranslations } from '@/lib/i18n/composable'
import { useHead } from '@unhead/vue'
import { getRecaptchaToken, loadRecaptcha } from '@/lib/recaptcha'

const pageTitles = useTranslations('PageTitles')
useHead({ title: () => pageTitles.value.priceRequest })

const t = useTranslations('PriceRequest')
const authStore = useAuthStore()
const languageStore = useLanguageStore()
let lastErrorCode = ''

onMounted(() => {
  void loadRecaptcha()
})

const priceRequest = usePriceRequest({
  onSubmit: async (items, comment, extras?: PriceRequestSubmitExtras) => {
    const user = authStore.user as {
      email?: string
      firstName?: string
      lastName?: string
      companyName?: string
      phone?: string
    } | null
    lastErrorCode = ''
    const recaptchaToken = await getRecaptchaToken('price_request')
    const res = await fetch('/api/price-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items,
        comment,
        language: languageStore.language,
        email: user?.email ?? '',
        name: [user?.firstName, user?.lastName].filter(Boolean).join(' '),
        company: user?.companyName ?? '',
        phone: user?.phone ?? '',
        recaptchaToken,
        website: extras?.website ?? '',
      }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      lastErrorCode = res.status === 429 ? 'rate_limited' : body?.error || 'failed'
      throw new Error(lastErrorCode)
    }
  },
})

const sendError = ref('')

async function handleSubmit(comment: string, extras?: PriceRequestSubmitExtras): Promise<boolean> {
  sendError.value = ''
  const ok = await priceRequest.submit(comment, extras)
  if (ok) return ok
  if (lastErrorCode === 'rate_limited') {
    sendError.value =
      t.value.rateLimited || 'Too many attempts. Please wait a few minutes and try again.'
  } else if (lastErrorCode === 'captcha_failed' || lastErrorCode === 'captcha_unavailable') {
    sendError.value =
      t.value.captchaFailed || 'We could not verify that you are human. Please try again.'
  } else {
    sendError.value = t.value.sendFailed || 'Could not send the request'
  }
  return ok
}
</script>
