<template>
  <div class="min-h-[70vh] flex items-center justify-center py-12 px-4">
    <div class="w-full max-w-md">
      <ForgotPassword
        :labels="forgotPasswordLabels"
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

const router = useRouter()
const languageStore = useLanguageStore()
const forgotPasswordLabels = useTranslations('ForgotPassword')
</script>
