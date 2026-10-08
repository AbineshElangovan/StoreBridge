export interface CartItem {
  id: string | number;
  quantity: number;
  properties?: Record<string, string>;
}

export interface AddToCartPayload {
  items: CartItem[];
}

export interface CartOperationResult {
  success: boolean;
  cart?: any;
  error?: string;
  redirectTo?: string;
}

/**
 * Helper utilities and contracts for Shopify Ajax Cart interactions.
 */
export class ShopifyCartService {
  /**
   * Build standard Shopify Ajax Cart add payload for pre-orders.
   * Attaches pre-order line-item properties so merchants can distinguish pre-orders in Shopify admin.
   */
  static buildPreorderPayload(variantId: string | number, quantity = 1): AddToCartPayload {
    return {
      items: [
        {
          id: variantId,
          quantity: Math.max(1, quantity),
          properties: {
            _preorder: 'true',
            'Pre-order Note': 'This is a pre-order item fulfilled when stock arrives.',
          },
        },
      ],
    };
  }

  /**
   * Validates variant ID and quantity before Ajax call.
   */
  static validatePreorderItem(variantId: string | number, quantity = 1): { valid: boolean; error?: string } {
    if (!variantId) {
      return { valid: false, error: 'Invalid or missing variant ID' };
    }
    if (quantity < 1) {
      return { valid: false, error: 'Quantity must be at least 1' };
    }
    return { valid: true };
  }
}
