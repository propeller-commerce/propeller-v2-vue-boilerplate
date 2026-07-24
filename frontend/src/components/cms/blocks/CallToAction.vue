<template>
  <section class="py-20 bg-primary/5">
    <div class="container-width text-center max-w-2xl mx-auto space-y-6">
      <h2 class="text-3xl font-bold tracking-tight sm:text-4xl">{{ block.title }}</h2>
      <p v-if="block.description" class="text-lg text-muted-foreground">
        {{ block.description }}
      </p>
      <router-link
        :to="localizeHref(block.buttonUrl, languageStore.language)"
        :class="[
          'inline-flex items-center justify-center rounded-md px-8 h-12 text-lg font-medium transition-colors',
          block.variant === 'secondary'
            ? 'border border-input bg-transparent hover:bg-accent'
            : 'bg-primary text-primary-foreground hover:bg-primary/90',
        ]"
      >
        {{ block.buttonText }}
      </router-link>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { CmsCallToAction } from '@/lib/cms/types'
import { localizeHref } from '@/lib/config'
import { useLanguageStore } from '@/stores/language'

defineProps<{ block: CmsCallToAction }>()

const languageStore = useLanguageStore()
</script>
