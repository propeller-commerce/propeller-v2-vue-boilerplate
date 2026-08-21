<template>
  <footer class="bg-[#242526] text-slate-100 mt-auto border-t border-slate-800">
    <div class="container mx-auto px-4 py-12 md:py-16">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div class="space-y-4">
          <h3 class="text-xl font-bold tracking-tight text-white">{{ siteName }}</h3>
          <p class="text-sm text-slate-400 leading-relaxed max-w-xs">{{ description }}</p>
        </div>

        <!-- CMS-driven columns or fallback -->
        <template v-if="footerColumns.length > 0">
          <div v-for="(column, i) in footerColumns" :key="i">
            <h4 class="text-sm font-semibold uppercase tracking-wider text-slate-200 mb-4">{{ column.title }}</h4>
            <ul class="space-y-3 text-sm text-slate-400">
              <li v-for="(link, j) in column.links" :key="j">
                <router-link :to="localizeHref(link.url, languageStore.language)" class="hover:text-white transition-colors">
                  {{ link.label }}
                </router-link>
              </li>
            </ul>
          </div>
        </template>

        <template v-else>
          <div>
            <h4 class="text-sm font-semibold uppercase tracking-wider text-slate-200 mb-4">{{ t.shopTitle }}</h4>
            <ul class="space-y-3 text-sm text-slate-400">
              <li><router-link :to="localizeHref('/', languageStore.language)" class="hover:text-white transition-colors">{{ t.allProducts }}</router-link></li>
              <li><router-link :to="localizeHref('/', languageStore.language)" class="hover:text-white transition-colors">{{ t.featured }}</router-link></li>
              <li><router-link :to="localizeHref('/new-arrivals', languageStore.language)" class="hover:text-white transition-colors">{{ t.newArrivals }}</router-link></li>
            </ul>
          </div>

          <div>
            <h4 class="text-sm font-semibold uppercase tracking-wider text-slate-200 mb-4">{{ t.supportTitle }}</h4>
            <ul class="space-y-3 text-sm text-slate-400">
              <li><router-link :to="localizeHref('/account', languageStore.language)" class="hover:text-white transition-colors">{{ t.myAccount }}</router-link></li>
              <li><router-link :to="localizeHref('/terms-conditions', languageStore.language)" class="hover:text-white transition-colors">{{ t.termsConditions }}</router-link></li>
              <li><router-link :to="localizeHref('/privacy', languageStore.language)" class="hover:text-white transition-colors">{{ t.privacyPolicy }}</router-link></li>
              <li><router-link :to="localizeHref('/returns', languageStore.language)" class="hover:text-white transition-colors">{{ t.returns }}</router-link></li>
            </ul>
          </div>
        </template>

        <div>
          <h4 class="text-sm font-semibold uppercase tracking-wider text-slate-200 mb-4">{{ t.contactTitle }}</h4>
          <ul class="space-y-3 text-sm text-slate-400">
            <li class="flex items-start gap-2">
              <svg class="w-5 h-5 mt-0.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" :stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>{{ email }}</span>
            </li>
            <li class="flex items-start gap-2">
              <svg class="w-5 h-5 mt-0.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" :stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span>{{ phone }}</span>
            </li>
          </ul>
        </div>
      </div>

      <div class="border-t border-slate-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <p class="text-xs text-slate-500">{{ copyright }}</p>
        <div class="flex gap-4">
          <!-- Social icons -->
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useLanguageStore } from '@/stores/language'
import { localizeHref } from '@/lib/config'
import { useTranslations } from '@/lib/i18n/composable'

const languageStore = useLanguageStore()
const t = useTranslations('Footer')

// CMS settings — replace with a global store when CMS integration is added
const siteName = import.meta.env.VITE_SITE_NAME || 'Propeller'
const description = computed(() =>
  import.meta.env.VITE_FOOTER_DESCRIPTION || t.value.description
)
const email = import.meta.env.VITE_FOOTER_EMAIL || 'info@propeller.com'
const phone = import.meta.env.VITE_FOOTER_PHONE || '+1 234 567 890'
const copyright = computed(() =>
  import.meta.env.VITE_COPYRIGHT_TEXT || `\u00A9 ${new Date().getFullYear()} Propeller E-commerce. All rights reserved.`
)
const footerColumns: { title: string; links: { label: string; url: string }[] }[] = []
</script>
