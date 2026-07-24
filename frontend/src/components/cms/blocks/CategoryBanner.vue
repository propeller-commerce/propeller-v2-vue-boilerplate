<template>
  <div
    v-if="banner.image"
    class="relative w-full aspect-[4/1] min-h-[200px] max-h-[320px] rounded-lg overflow-hidden mb-8"
  >
    <img
      :src="banner.image.url"
      :alt="banner.image.alternativeText || banner.title || ''"
      class="object-cover w-full h-full"
    />
    <div
      v-if="banner.title || banner.subtitle || banner.ctaText"
      class="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent flex items-center"
    >
      <div class="px-8 md:px-12 max-w-xl space-y-3">
        <h2
          v-if="banner.title"
          class="text-2xl md:text-3xl font-bold text-white drop-shadow-md"
        >
          {{ banner.title }}
        </h2>
        <p
          v-if="banner.subtitle"
          class="text-sm md:text-base text-white/90 drop-shadow-sm"
        >
          {{ banner.subtitle }}
        </p>
        <router-link
          v-if="banner.ctaText && banner.ctaUrl"
          :to="localizeHref(banner.ctaUrl, languageStore.language)"
          class="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 h-9 text-sm font-medium hover:bg-primary/90 transition-colors mt-2"
        >
          {{ banner.ctaText }}
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CmsCategoryBanner } from '@/lib/cms/types'
import { localizeHref } from '@/lib/config'
import { useLanguageStore } from '@/stores/language'

defineProps<{ banner: CmsCategoryBanner }>()

const languageStore = useLanguageStore()
</script>
