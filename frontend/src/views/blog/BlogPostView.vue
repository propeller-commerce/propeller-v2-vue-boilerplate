<template>
  <div class="container-width py-12 max-w-3xl">
    <article v-if="post">
      <button @click="router.back()" class="text-primary hover:underline text-sm mb-6 block">← {{ t.backToBlog }}</button>
      <img v-if="post.cover?.url" :src="post.cover.url" :alt="post.title" class="w-full h-64 object-cover rounded-[var(--radius-container)] mb-8" />
      <h1 class="text-4xl font-bold mb-4">{{ post.title }}</h1>
      <p v-if="post.publishedAt" class="text-sm text-muted-foreground mb-8">{{ post.publishedAt }}</p>
      <!-- Article body: CMS blocks (rich-text, media, ...) via the shared renderer. -->
      <CmsPageRenderer
        v-if="post.blocks && post.blocks.length"
        :page="articlePage"
        :renderers="cmsBlockRenderers"
      />
      <PreprTrack v-if="post.id" :item-id="post.id" />
    </article>
    <CmsFallback v-else />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CmsPageRenderer } from '@propeller-commerce/propeller-v2-cms-vue'
import { useTranslations } from '@/lib/i18n/composable'
import CmsFallback from '@/components/layout/CmsFallback.vue'
import PreprTrack from '@/components/cms/PreprTrack.vue'
import { cmsBlockRenderers } from '@/components/cms/blockRenderers'
import { useSsrCatalogStore } from '@/stores/ssrCatalog'
import type { CmsArticle } from '@/lib/cms/types'

const route = useRoute()
const router = useRouter()
const t = useTranslations('Blog')
const ssrCatalog = useSsrCatalogStore()

// Server-seeded article (peek so SSR + hydration read the same value).
const seed = ssrCatalog.peekSeed(route.fullPath)
const post = ref<CmsArticle | null>(
  seed?.kind === 'cms-article' ? (seed.data as CmsArticle) : null,
)

// <CmsPageRenderer> expects a page-like object with `id` + `blocks`.
const articlePage = computed(() => ({
  id: post.value?.id ?? post.value?.slug ?? '',
  title: post.value?.title ?? '',
  slug: post.value?.slug ?? '',
  blocks: post.value?.blocks ?? [],
}))

onMounted(() => {
  ssrCatalog.consumeSeed(route.fullPath)
})
</script>
