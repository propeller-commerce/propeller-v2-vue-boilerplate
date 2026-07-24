<template>
  <section v-if="block.file" class="py-16">
    <div class="container-width">
      <div class="relative w-full aspect-video rounded-lg overflow-hidden">
        <img
          :src="block.file.url"
          :alt="block.file.alternativeText || ''"
          class="object-cover w-full h-full"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { CmsMedia } from '@/lib/cms/types'

defineProps<{ block: CmsMedia }>()
</script>
