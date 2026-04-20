import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'price_include_tax'

export const usePriceStore = defineStore('price', () => {
  const stored = localStorage.getItem(STORAGE_KEY)
  const includeTax = ref(stored !== null ? stored === 'true' : false)

  function setIncludeTax(value: boolean) {
    includeTax.value = value
    localStorage.setItem(STORAGE_KEY, String(value))
    window.dispatchEvent(new CustomEvent('priceToggleChanged', { detail: value }))
  }

  function toggleTax() {
    setIncludeTax(!includeTax.value)
  }

  // Sync with other tabs
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue !== null) {
      includeTax.value = e.newValue === 'true'
    }
  })

  return { includeTax, setIncludeTax, toggleTax }
})
