<template>
  <section class="py-16">
    <div class="container-width">
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div class="prose prose-lg max-w-none" v-html="block.body" />
    </div>
  </section>
</template>

<script setup lang="ts">
import type { CmsRichText } from '@/lib/cms/types'

defineProps<{ block: CmsRichText }>()
</script>
