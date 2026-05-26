import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Cart } from 'propeller-sdk-v2'
import { isBrowser, safeStorage } from '@/lib/ssr'

function loadCartFromStorage(): Cart | null {
  try {
    const stored = safeStorage.getItem('cart')
    if (!stored) return null
    return JSON.parse(stored) as Cart
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
    cart.value = c
    if (c) safeStorage.setItem('cart', JSON.stringify(c))
    else safeStorage.removeItem('cart')
  }

  // Client-only re-hydration after SSR state transfer.
  //
  // Under SSR the server can't see localStorage, so this store renders with
  // `cart: null` and that null is what gets serialized into __INITIAL_STATE__.
  // The client entry restores that snapshot wholesale (`pinia.state.value =
  // initialState`) BEFORE any component reads the store, which clobbers the
  // value the setup initializer read from localStorage. Without this, an
  // anonymous cart vanishes on every refresh — and a later action-code apply
  // targets the wrong (empty) cart, so the API rejects an otherwise-valid code.
  //
  // localStorage is the source of truth for the anonymous cart (same contract
  // as the Next app, where the client read always wins over the server). Call
  // this from the client entry right after the state transfer to let the
  // persisted cart win back over the server's null.
  function hydrateFromStorage() {
    if (!isBrowser) return
    const stored = loadCartFromStorage()
    if (stored) cart.value = stored
  }

  function saveCart(c: Cart) {
    setCart(c)
  }

  function clearCart() {
    cart.value = null
    safeStorage.removeItem('cart')
  }

  function openCart() { isOpen.value = true }
  function closeCart() { isOpen.value = false }
  function toggleCart() { isOpen.value = !isOpen.value }

  // Clear cart on logout — browser-only (no cross-tab events under SSR).
  if (isBrowser) {
    window.addEventListener('userLoggedOut', () => clearCart())

    // Sync the cart across tabs — browser-only. The `storage` event fires only
    // in *other* tabs (never the one that wrote), so this can't race with our
    // own `setCart`. Add an item in one tab and the cart icon/sidebar update
    // live in the others; log out (or clear) in one tab and the rest follow.
    // Re-read via `loadCartFromStorage` (try/caught) rather than parsing
    // `e.newValue` inline — a malformed entry must not throw inside the listener.
    window.addEventListener('storage', (e) => {
      if (e.key !== 'cart') return
      cart.value = e.newValue ? loadCartFromStorage() : null
    })
  }

  return {
    cart, cartId, isOpen, itemCount, totalPrice,
    setCart, saveCart, clearCart, hydrateFromStorage, openCart, closeCart, toggleCart,
  }
})
