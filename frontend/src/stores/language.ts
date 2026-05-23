import { defineStore } from 'pinia'
import { ref } from 'vue'
import { isBrowser, safeStorage } from '@/lib/ssr'

const STORAGE_KEY = 'preferred_language'
const DEFAULT_LANGUAGE = import.meta.env.VITE_DEFAULT_LANGUAGE || 'NL'

export const useLanguageStore = defineStore('language', () => {
  // SSR starts at the default language; the router `beforeEach` then syncs it
  // from the URL's `:lang` param before any component renders, so the server
  // render is already in the correct language regardless of localStorage.
  const language = ref(safeStorage.getItem(STORAGE_KEY) || DEFAULT_LANGUAGE)

  function setLanguage(lang: string) {
    language.value = lang
    safeStorage.setItem(STORAGE_KEY, lang)
    if (isBrowser) {
      window.dispatchEvent(new CustomEvent('languageChanged', { detail: lang }))
    }
  }

  // Sync with other tabs — browser-only.
  if (isBrowser) {
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        language.value = e.newValue
      }
    })
  }

  return { language, setLanguage }
})
