<template>
  <section class="bg-primary/5 py-16 lg:py-20">
    <div class="mx-auto max-w-3xl px-4">
      <h2 class="mb-8 text-center text-3xl font-bold">{{ block.title }}</h2>

      <div class="space-y-3">
        <details
          v-for="(item, i) in block.questions"
          :key="i"
          class="group rounded-xl border border-border bg-card"
        >
          <summary class="flex cursor-pointer list-none items-center justify-between px-6 py-4 font-medium [&::-webkit-details-marker]:hidden">
            {{ item.question }}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              class="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div class="px-6 pb-4 text-muted-foreground">
            {{ item.answer }}
          </div>
        </details>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { CmsFaq } from '@/lib/cms/types'

defineProps<{ block: CmsFaq }>()
</script>
