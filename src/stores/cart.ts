import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Cart } from 'propeller-sdk-v2'
import { stripLeadingUnderscores } from '@/shared/utils/userUtils'

function normalizeCart(c: Cart): Cart {
  return stripLeadingUnderscores(JSON.parse(JSON.stringify(c))) as Cart
}

function loadCartFromStorage(): Cart | null {
  try {
    const stored = localStorage.getItem('cart')
    if (!stored) return null
    return stripLeadingUnderscores(JSON.parse(stored)) as Cart
  } catch {
    return null
  }
}

export const useCartStore = defineStore('cart', () => {
  const cart = ref<Cart | null>(loadCartFromStorage())
  const isOpen = ref(false)

  const cartId = computed(() => cart.value?.cartId ?? null)

  const itemCount = computed(() => {
    if (!cart.value) return 0
    const items = (cart.value as any).items ?? (cart.value as any).mainItems?.items ?? []
    return items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)
  })

  const totalPrice = computed(() => {
    return (cart.value as any)?.total?.totalNet ?? 0
  })

  function setCart(c: Cart | null) {
    const normalized = c ? normalizeCart(c) : null
    cart.value = normalized
    if (normalized) localStorage.setItem('cart', JSON.stringify(normalized))
    else localStorage.removeItem('cart')
  }

  function saveCart(c: Cart) {
    setCart(c)
  }

  function clearCart() {
    cart.value = null
    localStorage.removeItem('cart')
  }

  function openCart() { isOpen.value = true }
  function closeCart() { isOpen.value = false }
  function toggleCart() { isOpen.value = !isOpen.value }

  // Clear cart on logout
  window.addEventListener('userLoggedOut', () => clearCart())

  return {
    cart, cartId, isOpen, itemCount, totalPrice,
    setCart, saveCart, clearCart, openCart, closeCart, toggleCart,
  }
})
