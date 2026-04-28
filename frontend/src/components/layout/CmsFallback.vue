<template>
  <!--
    Friendly fallback used by CMS-driven views (CmsPageView, BlogView, BlogPostView)
    while the CMS backend isn't wired up yet. The user always lands on something
    useful instead of a hard "Page Not Found" screen. Replace with a real 404
    once the CMS returns confirmed misses.
  -->
  <div class="text-center py-16">
    <h1 class="text-4xl font-bold text-foreground mb-4">{{ title }}</h1>
    <p class="text-muted-foreground text-lg max-w-xl mx-auto mb-6">
      {{ subtitle }}
    </p>
    <router-link
      :to="localizeHref('/', languageStore.language)"
      class="inline-block bg-primary text-primary-foreground px-8 py-3 rounded-[var(--radius-container)] font-medium hover:bg-primary/90 transition"
    >
      {{ ctaLabel }}
    </router-link>
  </div>
</template>

<script setup lang="ts">
import { localizeHref } from '@/lib/config'
import { useLanguageStore } from '@/stores/language'

withDefaults(
  defineProps<{
    title?: string
    subtitle?: string
    ctaLabel?: string
  }>(),
  {
    title: 'Welcome to Propeller',
    subtitle:
      'Discover our full catalog of products — quality, selection, and fast delivery.',
    ctaLabel: 'Browse Products',
  },
)

const languageStore = useLanguageStore()
</script>
