/**
 * fetchActiveCart — fetches the user's existing OPEN cart filtered by user/company.
 *
 * Framework-agnostic helper extracted from the Vue/React login flows so
 * login/register pages can call it directly with the freshly-authenticated
 * user, without going through a reactive composable whose internal user ref
 * may still be stale at the moment of invocation.
 *
 * Mirrors `propeller-next/composables/shared/utils/fetchActiveCart.ts`.
 */

import { CartService, Enums } from 'propeller-sdk-v2';
import type {
  Cart,
  CartSearchInput,
  Contact,
  Customer,
  GraphQLClient,
  MediaImageProductSearchInput,
  TransformationsInput,
} from 'propeller-sdk-v2';

export interface FetchActiveCartConfig {
  graphqlClient: GraphQLClient;
  user: Contact | Customer;
  companyId?: number;
  language: string;
  imageSearchFilters: MediaImageProductSearchInput;
  imageVariantFilters: TransformationsInput;
}

export async function fetchActiveCart(
  cfg: FetchActiveCartConfig,
): Promise<Cart | null> {
  const cartService = new CartService(cfg.graphqlClient);
  try {
    const searchInput: CartSearchInput = {
      offset: 100,
      statuses: [Enums.CartStatus.OPEN],
    };
    if ('contactId' in cfg.user && cfg.user.contactId) {
      searchInput.contactIds = [cfg.user.contactId];
      if (cfg.companyId) searchInput.companyIds = [cfg.companyId];
    } else if ('customerId' in cfg.user && cfg.user.customerId) {
      searchInput.customerIds = [cfg.user.customerId];
    }
    const carts = await cartService.getCarts(searchInput);
    if (carts?.items?.length) {
      const existingCartId = carts.items[carts.items.length - 1].cartId;
      return (
        (await cartService.getCart({
          cartId: existingCartId,
          imageSearchFilters: cfg.imageSearchFilters,
          imageVariantFilters: cfg.imageVariantFilters,
          language: cfg.language,
        })) ?? null
      );
    }
    return null;
  } catch (e) {
    console.error('[fetchActiveCart] Failed to fetch active cart:', e);
    return null;
  }
}
