<template>
  <!-- No split layout: single centered column -->
  <section v-if="!hasSplitLayout" class="py-16">
    <div class="container-width max-w-2xl mx-auto">
      <h2 v-if="block.title" class="text-3xl font-bold tracking-tight mb-4">
        {{ block.title }}
      </h2>
      <p v-if="block.description" class="text-muted-foreground mb-8">
        {{ block.description }}
      </p>

      <div v-if="submitted" class="bg-green-50 border border-green-200 rounded-lg p-8">
        <p class="text-green-800 text-lg font-medium">{{ block.successMessage }}</p>
      </div>
      <div v-else class="bg-card rounded-xl border border-border p-6">
        <h3 v-if="block.formTitle" class="text-xl font-semibold mb-4">{{ block.formTitle }}</h3>
        <form class="space-y-4" @submit.prevent="handleSubmit">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="space-y-2">
              <label for="contact-name-a" class="text-sm font-medium">{{ t.name }}</label>
              <input id="contact-name-a" v-model="name" name="name" required :placeholder="t.namePlaceholder" :class="inputClass" />
            </div>
            <div class="space-y-2">
              <label for="contact-email-a" class="text-sm font-medium">{{ t.email }}</label>
              <input id="contact-email-a" v-model="email" name="email" type="email" required :placeholder="t.emailPlaceholder" :class="inputClass" />
            </div>
          </div>
          <div class="space-y-2">
            <label for="contact-message-a" class="text-sm font-medium">{{ t.message }}</label>
            <textarea id="contact-message-a" v-model="message" name="message" required rows="4" :placeholder="t.messagePlaceholder" :class="inputClass" />
          </div>
          <div aria-hidden="true" :style="honeypotStyle">
            <label for="contact-website-a">Website</label>
            <input id="contact-website-a" v-model="website" name="website" type="text" tabindex="-1" autocomplete="off" />
          </div>
          <p v-if="failed" role="alert" class="text-sm text-destructive">{{ errorLabel }}</p>
          <button type="submit" :disabled="loading" :class="buttonClass">
            {{ loading ? (t.sending || t.send) : t.send }}
          </button>
        </form>
      </div>
    </div>
  </section>

  <!-- Split layout: contact details + form -->
  <section v-else class="py-16 lg:py-20 bg-primary/5">
    <div class="container-width">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        <div class="space-y-6">
          <h2 v-if="block.title" class="text-3xl font-bold tracking-tight">{{ block.title }}</h2>
          <p v-if="block.description" class="text-muted-foreground text-lg">{{ block.description }}</p>
          <div class="space-y-4 pt-4">
            <div v-if="block.phone" class="flex items-center gap-3">
              <div class="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <a :href="`tel:${block.phone}`" class="text-foreground font-medium hover:text-primary transition-colors">{{ block.phone }}</a>
            </div>
            <div v-if="block.email" class="flex items-center gap-3">
              <div class="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <a :href="`mailto:${block.email}`" class="text-foreground font-medium hover:text-primary transition-colors">{{ block.email }}</a>
            </div>
          </div>
        </div>
        <div>
          <div v-if="submitted" class="bg-green-50 border border-green-200 rounded-lg p-8">
            <p class="text-green-800 text-lg font-medium">{{ block.successMessage }}</p>
          </div>
          <div v-else class="bg-card rounded-xl border border-border p-6">
            <h3 v-if="block.formTitle" class="text-xl font-semibold mb-4">{{ block.formTitle }}</h3>
            <form class="space-y-4" @submit.prevent="handleSubmit">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="space-y-2">
                  <label for="contact-name-b" class="text-sm font-medium">{{ t.name }}</label>
                  <input id="contact-name-b" v-model="name" name="name" required :placeholder="t.namePlaceholder" :class="inputClass" />
                </div>
                <div class="space-y-2">
                  <label for="contact-email-b" class="text-sm font-medium">{{ t.email }}</label>
                  <input id="contact-email-b" v-model="email" name="email" type="email" required :placeholder="t.emailPlaceholder" :class="inputClass" />
                </div>
              </div>
              <div class="space-y-2">
                <label for="contact-message-b" class="text-sm font-medium">{{ t.message }}</label>
                <textarea id="contact-message-b" v-model="message" name="message" required rows="4" :placeholder="t.messagePlaceholder" :class="inputClass" />
              </div>
              <div aria-hidden="true" :style="honeypotStyle">
                <label for="contact-website-b">Website</label>
                <input id="contact-website-b" v-model="website" name="website" type="text" tabindex="-1" autocomplete="off" />
              </div>
              <p v-if="failed" role="alert" class="text-sm text-destructive">{{ errorLabel }}</p>
              <button type="submit" :disabled="loading" :class="buttonClass">
                {{ loading ? (t.sending || t.send) : t.send }}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { CmsContactForm } from '@/lib/cms/types'
import { useTranslations } from '@/lib/i18n/composable'
import { getRecaptchaToken, loadRecaptcha } from '@/lib/recaptcha'

const props = defineProps<{ block: CmsContactForm }>()

const t = useTranslations('ContactForm')
const submitted = ref(false)
const loading = ref(false)
const failed = ref<false | 'send' | 'rateLimited' | 'captcha'>(false)
const errorLabel = computed(() => {
  if (failed.value === 'rateLimited') {
    return t.value.rateLimited || 'Too many attempts. Please wait a few minutes and try again.'
  }
  if (failed.value === 'captcha') {
    return t.value.captchaFailed || 'We could not verify that you are human. Please try again.'
  }
  return t.value.sendError || 'Your message could not be sent. Please try again later.'
})
const hasSplitLayout = computed(() => !!(props.block.phone || props.block.email))

const name = ref('')
const email = ref('')
const message = ref('')
// Honeypot: hidden from people, bots fill it in.
const website = ref('')
const honeypotStyle = 'position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden'

onMounted(() => {
  void loadRecaptcha()
})

const inputClass =
  'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
const buttonClass =
  'inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground h-11 px-8 text-base font-medium hover:bg-primary/90 transition-colors w-full disabled:opacity-50'

async function handleSubmit() {
  if (loading.value) return
  loading.value = true
  failed.value = false
  try {
    const recaptchaToken = await getRecaptchaToken('contact')
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.value,
        email: email.value,
        message: message.value,
        website: website.value,
        recaptchaToken,
      }),
    })
    if (res.ok) {
      submitted.value = true
    } else if (res.status === 429) {
      failed.value = 'rateLimited'
    } else {
      const data = await res.json().catch(() => ({}))
      const code = data?.error
      failed.value = code === 'captcha_failed' || code === 'captcha_unavailable' ? 'captcha' : 'send'
    }
  } catch {
    failed.value = 'send'
  } finally {
    loading.value = false
  }
}
</script>
