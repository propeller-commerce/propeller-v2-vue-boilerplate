<template>
  <div class="min-h-[70vh] flex items-center justify-center py-12 px-4">
    <div class="w-full max-w-md">
      <ForgotPassword
        :graphqlClient="graphqlClient"
        :language="languageStore.language"
        :onNavigateToLogin="() => router.push(localizeHref('/login', languageStore.language))"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useLanguageStore } from '@/stores/language'
import { graphqlClient } from '@/lib/api'
import { ForgotPassword } from 'propeller-v2-vue-ui';
import { localizeHref } from '@/lib/config'

const router = useRouter()
const languageStore = useLanguageStore()
</script>
