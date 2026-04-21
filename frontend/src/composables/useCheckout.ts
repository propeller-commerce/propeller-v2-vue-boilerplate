/**
 * useCheckout (Vue) — Checkout flow: address updates, cart settings, order placement.
 *
 * Covers: CheckoutView.
 *
 * Responsibilities:
 * - updateCartAddress: save invoice or delivery address to cart
 * - updateCartSettings: save payment method, carrier, delivery date, reference, notes
 * - placeOrder: processCart → setOrderStatus → optional triggerQuoteSendRequest
 * - getUserDefaultAddress: resolve pre-fill address from user profile
 * - buildAddressInput: normalize address data to CartUpdateAddressInput
 */

import { ref, type Ref } from 'vue';
import { CartService, OrderService, Enums } from 'propeller-sdk-v2';
import type {
  GraphQLClient,
  Cart,
  CartUpdateAddressInput,
  MediaImageProductSearchInput,
  TransformationsInput,
  Address,
} from 'propeller-sdk-v2';
import type { AnyUser } from '../shared/utils/userIdentity';
import { getDefaultInvoiceAddress, getDefaultDeliveryAddress } from '../shared/utils/userIdentity';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UseCheckoutOptions {
  graphqlClient: GraphQLClient;
  user: Ref<AnyUser>;
  companyId?: Ref<number | undefined>;
  language?: Ref<string>;
  configuration: {
    imageSearchFiltersGrid: MediaImageProductSearchInput;
    imageVariantFiltersSmall: TransformationsInput;
  };
}

export interface CartSettingsInput {
  paymentMethod?: string;
  carrier?: string;
  requestDate?: string;
  reference?: string;
  notes?: string;
}

export interface PlaceOrderOptions {
  isQuoteMode?: boolean;
  reference?: string;
  notes?: string;
}

export interface PlaceOrderResult {
  success: boolean;
  orderId?: number;
  error?: string;
}

export interface UseCheckoutReturn {
  loading: Ref<boolean>;
  error: Ref<string | null>;
  updateCartAddress: (cartId: string, type: 'INVOICE' | 'DELIVERY', address: any) => Promise<Cart | null>;
  updateCartSettings: (cartId: string, input: CartSettingsInput) => Promise<Cart | null>;
  placeOrder: (cartId: string, options?: PlaceOrderOptions) => Promise<PlaceOrderResult>;
  getUserDefaultAddress: (type: 'invoice' | 'delivery') => Address | undefined;
  buildAddressInput: (type: 'INVOICE' | 'DELIVERY', addr: any) => CartUpdateAddressInput;
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useCheckout(options: UseCheckoutOptions): UseCheckoutReturn {
  const { graphqlClient, user, configuration } = options;
  const languageRef = options.language ?? ref('NL');

  const loading = ref(false);
  const error = ref<string | null>(null);

  function buildAddressInput(type: 'INVOICE' | 'DELIVERY', addr: any): CartUpdateAddressInput {
    return {
      type: type === 'INVOICE' ? Enums.CartAddressType.INVOICE : Enums.CartAddressType.DELIVERY,
      firstName: addr.firstName || '',
      lastName: addr.lastName || '',
      street: addr.street || '',
      postalCode: addr.postalCode || '',
      city: addr.city || '',
      company: addr.company,
      gender: addr.gender,
      middleName: addr.middleName,
      number: addr.number,
      numberExtension: addr.numberExtension,
      country: addr.country,
      email: addr.email,
      mobile: addr.mobile,
      phone: addr.phone,
      notes: addr.notes,
      icp: addr.icp,
    };
  }

  function getUserDefaultAddress(type: 'invoice' | 'delivery'): Address | undefined {
    const u = user.value;
    if (!u) return undefined;
    return type === 'invoice'
      ? getDefaultInvoiceAddress(u)
      : getDefaultDeliveryAddress(u);
  }

  async function updateCartAddress(cartId: string, type: 'INVOICE' | 'DELIVERY', address: any): Promise<Cart | null> {
    loading.value = true;
    error.value = null;
    try {
      const service = new CartService(graphqlClient);
      const input = buildAddressInput(type, address);
      const updated = await service.updateCartAddress({
        id: cartId,
        input,
        imageSearchFilters: configuration.imageSearchFiltersGrid,
        imageVariantFilters: configuration.imageVariantFiltersSmall,
        language: languageRef.value || 'NL',
      });
      return updated;
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to save address';
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function updateCartSettings(cartId: string, input: CartSettingsInput): Promise<Cart | null> {
    loading.value = true;
    error.value = null;
    try {
      const service = new CartService(graphqlClient);
      const cartInput: Record<string, any> = {};
      if (input.paymentMethod) cartInput.paymentData = { method: input.paymentMethod };
      if (input.carrier || input.requestDate) {
        cartInput.postageData = {};
        if (input.carrier) cartInput.postageData.carrier = input.carrier;
        if (input.requestDate) cartInput.postageData.requestDate = input.requestDate;
      }
      if (input.reference !== undefined) cartInput.reference = input.reference || undefined;
      if (input.notes !== undefined) cartInput.notes = input.notes || undefined;

      const updated = await service.updateCart({
        id: cartId,
        input: cartInput,
        imageSearchFilters: configuration.imageSearchFiltersGrid,
        imageVariantFilters: configuration.imageVariantFiltersSmall,
        language: languageRef.value || 'NL',
      });
      return updated;
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to update cart';
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function placeOrder(cartId: string, opts: PlaceOrderOptions = {}): Promise<PlaceOrderResult> {
    loading.value = true;
    error.value = null;
    try {
      const cartService = new CartService(graphqlClient);
      const orderService = new OrderService(graphqlClient);
      const language = languageRef.value || 'NL';

      // Update reference/notes if provided
      if (opts.reference || opts.notes) {
        await cartService.updateCart({
          id: cartId,
          input: {
            reference: opts.reference || undefined,
            notes: opts.notes || undefined,
          },
          imageSearchFilters: configuration.imageSearchFiltersGrid,
          imageVariantFilters: configuration.imageVariantFiltersSmall,
          language,
        });
      }

      const orderStatus = opts.isQuoteMode ? 'REQUEST' : 'NEW';
      const response = await cartService.processCart({
        id: cartId,
        input: { orderStatus, language },
      });

      if (!response?.cartOrderId) throw new Error('No Order ID returned');

      const orderId = response.cartOrderId;

      await orderService.setOrderStatus({
        orderId,
        status: orderStatus,
        payStatus: Enums.PaymentStatuses.OPEN,
        sendOrderConfirmationEmail: !opts.isQuoteMode,
        addPDFAttachment: !opts.isQuoteMode,
        triggerOrderSendConfirmEvent: !opts.isQuoteMode,
        deleteCart: true,
      });

      if (opts.isQuoteMode) {
        await (orderService as any).triggerQuoteSendRequest?.({ orderId, language });
      }

      return { success: true, orderId };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to place order';
      error.value = msg;
      return { success: false, error: msg };
    } finally {
      loading.value = false;
    }
  }

  return {
    loading,
    error,
    updateCartAddress,
    updateCartSettings,
    placeOrder,
    getUserDefaultAddress,
    buildAddressInput,
  };
}
