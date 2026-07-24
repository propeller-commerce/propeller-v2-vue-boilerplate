<template>
  <section class="bg-primary/5 py-16 lg:py-20">
    <div class="container-width">
      <div
        :class="[
          'grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center',
          imageLeft ? '' : 'lg:[&>*:first-child]:order-2',
        ]"
      >
        <div
          v-if="block.image"
          class="relative aspect-[870/570] w-full overflow-hidden rounded-2xl"
        >
          <img
            :src="block.image.url"
            :alt="block.image.alternativeText || block.title"
            class="object-cover w-full h-full"
          />
        </div>

        <div class="space-y-6">
          <h2 class="text-3xl font-bold tracking-tight text-foreground">
            {{ block.title }}
          </h2>
          <p v-if="block.description" class="text-lg leading-relaxed text-muted-foreground">
            {{ block.description }}
          </p>
          <router-link
            v-if="block.buttonText && block.buttonUrl"
            :to="localizeHref(block.buttonUrl, languageStore.language)"
            class="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground px-8 h-12 text-lg font-medium hover:bg-primary/90 transition-colors"
          >
            {{ block.buttonText }}
          </router-link>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CmsFeature } from '@/lib/cms/types'
import { localizeHref } from '@/lib/config'
import { useLanguageStore } from '@/stores/language'

const props = defineProps<{ block: CmsFeature }>()

const languageStore = useLanguageStore()
const imageLeft = computed(() => props.block.imagePosition === 'left')
</script>
