import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'preferred_language'
const DEFAULT_LANGUAGE = import.meta.env.VITE_DEFAULT_LANGUAGE || 'NL'

export const useLanguageStore = defineStore('language', () => {
  const language = ref(localStorage.getItem(STORAGE_KEY) || DEFAULT_LANGUAGE)

  function setLanguage(lang: string) {
    language.value = lang
    localStorage.setItem(STORAGE_KEY, lang)
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: lang }))
  }

  // Sync with other tabs
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      language.value = e.newValue
    }
  })

  return { language, setLanguage }
})
