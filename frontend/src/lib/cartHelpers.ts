import type { Cart } from '@propeller-commerce/propeller-sdk-v2'
import { isBrowser, safeStorage } from '@/lib/ssr'

/**
 * Restore the manager's own cart after they finish acting on a requester's
 * authorization cart.
 *
 * When a manager accepts an authorization request, their own cart is parked in
 * `manager_cart` (see AuthorizationRequestsView) and the requester's cart is
 * loaded. Whether the manager completes that cart by placing the order OR by
 * submitting it for further authorization, control of the storefront returns
 * to the manager — so their parked cart must come back.
 *
 * Returns the restored Cart when one was parked (caller should setCart it),
 * or `null` when there was nothing to restore (caller should clear).
 */
export function restoreManagerCart(): Cart | null {
  if (!isBrowser) return null
  const parked = safeStorage.getItem('manager_cart')
  if (!parked) return null
  safeStorage.removeItem('manager_cart')
  try {
    return JSON.parse(parked) as Cart
  } catch {
    return null
  }
}
