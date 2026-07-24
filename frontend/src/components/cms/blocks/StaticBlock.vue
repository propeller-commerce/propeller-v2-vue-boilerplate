<template>
  <!--
    Placeholder for Prepr Static components. Each staticType maps to a
    template-specific section:
      - TESTIMONIALS: Customer testimonial carousel
      - STEPS: Step-by-step process/how-it-works section
      - EXPLANATION: Detailed explanation or feature breakdown
      - BENEFITS: Benefits/advantages grid
    These need custom implementation per project.
  -->
  <span style="display: none" />
</template>

<script setup lang="ts">
import type { CmsStatic } from '@/lib/cms/types'

defineProps<{ block: CmsStatic }>()
</script>
