<template>
  <section class="py-16 border-b border-border/60 bg-slate-50/30">
    <div class="container-width">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div
          v-for="(item, i) in block.items"
          :key="i"
          class="border-none shadow-none bg-transparent"
        >
          <div class="flex items-center gap-4 pt-6">
            <div class="h-14 w-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-2xl shadow-sm text-primary">
              {{ item.icon }}
            </div>
            <div>
              <h3 class="font-semibold text-lg">{{ item.title }}</h3>
              <p class="text-sm text-muted-foreground">{{ item.text }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { CmsValueProps } from '@/lib/cms/types'

defineProps<{ block: CmsValueProps }>()
</script>
