<template>
  <section class="relative overflow-hidden min-h-[600px] flex items-center">
    <div v-if="block.image" class="absolute inset-0 z-0">
      <img
        :src="block.image.url"
        :alt="block.image.alternativeText || block.title"
        class="object-cover w-full h-full"
      />
      <div class="absolute inset-0 bg-gradient-to-r from-background/95 via-background/70 to-transparent" />
    </div>

    <div class="container-width relative z-10 w-full">
      <div class="max-w-2xl space-y-6">
        <h1 class="text-4xl md:text-6xl font-bold tracking-tight text-foreground sm:text-7xl drop-shadow-sm">
          {{ block.title }}
        </h1>
        <p
          v-if="block.subtitle"
          class="text-lg leading-8 text-muted-foreground max-w-xl font-medium"
        >
          {{ block.subtitle }}
        </p>
        <div class="flex items-center gap-x-4 pt-4">
          <router-link
            v-if="block.ctaText && block.ctaUrl"
            :to="localizeHref(block.ctaUrl, languageStore.language)"
            class="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-8 h-12 text-lg font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
          >
            {{ block.ctaText }}
          </router-link>
          <router-link
            v-if="block.secondaryCtaText && block.secondaryCtaUrl"
            :to="localizeHref(block.secondaryCtaUrl, languageStore.language)"
            class="inline-flex items-center justify-center rounded-md border border-input bg-transparent hover:bg-accent px-8 h-12 text-lg font-medium transition-colors"
          >
            {{ block.secondaryCtaText }}
          </router-link>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { CmsHeroBanner } from '@/lib/cms/types'
import { localizeHref } from '@/lib/config'
import { useLanguageStore } from '@/stores/language'

defineProps<{ block: CmsHeroBanner }>()

const languageStore = useLanguageStore()
</script>
