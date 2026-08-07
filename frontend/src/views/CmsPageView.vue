<template>
  <div>
    <CmsPageRenderer
      v-if="page && page.blocks.length"
      :page="page"
      :renderers="cmsBlockRenderers"
    />
    <CmsFallback v-else />
    <PreprTrack v-if="page?.id" :item-id="page.id" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useHead } from '@unhead/vue'
import { useRoute } from 'vue-router'
import { CmsPageRenderer } from '@propeller-commerce/propeller-v2-cms-vue'
import CmsFallback from '@/components/layout/CmsFallback.vue'
import PreprTrack from '@/components/cms/PreprTrack.vue'
import { cmsBlockRenderers } from '@/components/cms/blockRenderers'
import { useSsrCatalogStore } from '@/stores/ssrCatalog'
import type { CmsRichPage } from '@/lib/cms/types'

const route = useRoute()
const ssrCatalog = useSsrCatalogStore()

// peekSeed (not consume): the SSR render and the client's hydration render must
// read the SAME seed so their DOM trees match — no hydration mismatch. The
// post-hydration consumeSeed below clears it. The CMS page is fetched
// server-side (the provider token is server-only), so client-side soft
// navigations to a new CMS slug have no seed and fall back to <CmsFallback>
// until a full navigation re-runs the SSR loader.
const seed = ssrCatalog.peekSeed(route.fullPath)
const page = ref<CmsRichPage | null>(
  seed?.kind === 'cms' ? (seed.data as CmsRichPage) : null,
)

onMounted(() => {
  ssrCatalog.consumeSeed(route.fullPath)
})

// CMS pages carry their own title/description; without this every one of them
// served the site default.
useHead({
  title: computed(() => page.value?.title || ''),
  meta: [
    {
      name: 'description',
      content: computed(() => page.value?.description || ''),
    },
  ],
})
</script>
