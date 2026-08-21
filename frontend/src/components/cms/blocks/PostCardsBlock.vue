<template>
  <section class="py-16 lg:py-20 bg-primary/5">
    <div class="container-width">
      <div class="text-center mb-10">
        <h2 class="text-3xl font-bold">{{ block.title }}</h2>
        <p v-if="block.subtitle" class="text-muted-foreground mt-2">{{ block.subtitle }}</p>
      </div>

      <div class="relative">
        <div
          ref="scrollRef"
          class="flex gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory scrollbar-hide"
          style="scrollbar-width: none; -ms-overflow-style: none"
        >
          <router-link
            v-for="post in block.posts"
            :key="post.slug"
            :to="localizeHref(`/blog/${post.slug}`, languageStore.language)"
            class="group bg-card rounded-2xl overflow-hidden border border-border hover:shadow-lg transition flex flex-col flex-shrink-0 snap-start"
            :style="{ width: `calc((100% - ${(cardsPerPage - 1) * 24}px) / ${cardsPerPage})` }"
          >
            <div class="relative">
              <img
                v-if="post.cover"
                :src="post.cover.url"
                :alt="post.cover.alternativeText || post.title"
                :width="post.cover.width || 720"
                :height="post.cover.height || 360"
                class="aspect-video w-full object-cover"
              />
              <div v-else class="aspect-video w-full bg-muted" />
              <span
                v-if="post.category"
                class="absolute top-3 right-3 bg-card/90 backdrop-blur-sm text-foreground text-xs font-medium px-3 py-1 rounded-full border border-border shadow-sm"
              >
                {{ post.category }}
              </span>
            </div>

            <div class="p-5 flex flex-col flex-1">
              <div v-if="post.author || post.readTime" class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <img
                    v-if="post.author?.avatar"
                    :src="post.author.avatar.url"
                    :alt="post.author.name"
                    :width="28"
                    :height="28"
                    class="w-7 h-7 rounded-full object-cover"
                  />
                  <div
                    v-else-if="post.author"
                    class="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary"
                  >
                    {{ post.author.name.charAt(0) }}
                  </div>
                  <span v-if="post.author" class="text-sm text-muted-foreground font-medium">
                    {{ post.author.name }}
                  </span>
                </div>
                <div v-if="post.readTime" class="flex items-center gap-1 text-sm text-muted-foreground">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                    <circle cx="12" cy="12" r="10" />
                    <path stroke-linecap="round" d="M12 6v6l4 2" />
                  </svg>
                  <span>{{ post.readTime }} min</span>
                </div>
              </div>

              <h3 class="font-bold text-lg leading-snug line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                {{ post.title }}
              </h3>
              <p v-if="post.excerpt" class="text-sm text-muted-foreground line-clamp-3 mb-4 flex-1">
                {{ post.excerpt }}
              </p>
              <span class="text-primary font-medium text-sm inline-flex items-center gap-1 mt-auto">
                Lees meer
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </div>
          </router-link>
        </div>

        <div v-if="totalPages > 1" class="flex items-center justify-center gap-3 mt-8">
          <button
            :disabled="page === 0"
            class="w-10 h-10 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground disabled:opacity-30 disabled:cursor-not-allowed transition"
            @click="scroll('prev')"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div class="flex gap-2">
            <button
              v-for="(_, i) in totalPages"
              :key="i"
              :class="['w-2.5 h-2.5 rounded-full transition', i === page ? 'bg-primary' : 'bg-border']"
              @click="goToPage(i)"
            />
          </div>
          <button
            :disabled="page === totalPages - 1"
            class="w-10 h-10 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground disabled:opacity-30 disabled:cursor-not-allowed transition"
            @click="scroll('next')"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CmsPostCards } from '@/lib/cms/types'
import { localizeHref } from '@/lib/config'
import { useLanguageStore } from '@/stores/language'

const props = defineProps<{ block: CmsPostCards }>()

const languageStore = useLanguageStore()

const scrollRef = ref<HTMLDivElement | null>(null)
const page = ref(0)
const cardsPerPage = 3
const totalPages = computed(() => Math.ceil(props.block.posts.length / cardsPerPage))

function scroll(direction: 'prev' | 'next') {
  const next =
    direction === 'next'
      ? Math.min(page.value + 1, totalPages.value - 1)
      : Math.max(page.value - 1, 0)
  page.value = next
  if (scrollRef.value) {
    const cardWidth = scrollRef.value.scrollWidth / props.block.posts.length
    scrollRef.value.scrollTo({ left: next * cardsPerPage * cardWidth, behavior: 'smooth' })
  }
}

function goToPage(i: number) {
  page.value = i
  if (scrollRef.value) {
    scrollRef.value.scrollTo({
      left: i * cardsPerPage * (scrollRef.value.scrollWidth / props.block.posts.length),
      behavior: 'smooth',
    })
  }
}
</script>
