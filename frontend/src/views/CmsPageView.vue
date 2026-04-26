<template>
  <div class="container-width py-12">
    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
    </div>
    <div v-else-if="page">
      <!-- CMS page content - rendered when CMS blocks are available -->
      <div v-for="block in page.blocks" :key="block.id">
        <!-- DynamicBlockRenderer equivalent — render blocks here -->
        <pre class="text-xs text-foreground-subtle">{{ block.__component }}</pre>
      </div>
    </div>
    <CmsFallback v-else />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import CmsFallback from '@/components/layout/CmsFallback.vue'

const route = useRoute()
const page = ref<any>(null)
const loading = ref(true)

async function loadPage() {
  loading.value = true
  try {
    // CMS page loaded from Strapi - implement when CMS is configured
    // const slug = Array.isArray(route.params.slug) ? route.params.slug.join('/') : route.params.slug
    // page.value = await getPage(slug)
  } catch (e) {
    console.error('Failed to load CMS page', e)
  } finally {
    loading.value = false
  }
}

onMounted(loadPage)
watch(() => route.params.slug, loadPage)
</script>
