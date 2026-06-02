<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-3xl font-bold tracking-tight">Favorites</h1>
    </div>
    <FavoriteLists
      v-if="authStore.user"
      :showActions="true"
      :allowFavoriteListCreate="true"
      :onListChanged="() => authStore.refreshUser()"
      :onListClick="(id: string) => router.push(localizeHref(`/account/favorites/${id}`, languageStore.language))"
    />
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useLanguageStore } from '@/stores/language'
import { graphqlClient } from '@/lib/api'
import { localizeHref } from '@/lib/config'
import { FavoriteLists } from 'propeller-v2-vue-ui';

const router = useRouter()
const authStore = useAuthStore()
const languageStore = useLanguageStore()
</script>
