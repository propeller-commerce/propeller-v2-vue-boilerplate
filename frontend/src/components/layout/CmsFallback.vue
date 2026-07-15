<template>
  <!--
    Friendly fallback used by CMS-driven views (CmsPageView, BlogView, BlogPostView)
    while the CMS backend isn't wired up yet. The user always lands on something
    useful instead of a hard "Page Not Found" screen. Replace with a real 404
    once the CMS returns confirmed misses.
  -->
  <div class="text-center py-16">
    <h1 class="text-4xl font-bold text-foreground mb-4">{{ displayTitle }}</h1>
    <p class="text-muted-foreground text-lg max-w-xl mx-auto mb-6">
      {{ displaySubtitle }}
    </p>
    <router-link
      :to="localizeHref('/', languageStore.language)"
      class="inline-block bg-primary text-primary-foreground px-8 py-3 rounded-[var(--radius-container)] font-medium hover:bg-primary/90 transition"
    >
      {{ displayCtaLabel }}
    </router-link>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { localizeHref } from '@/lib/config'
import { useLanguageStore } from '@/stores/language'
import { useTranslations } from '@/lib/i18n/composable'

// Props override the translated defaults when a CMS-driven caller supplies
// them; otherwise fall back to the Home namespace so the fallback text
// follows the active language.
const props = defineProps<{
  title?: string
  subtitle?: string
  ctaLabel?: string
}>()

const languageStore = useLanguageStore()
const t = useTranslations('Home')

const displayTitle = computed(() => props.title ?? t.value.welcomeTitle)
const displaySubtitle = computed(() => props.subtitle ?? t.value.welcomeSubtitle)
const displayCtaLabel = computed(() => props.ctaLabel ?? t.value.browseProducts)
</script>
