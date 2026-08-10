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
      // Mirror into a cookie — the SSR render can't read localStorage, so
      // without this an unprefixed page always renders the default language.
      document.cookie = `${STORAGE_KEY}=${lang}; path=/; max-age=31536000; samesite=lax`
      window.dispatchEvent(new CustomEvent('languageChanged', { detail: lang }))
    }
  }

  /** Seed from the request cookie during SSR (mirrors the price store). */
  function seedFromCookie(cookies: Record<string, string>) {
    const value = cookies[STORAGE_KEY]
    if (value) language.value = value.toUpperCase()
  }

  // Sync with other tabs — browser-only.
  if (isBrowser) {
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        language.value = e.newValue
      }
    })
  }

  return { language, setLanguage, seedFromCookie }
})
