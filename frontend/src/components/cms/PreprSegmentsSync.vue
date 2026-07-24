<template>
  <span style="display: none" aria-hidden="true" />
</template>

<script setup lang="ts">
/**
 * Keeps a `prepr-segments` cookie in sync with the logged-in user's group
 * segments (from the company's SYSTEM_USER_GROUPS attribute). server.js reads
 * this cookie and forwards it as the Prepr-Segments header, so group-based
 * personalization resolves server-side (the Prepr token is server-only). Renders
 * nothing; mounted once in the app root. No-ops unless Prepr is the CMS.
 */
import { watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useCompanyStore } from '@/stores/company'
import { getUserSegments } from '@/lib/preprSegments'
import { PREPR_ENABLED } from '@/lib/preprEvent'

const SEGMENTS_COOKIE = 'prepr-segments'

const authStore = useAuthStore()
const companyStore = useCompanyStore()
const { user, isAuthenticated, isLoading } = storeToRefs(authStore)
const { selectedCompany } = storeToRefs(companyStore)

function syncSegments(): void {
  if (!PREPR_ENABLED || typeof document === 'undefined') return
  if (isLoading.value) return

  const segments =
    isAuthenticated.value && user.value
      ? getUserSegments(user.value, selectedCompany.value).sort()
      : []

  if (segments.length > 0) {
    document.cookie = `${SEGMENTS_COOKIE}=${encodeURIComponent(segments.join(','))}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`
  } else {
    document.cookie = `${SEGMENTS_COOKIE}=; path=/; max-age=0; samesite=lax`
  }
}

watch(
  [isLoading, isAuthenticated, user, selectedCompany],
  syncSegments,
  { immediate: true },
)
</script>
