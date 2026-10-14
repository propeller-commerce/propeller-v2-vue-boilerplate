<template>
  <div class="min-h-[70vh] flex items-center justify-center py-12 px-4">
    <div class="w-full max-w-md">
      <!-- The page owns its h1; the component's own title would be a second
           heading, so it is suppressed with an empty `title`. -->
      <h1 class="text-2xl font-bold text-center mb-6">{{ forgotPasswordLabels.title }}</h1>

      <ForgotPassword
        :labels="forgotPasswordLabels"
        title=""
        :buttonText="forgotPasswordLabels.submitButton"
        :responseMessage="forgotPasswordLabels.responseMessage"
        :onNavigateToLogin="() => router.push(localizeHref('/login', languageStore.language))"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useLanguageStore } from '@/stores/language'
import { graphqlClient } from '@/lib/api'
import { ForgotPassword } from '@propeller-commerce/propeller-v2-vue-ui';
import { localizeHref } from '@/lib/config'
import { useTranslations } from '@/lib/i18n/composable';
import { useHead } from '@unhead/vue';

const pageTitles = useTranslations('PageTitles');
useHead({ title: () => pageTitles.value.forgotPassword });

const router = useRouter()
const languageStore = useLanguageStore()
const forgotPasswordLabels = useTranslations('ForgotPassword')
</script>
