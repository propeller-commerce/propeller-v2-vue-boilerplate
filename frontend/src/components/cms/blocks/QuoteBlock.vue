<template>
  <section class="py-16">
    <div class="container-width max-w-3xl mx-auto">
      <blockquote class="border-l-4 border-primary pl-6 py-2">
        <p v-if="block.title" class="text-lg font-semibold mb-2">{{ block.title }}</p>
        <p class="text-xl italic text-muted-foreground leading-relaxed">{{ block.body }}</p>
      </blockquote>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { CmsQuote } from '@/lib/cms/types'

defineProps<{ block: CmsQuote }>()
</script>
