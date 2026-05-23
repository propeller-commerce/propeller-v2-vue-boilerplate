import { defineStore } from 'pinia'
import { ref } from 'vue'
import { isBrowser, safeStorage } from '@/lib/ssr'

const STORAGE_KEY = 'price_include_tax'

export const usePriceStore = defineStore('price', () => {
  // SSR defaults to net prices (matches the React server seam's `includeTax:
  // false`); the client picks up the persisted preference on hydration.
  const stored = safeStorage.getItem(STORAGE_KEY)
  const includeTax = ref(stored !== null ? stored === 'true' : false)

  function setIncludeTax(value: boolean) {
    includeTax.value = value
    safeStorage.setItem(STORAGE_KEY, String(value))
    if (isBrowser) {
      window.dispatchEvent(new CustomEvent('priceToggleChanged', { detail: value }))
    }
  }

  function toggleTax() {
    setIncludeTax(!includeTax.value)
  }

  // Sync with other tabs — browser-only.
  if (isBrowser) {
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY && e.newValue !== null) {
        includeTax.value = e.newValue === 'true'
      }
    })
  }

  return { includeTax, setIncludeTax, toggleTax }
})
