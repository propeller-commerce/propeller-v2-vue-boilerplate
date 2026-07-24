<template>
  <div class="container-width py-12">
    <h1 class="text-3xl font-bold mb-8">{{ t.title }}</h1>
    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
    </div>
    <CmsFallback v-else-if="!posts.length" />
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="post in posts"
        :key="post.slug"
        class="bg-card rounded-[var(--radius-container)] shadow overflow-hidden hover:shadow-md transition cursor-pointer"
        @click="router.push(localizeHref(`/blog/${post.slug}`, languageStore.language))"
      >
        <img v-if="post.cover?.url" :src="post.cover.url" :alt="post.title" class="w-full h-48 object-cover" />
        <div class="p-5">
          <p v-if="post.publishedAt" class="text-xs text-muted-foreground mb-2">{{ post.publishedAt }}</p>
          <h2 class="text-lg font-semibold mb-2 line-clamp-2">{{ post.title }}</h2>
          <p class="text-sm text-muted-foreground line-clamp-3">{{ post.description }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLanguageStore } from '@/stores/language'
import { localizeHref } from '@/lib/config'
import { useTranslations } from '@/lib/i18n/composable'
import CmsFallback from '@/components/layout/CmsFallback.vue'
import { useSsrCatalogStore } from '@/stores/ssrCatalog'
import type { CmsArticle } from '@/lib/cms/types'

const route = useRoute()
const router = useRouter()
const languageStore = useLanguageStore()
const t = useTranslations('Blog')
const ssrCatalog = useSsrCatalogStore()

// Server-seeded article list (peek so SSR + hydration read the same value).
const seed = ssrCatalog.peekSeed(route.fullPath)
const posts = ref<CmsArticle[]>(
  seed?.kind === 'cms-articles' ? (seed.data as CmsArticle[]) : [],
)
// The list is server-fetched (CMS token is server-only); no client refetch.
const loading = ref(false)

onMounted(() => {
  ssrCatalog.consumeSeed(route.fullPath)
})
</script>
