<template>
  <div class="container-width py-12">
    <h1 class="text-3xl font-bold mb-8">{{ t.termsTitle }}</h1>
    <!-- Body copy comes from the StaticPages namespace. It used to be hardcoded
         English under a translated heading, so a Dutch storefront served
         "Algemene voorwaarden" followed by English terms. -->
    <div class="prose max-w-none text-muted-foreground space-y-4">
      <p>{{ t.termsIntro }}</p>
      <h2 class="text-xl font-semibold mt-6">{{ t.termsAcceptanceTitle }}</h2>
      <p>{{ t.termsAcceptanceBody }}</p>
      <h2 class="text-xl font-semibold mt-6">{{ t.termsLicenseTitle }}</h2>
      <p>{{ t.termsLicenseBody }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useHead } from '@unhead/vue';
import { useTranslations } from '@/lib/i18n/composable';

const t = useTranslations('StaticPages');

useHead({ title: computed(() => t.value.termsTitle || '') });
</script>
