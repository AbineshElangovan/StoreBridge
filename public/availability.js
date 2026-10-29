/**
 * StoreBridge Customer Experience
 * Product Availability / Pre-order / Notify Me
 *
 * Responsibilities:
 * 1. Detect Shopify product form
 * 2. Detect selected variant
 * 3. Read variant inventory (including StoreBridge backend inventory)
 * 4. Load StoreBridge configuration
 * 5. Decide AVAILABLE / PREORDER / NOTIFY_ME / SOLD_OUT
 * 6. Replace native unavailable purchase UI
 * 7. Add Pre-order items to Shopify normal cart
 * 8. Register Notify Me customers
 */

(function () {
  'use strict';
  if (window.__STOREBRIDGE_AVAILABILITY_LOADED__) {
    return;
  }
  window.__STOREBRIDGE_AVAILABILITY_LOADED__ = true;

  // Strict page isolation: Purge cart UI if not on /cart page
  if (!isCartPage()) {
    document.documentElement.classList.remove('storebridge-custom-cart-active');
    if (document.body) document.body.classList.remove('storebridge-custom-cart-active');
    const strayCart = document.getElementById('storebridge-cart-page');
    if (strayCart) strayCart.remove();
  } else {
    try {
      if (sessionStorage.getItem('storebridge_has_preorder') === 'true') {
        document.documentElement.classList.add('storebridge-custom-cart-active');
        if (document.body) document.body.classList.add('storebridge-custom-cart-active');
      }
    } catch (e) {}
  }

  // ============================================================
  // CONFIGURATION
  // ============================================================

  const DEFAULT_CONFIG = {
    shop: '',
    productId: '',
    productTitle: '',
    productUrl: '',
    productImage: '',

    apiUrl: '',
    variantsInventory: {},

    preorder: {
      enabled: false,
      isTargeted: false,
      inventoryThreshold: 0,
      customerMessage: "Pre-order before it's gone.",
      shippingMessage: "Shipping: As soon as possible",
      fulfillmentMessage:
        "We will fulfill the item as soon as it becomes available",
      maxQuantity: null,
      discountType: 'none',
      discountValue: 0,
      allowHalfPayment: true,
      allowFullPayment: true,
      defaultPaymentOption: 'HALF'
    },

    notifyMe: {
      enabled: false,
      notifyEmail: true,
      notifyWhatsApp: true,
      popupMessage: "Get notified when this item is back in stock.",
      buttonText: "Notify me",
      successMessage: "You're on the list!"
    }
  };

  let config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

  let productVariants = [];

  let nativeButtonState = null;
  let nativePaymentButtonState = null;

  let activeVariantId = null;
  let activeAvailabilityState = 'AVAILABLE';

  let modalCreated = false;

  let initializationStarted = false;

  const configCache = new Map();

  // ============================================================
  // HELPERS
  // ============================================================

  function log(...args) {
    console.log('[StoreBridge]', ...args);
  }

  function warn(...args) {
    console.warn('[StoreBridge]', ...args);
  }

  function escapeHtml(value) {
    if (value === null || value === undefined) {
      return '';
    }

    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalizeId(value) {
    if (!value) return '';

    return String(value)
      .replace('gid://shopify/ProductVariant/', '')
      .trim();
  }

  function parseCurrencyAmount(rawStr) {
    if (!rawStr) return 0;
    const match = String(rawStr).replace(/^[^\d]+/, '').replace(/,/g, '').match(/\d+(\.\d+)?/);
    return match ? parseFloat(match[0]) : 0;
  }

  function getCurrencyPrefix() {
    if (window.Shopify && window.Shopify.currency && window.Shopify.currency.active) {
      if (window.Shopify.currency.active === 'USD') return '$';
      if (window.Shopify.currency.active === 'INR') return 'Rs. ';
    }
    return 'Rs. ';
  }

  function formatMoney(amount) {
    const num = Number(amount || 0);
    const formatted = num.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return `${getCurrencyPrefix()}${formatted}`;
  }


  // ============================================================
  // ROOT ELEMENT
  // ============================================================

    function getRootElement() {
    return (
      document.getElementById('storebridge-availability') ||
      document.getElementById('storebridge-cart-embed') ||
      document.getElementById('storebridge-global-embed')
    );
  }

  // ============================================================
  // PRODUCT FORM DETECTION
  // ============================================================

  function getProductForm() {
    const selectors = [
      'product-form form',
      'form[action*="/cart/add"]',
      'form.shopify-product-form',
      'form[data-type="add-to-cart-form"]',
      'form[id^="product-form-"]',
      'form[id*="AddToCart"]',
      'form[id*="add-to-cart"]',
      '#product_form',
      'product-form'
    ];

    for (const selector of selectors) {
      const form = document.querySelector(selector);

      if (form) {
        return form;
      }
    }

    return null;
  }

  function getNativeSubmitButton(form) {
    if (!form) return null;

    const selectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button[name="add"]',
      '.product-form__submit',
      '[data-action="add-to-cart"]'
    ];

    for (const selector of selectors) {
      const button = form.querySelector(selector);

      if (button) {
        return button;
      }
    }

    if (form.id) {
      const externalButton =
        document.querySelector(
          `button[form="${CSS.escape(form.id)}"][type="submit"]`
        ) ||
        document.querySelector(
          `button[form="${CSS.escape(form.id)}"][name="add"]`
        );

      if (externalButton) {
        return externalButton;
      }
    }

    return null;
  }

  // ============================================================
  // ACCELERATED CHECKOUT / BUY NOW
  // ============================================================

  function getPaymentButtonContainer() {
    const selectors = [
      '.shopify-payment-button',
      '[data-shopify="payment-button"]',
      'button[name="checkout"]',
      '.dynamic-checkout__content'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);

      if (element) {
        return element;
      }
    }

    return null;
  }

  // ============================================================
  // VARIANT DETECTION
  // ============================================================

  function getSelectedVariantId(form) {
    /*
     * 1. Shopify product form variant ID
     */
    if (form) {
      const input =
        form.querySelector('input[name="id"]') ||
        form.querySelector('select[name="id"]');

      if (input && input.value) {
        return normalizeId(input.value);
      }
    }

    const globalIdInput = document.querySelector('form[action*="/cart/add"] input[name="id"], form[action*="/cart/add"] select[name="id"], input[name="id"]');
    if (globalIdInput && globalIdInput.value) {
      return normalizeId(globalIdInput.value);
    }

    /*
     * 2. URL ?variant=
     */
    try {
      const params = new URLSearchParams(window.location.search);
      const urlVariant = params.get('variant');

      if (urlVariant) {
        return normalizeId(urlVariant);
      }
    } catch (error) {
      // Ignore
    }

    /*
     * 3. Match checked options in DOM against known variants
     */
    try {
      const checkedInputs = Array.from(document.querySelectorAll('variant-radios input:checked, .product-form__input input[type="radio"]:checked, fieldset input[type="radio"]:checked'));
      if (checkedInputs.length > 0 && productVariants.length > 0) {
        const selectedValues = checkedInputs.map(i => (i.value || '').trim().toLowerCase()).filter(Boolean);
        const match = productVariants.find(v => {
          const title = (v.title || '').toLowerCase();
          return selectedValues.every(val => title.includes(val));
        });
        if (match && match.id) {
          return normalizeId(match.id);
        }
      }
    } catch (e) {
      // Ignore
    }

    /*
     * 4. Root element dataset
     */
    const root = getRootElement();

    if (root && root.dataset.selectedVariantId) {
      return normalizeId(root.dataset.selectedVariantId);
    }

    /*
     * 5. First variant fallback
     */
    if (productVariants.length > 0) {
      return normalizeId(productVariants[0].id);
    }

    return '';
  }

  function getSelectedVariant(variantId) {
    const cleanId = normalizeId(variantId);

    if (!cleanId) {
      return productVariants[0] || null;
    }

    let found = productVariants.find(
      (variant) => normalizeId(variant.id) === cleanId
    );

    if (!found && cleanId) {
      const form = getProductForm();
      const nativeBtn = getNativeSubmitButton(form);
      const isSoldOut = nativeBtn
        ? Boolean(nativeBtn.disabled || (nativeBtn.textContent || '').toLowerCase().includes('sold out'))
        : true;
      const domPrice = document.querySelector('.price-item--regular, .price, .product__price')?.textContent || '';

      found = {
        id: cleanId,
        title: 'Selected Item',
        available: !isSoldOut,
        inventory_quantity: isSoldOut ? 0 : 999,
        price: domPrice
      };
      productVariants.push(found);
    }

    return found || null;
  }

  // ============================================================
  // INVENTORY
  // ============================================================

  function getInventoryState(variant) {
    if (!variant) {
      return {
        available: false,
        inventoryQuantity: 0
      };
    }

    const cleanId = normalizeId(variant.id);
    let quantity = null;

    // Check StoreBridge backend inventory first if available
    if (config.variantsInventory && config.variantsInventory[cleanId] !== undefined) {
      quantity = Number(config.variantsInventory[cleanId]);
    } else if (variant.inventory_quantity !== null && variant.inventory_quantity !== undefined) {
      quantity = Number(variant.inventory_quantity);
    }

    const hasQuantity = Number.isFinite(quantity);
    const finalQuantity = hasQuantity ? quantity : (variant.available ? 999 : 0);

    return {
      // If backend reports <= 0, item is out of stock regardless of Shopify's "continue selling" flag
      available: Boolean(variant.available) && (!hasQuantity || quantity > 0),
      inventoryQuantity: finalQuantity
    };
  }

  // ============================================================
  // AVAILABILITY ENGINE
  // ============================================================

  function resolveAvailabilityState(inventoryState, nativeButton) {
    const isNativeSoldOut = nativeButton && (
      Boolean(nativeButton.disabled) ||
      (nativeButton.textContent || '').toLowerCase().includes('sold out')
    );

    const inventory = inventoryState.inventoryQuantity;

    const threshold = Number.isFinite(
      Number(config.preorder.inventoryThreshold)
    )
      ? Number(config.preorder.inventoryThreshold)
      : 0;

    /*
     * Available only when:
     * Shopify says available AND inventory is strictly above threshold
     * AND the native button is not disabled/sold out
     */
    if (
      !isNativeSoldOut &&
      inventoryState.available &&
      inventory > threshold
    ) {
      return 'AVAILABLE';
    }

    /*
     * Out of stock / threshold reached
     * Strictly trigger Pre-order only if enabled AND product is targeted
     */
    const isTargeted = Boolean(config.preorder && config.preorder.isTargeted === true);

    if (config.preorder && config.preorder.enabled && isTargeted && inventory <= threshold) {
      return 'PREORDER';
    }

    if (config.notifyMe && config.notifyMe.enabled) {
      return 'NOTIFY_ME';
    }

    return 'SOLD_OUT';
  }

  // ============================================================
  // NATIVE BUTTON STATE
  // ============================================================

  function saveNativeButtonState(button) {
    if (!button || nativeButtonState) {
      return;
    }

    nativeButtonState = {
      display: button.style.display,
      visibility: button.style.visibility,
      opacity: button.style.opacity,
      disabled: button.disabled,
      ariaDisabled: button.getAttribute('aria-disabled')
    };
  }

  function restoreNativeButton(button) {
    if (!button || !nativeButtonState) {
      return;
    }

    button.style.display = nativeButtonState.display;
    button.style.visibility = nativeButtonState.visibility;
    button.style.opacity = nativeButtonState.opacity;

    button.disabled = nativeButtonState.disabled;

    if (nativeButtonState.ariaDisabled === null) {
      button.removeAttribute('aria-disabled');
    } else {
      button.setAttribute(
        'aria-disabled',
        nativeButtonState.ariaDisabled
      );
    }
  }

  function hideNativeButton(button) {
    if (!button) return;

    saveNativeButtonState(button);

    button.style.setProperty('display', 'none', 'important');
  }

  // ============================================================
  // BUY NOW BUTTON
  // ============================================================

  function savePaymentButtonState(element) {
    if (!element || nativePaymentButtonState) {
      return;
    }

    nativePaymentButtonState = {
      display: element.style.display,
      visibility: element.style.visibility,
      opacity: element.style.opacity
    };
  }

  function hidePaymentButton() {
    const selectors = [
      '.shopify-payment-button',
      '[data-shopify="payment-button"]',
      'button[name="checkout"]',
      '.shopify-payment-button__button',
      '.shopify-payment-button__button--unbranded',
      '.dynamic-checkout__content'
    ];

    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        savePaymentButtonState(element);
        element.style.setProperty('display', 'none', 'important');
      });
    });
  }

  function restorePaymentButton() {
    const selectors = [
      '.shopify-payment-button',
      '[data-shopify="payment-button"]',
      'button[name="checkout"]',
      '.shopify-payment-button__button',
      '.shopify-payment-button__button--unbranded',
      '.dynamic-checkout__content'
    ];

    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        element.style.removeProperty('display');
      });
    });
  }

  // ============================================================
  // QUANTITY SELECTOR STATE
  // ============================================================

  let savedQuantityElements = [];

  function hideQuantitySelector(form) {
    document.documentElement.classList.add('storebridge-notify-active');
    document.body?.classList.add('storebridge-notify-active');

    const selectors = [
      '.product-form__quantity',
      'quantity-input',
      'quantity-popover',
      '.quantity',
      '.product-form__input--quantity',
      '[data-quantity-input]',
      '.product__quantity',
      '.price-per-item__container',
      '.quantity__input',
      '.quantity__button'
    ];

    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        if (!savedQuantityElements.some((item) => item.element === element)) {
          savedQuantityElements.push({
            element,
            display: element.style.display
          });
        }
        element.style.setProperty('display', 'none', 'important');
        element.style.setProperty('visibility', 'hidden', 'important');
      });
    });

    document.querySelectorAll('input[name="quantity"], input[name="qty"]').forEach((qtyInput) => {
      const parent = qtyInput.closest(
        '.product-form__quantity, quantity-input, quantity-popover, .quantity, .product-form__input, .product__quantity'
      );
      const target = parent || qtyInput;
      if (!savedQuantityElements.some((item) => item.element === target)) {
        savedQuantityElements.push({
          element: target,
          display: target.style.display
        });
      }
      target.style.setProperty('display', 'none', 'important');
      target.style.setProperty('visibility', 'hidden', 'important');
      qtyInput.style.setProperty('display', 'none', 'important');
    });

    document.querySelectorAll('button[name="minus"], button[name="plus"]').forEach((btn) => {
      const parent = btn.closest('quantity-input, .quantity, .product-form__quantity') || btn;
      parent.style.setProperty('display', 'none', 'important');
      parent.style.setProperty('visibility', 'hidden', 'important');
    });
  }

  function restoreQuantitySelector() {
    document.documentElement.classList.remove('storebridge-notify-active');
    document.body?.classList.remove('storebridge-notify-active');

    savedQuantityElements.forEach(({ element, display }) => {
      if (display) {
        element.style.display = display;
      } else {
        element.style.removeProperty('display');
      }
      element.style.removeProperty('visibility');
    });
    savedQuantityElements = [];
  }

  // ============================================================
  // REMOVE STOREBRIDGE UI
  // ============================================================

  function removeAvailabilityUI() {
    document
      .querySelectorAll('[data-storebridge="ui-container"]')
      .forEach((element) => element.remove());
  }

  // ============================================================
  // GET QUANTITY
  // ============================================================

  function getSelectedQuantity(form) {
    const quantityInput =
      form?.querySelector('input[name="quantity"]') ||
      document.querySelector('input[name="quantity"]');

    if (!quantityInput) {
      return 1;
    }

    const quantity = Number(quantityInput.value);

    if (!Number.isInteger(quantity) || quantity < 1) {
      return 1;
    }

    return quantity;
  }

  // ============================================================
  // PREORDER SUBMISSION
  // ============================================================

  async function handlePreorderSubmit(
    variantId,
    quantity,
    button
  ) {
    if (!variantId || !button) {
      return;
    }

    const originalText = button.innerHTML;

    let customerEmail = window.Shopify?.customer?.email || '';
    if (!customerEmail) {
      try { customerEmail = localStorage.getItem('storebridge_customer_email') || ''; } catch(e){}
    }

    button.disabled = true;

    button.innerHTML =
      '<span class="storebridge-spinner"></span> Adding to cart...';

    try {
      const rootPath =
        window.Shopify?.routes?.root || '/';

      try { sessionStorage.setItem('storebridge_has_preorder', 'true'); } catch(e){}
      const addUrl = `${rootPath}cart/add.js`;
      const cartUrl = `${rootPath}cart`;

      let finalQuantity = Math.max(
        1,
        Number(quantity) || 1
      );

      if (
        config.preorder.maxQuantity !== null &&
        Number.isFinite(Number(config.preorder.maxQuantity))
      ) {
        finalQuantity = Math.min(
          finalQuantity,
          Number(config.preorder.maxQuantity)
        );
      }

      const hasOffer =
        config.preorder &&
        config.preorder.discountType &&
        config.preorder.discountType !== 'none' &&
        Number(config.preorder.discountValue) > 0;

      const offerText = hasOffer
        ? (config.preorder.discountType === 'percentage'
            ? `${config.preorder.discountValue}% OFF`
            : `Rs. ${config.preorder.discountValue} OFF`)
        : '';

      const selVariant = getSelectedVariant(variantId);
      const rawPrice = selVariant?.price;
      let numPrice = 0;
      if (typeof rawPrice === 'number') {
        numPrice = rawPrice / 100;
      } else if (typeof rawPrice === 'string' && rawPrice.trim()) {
        numPrice = parseCurrencyAmount(rawPrice);
      }

      // Fallback: check price from product page DOM if variant price parsing returned zero
      if (numPrice <= 0) {
        const domPriceText =
          document.querySelector('.price__regular .price-item--regular, .price-item--regular, .price, .product__price')?.textContent || '';
        numPrice = parseCurrencyAmount(domPriceText);
        if (numPrice <= 0) numPrice = 1240;
      }

      let discountedPriceText = '';
      let savingsText = '';

      if (hasOffer && numPrice > 0) {
        const discountAmt = config.preorder.discountType === 'percentage'
          ? (numPrice * Number(config.preorder.discountValue)) / 100
          : Number(config.preorder.discountValue);
        const finalPrice = Math.max(0, numPrice - discountAmt);
        discountedPriceText = `Rs. ${finalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        savingsText = config.preorder.discountType === 'percentage'
          ? `Save ${config.preorder.discountValue}% (Rs. ${discountAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
          : `Save Rs. ${discountAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }

      const paymentPlan = window.__STOREBRIDGE_SELECTED_PLAN__ || (config.preorder.allowHalfPayment !== false ? 'HALF' : 'FULL');
      const isHalf = paymentPlan === 'HALF';
      const baseProductPrice = (hasOffer && numPrice > 0)
        ? Math.max(0, numPrice - (config.preorder.discountType === 'percentage' ? (numPrice * Number(config.preorder.discountValue)) / 100 : Number(config.preorder.discountValue)))
        : numPrice;
      const initialDue = isHalf ? Math.round((baseProductPrice / 2) * 100) / 100 : baseProductPrice;
      const remainingDue = isHalf ? Math.round((baseProductPrice - initialDue) * 100) / 100 : 0;

      const response = await fetch(addUrl, {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },

        body: JSON.stringify({
          items: [
            {
              id: Number(variantId),
              quantity: finalQuantity,

              properties: {
                _preorder: 'true',
                'Pre-order': 'Pre-order Item',
                'Payment Option': isHalf ? 'Half Payment (50% Deposit)' : 'Full Payment (100%)',
                _paymentOption: isHalf ? 'HALF' : 'FULL',
                'Total Product Price': `Rs. ${baseProductPrice.toFixed(2)}`,
                _totalAmount: baseProductPrice.toFixed(2),
                'Initial Amount Paid': `Rs. ${initialDue.toFixed(2)}`,
                _depositAmount: initialDue.toFixed(2),
                'Remaining Balance Due': `Rs. ${remainingDue.toFixed(2)}`,
                _remainingAmount: remainingDue.toFixed(2),
                'Pre-order Note':
                  config.preorder.fulfillmentMessage ||
                  'This is a pre-order item fulfilled when stock arrives.',
                ...(hasOffer
                  ? {
                      'Pre-order Offer': offerText,
                      ...(discountedPriceText ? { 'Pre-order Price': discountedPriceText } : {}),
                      ...(savingsText ? { 'Offer Savings': savingsText } : {})
                    }
                  : {})
              }
            }
          ]
        })
      });

      let responseData = null;

      try {
        responseData = await response.json();
      } catch {
        responseData = null;
      }

      if (!response.ok) {
        throw new Error(
          responseData?.description ||
            responseData?.message ||
            'Could not add pre-order item to cart.'
        );
      }

      button.innerHTML =
        'Added! Redirecting...';

      try {
        const pendingItem = {
          variantId: String(variantId),
          quantity: finalQuantity,
          productTitle: selVariant?.product?.title || document.querySelector('.product__title, h1')?.textContent?.trim() || 'Pre-order Item',
          variantTitle: selVariant?.title || null,
          paymentOption: isHalf ? 'HALF' : 'FULL',
          totalAmount: Math.round(baseProductPrice * finalQuantity * 100) / 100,
          depositAmount: Math.round(initialDue * finalQuantity * 100) / 100,
          remainingBalance: Math.round(remainingDue * finalQuantity * 100) / 100,
          timestamp: Date.now()
        };
        localStorage.setItem('storebridge_pending_preorder', JSON.stringify(pendingItem));

        try {
          const shop = config.shop || window.Shopify?.shop || 'eshan-inventory-solutions.myshopify.com';
          const apiUrl = config.apiUrl || 'https://dz50mdfc-3000.inc1.devtunnels.ms';

          fetch(`${apiUrl}/api/storefront/record-preorder`, {
            method: 'POST',
            keepalive: true,
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Shop-Domain': shop,
              'X-Tunnel-Skip-Anti-Phishing-Page': '1',
              Accept: 'application/json'
            },
            body: JSON.stringify({
              shop,
              orderNumber: 'auto',
              variantId: String(variantId),
              customerName: window.Shopify?.customer?.name || (customerEmail ? customerEmail.split('@')[0] : 'Customer'),
              customerEmail: customerEmail,
              customerPhone: null,
              quantity: finalQuantity,
              productTitle: pendingItem.productTitle,
              variantTitle: pendingItem.variantTitle,
              paymentOption: pendingItem.paymentOption,
              totalAmount: pendingItem.totalAmount,
              depositAmount: pendingItem.depositAmount,
              remainingBalance: pendingItem.remainingBalance,
              paymentStatus: isHalf ? 'PARTIALLY_PAID' : 'PAID',
              currency: 'INR'
            })
          }).catch(function() {});
        } catch (postErr) {}
      } catch (e) {}

      window.location.href = cartUrl;
    } catch (error) {
      console.error(
        '[StoreBridge:Preorder]',
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : 'Unable to add the pre-order item to cart.'
      );

      button.disabled = false;
      button.innerHTML = originalText;
    }
  }

  // ============================================================
  // RENDER PREORDER
  // ============================================================

  function renderPreorderUI(
    form,
    nativeButton,
    variant
  ) {
    hideNativeButton(nativeButton);
    hidePaymentButton();
    restoreQuantitySelector();

    removeAvailabilityUI();

    const container = document.createElement('div');

    container.setAttribute(
      'data-storebridge',
      'ui-container'
    );

    container.className =
      'storebridge-wrapper';

    // Calculate product price from variant or DOM
    const rawPrice = variant?.price;
    let numPrice = 0;
    if (typeof rawPrice === 'number') {
      numPrice = rawPrice / 100;
    } else if (typeof rawPrice === 'string' && rawPrice.trim()) {
      numPrice = parseCurrencyAmount(rawPrice);
    }
    if (numPrice <= 0) {
      const domPriceText =
        document.querySelector('.price__regular .price-item--regular, .price-item--regular, .price, .product__price')?.textContent || '';
      numPrice = parseCurrencyAmount(domPriceText);
      if (numPrice <= 0) numPrice = 500;
    }

    const hasOffer =
      config.preorder &&
      config.preorder.discountType &&
      config.preorder.discountType !== 'none' &&
      Number(config.preorder.discountValue) > 0;

    let discountAmt = 0;
    let finalPrice = numPrice;
    if (hasOffer) {
      discountAmt = config.preorder.discountType === 'percentage'
        ? (numPrice * Number(config.preorder.discountValue)) / 100
        : Number(config.preorder.discountValue);
      finalPrice = Math.max(0, numPrice - discountAmt);
    }

    const allowHalf = (config && config.preorder) ? config.preorder.allowHalfPayment !== false : true;
    const allowFull = (config && config.preorder) ? config.preorder.allowFullPayment !== false : true;
    let defaultPlan = (config && config.preorder && config.preorder.defaultPaymentOption) || 'HALF';
    if (!allowHalf && allowFull) defaultPlan = 'FULL';
    if (allowHalf && !allowFull) defaultPlan = 'HALF';

    let currentPlan = window.__STOREBRIDGE_SELECTED_PLAN__ || defaultPlan;
    if (currentPlan === 'HALF' && !allowHalf) currentPlan = 'FULL';
    if (currentPlan === 'FULL' && !allowFull) currentPlan = 'HALF';
    window.__STOREBRIDGE_SELECTED_PLAN__ = currentPlan;

    const halfInitial = Math.round((finalPrice / 2) * 100) / 100;
    const halfRemaining = Math.round((finalPrice - halfInitial) * 100) / 100;
    const fullInitial = finalPrice;
    const fullRemaining = 0;

    const dueNow = currentPlan === 'HALF' ? halfInitial : fullInitial;
    const dueLater = currentPlan === 'HALF' ? halfRemaining : fullRemaining;

    container.innerHTML = `
      <div class="storebridge-info-card">

        <p class="storebridge-customer-msg">
          ${escapeHtml(
            config.preorder.customerMessage
          )}
        </p>

        <div class="storebridge-shipping-row">

          <svg
            width="15"
            height="15"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fill-rule="evenodd"
              d="M3 4.5A1.5 1.5 0 0 1 4.5 3h7A1.5 1.5 0 0 1 13 4.5v2.25h2.172a1.5 1.5 0 0 1 1.06.44l2.329 2.328a1.5 1.5 0 0 1 .439 1.06V14.5a1.5 1.5 0 0 1-1.5 1.5h-.543a2.502 2.502 0 0 1-4.914 0H8.457a2.502 2.502 0 0 1-4.914 0H3A1.5 1.5 0 0 1 1.5 14.5v-8.5A1.5 1.5 0 0 1 3 4.5Zm3 11a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm8.5 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
              clip-rule="evenodd"
            />
          </svg>

          <span>
            ${escapeHtml(
              config.preorder.shippingMessage
            )}
          </span>

        </div>

        ${
          hasOffer
            ? `
              <div style="margin-top: 8px; padding: 6px 10px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; font-size: 11px; font-weight: 700; color: #065f46; display: flex; align-items: center; justify-content: space-between;">
                <span>Special Pre-order Offer:</span>
                <span style="background: #16a34a; color: #ffffff; padding: 2px 7px; border-radius: 4px; font-size: 11px; font-weight: 800;">
                  ${
                    config.preorder.discountType === 'percentage'
                      ? `${escapeHtml(config.preorder.discountValue)}% OFF`
                      : `Rs. ${escapeHtml(config.preorder.discountValue)} OFF`
                  }
                </span>
              </div>
            `
            : ''
        }

      </div>

      <!-- Payment Options & Deposit Breakdown Block -->
      ${(allowHalf && !allowFull) ? `
        <div class="storebridge-breakdown-card" style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 12px; padding: 12px 14px; font-size: 12px; display: flex; flex-direction: column; gap: 6px; margin: 12px 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #bbf7d0; padding-bottom: 6px;">
            <span style="font-weight: 800; color: #166534; font-size: 13px; display: flex; align-items: center; gap: 6px;">
              <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #22c55e;"></span>
              Pre-order Payment Plan
            </span>
            <span style="background: #22c55e; color: #ffffff; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 800; text-transform: uppercase;">50% Deposit</span>
          </div>
          ${hasOffer ? `
            <div style="display: flex; justify-content: space-between; color: #64748b; font-size: 12px; margin-top: 2px;">
              <span>Original Price:</span>
              <span style="text-decoration: line-through; color: #94a3b8; font-weight: 600;">${formatMoney(numPrice)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; color: #047857; font-size: 12px; font-weight: 700;">
              <span>Pre-order Discount (${config.preorder.discountType === 'percentage' ? `${escapeHtml(config.preorder.discountValue)}% OFF` : `Rs. ${escapeHtml(config.preorder.discountValue)} OFF`}):</span>
              <span>- ${formatMoney(discountAmt)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; color: #0f172a; font-size: 12px; font-weight: 700; border-top: 1px dashed #bbf7d0; padding-top: 4px;">
              <span>Total Product Price:</span>
              <span style="font-weight: 800; color: #0f172a;">${formatMoney(finalPrice)}</span>
            </div>
          ` : `
            <div style="display: flex; justify-content: space-between; color: #475569; font-size: 12px; margin-top: 2px;">
              <span>Total Product Price:</span>
              <span style="font-weight: 700; color: #0f172a;">${formatMoney(finalPrice)}</span>
            </div>
          `}
          <div style="display: flex; justify-content: space-between; color: #15803d; font-weight: 800; font-size: 13px;">
            <span>Due Today (50% Deposit):</span>
            <span>${formatMoney(halfInitial)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; color: #b45309; font-weight: 600; font-size: 11px;">
            <span>Remaining Balance:</span>
            <span>${formatMoney(halfRemaining)} (Due upon restock)</span>
          </div>
          <div style="margin-top: 4px; padding-top: 6px; border-top: 1px dashed #bbf7d0; font-size: 11px; font-weight: 600; color: #166534; text-align: center;">
            Only 50% payment required today to reserve your item.
          </div>
        </div>
      ` : (allowHalf && allowFull) ? `
        <div class="storebridge-payment-options-box" style="margin: 12px 0; display: flex; flex-direction: column; gap: 8px;">
          <div style="font-size: 11px; font-weight: 800; color: #374151; text-transform: uppercase; letter-spacing: 0.04em;">
            Payment Options
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            <label class="storebridge-pay-plan-card" style="display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border: 1.5px solid ${currentPlan === 'HALF' ? '#047857' : '#e5e7eb'}; background: ${currentPlan === 'HALF' ? '#f0fdf4' : '#ffffff'}; border-radius: 10px; cursor: pointer; transition: all 0.15s;">
              <input type="radio" name="storebridge_pay_plan" value="HALF" ${currentPlan === 'HALF' ? 'checked' : ''} style="margin-top: 3px; accent-color: #047857;" />
              <div style="flex: 1;">
                <div style="display: flex; justify-content: space-between; align-items: baseline;">
                  <span style="font-size: 13px; font-weight: 700; color: #111827;">Half Payment (50% Deposit)</span>
                  <span style="font-size: 13px; font-weight: 800; color: #047857;">Pay ${formatMoney(halfInitial)}</span>
                </div>
                <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">
                  ${hasOffer ? `50% of discounted total (${formatMoney(finalPrice)}) • ` : ''}${formatMoney(halfRemaining)} balance due when item is ready to ship
                </div>
              </div>
            </label>

            <label class="storebridge-pay-plan-card" style="display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border: 1.5px solid ${currentPlan === 'FULL' ? '#047857' : '#e5e7eb'}; background: ${currentPlan === 'FULL' ? '#f0fdf4' : '#ffffff'}; border-radius: 10px; cursor: pointer; transition: all 0.15s;">
              <input type="radio" name="storebridge_pay_plan" value="FULL" ${currentPlan === 'FULL' ? 'checked' : ''} style="margin-top: 3px; accent-color: #047857;" />
              <div style="flex: 1;">
                <div style="display: flex; justify-content: space-between; align-items: baseline;">
                  <span style="font-size: 13px; font-weight: 700; color: #111827;">Full Payment (100%)</span>
                  <span style="font-size: 13px; font-weight: 800; color: #111827;">Pay ${formatMoney(fullInitial)}</span>
                </div>
                <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">
                  Pay in full today • Zero remaining balance
                </div>
              </div>
            </label>
          </div>

          <!-- Price & Payment Breakdown -->
          <div class="storebridge-breakdown-card" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; font-size: 12px; display: flex; flex-direction: column; gap: 4px; margin-top: 2px;">
            ${hasOffer ? `
              <div style="display: flex; justify-content: space-between; color: #64748b; font-size: 11px;">
                <span>Original Price:</span>
                <span style="text-decoration: line-through; color: #94a3b8; font-weight: 600;">${formatMoney(numPrice)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; color: #047857; font-size: 11px; font-weight: 700;">
                <span>Pre-order Discount (${config.preorder.discountType === 'percentage' ? `${escapeHtml(config.preorder.discountValue)}% OFF` : `Rs. ${escapeHtml(config.preorder.discountValue)} OFF`}):</span>
                <span>- ${formatMoney(discountAmt)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; color: #0f172a; font-size: 12px; font-weight: 700; border-top: 1px dashed #cbd5e1; padding-top: 4px;">
                <span>Total Product Price:</span>
                <span id="storebridge-total-display" style="font-weight: 800; color: #0f172a;">${formatMoney(finalPrice)}</span>
              </div>
            ` : `
              <div style="display: flex; justify-content: space-between; color: #475569;">
                <span>Total Product Price:</span>
                <span id="storebridge-total-display" style="font-weight: 700; color: #0f172a;">${formatMoney(finalPrice)}</span>
              </div>
            `}
            <div style="display: flex; justify-content: space-between; color: #047857; font-weight: 700;">
              <span id="storebridge-due-label">Due Today (${currentPlan === 'HALF' ? '50% Initial Payment' : 'Full Payment'}):</span>
              <span id="storebridge-due-display">${formatMoney(dueNow)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; color: ${currentPlan === 'HALF' ? '#d97706' : '#94a3b8'}; font-weight: 600;">
              <span>Remaining Balance:</span>
              <span id="storebridge-remaining-display">${formatMoney(dueLater)} ${currentPlan === 'HALF' ? '(Due upon restock)' : ''}</span>
            </div>
            ${currentPlan === 'HALF' ? `
              <div style="margin-top: 4px; padding-top: 6px; border-top: 1px dashed #e2e8f0; font-size: 11px; font-weight: 600; color: #166534; text-align: center;">
                Only 50% payment required today to reserve your item.
              </div>
            ` : ''}
          </div>
        </div>
      ` : ''}

      <p class="storebridge-supporting-msg">
        Don't miss out - Grab yours now before we sell out again!
      </p>

      <button
        type="button"
        class="storebridge-preorder-btn"
        data-storebridge-action="preorder"
      >
        Pre Order
      </button>

      <p class="storebridge-fulfillment-msg">
        ${escapeHtml(
          config.preorder.fulfillmentMessage
        )}
      </p>

      ${
        config.notifyMe.enabled
          ? `
            <button
              type="button"
              class="storebridge-notify-btn"
              data-storebridge-action="notify"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>

              <span>Notify me</span>
            </button>
          `
          : ''
      }
    `;

    insertUIAfterButton(
      nativeButton,
      container
    );

    // Attach dynamic listeners for payment option toggling
    const planInputs = container.querySelectorAll('input[name="storebridge_pay_plan"]');
    const preorderButton = container.querySelector('[data-storebridge-action="preorder"]');

    planInputs.forEach((input) => {
      input.addEventListener('change', (e) => {
        const val = e.target.value;
        window.__STOREBRIDGE_SELECTED_PLAN__ = val;

        // Re-render UI to update cards, breakdown, and button label cleanly
        renderPreorderUI(form, nativeButton, variant);
      });
    });

    preorderButton?.addEventListener(
      'click',
      (event) => {
        event.preventDefault();

        const currentForm = getProductForm();

        const currentVariantId =
          getSelectedVariantId(currentForm);

        const quantity =
          getSelectedQuantity(currentForm);

        handlePreorderSubmit(
          currentVariantId,
          quantity,
          preorderButton
        );
      }
    );

    const notifyButton =
      container.querySelector(
        '[data-storebridge-action="notify"]'
      );

    notifyButton?.addEventListener(
      'click',
      (event) => {
        event.preventDefault();

        const currentForm =
          getProductForm();

        const currentVariantId =
          getSelectedVariantId(currentForm);

        const currentVariant =
          getSelectedVariant(currentVariantId);

        openNotifyMeModal(
          currentVariant
        );
      }
    );
  }

  // ============================================================
  // RENDER NOTIFY ME
  // ============================================================
  function renderNotifyMeUI(
    form,
    nativeButton,
    variant
  ) {
    hideNativeButton(nativeButton);
    hidePaymentButton();
    hideQuantitySelector(form);

    removeAvailabilityUI();

    const container = document.createElement('div');

    container.setAttribute(
      'data-storebridge',
      'ui-container'
    );

    container.className =
      'storebridge-wrapper';

    container.innerHTML = `
      <div class="storebridge-out-of-stock-card">
        <div class="storebridge-out-of-stock-header">
          <span class="storebridge-out-of-stock-dot"></span>
          <span>This product is currently out of stock</span>
        </div>
        <p class="storebridge-out-of-stock-desc">
          Click <strong>Notify me</strong> and enter your details to receive an email notification as soon as stock is back!
        </p>
      </div>

      <button
        type="button"
        class="storebridge-notify-btn"
        data-storebridge-action="notify"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        <span>Notify me</span>
      </button>
    `;

    insertUIAfterButton(
      nativeButton,
      container
    );

    const notifyButton =
      container.querySelector(
        '[data-storebridge-action="notify"]'
      );

    notifyButton?.addEventListener(
      'click',
      (event) => {
        event.preventDefault();

        const currentForm =
          getProductForm();

        const currentVariantId =
          getSelectedVariantId(currentForm);

        const currentVariant =
          getSelectedVariant(
            currentVariantId
          );

        openNotifyMeModal(
          currentVariant
        );
      }
    );
  }

  // ============================================================
  // RENDER SOLD OUT
  // ============================================================

  function renderSoldOutUI(
    form,
    nativeButton
  ) {
    hideNativeButton(nativeButton);
    hidePaymentButton();
    hideQuantitySelector(form);

    removeAvailabilityUI();

    const container = document.createElement('div');

    container.setAttribute(
      'data-storebridge',
      'ui-container'
    );

    container.className =
      'storebridge-wrapper';

    container.innerHTML = `
      <button
        type="button"
        class="storebridge-soldout-btn"
        disabled
      >
        Sold Out
      </button>
    `;

    insertUIAfterButton(
      nativeButton,
      container
    );
  }

  // ============================================================
  // INSERT STOREBRIDGE UI
  // ============================================================

  function insertUIAfterButton(
    button,
    container
  ) {
    if (
      button &&
      button.parentNode
    ) {
      button.parentNode.insertBefore(
        container,
        button.nextSibling
      );

      return;
    }

    const form = getProductForm();

    if (
      form &&
      form.parentNode
    ) {
      form.parentNode.insertBefore(
        container,
        form.nextSibling
      );
    }
  }

  // ============================================================
  // RESTORE NORMAL SHOPIFY UI
  // ============================================================

  function restoreNormalPurchaseUI(
    nativeButton
  ) {
    removeAvailabilityUI();

    restoreNativeButton(
      nativeButton
    );

    restorePaymentButton();
    restoreQuantitySelector();
  }

  // ============================================================
  // UPDATE AVAILABILITY
  // ============================================================

  function updateAvailability() {
    const form = getProductForm();

    if (!form) {
      warn(
        'Shopify product form not found.'
      );

      return false;
    }

    const nativeButton =
      getNativeSubmitButton(form);

    if (!nativeButton) {
      warn(
        'Shopify Add to Cart button not found.'
      );

      return false;
    }

    const variantId =
      getSelectedVariantId(form);

    const variant =
      getSelectedVariant(
        variantId
      );

    if (!variant) {
      warn(
        'Selected Shopify variant not found:',
        variantId
      );

      return false;
    }

    const inventoryState =
      getInventoryState(variant);

    const state =
      resolveAvailabilityState(
        inventoryState,
        nativeButton
      );

    activeVariantId =
      normalizeId(variant.id);

    activeAvailabilityState =
      state;

    log(
      'Availability evaluation:',
      {
        variantId: activeVariantId,
        variantTitle: variant.title,
        available: inventoryState.available,
        inventory: inventoryState.inventoryQuantity,
        threshold:
          config.preorder.inventoryThreshold,
        preorder:
          config.preorder.enabled,
        notifyMe:
          config.notifyMe.enabled,
        state
      }
    );

    if (state === 'AVAILABLE') {
      restoreNormalPurchaseUI(
        nativeButton
      );
    }

    if (state === 'PREORDER') {
      renderPreorderUI(
        form,
        nativeButton,
        variant
      );
    }

    if (state === 'NOTIFY_ME') {
      renderNotifyMeUI(
        form,
        nativeButton,
        variant
      );
    }

    if (state === 'SOLD_OUT') {
      renderSoldOutUI(
        form,
        nativeButton
      );
    }

    return true;
  }

  // ============================================================
  // FETCH CONFIG
  // ============================================================

  async function fetchConfig(
    variantId,
    forceRefresh = false
  ) {
    const cleanVariantId =
      normalizeId(variantId);

    if (
      !forceRefresh &&
      configCache.has(cleanVariantId)
    ) {
      const cached =
        configCache.get(
          cleanVariantId
        );

      config.preorder = {
        ...DEFAULT_CONFIG.preorder,
        ...cached.preorder
      };

      config.notifyMe = {
        ...DEFAULT_CONFIG.notifyMe,
        ...cached.notifyMe
      };

      if (cached.variantsInventory) {
        config.variantsInventory = {
          ...(config.variantsInventory || {}),
          ...cached.variantsInventory
        };
      }

      return;
    }

    if (!config.apiUrl) {
      warn(
        'StoreBridge API URL is not configured.'
      );

      return;
    }

    try {
      const params =
        new URLSearchParams();

      params.set(
        'shop',
        config.shop
      );

      if (config.productId && config.productId !== 'undefined') {
        params.set(
          'productId',
          config.productId
        );
      }

      if (cleanVariantId && cleanVariantId !== 'undefined') {
        params.set(
          'variantId',
          cleanVariantId
        );
      }

      const endpoint =
        `${config.apiUrl}/api/storefront/config?${params.toString()}`;

      log(
        'Fetching configuration:',
        endpoint
      );

      const response =
        await fetch(endpoint, {
          method: 'GET',
          headers: {
            'X-Shopify-Shop-Domain':
              config.shop,
            'X-Tunnel-Skip-Anti-Phishing-Page': '1',
            Accept:
              'application/json'
          }
        });

      if (!response.ok) {
        throw new Error(
          `Configuration request failed: ${response.status}`
        );
      }

      const data =
        await response.json();

      if (!data.success) {
        throw new Error(
          data.error ||
            'StoreBridge configuration unavailable'
        );
      }

      const nextConfig = {
        preorder: {
          ...DEFAULT_CONFIG.preorder,
          ...(data.preorder || {})
        },

        notifyMe: {
          ...DEFAULT_CONFIG.notifyMe,
          ...(data.notifyMe || {})
        },

        variantsInventory: data.variantsInventory || {}
      };

      configCache.set(
        cleanVariantId,
        nextConfig
      );

      config.preorder =
        nextConfig.preorder;

      config.notifyMe =
        nextConfig.notifyMe;

      if (data.variantsInventory) {
        config.variantsInventory = {
          ...(config.variantsInventory || {}),
          ...data.variantsInventory
        };
      }

      log(
        'Configuration loaded successfully.',
        { preorder: config.preorder, notifyMe: config.notifyMe, inventory: config.variantsInventory }
      );
      updateAvailability();
    } catch (error) {
      warn(
        'Could not load StoreBridge configuration. Using defaults.',
        error
      );
    }
  }

  // ============================================================
  // VARIANT CHANGE
  // ============================================================

  let variantChangeTimer = null;
  let variantRequestSequence = 0;

  async function handleVariantChange() {
    clearTimeout(
      variantChangeTimer
    );

    variantChangeTimer =
      setTimeout(
        async () => {
          const form =
            getProductForm();

          if (!form) return;

          const variantId =
            getSelectedVariantId(
              form
            );

          if (!variantId) return;

          // Immediate render if variant stock is already known
          updateAvailability();

          const requestId =
            ++variantRequestSequence;

          /*
           * Fetch configuration for the
           * newly selected variant.
           */
          await fetchConfig(
            variantId
          );

          /*
           * Ignore an old request if
           * customer changed variant again.
           */
          if (
            requestId !==
            variantRequestSequence
          ) {
            return;
          }

          updateAvailability();
        },
        100
      );
  }

  function setupVariantListeners() {
    const form =
      getProductForm();

    if (!form) {
      warn(
        'Product form not available yet. Retrying...'
      );

      return;
    }

    /*
     * Shopify variant ID input
     */
    const variantInputs =
      form.querySelectorAll(
        'input[name="id"], select[name="id"]'
      );

    variantInputs.forEach(
      (input) => {
        input.addEventListener(
          'change',
          handleVariantChange
        );

        input.addEventListener(
          'input',
          handleVariantChange
        );
      }
    );

    /*
     * Product option changes (Dawn variant-radios, variant-selects, size/color pills)
     */
    document.addEventListener(
      'change',
      (event) => {
        const target = event.target;
        if (!target) return;

        if (
          target.name === 'id' ||
          target.closest('variant-radios, variant-selects, .product-form__input, product-form, form[action*="/cart/add"]') ||
          target.matches?.('.single-option-selector, input[type="radio"], select')
        ) {
          handleVariantChange();
          setTimeout(handleVariantChange, 50);
          setTimeout(handleVariantChange, 150);
        }
      }
    );

    document.addEventListener(
      'click',
      (event) => {
        const target = event.target;
        if (target && target.closest('variant-radios label, variant-radios input, .product-form__input label, .product-form__input input, input[type="radio"], [data-single-option-selector]')) {
          setTimeout(handleVariantChange, 30);
          setTimeout(handleVariantChange, 120);
        }
      }
    );

    /*
     * Shopify/theme custom event
     */
    document.addEventListener(
      'variant:change',
      handleVariantChange
    );

    document.addEventListener(
      'variantChange',
      handleVariantChange
    );

    /*
     * Browser URL variant changes (popstate + replaceState)
     */
    window.addEventListener(
      'popstate',
      handleVariantChange
    );

    if (!window.__storebridgeHistoryPatched) {
      window.__storebridgeHistoryPatched = true;
      const originalReplaceState = window.history.replaceState;
      window.history.replaceState = function(...args) {
        originalReplaceState.apply(this, args);
        setTimeout(handleVariantChange, 50);
      };
      const originalPushState = window.history.pushState;
      window.history.pushState = function(...args) {
        originalPushState.apply(this, args);
        setTimeout(handleVariantChange, 50);
      };
    }


    /*
     * Observe Shopify changing
     * variant ID programmatically.
     */
    const variantInput =
      form.querySelector(
        'input[name="id"]'
      );

    if (
      variantInput &&
      window.MutationObserver
    ) {
      const observer =
        new MutationObserver(
          () => {
            handleVariantChange();
          }
        );

      observer.observe(
        variantInput,
        {
          attributes: true,
          attributeFilter: [
            'value',
            'data-variant-id'
          ]
        }
      );
    }
  }

  // ============================================================
  // NOTIFY ME MODAL
  // ============================================================

  function createNotifyMeModal() {
    if (modalCreated) {
      return;
    }

    modalCreated = true;

    const wrapper =
      document.createElement('div');

    wrapper.id =
      'storebridge-notify-modal-backdrop';

    wrapper.className =
      'storebridge-modal-backdrop';

    wrapper.innerHTML = `
      <div
        class="storebridge-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="storebridge-modal-title"
      >

        <button
          type="button"
          class="storebridge-modal-close"
          id="storebridge-modal-close"
          aria-label="Close"
        >
          &times;
        </button>

        <div
          id="storebridge-modal-form-view"
        >

          <div class="storebridge-modal-icon">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
            >
              <path
                d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
              />
              <path
                d="M13.73 21a2 2 0 0 1-3.46 0"
              />
            </svg>
          </div>

          <h3
            id="storebridge-modal-title"
            class="storebridge-modal-title"
          >
            Notify me
          </h3>

          <p
            id="storebridge-modal-subtitle"
            class="storebridge-modal-subtitle"
          >
            ${escapeHtml(
              config.notifyMe.popupMessage
            )}
          </p>

          <div
            class="storebridge-modal-product-chip"
          >
            <img
              id="storebridge-modal-product-img"
              class="storebridge-modal-thumb"
              src="${escapeHtml(config.productImage || '')}"
              alt="${escapeHtml(config.productTitle)}"
              style="${config.productImage ? '' : 'display: none;'}"
            />
            <div class="storebridge-modal-product-info">
              <div
                id="storebridge-modal-product-title"
                class="storebridge-modal-product-title"
              >
                ${escapeHtml(
                  config.productTitle
                )}
              </div>

              <div
                id="storebridge-modal-var-title"
                class="storebridge-modal-variant-title"
              >
                Variant: Selected
              </div>
            </div>
          </div>

          <div
            id="storebridge-modal-error"
            class="storebridge-modal-error"
          ></div>

          <form
            id="storebridge-modal-form"
            novalidate
          >

            ${
              config.notifyMe.notifyEmail
                ? `
                  <div class="storebridge-form-group">

                    <label
                      class="storebridge-form-label"
                      for="storebridge-input-email"
                    >
                      Email <span style="color: #ef4444;">*</span>
                    </label>

                    <input
                      type="email"
                      id="storebridge-input-email"
                      class="storebridge-form-input"
                      placeholder="Enter your email"
                      autocomplete="email"
                      required
                    />

                  </div>
                `
                : ''
            }

            <div class="storebridge-form-group">

              <label
                class="storebridge-form-label"
                for="storebridge-input-whatsapp"
              >
                WhatsApp Number <span style="font-weight: normal; color: #6b7280; font-size: 11px;">(Optional)</span>
              </label>

              <div class="storebridge-phone-wrapper">

                <select
                  id="storebridge-country-code"
                  class="storebridge-phone-select"
                  aria-label="Country code"
                >
                  <option value="+91" data-digits="10" selected>IN +91</option>
                  <option value="+1" data-digits="10">US +1</option>
                  <option value="+44" data-digits="10">UK +44</option>
                  <option value="+971" data-digits="9">UAE +971</option>
                  <option value="+966" data-digits="9">SA +966</option>
                  <option value="+65" data-digits="8">SG +65</option>
                  <option value="+61" data-digits="9">AU +61</option>
                  <option value="+1" data-digits="10">CA +1</option>
                  <option value="+974" data-digits="8">QA +974</option>
                  <option value="+965" data-digits="8">KW +965</option>
                  <option value="+60" data-digits="10">MY +60</option>
                  <option value="+49" data-digits="10">DE +49</option>
                </select>

                <input
                  type="tel"
                  id="storebridge-input-whatsapp"
                  class="storebridge-form-input storebridge-phone-input"
                  placeholder="10-digit mobile number"
                  inputmode="numeric"
                  maxlength="10"
                />

              </div>

            </div>

            <button
              type="submit"
              class="storebridge-modal-submit-btn"
              id="storebridge-modal-submit"
            >
              ${escapeHtml(
                config.notifyMe.buttonText ||
                  'Notify me when available'
              )}
            </button>

            <p class="storebridge-modal-terms">
              We'll only notify you when this item is back in stock.
            </p>

          </form>
        </div>

        <div
          id="storebridge-modal-success-view"
          class="storebridge-modal-success"
        >

          <div class="storebridge-success-icon">

            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>

          </div>

          <h3
            id="storebridge-success-title"
            class="storebridge-modal-title"
          >
            ${escapeHtml(
              config.notifyMe.successMessage ||
                "NOTIFY ME"
            )}
          </h3>

          <p class="storebridge-modal-subtitle">
            We'll let you know when this product is back in stock.
          </p>

          <div class="storebridge-modal-success-card">
            <img
              id="storebridge-modal-success-img"
              class="storebridge-modal-success-thumb"
              src="${escapeHtml(config.productImage || '')}"
              alt="${escapeHtml(config.productTitle)}"
              style="${config.productImage ? '' : 'display: none;'}"
            />
            <div class="storebridge-modal-success-info">
              <div
                id="storebridge-modal-success-product-title"
                class="storebridge-modal-product-title"
              >
                ${escapeHtml(config.productTitle)}
              </div>
              <div
                id="storebridge-modal-success-var-title"
                class="storebridge-modal-variant-title"
              >
                Variant: Selected
              </div>
            </div>
          </div>

          <button
            type="button"
            class="storebridge-modal-submit-btn"
            id="storebridge-modal-done"
          >
            Done
          </button>

        </div>

      </div>
    `;

    document.body.appendChild(
      wrapper
    );

    const closeButton =
      wrapper.querySelector(
        '#storebridge-modal-close'
      );

    closeButton?.addEventListener(
      'click',
      closeNotifyMeModal
    );

    const doneButton =
      wrapper.querySelector(
        '#storebridge-modal-done'
      );

    doneButton?.addEventListener(
      'click',
      closeNotifyMeModal
    );

    wrapper.addEventListener(
      'click',
      (event) => {
        if (
          event.target === wrapper
        ) {
          closeNotifyMeModal();
        }
      }
    );

    const modalForm =
      wrapper.querySelector(
        '#storebridge-modal-form'
      );

    modalForm?.addEventListener(
      'submit',
      handleNotifyMeSubmit
    );

    setupPhoneInput();
  }

  function setupPhoneInput() {
    const phoneInput =
      document.getElementById('storebridge-input-whatsapp');
    const countrySelect =
      document.getElementById('storebridge-country-code');

    if (!phoneInput || !countrySelect) {
      return;
    }

    function syncCountryDigits() {
      const selectedOption = countrySelect.options[countrySelect.selectedIndex];
      const digits = Number(selectedOption?.dataset?.digits) || 10;
      phoneInput.maxLength = digits;
      phoneInput.placeholder = `${digits}-digit mobile number`;
      const current = phoneInput.value.replace(/\D/g, '');
      if (current.length > digits) {
        phoneInput.value = current.slice(0, digits);
      }
    }

    syncCountryDigits();

    countrySelect.addEventListener('change', () => {
      syncCountryDigits();
      phoneInput.focus();
    });

    phoneInput.addEventListener('input', () => {
      const selectedOption = countrySelect.options[countrySelect.selectedIndex];
      const digits = Number(selectedOption?.dataset?.digits) || 10;
      phoneInput.value = phoneInput.value.replace(/\D/g, '').slice(0, digits);
    });
  }

  function updateModalContent(
    variant
  ) {
    const subtitle =
      document.getElementById(
        'storebridge-modal-subtitle'
      );

    if (subtitle) {
      subtitle.textContent =
        config.notifyMe.popupMessage;
    }

    const productTitle =
      document.getElementById(
        'storebridge-modal-product-title'
      );

    if (productTitle) {
      productTitle.textContent =
        config.productTitle;
    }

    const variantTitle =
      document.getElementById(
        'storebridge-modal-var-title'
      );

    if (variantTitle) {
      const title =
        variant?.title &&
        variant.title !== 'Default Title'
          ? variant.title
          : 'Selected Item';

      variantTitle.textContent =
        `Variant: ${title}`;
    }

    let currentImg =
      (variant && variant.image) ||
      config.productImage ||
      '';

    if (!currentImg) {
      const root = getRootElement();
      const datasetImg = root?.dataset?.productImage;
      const ogImg = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
      const pageImg = document.querySelector('.product__media img, .product-media img, .product__image img, .product-single__photo, [data-product-single-thumbnail], img[src*="cdn.shopify.com"]')?.getAttribute('src');
      currentImg = datasetImg || ogImg || pageImg || 'https://cdn.shopify.com/s/files/1/0758/9848/6975/files/classic-cotton-t-shirt.png?v=1786435001';
    }
    if (currentImg && currentImg.startsWith('//')) {
      currentImg = 'https:' + currentImg;
    }

    const imgEl =
      document.getElementById(
        'storebridge-modal-product-img'
      );

    if (imgEl) {
      imgEl.src = currentImg;
      imgEl.style.display = 'block';
    }

    const successImgEl =
      document.getElementById(
        'storebridge-modal-success-img'
      );

    if (successImgEl) {
      successImgEl.src = currentImg;
      successImgEl.style.display = 'block';
    }

    const successVarTitle =
      document.getElementById(
        'storebridge-modal-success-var-title'
      );

    if (successVarTitle) {
      const title =
        variant?.title &&
        variant.title !== 'Default Title'
          ? variant.title
          : 'Selected Item';

      successVarTitle.textContent =
        `Variant: ${title}`;
    }

    const submitButton =
      document.getElementById(
        'storebridge-modal-submit'
      );

    if (submitButton) {
      submitButton.textContent =
        config.notifyMe.buttonText ||
        'Notify me when available';
    }

    const successTitle =
      document.getElementById(
        'storebridge-success-title'
      );

    if (successTitle) {
      successTitle.textContent =
        config.notifyMe.successMessage ||
        'NOTIFY ME';
    }
  }

  function openNotifyMeModal(
    variant
  ) {
    createNotifyMeModal();

    updateModalContent(
      variant
    );

    const backdrop =
      document.getElementById(
        'storebridge-notify-modal-backdrop'
      );

    if (!backdrop) {
      return;
    }

    const errorBox =
      document.getElementById(
        'storebridge-modal-error'
      );

    const formView =
      document.getElementById(
        'storebridge-modal-form-view'
      );

    const successView =
      document.getElementById(
        'storebridge-modal-success-view'
      );

    if (errorBox) {
      errorBox.style.display =
        'none';

      errorBox.textContent =
        '';
    }

    if (formView) {
      formView.style.display =
        'block';
    }

    if (successView) {
      successView.style.display =
        'none';
    }

    backdrop.classList.add(
      'is-open'
    );

    document.body.style.overflow =
      'hidden';
  }

  function closeNotifyMeModal() {
    const backdrop =
      document.getElementById(
        'storebridge-notify-modal-backdrop'
      );

    if (backdrop) {
      backdrop.classList.remove(
        'is-open'
      );
    }

    const modalForm =
      document.getElementById(
        'storebridge-modal-form'
      );
    if (modalForm) {
      modalForm.reset();
    }

    document.body.style.overflow =
      '';
  }

  // ============================================================
  // NOTIFY ME SUBMISSION
  // ============================================================

  async function handleNotifyMeSubmit(
    event
  ) {
    event.preventDefault();

    const emailInput =
      document.getElementById(
        'storebridge-input-email'
      );

    const phoneInput =
      document.getElementById(
        'storebridge-input-whatsapp'
      );

    const countrySelect =
      document.getElementById(
        'storebridge-country-code'
      );

    const submitButton =
      document.getElementById(
        'storebridge-modal-submit'
      );

    const errorBox =
      document.getElementById(
        'storebridge-modal-error'
      );

    const email =
      emailInput?.value.trim() || '';

    const phoneDigits =
      phoneInput?.value
        .replace(/\D/g, '')
        .trim() || '';

    const countryCode =
      countrySelect?.value || '+91';

    const selectedOption =
      countrySelect?.options[
        countrySelect.selectedIndex
      ];

    const expectedDigits =
      Number(
        selectedOption?.dataset?.digits
      ) || 10;

    /*
     * Email is strictly required
     */
    if (!email) {
      showModalError(
        'Please enter your email address.'
      );
      emailInput?.focus();
      return;
    }

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      showModalError(
        'Please enter a valid email address.'
      );
      emailInput?.focus();
      return;
    }

    /*
     * Mobile number is optional lead.
     * When entered, must match the exact digit length of the selected country (e.g. 10 for IN/US, 9 for UAE, 8 for SG).
     */
    if (phoneDigits) {
      if (phoneDigits.length !== expectedDigits) {
        showModalError(`Mobile number must be exactly ${expectedDigits} digits.`);
        phoneInput?.focus();
        return;
      }
    }

    const whatsapp =
      phoneDigits
        ? `${countryCode}${phoneDigits}`
        : null;

    const form =
      getProductForm();

    const variantId =
      getSelectedVariantId(form);

    if (!variantId) {
      showModalError(
        'Unable to determine the selected variant.'
      );

      return;
    }

    if (!submitButton) {
      return;
    }

    const originalText =
      submitButton.innerHTML;

    submitButton.disabled =
      true;

    submitButton.innerHTML =
      '<span class="storebridge-spinner"></span> Submitting...';

    if (errorBox) {
      errorBox.style.display =
        'none';

      errorBox.textContent =
        '';
    }

    try {
      const root = getRootElement();
      const shop = config.shop || root?.dataset?.shop || window.Shopify?.shop || 'eshan-namakkal.myshopify.com';
      const productId = config.productId || root?.dataset?.productId || '9195393188027';
      const apiUrl = (config.apiUrl || root?.dataset?.apiUrl || 'https://dz50mdfc-3000.inc1.devtunnels.ms').replace(/\/+$/, '');
      const endpoint = `${apiUrl}/api/storefront/notify-me`;

      const currentVariant = getSelectedVariant(variantId);
      const variantTitle = currentVariant ? currentVariant.title : null;
      const variantPrice = currentVariant ? currentVariant.price : null;
      let variantImage = (currentVariant && currentVariant.image) ? currentVariant.image : (config.productImage || root?.dataset?.productImage || null);

      if (!variantImage) {
        const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
        const pageImg = document.querySelector('.product__media img, .product-media img, .product-single__photo, [data-product-single-thumbnail], img[src*="cdn.shopify.com"]')?.getAttribute('src');
        variantImage = ogImage || pageImg || null;
      }
      if (variantImage && variantImage.startsWith('//')) {
        variantImage = 'https:' + variantImage;
      }

      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), 25000);

      const response =
        await fetch(endpoint, {
          method: 'POST',
          signal: controller.signal,

          headers: {
            'Content-Type':
              'application/json',

            'X-Shopify-Shop-Domain':
              shop,

            'X-Tunnel-Skip-Anti-Phishing-Page': '1',

            Accept:
              'application/json'
          },

          body: JSON.stringify({
            shop: shop,
            shopifyProductId: productId,
            shopifyVariantId: variantId,
            productTitle: config.productTitle || root?.dataset?.productTitle || document.title,
            variantTitle: variantTitle,
            price: variantPrice,
            productUrl: window.location.href,
            imageUrl: variantImage || config.productImage || null,
            email: email || null,
            mobile: whatsapp,
            whatsapp: whatsapp,
            quantity: 1
          })
        });

      clearTimeout(timeoutHandle);

      const data =
        await response.json();

      if (
        response.ok &&
        data.success
      ) {
        const formView =
          document.getElementById(
            'storebridge-modal-form-view'
          );

        const successView =
          document.getElementById(
            'storebridge-modal-success-view'
          );

        if (formView) {
          formView.style.display =
            'none';
        }

        if (successView) {
          successView.style.display =
            'block';

          if (data.emailNotice) {
            const existingNotice = document.getElementById('storebridge-modal-email-notice');
            if (existingNotice) existingNotice.remove();
            const noticeEl = document.createElement('div');
            noticeEl.id = 'storebridge-modal-email-notice';
            noticeEl.style.cssText = 'margin: 10px 0; font-size: 11px; line-height: 1.4; color: #92400e; background: #fef3c7; border: 1px solid #fde68a; border-radius: 6px; padding: 8px 12px; text-align: left;';
            noticeEl.textContent = data.emailNotice;
            const subtitle = successView.querySelector('.storebridge-modal-subtitle');
            if (subtitle) {
              subtitle.after(noticeEl);
            }
          }
        }

        const modalForm =
          document.getElementById(
            'storebridge-modal-form'
          );
        if (modalForm) {
          modalForm.reset();
        }

        return;
      }

      showModalError(
        data.message ||
          data.error ||
          'Failed to submit registration. Please try again.'
      );
    } catch (error) {
      console.error(
        '[StoreBridge:NotifyMe]',
        error
      );

      const msg = (error && error.name === 'AbortError')
        ? 'Request timed out connecting to server. Please try again.'
        : 'Network error connecting to StoreOrbit. Please try again.';

      showModalError(msg);
    } finally {
      submitButton.disabled =
        false;

      submitButton.innerHTML =
        originalText;
    }
  }

  function showModalError(
    message
  ) {
    const errorBox =
      document.getElementById(
        'storebridge-modal-error'
      );

    if (!errorBox) {
      return;
    }

    errorBox.textContent =
      message;

    errorBox.style.display =
      'block';
  }

  // ============================================================
  // PARSE LIQUID VARIANT DATA (WITH AUTO-DISCOVERY FALLBACK)
  // ============================================================

  async function loadProductVariants() {
    const script =
      document.getElementById(
        'storebridge-product-variants-data'
      );

    if (script && script.textContent) {
      try {
        const parsed =
          JSON.parse(
            script.textContent || '[]'
          );

        if (Array.isArray(parsed) && parsed.length > 0) {
          productVariants =
            parsed.map(
              (variant) => ({
                ...variant,
                id: normalizeId(variant.id),
                available: Boolean(variant.available),
                inventory_quantity:
                  variant.inventory_quantity !== null && variant.inventory_quantity !== undefined
                    ? Number(variant.inventory_quantity)
                    : null
              })
            );

          log('Loaded variants from Liquid block:', productVariants);
          return true;
        }
      } catch (error) {
        console.warn('[StoreBridge] Failed to parse Liquid variant data:', error);
      }
    }

    // Dynamic auto-discovery: fetch product JSON from Shopify storefront endpoint
    try {
      if (window.location.pathname.includes('/products/')) {
        const cleanPath = window.location.pathname.replace(/\/+$/, '');
        const res = await fetch(`${cleanPath}.js`, { credentials: 'same-origin' });
        if (res.ok) {
          const data = await res.json();
          if (data && data.variants && Array.isArray(data.variants)) {
            productVariants = data.variants.map((v) => ({
              id: normalizeId(v.id),
              title: v.title,
              available: Boolean(v.available),
              inventory_quantity:
                v.inventory_quantity !== null && v.inventory_quantity !== undefined
                  ? Number(v.inventory_quantity)
                  : null,
              price: v.price ? (v.price > 9999 ? (v.price / 100) : v.price) : 0,
              image: v.featured_image ? (v.featured_image.src || v.featured_image) : null
            }));

            if (!config.productTitle && data.title) config.productTitle = data.title;
            if (!config.productId && data.id) config.productId = String(data.id);
            if (!config.productImage && data.featured_image) config.productImage = data.featured_image;

            log('Auto-discovered variants from Shopify .js endpoint:', productVariants);
            return true;
          }
        }
      }
    } catch (e) {
      console.warn('[StoreBridge] Auto-discovery error:', e);
    }

    return false;
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  async function initializeStoreBridge() {
    if (initializationStarted) {
      return;
    }

    const isProductPage =
      window.location.pathname.includes('/products/') ||
      Boolean(getProductForm());

    if (!isProductPage) {
      return;
    }

    const root = getRootElement();

    initializationStarted = true;

    /*
     * Store information
     */
    config.shop =
      root?.dataset?.shop ||
      window.Shopify?.shop ||
      window.location.hostname;

    config.productId =
      root?.dataset?.productId ||
      document.querySelector('[data-product-id]')?.dataset?.productId ||
      document.querySelector('product-info')?.dataset?.productId ||
      document.querySelector('product-info')?.getAttribute('data-product-id') ||
      document.querySelector('form[action*="/cart/add"] input[name="product-id"]')?.value ||
      (window.ShopifyAnalytics?.meta?.product?.id ? String(window.ShopifyAnalytics.meta.product.id) : '') ||
      (window.__st?.rid ? String(window.__st.rid) : '') ||
      '';

    config.productTitle =
      root?.dataset?.productTitle ||
      document.querySelector('.product__title, h1.product-title, h1')?.textContent?.trim() ||
      document.title;

    config.productUrl =
      root?.dataset?.productUrl ||
      window.location.pathname;

    config.productImage =
      root?.dataset?.productImage ||
      document.querySelector('.product__media img, .product-media img, meta[property="og:image"]')?.getAttribute('content') ||
      '';

    /*
     * StoreBridge API URL
     */
    config.apiUrl =
      root?.dataset?.apiUrl ||
      'https://dz50mdfc-3000.inc1.devtunnels.ms';

    config.apiUrl =
      config.apiUrl.replace(
        /\/+$/,
        ''
      );

    log(
      'StoreBridge initialized',
      {
        shop: config.shop,
        productId: config.productId,
        apiUrl: config.apiUrl
      }
    );

    /*
     * Load variant data from Liquid or auto-fetch
     */
    await loadProductVariants();

    /*
     * Wait for Shopify product form (non-blocking fallback)
     */
    const form =
      await waitForProductForm(3000);

    /*
     * Determine selected variant
     */
    const variantId =
      getSelectedVariantId(
        form
      );

    /*
     * Load variant-specific StoreBridge config
     */
    if (variantId) {
      await fetchConfig(
        variantId
      );
    } else {
      await fetchConfig();
    }

    /*
     * Setup variant listeners
     */
    setupVariantListeners();

    /*
     * Render initial state
     */
    updateAvailability();

    /*
     * Watch for themes replacing the product form dynamically
     */
    setupDomObserver();

    return true;
  }

  // ============================================================
  // WAIT FOR PRODUCT FORM
  // ============================================================

  function waitForProductForm(
    timeout = 10000
  ) {
    return new Promise(
      (resolve) => {
        const existing =
          getProductForm();

        if (existing) {
          resolve(existing);
          return;
        }

        const start =
          Date.now();

        const interval =
          setInterval(
            () => {
              const form =
                getProductForm();

              if (form) {
                clearInterval(
                  interval
                );

                resolve(form);

                return;
              }

              if (
                Date.now() - start >=
                timeout
              ) {
                clearInterval(
                  interval
                );

                resolve(null);
              }
            },
            200
          );
      }
    );
  }

  // ============================================================
  // DOM OBSERVER
  // ============================================================

  function setupDomObserver() {
    if (
      !window.MutationObserver
    ) {
      return;
    }

    const observer =
      new MutationObserver(
        () => {
          const form =
            getProductForm();

          if (!form) {
            return;
          }

          const button =
            getNativeSubmitButton(
              form
            );

          if (!button) {
            return;
          }

          /*
           * If Shopify replaced the product form or variant changed
           */
          const currentVariantId =
            getSelectedVariantId(
              form
            );

          if (
            currentVariantId &&
            currentVariantId !==
              activeVariantId
          ) {
            handleVariantChange();
          } else if (
            activeAvailabilityState &&
            activeAvailabilityState !== 'AVAILABLE'
          ) {
            const hasPreorderUI = document.querySelector('[data-storebridge="ui-container"]');
            if (!hasPreorderUI || (button && button.style.display !== 'none')) {
              updateAvailability();
            }
          }
        }
      );

    observer.observe(
      document.body,
      {
        childList: true,
        subtree: true
      }
    );
  }

  // ============================================================
  // START
  // ============================================================

  function ensureConfig() {
    const root =
      getRootElement() ||
      document.getElementById('storebridge-global-embed') ||
      document.querySelector('[data-storebridge-embed="true"]');
    if (root) {
      if (root.dataset.shop) config.shop = root.dataset.shop;
      if (root.dataset.productId) config.productId = root.dataset.productId;
      if (root.dataset.productTitle) config.productTitle = root.dataset.productTitle;
      if (root.dataset.productUrl) config.productUrl = root.dataset.productUrl;
      if (root.dataset.productImage) config.productImage = root.dataset.productImage;
      if (root.dataset.apiUrl) config.apiUrl = root.dataset.apiUrl;
    }
    if (!config.shop && window.Shopify && window.Shopify.shop) {
      config.shop = window.Shopify.shop;
    }
    if (!config.apiUrl) {
      config.apiUrl = 'https://dz50mdfc-3000.inc1.devtunnels.ms';
    }
    config.apiUrl = config.apiUrl.replace(/\/+$/, '');
    if (productVariants.length === 0) {
      loadProductVariants();
    }
  }

  function attachGlobalDelegatedListeners() {
    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!target) return;

      const notifyBtn = target.closest(
        '[data-storebridge-action="notify"], #storebridge-notify-action-btn, .storebridge-notify-btn'
      );
      if (notifyBtn && !notifyBtn.closest('#storebridge-notify-modal-backdrop')) {
        event.preventDefault();
        event.stopPropagation();
        ensureConfig();
        const currentForm = getProductForm();
        const currentVariantId = getSelectedVariantId(currentForm);
        const currentVariant = getSelectedVariant(currentVariantId);
        openNotifyMeModal(currentVariant);
        return;
      }

      const preorderBtn = target.closest(
        '[data-storebridge-action="preorder"], #storebridge-preorder-action-btn, .storebridge-preorder-btn'
      );
      if (preorderBtn && !preorderBtn.closest('[data-storebridge="ui-container"]') && !preorderBtn.closest('#storebridge-notify-modal-backdrop')) {
        event.preventDefault();
        event.stopPropagation();
        ensureConfig();
        const currentForm = getProductForm();
        const currentVariantId = getSelectedVariantId(currentForm);
        const quantity = getSelectedQuantity(currentForm);
        handlePreorderSubmit(currentVariantId, quantity, preorderBtn);
        return;
      }
    });
  }


  // ============================================================
  // CART PAGE ENHANCER (STRICTLY ISOLATED TO /cart PAGE ONLY)
  // ============================================================

  function isCartPage() {
    const rawPath = (window.location.pathname || '').toLowerCase();
    const cleanPath = rawPath.replace(/\/+$/, '');

    // 1. Strict exclusions: Home page, collections, products, blogs, pages are NEVER the cart page
    if (
      cleanPath === '' ||
      cleanPath === '/' ||
      cleanPath.includes('/products/') ||
      cleanPath.includes('/collections/') ||
      cleanPath.includes('/pages/') ||
      cleanPath.includes('/blogs/') ||
      cleanPath.includes('/search')
    ) {
      return false;
    }

    // 2. Exact match for /cart or internationalized locale paths (e.g. /en/cart, /fr/cart)
    if (cleanPath === '/cart' || cleanPath.endsWith('/cart')) {
      return true;
    }

    // 3. Official Shopify template check
    if (window.Shopify?.template === 'cart' || document.body?.classList?.contains('template-cart')) {
      return true;
    }

    return false;
  }

  function isProductPage() {
    if (isCartPage()) {
      return false;
    }
    const pathname = (window.location.pathname || '').toLowerCase();
    return (
      pathname.includes('/products/') ||
      Boolean(
        document.querySelector(
          '#storebridge-availability, [data-storebridge="availability"]'
        )
      ) ||
      Boolean(
        document.querySelector(
          '.product-form, #product-form, product-info, [data-product-id]'
        )
      )
    );
  }


  function parseOffer(value) {
    if (!value) return { type: 'none', value: 0 };
    const text = String(value).trim();
    if (!text || text.toLowerCase() === 'none' || text.toLowerCase() === 'null') {
      return { type: 'none', value: 0 };
    }

    // 1. Percentage check: e.g. "10% OFF", "10%", "20% OFF"
    const pctMatch = text.match(/(\d+(?:\.\d+)?)\s*%/i);
    if (pctMatch) {
      const val = parseFloat(pctMatch[1]);
      if (val > 0) return { type: 'percentage', value: val };
    }

    // 2. Fixed check: e.g. "Rs. 10 OFF", "Rs 10 OFF", "₹10 OFF", "10 OFF", "$10 OFF"
    const fixedMatch = text.match(/(?:Rs\.?|₹|\$)?\s*(\d+(?:\.\d+)?)\s*(?:Rs\.?|₹|\$)?\s*OFF/i);
    if (fixedMatch) {
      const val = parseFloat(fixedMatch[1]);
      if (val > 0) return { type: 'fixed', value: val };
    }

    const plainFixed = text.match(/(?:Rs\.?|₹|\$)\s*(\d+(?:\.\d+)?)/i);
    if (plainFixed) {
      const val = parseFloat(plainFixed[1]);
      if (val > 0) return { type: 'fixed', value: val };
    }

    return { type: 'none', value: 0 };
  }

  function getItemProperty(item, key) {
    if (!item || !item.properties) return '';
    const props = item.properties;
    if (typeof props === 'object' && !Array.isArray(props)) {
      if (props[key] !== undefined) return String(props[key]);
      const lowerKey = key.toLowerCase();
      for (const k of Object.keys(props)) {
        if (k.toLowerCase() === lowerKey) return String(props[k]);
      }
      return '';
    }
    if (Array.isArray(props)) {
      for (const entry of props) {
        if (Array.isArray(entry) && entry[0] && String(entry[0]).toLowerCase() === key.toLowerCase()) {
          return String(entry[1] || '');
        }
        if (entry && typeof entry === 'object' && entry.name && String(entry.name).toLowerCase() === key.toLowerCase()) {
          return String(entry.value || '');
        }
      }
    }
    return '';
  }

  function isItemPreorder(item) {
    if (!item) return false;
    const props = item.properties;
    if (props) {
      if (typeof props === 'object' && !Array.isArray(props)) {
        if (props._preorder === 'true' || props._preorder === true) return true;
        if (props['Pre-order'] || props['pre-order']) return true;
        if (props['Pre-order Note'] || props['pre-order note']) return true;
        if (props['Pre-order Offer'] || props['pre-order offer'] || props['Offer']) return true;
        for (const k of Object.keys(props)) {
          const lk = k.toLowerCase();
          if (lk.includes('pre-order') || lk.includes('preorder')) return true;
        }
      }
      if (Array.isArray(props)) {
        for (const entry of props) {
          const key = String(entry[0] || entry.name || '').toLowerCase();
          if (key.includes('pre-order') || key.includes('preorder')) return true;
        }
      }
    }
    const title = String(item.title || item.product_title || '').toLowerCase();
    if (title.includes('pre-order') || title.includes('[pre-order]')) return true;
    return false;
  }

  let activeDiscountCode = '';
  let isCartUpdating = false;
  let isEnhancingCart = false;
  let enhanceTimeout = null;
  let cachedRemoteCartConfig = null;
  let lastCartUpdateTimestamp = 0;
  const pendingQtyDebounceTimers = new Map();

  function updateCartTotalsInPlace(root) {
    if (!root) root = document.getElementById('storebridge-cart-page');
    if (!root) return;

    const cards = Array.from(root.querySelectorAll('.storebridge-cart-item-card'));
    if (cards.length === 0) {
      root.innerHTML = `
        <div class="storebridge-cart-header">
          <h1 class="storebridge-cart-title">Cart</h1>
        </div>
        <div class="storebridge-cart-empty">
          <h2>Your cart is empty</h2>
          <p style="color: #64748b; font-size: 15px; margin: 0 0 24px 0;">Your pre-order cart is currently empty.</p>
          <a href="/collections/all" class="storebridge-continue-shopping-btn">Continue shopping</a>
        </div>
      `;
      return;
    }

    let totalOriginalSum = 0;
    let totalDiscountSum = 0;
    let totalFinalSum = 0;
    let totalDueNowSum = 0;
    let totalDueLaterSum = 0;
    let totalItemCount = 0;
    let preorderItemCount = 0;
    let hasHalfPayment = false;

    cards.forEach((card) => {
      const qtySpan = card.querySelector('.storebridge-qty-value');
      const qty = Math.max(0, parseInt(qtySpan?.textContent || '1', 10));
      const unitPrice = parseFloat(card.getAttribute('data-unit-price') || '0');
      const unitDiscount = parseFloat(card.getAttribute('data-unit-discount') || '0');
      const unitFinal = parseFloat(card.getAttribute('data-unit-final') || String(unitPrice - unitDiscount));
      const isPreorder = card.getAttribute('data-is-preorder') === '1';
      const isHalf = card.getAttribute('data-is-half') === '1';

      const unitDueNow = isHalf ? Math.round((unitFinal / 2) * 100) / 100 : unitFinal;
      const unitDueLater = isHalf ? Math.round((unitFinal - unitDueNow) * 100) / 100 : 0;

      if (isPreorder) preorderItemCount += qty;
      if (isHalf) hasHalfPayment = true;
      totalItemCount += qty;

      const lineOriginal = unitPrice * qty;
      const lineDiscount = unitDiscount * qty;
      const lineFinal = unitFinal * qty;
      const lineDueNow = unitDueNow * qty;
      const lineDueLater = unitDueLater * qty;

      totalOriginalSum += lineOriginal;
      totalDiscountSum += lineDiscount;
      totalFinalSum += lineFinal;
      totalDueNowSum += lineDueNow;
      totalDueLaterSum += lineDueLater;

      // Update line prices in card
      const finalPriceEl = card.querySelector('.storebridge-line-final-price');
      if (finalPriceEl) finalPriceEl.textContent = formatMoney(isHalf ? lineDueNow : lineFinal);

      const origPriceEl = card.querySelector('.storebridge-line-original-price');
      if (origPriceEl) {
        if (isHalf) {
          origPriceEl.textContent = `Total: ${formatMoney(lineFinal)}`;
          origPriceEl.style.display = '';
        } else if (unitDiscount > 0) {
          origPriceEl.textContent = formatMoney(lineOriginal);
          origPriceEl.style.display = '';
        } else {
          origPriceEl.style.display = 'none';
        }
      }

      // Update button data-qty
      card.querySelectorAll('.storebridge-qty-btn').forEach((btn) => {
        btn.setAttribute('data-qty', String(qty));
      });
    });

    // Update Header Badge
    const countBadge = root.querySelector('.storebridge-cart-count-badge');
    if (countBadge) countBadge.textContent = String(totalItemCount);

    // Update Summary Original Price row
    const origLabel = root.querySelector('.storebridge-summary-row-label');
    if (origLabel && origLabel.textContent.includes('Original Price')) {
      origLabel.textContent = `Original Price (${totalItemCount} item${totalItemCount > 1 ? 's' : ''})`;
    }
    const origValue = root.querySelector('.storebridge-summary-orig-val, .storebridge-summary-rows .storebridge-summary-row-value');
    if (origValue) origValue.textContent = formatMoney(totalOriginalSum);

    // Update Discount Savings row
    const savingsValue = root.querySelector('.storebridge-summary-row-value.storebridge-savings-red, .storebridge-savings-red');
    if (savingsValue) {
      savingsValue.textContent = `- ${formatMoney(totalDiscountSum)}`;
      const discountRow = savingsValue.closest('.storebridge-summary-row');
      if (discountRow) {
        discountRow.style.display = totalDiscountSum > 0 ? '' : 'none';
      }
    }

    // Update Half Payment specific rows if present
    const totalValEl = root.querySelector('.storebridge-summary-val-total');
    if (totalValEl) totalValEl.textContent = formatMoney(totalFinalSum);

    const depositValEl = root.querySelector('.storebridge-summary-val-deposit');
    if (depositValEl) depositValEl.textContent = formatMoney(totalDueNowSum);

    const remainingValEl = root.querySelector('.storebridge-summary-val-remaining');
    if (remainingValEl) remainingValEl.textContent = formatMoney(totalDueLaterSum);

    // Update Total Box
    const totalBoxValue = root.querySelector('.storebridge-total-box-value, .storebridge-total-value');
    if (totalBoxValue) totalBoxValue.textContent = formatMoney(hasHalfPayment ? totalDueNowSum : totalFinalSum);

    const totalBoxLabel = root.querySelector('.storebridge-total-box-label, .storebridge-total-label');
    if (totalBoxLabel) {
      if (hasHalfPayment) {
        totalBoxLabel.textContent = 'Pre-order Total (Due Today)';
      } else {
        totalBoxLabel.textContent = (preorderItemCount === totalItemCount) ? 'Pre-order Total' : 'Order Total';
      }
    }
  }

  function queueQuantityUpdate(itemKey, targetQty, lineIndex) {
    lastCartUpdateTimestamp = Date.now();
    const mapKey = itemKey ? String(itemKey) : String(lineIndex);

    if (pendingQtyDebounceTimers.has(mapKey)) {
      clearTimeout(pendingQtyDebounceTimers.get(mapKey));
    }

    const timer = setTimeout(async () => {
      pendingQtyDebounceTimers.delete(mapKey);
      await sendCartQuantityChange(itemKey, targetQty, lineIndex);
    }, 280);

    pendingQtyDebounceTimers.set(mapKey, timer);
  }

  async function sendCartQuantityChange(itemKey, targetQty, lineIndex) {
    lastCartUpdateTimestamp = Date.now();
    try {
      const rootPath = window.Shopify?.routes?.root || '/';
      const primaryPayload = (lineIndex !== null && lineIndex !== undefined && String(lineIndex).trim() !== '') ? {
        line: parseInt(lineIndex, 10),
        quantity: targetQty
      } : {
        id: String(itemKey),
        quantity: targetQty
      };

      let res = await fetch(`${rootPath}cart/change.js`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(primaryPayload)
      });

      if (!res.ok) {
        const altPayload = primaryPayload.line ? {
          id: String(itemKey),
          quantity: targetQty
        } : (lineIndex ? {
          line: parseInt(lineIndex, 10),
          quantity: targetQty
        } : null);

        if (altPayload) {
          res = await fetch(`${rootPath}cart/change.js`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json'
            },
            body: JSON.stringify(altPayload)
          });
        }
      }

      if (res.ok) {
        const updatedCart = await res.json();
        const serverCartEl = document.getElementById('storebridge-server-cart');
        if (serverCartEl) {
          try {
            serverCartEl.textContent = JSON.stringify(updatedCart);
          } catch (e) {}
        }
        if (!updatedCart.items || updatedCart.items.length === 0) {
          const root = document.getElementById('storebridge-cart-page');
          if (root) updateCartTotalsInPlace(root);
        }
      }
    } catch (err) {
      console.error('[StoreBridge:CartChange]', err);
    }
  }

  function renderStoreBridgeCart(cart) {
    if (!cart) return;

    const totalCount = cart.item_count !== undefined ? cart.item_count : (cart.items ? cart.items.length : 0);
    const hasItems = cart.items && cart.items.length > 0 && totalCount > 0;
    const hasPreorder = hasItems && cart.items.some((item) => isItemPreorder(item));

    // If cart has items but NONE are preorder, restore native theme cart view cleanly
    if (hasItems && !hasPreorder) {
      const existingRoot = document.getElementById('storebridge-cart-page');
      if (existingRoot) existingRoot.remove();
      document.documentElement.classList.remove('storebridge-custom-cart-active');
      document.body.classList.remove('storebridge-custom-cart-active');
      try { sessionStorage.removeItem('storebridge_has_preorder'); } catch (e) {}

      // Unhide native cart sections
      document.querySelectorAll(
        '[id*="cart-footer"], [id*="cart_footer"], [class*="cart-footer"], [class*="cart_footer"], [class*="cart__footer"], [class*="cart-sidebar"], [class*="cart__sidebar"], .section-main-cart-footer, .shopify-section-main-cart-footer, #main-cart-footer, .cart__footer, .cart__footer-wrapper, .cart__aside, .cart__summary, .cart-summary, #main-cart-items, .cart__contents, cart-items, form#cart, form#cartform, form[action*="/cart"], .cart__warnings, .title-wrapper-with-link, .cart-items, .Cart, .Cart__ItemList, .Cart__Recap, .cart-form, .cart-template, .cart__page-table, [data-cart-form]'
      ).forEach((el) => {
        el.style.removeProperty('display');
        el.style.removeProperty('visibility');
        el.style.removeProperty('height');
        el.style.removeProperty('width');
        el.style.removeProperty('min-height');
        el.style.removeProperty('background');
        el.style.removeProperty('overflow');
      });
      return;
    }

    try { sessionStorage.setItem('storebridge_has_preorder', 'true'); } catch (e) {}
    document.documentElement.classList.add('storebridge-custom-cart-active');
    document.body.classList.add('storebridge-custom-cart-active');

    // Create or select root container FIRST
    let root = document.getElementById('storebridge-cart-page');
    if (!root) {
      root = document.createElement('div');
      root.id = 'storebridge-cart-page';
      root.className = 'storebridge-cart-page';

      // Mount into the main page wrapper
      const mainContent = document.querySelector('main, #MainContent, .main-content') || document.body;
      const firstCartSection =
        document.querySelector('.shopify-section-main-cart-items') ||
        document.querySelector('[id*="cart-items"]')?.closest('.shopify-section') ||
        document.querySelector('[id*="cart_items"]')?.closest('.shopify-section') ||
        document.querySelector('cart-items')?.closest('.shopify-section') ||
        document.querySelector('cart-items') ||
        document.querySelector('#main-cart-items');

      if (firstCartSection && firstCartSection.parentNode) {
        firstCartSection.parentNode.insertBefore(root, firstCartSection);
      } else if (mainContent) {
        mainContent.prepend(root);
      } else {
        document.body.prepend(root);
      }
    }

    // Actively hide ALL native theme cart tables & footers (NEVER recommendations)
    document.querySelectorAll(
      '[id*="cart-footer"], [id*="cart_footer"], [class*="cart-footer"], [class*="cart_footer"], [class*="cart__footer"], [class*="cart-sidebar"], [class*="cart__sidebar"], .section-main-cart-footer, .shopify-section-main-cart-footer, #main-cart-footer, .cart__footer, .cart__footer-wrapper, .cart__aside, .cart__summary, .cart-summary, #main-cart-items, .cart__contents, cart-items, form#cart, form#cartform, form[action*="/cart"], .cart__warnings, .title-wrapper-with-link, .cart-items, .Cart, .Cart__ItemList, .Cart__Recap, .cart-form, .cart-template, .cart__page-table, [data-cart-form]'
    ).forEach((el) => {
      if (!el.closest('#storebridge-cart-page') && el !== root) {
        const parentSection = el.closest('.shopify-section, section, [id*="shopify-section"]');
        if (parentSection && !parentSection.contains(root)) {
          // Verify it's not a recommendations section
          const isRec = parentSection.matches('product-recommendations, [class*="recommend"], [id*="recommend"], [class*="related"], [id*="related"], [class*="featured"], [id*="featured"]') ||
                        parentSection.querySelector('product-recommendations, [class*="recommend"], [class*="related"], [class*="product-card"], [class*="card--product"]');
          if (!isRec) {
            parentSection.style.setProperty('display', 'none', 'important');
            parentSection.style.setProperty('visibility', 'hidden', 'important');
            parentSection.style.setProperty('height', '0px', 'important');
            parentSection.style.setProperty('width', '0px', 'important');
            parentSection.style.setProperty('min-height', '0px', 'important');
            parentSection.style.setProperty('background', 'transparent', 'important');
            parentSection.style.setProperty('overflow', 'hidden', 'important');
          }
        }
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
        el.style.setProperty('height', '0px', 'important');
        el.style.setProperty('width', '0px', 'important');
        el.style.setProperty('min-height', '0px', 'important');
        el.style.setProperty('background', 'transparent', 'important');
        el.style.setProperty('overflow', 'hidden', 'important');
      }
    });

    // Walk up parent chain, neutralize multi-column grid, but EXPLICITLY PRESERVE recommendations
    let currentParent = root.parentElement;
    while (currentParent && currentParent !== document.body && currentParent !== document.documentElement) {
      currentParent.style.setProperty('display', 'block', 'important');
      currentParent.style.setProperty('width', '100%', 'important');
      currentParent.style.setProperty('max-width', '100%', 'important');
      currentParent.style.setProperty('background', 'transparent', 'important');

      Array.from(currentParent.children).forEach((child) => {
        if (child !== root && !child.contains(root)) {
          // EXPLICIT CHECK: If this is Related Products / Recommendations, KEEP IT VISIBLE!
          const isRecommendations =
            child.matches?.('product-recommendations, [class*="recommend"], [id*="recommend"], [class*="related"], [id*="related"], [class*="featured"], [id*="featured"], [class*="complementary"], [id*="complementary"]') ||
            child.querySelector?.('product-recommendations, [class*="recommend"], [class*="related"], [class*="product-card"], [class*="card--product"], [class*="collection"]');

          if (isRecommendations) {
            child.style.removeProperty('display');
            child.style.removeProperty('visibility');
            child.style.removeProperty('height');
            child.style.removeProperty('width');
            child.style.removeProperty('overflow');
            return;
          }

          // Only hide native cart item forms or footers
          const isNativeCartSection =
            child.matches?.('[id*="cart-items"], [id*="cart_items"], [id*="cart-footer"], [id*="cart_footer"], .section-main-cart-items, .section-main-cart-footer, .cart__footer-wrapper, #main-cart-items, #main-cart-footer, cart-items') ||
            child.querySelector?.('button[name="checkout"], .cart__checkout-button, [class*="cart-footer"], [class*="cart_footer"], [id*="cart-footer"], [id*="cart_footer"]');

          if (isNativeCartSection) {
            child.style.setProperty('display', 'none', 'important');
            child.style.setProperty('visibility', 'hidden', 'important');
            child.style.setProperty('height', '0px', 'important');
            child.style.setProperty('width', '0px', 'important');
            child.style.setProperty('min-height', '0px', 'important');
            child.style.setProperty('background', 'transparent', 'important');
            child.style.setProperty('overflow', 'hidden', 'important');
          }
        }
      });

      currentParent = currentParent.parentElement;
    }

    // Empty Cart
    if (!hasItems) {
      root.innerHTML = `
        <div class="storebridge-cart-header">
          <h1 class="storebridge-cart-title">Cart</h1>
        </div>
        <div class="storebridge-cart-empty">
          <h2>Your cart is empty</h2>
          <p style="color: #64748b; font-size: 15px; margin: 0 0 24px 0;">Your pre-order cart is currently empty.</p>
          <a href="/collections/all" class="storebridge-continue-shopping-btn">Continue shopping</a>
        </div>
      `;
      return;
    }

    // Calculate totals dynamically
    let totalOriginalSum = 0;
    let totalDiscountSum = 0;
    let totalFinalSum = 0;
    let totalDueNowSum = 0;
    let totalDueLaterSum = 0;
    let totalItemCount = 0;
    let preorderItemCount = 0;
    const detectedOffers = [];

    const processedItems = cart.items.map((item, index) => {
      const isPreorder = isItemPreorder(item);
      const qty = Number(item.quantity || 1);
      totalItemCount += qty;

      let unitPrice = 0;
      if (item.original_price) {
        unitPrice = Number(item.original_price) / 100;
      } else if (item.price) {
        unitPrice = Number(item.price) / 100;
      } else if (item.line_price && qty > 0) {
        unitPrice = Number(item.line_price) / (qty * 100);
      }

      if (unitPrice <= 0) unitPrice = 1240;

      if (!isPreorder) {
        const lineTotal = unitPrice * qty;
        totalOriginalSum += lineTotal;
        totalFinalSum += lineTotal;
        return {
          item,
          index,
          isPreorder: false,
          qty,
          unitPrice,
          unitDiscount: 0,
          finalUnitPrice: unitPrice,
          lineOriginal: lineTotal,
          lineDiscount: 0,
          lineFinal: lineTotal,
          offer: { type: 'none', value: 0 }
        };
      }

      // Pre-order item
      preorderItemCount += qty;

      let offer = parseOffer(
        getItemProperty(item, 'Pre-order Offer') ||
        getItemProperty(item, 'Offer') ||
        ''
      );

      if (offer.type === 'none') {
        const savingsProp = getItemProperty(item, 'Offer Savings');
        if (savingsProp) {
          offer = parseOffer(savingsProp);
        }
      }

      // Fallback: check remote store config
      if (
        offer.type === 'none' &&
        cachedRemoteCartConfig?.preorder?.discountType &&
        cachedRemoteCartConfig.preorder.discountType !== 'none' &&
        Number(cachedRemoteCartConfig.preorder.discountValue) > 0
      ) {
        offer = {
          type: cachedRemoteCartConfig.preorder.discountType,
          value: Number(cachedRemoteCartConfig.preorder.discountValue)
        };
      }

      if (offer.type !== 'none' && offer.value > 0) {
        detectedOffers.push(offer);
      }

      let unitDiscount = 0;
      if (offer.type === 'percentage' && offer.value > 0) {
        unitDiscount = (unitPrice * offer.value) / 100;
      } else if (offer.type === 'fixed' && offer.value > 0) {
        unitDiscount = Math.min(unitPrice, offer.value);
      }

      const finalUnitPrice = Math.max(0, unitPrice - unitDiscount);
      const lineOriginal = unitPrice * qty;
      const lineDiscount = unitDiscount * qty;
      const lineFinal = finalUnitPrice * qty;

      // Detect Half Payment Option
      const itemPaymentOption = (
        getItemProperty(item, '_paymentOption') ||
        getItemProperty(item, 'Payment Option') ||
        ''
      ).toUpperCase();

      let isHalf = false;
      if (itemPaymentOption.includes('HALF') || itemPaymentOption.includes('50%')) {
        isHalf = true;
      } else if (itemPaymentOption.includes('FULL') || itemPaymentOption.includes('100%')) {
        isHalf = false;
      } else {
        const configAllowHalf = cachedRemoteCartConfig?.preorder?.allowHalfPayment !== false;
        const configAllowFull = cachedRemoteCartConfig?.preorder?.allowFullPayment !== false;
        if (configAllowHalf && !configAllowFull) {
          isHalf = true;
        } else if (!configAllowHalf && configAllowFull) {
          isHalf = false;
        } else if (cachedRemoteCartConfig?.preorder?.defaultPaymentOption === 'HALF') {
          isHalf = true;
        }
      }

      const unitDueNow = isHalf ? Math.round((finalUnitPrice / 2) * 100) / 100 : finalUnitPrice;
      const unitDueLater = isHalf ? Math.round((finalUnitPrice - unitDueNow) * 100) / 100 : 0;
      const lineDueNow = unitDueNow * qty;
      const lineDueLater = unitDueLater * qty;

      totalOriginalSum += lineOriginal;
      totalDiscountSum += lineDiscount;
      totalFinalSum += lineFinal;
      totalDueNowSum += lineDueNow;
      totalDueLaterSum += lineDueLater;

      return {
        item,
        index,
        isPreorder: true,
        isHalf,
        qty,
        unitPrice,
        unitDiscount,
        finalUnitPrice,
        unitDueNow,
        unitDueLater,
        lineOriginal,
        lineDiscount,
        lineFinal,
        lineDueNow,
        lineDueLater,
        offer
      };
    });

    const boxIconSvg = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    `;

    const trashIconSvg = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        <line x1="10" y1="11" x2="10" y2="17"></line>
        <line x1="14" y1="11" x2="14" y2="17"></line>
      </svg>
    `;

    // Generate Cards HTML
    const itemsHtml = processedItems.map((p) => {
      const item = p.item;
      const isPreorder = p.isPreorder;
      const hasOffer = p.offer.type !== 'none' && p.offer.value > 0;
      const lineIndex = p.index + 1;
      const itemKey = item.key || String(item.id);

      const isHalf = Boolean(p.isHalf);
      let badgeClass = 'storebridge-badge-none';
      let badgeText = isHalf ? 'PRE-ORDER • 50% DEPOSIT' : 'PRE-ORDER';
      let savingsText = '';

      if (p.offer.type === 'percentage' && p.offer.value > 0) {
        badgeClass = 'storebridge-badge-percentage';
        badgeText = isHalf
          ? `PRE-ORDER • ${p.offer.value}% OFF • 50% DEPOSIT`
          : `PRE-ORDER • ${p.offer.value}% OFF`;
        savingsText = `Save ${formatMoney(p.unitDiscount)} (${p.offer.value}%)`;
      } else if (p.offer.type === 'fixed' && p.offer.value > 0) {
        badgeClass = 'storebridge-badge-fixed';
        badgeText = isHalf
          ? `PRE-ORDER • ${formatMoney(p.offer.value).replace('.00', '')} OFF • 50% DEPOSIT`
          : `PRE-ORDER • ${formatMoney(p.offer.value).replace('.00', '')} OFF`;
        savingsText = `Save ${formatMoney(p.unitDiscount)}`;
      }

      const fulfillmentNote = getItemProperty(item, 'Pre-order Note') ||
        config.preorder.fulfillmentMessage ||
        'This is a pre-order item. It will be fulfilled when stock arrives.';

      const imageUrl = item.featured_image?.url || item.image || '//cdn.shopify.com/s/files/1/0836/6748/4891/t/1/assets/no-image.gif';
      const variantText = item.variant_title && item.variant_title !== 'Default Title' ? item.variant_title : '';

      return `
        <div class="storebridge-cart-item-card" data-key="${escapeHtml(itemKey)}" data-line="${lineIndex}" data-unit-price="${p.unitPrice}" data-unit-discount="${p.unitDiscount}" data-unit-final="${p.finalUnitPrice}" data-unit-due-now="${p.unitDueNow}" data-unit-due-later="${p.unitDueLater}" data-is-half="${isHalf ? '1' : '0'}" data-is-preorder="${isPreorder ? '1' : '0'}">
          <div class="storebridge-cart-item-image-wrapper">
            <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.product_title || item.title)}" class="storebridge-cart-item-image" loading="lazy" />
          </div>

          <div class="storebridge-cart-item-content">
            <div class="storebridge-cart-item-top-row">
              <div class="storebridge-cart-item-heading">
                <h3 class="storebridge-cart-item-title">${escapeHtml(item.product_title || item.title)}</h3>
                ${variantText ? `<div class="storebridge-cart-item-variant">${escapeHtml(variantText)}</div>` : ''}
              </div>

              <div class="storebridge-cart-item-controls-and-price">
                <div class="storebridge-cart-qty-wrapper">
                  <button type="button" class="storebridge-qty-btn storebridge-qty-minus" aria-label="Decrease quantity" data-key="${escapeHtml(itemKey)}" data-line="${lineIndex}" data-qty="${p.qty}">−</button>
                  <span class="storebridge-qty-value">${p.qty}</span>
                  <button type="button" class="storebridge-qty-btn storebridge-qty-plus" aria-label="Increase quantity" data-key="${escapeHtml(itemKey)}" data-line="${lineIndex}" data-qty="${p.qty}">+</button>
                </div>

                <button type="button" class="storebridge-delete-btn" aria-label="Remove item" data-key="${escapeHtml(itemKey)}" data-line="${lineIndex}">
                  ${trashIconSvg}
                </button>

                <div class="storebridge-cart-item-line-price">
                  <div class="storebridge-line-final-price">${formatMoney(isHalf ? p.lineDueNow : p.lineFinal)}</div>
                  ${isHalf ? `<div style="font-size: 11px; font-weight: 700; color: #047857;">Deposit Due Today</div>` : ''}
                  ${(hasOffer || isHalf) ? `<div class="storebridge-line-original-price" style="${isHalf ? 'text-decoration: none; color: #64748b; font-size: 11px;' : ''}">${isHalf ? `Total: ${formatMoney(p.lineFinal)}` : formatMoney(p.lineOriginal)}</div>` : ''}
                </div>
              </div>
            </div>

            ${isPreorder ? `
              <div class="storebridge-cart-item-preorder-section">
                <div class="storebridge-preorder-badge ${badgeClass}">
                  ${boxIconSvg}
                  <span>${escapeHtml(badgeText)}</span>
                </div>

                <div class="storebridge-cart-item-prices">
                  ${hasOffer ? `<div class="storebridge-unit-original-price">${formatMoney(p.unitPrice)}</div>` : ''}
                  ${isHalf ? `
                    <div class="storebridge-unit-final-price" style="display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap;">
                      <span style="font-size: 16px; font-weight: 800; color: #047857;">${formatMoney(p.unitDueNow)}</span>
                      <span style="font-size: 11px; font-weight: 700; color: #065f46; background: #ecfdf5; padding: 2px 7px; border-radius: 6px; border: 1px solid #a7f3d0;">50% Deposit Due Today</span>
                    </div>
                    <div style="font-size: 12px; color: #475569; font-weight: 600; margin-top: 3px;">
                      Total: ${formatMoney(p.finalUnitPrice)} • Remaining: <strong style="color: #b45309;">${formatMoney(p.unitDueLater)}</strong> due upon restock
                    </div>
                  ` : `
                    <div class="storebridge-unit-final-price">${formatMoney(p.finalUnitPrice)}</div>
                  `}
                  ${hasOffer ? `<div class="storebridge-unit-savings">${escapeHtml(savingsText)}</div>` : ''}
                </div>

                <div class="storebridge-cart-fulfillment-note">
                  ${escapeHtml(fulfillmentNote)}
                </div>
              </div>
            ` : `
              <div class="storebridge-cart-item-normal-prices">
                <div class="storebridge-unit-final-price">${formatMoney(p.unitPrice)}</div>
              </div>
            `}
          </div>
        </div>
      `;
    }).join('');

    // Summary offer label
    let summaryOfferLabel = 'Pre-order Offer (Savings)';
    if (detectedOffers.length === 1) {
      const singleOffer = detectedOffers[0];
      if (singleOffer.type === 'percentage') {
        summaryOfferLabel = `Pre-order Offer (${singleOffer.value}% OFF)`;
      } else if (singleOffer.type === 'fixed') {
        summaryOfferLabel = `Pre-order Offer (${formatMoney(singleOffer.value).replace('.00', '')} OFF)`;
      }
    }

    const totalHeading = (preorderItemCount === totalItemCount) ? 'Pre-order Total' : 'Order Total';

    // Render Full Page HTML
    root.innerHTML = `
      <div class="storebridge-cart-header">
        <h1 class="storebridge-cart-title">Cart</h1>
        <span class="storebridge-cart-count-badge">${totalItemCount}</span>
      </div>

      <div class="storebridge-cart-layout">
        <div class="storebridge-cart-items-column">
          ${itemsHtml}
        </div>

        <div class="storebridge-cart-summary-column">
          <div class="storebridge-order-summary-card">
            <h2 class="storebridge-summary-title">Order Summary</h2>

            <div class="storebridge-discount-box" id="storebridge-discount-toggle">
              <span>Discount</span>
              <span class="storebridge-discount-plus-icon" id="storebridge-discount-icon">+</span>
            </div>

            <div class="storebridge-discount-drawer" id="storebridge-discount-drawer" style="display: none;">
              <div class="storebridge-discount-input-row">
                <input type="text" id="storebridge-discount-input" class="storebridge-discount-input" placeholder="Discount code" value="${escapeHtml(activeDiscountCode)}" />
                <button type="button" id="storebridge-discount-apply-btn" class="storebridge-discount-apply-btn">Apply</button>
              </div>
              <div id="storebridge-discount-message" class="storebridge-discount-message" style="display: none;"></div>
            </div>

            ${(() => {
              const hasAnyHalf = processedItems.some(p => p.isPreorder && p.isHalf);
              return `
                <div class="storebridge-summary-rows">
                  <div class="storebridge-summary-row">
                    <span class="storebridge-summary-row-label">Original Price (${totalItemCount} item${totalItemCount > 1 ? 's' : ''})</span>
                    <span class="storebridge-summary-row-value storebridge-summary-orig-val">${formatMoney(totalOriginalSum)}</span>
                  </div>

                  ${totalDiscountSum > 0 ? `
                    <div class="storebridge-summary-row">
                      <span class="storebridge-summary-row-label">${escapeHtml(summaryOfferLabel)}</span>
                      <span class="storebridge-summary-row-value storebridge-savings-red">- ${formatMoney(totalDiscountSum)}</span>
                    </div>
                  ` : ''}

                  ${hasAnyHalf ? `
                    <div class="storebridge-summary-row" style="border-top: 1px dashed #e2e8f0; padding-top: 8px; margin-top: 4px;">
                      <span class="storebridge-summary-row-label" style="font-weight: 600; color: #475569;">Total Pre-order Value</span>
                      <span class="storebridge-summary-row-value storebridge-summary-val-total" style="font-weight: 700; color: #0f172a;">${formatMoney(totalFinalSum)}</span>
                    </div>

                    <div class="storebridge-summary-row" style="background: #ecfdf5; margin: 4px -6px; padding: 6px 6px; border-radius: 8px; border: 1px solid #a7f3d0;">
                      <span class="storebridge-summary-row-label" style="font-weight: 800; color: #065f46;">50% Deposit (Due Today)</span>
                      <span class="storebridge-summary-row-value storebridge-summary-val-deposit" style="font-weight: 900; color: #047857;">${formatMoney(totalDueNowSum)}</span>
                    </div>

                    <div class="storebridge-summary-row" style="margin: 3px 0 6px 0;">
                      <span class="storebridge-summary-row-label" style="font-weight: 600; color: #b45309; font-size: 12px;">Remaining Balance</span>
                      <span class="storebridge-summary-row-value storebridge-summary-val-remaining" style="font-weight: 700; color: #b45309;">${formatMoney(totalDueLaterSum)}</span>
                    </div>
                    <p style="font-size: 11px; color: #94a3b8; margin: 0 0 10px 0; line-height: 1.3;">Remaining balance is due upon restock before fulfillment.</p>
                  ` : ''}
                </div>

                <div class="storebridge-total-highlight-box storebridge-summary-total-box" style="background: #fff4e5 !important; border: 1.5px solid #fed7aa !important; border-radius: 12px !important; padding: 16px 20px !important; display: flex !important; justify-content: space-between !important; align-items: center !important; margin-bottom: 14px !important; box-sizing: border-box !important;">
                  <span class="storebridge-total-label storebridge-total-box-label" style="font-size: 16px !important; font-weight: 800 !important; color: #0f172a !important;">${escapeHtml(hasAnyHalf ? 'Pre-order Total (Due Today)' : totalHeading)}</span>
                  <span class="storebridge-total-value storebridge-total-box-value" style="font-size: 22px !important; font-weight: 900 !important; color: #0f172a !important; letter-spacing: -0.015em !important;">${formatMoney(hasAnyHalf ? totalDueNowSum : totalFinalSum)}</span>
                </div>
              `;
            })()}

            <div class="storebridge-summary-divider"></div>

            <p class="storebridge-taxes-note storebridge-summary-taxes-note">Taxes and shipping calculated at checkout.</p>

            <button type="button" class="storebridge-checkout-btn storebridge-cart-checkout-btn button button--primary button--full-width" id="storebridge-checkout-action-btn" style="display: flex !important; align-items: center !important; justify-content: center !important; width: 100% !important; height: 50px !important; background: #18181b !important; color: #ffffff !important; border: none !important; border-radius: 12px !important; font-size: 16px !important; font-weight: 800 !important; cursor: pointer !important; text-align: center !important; line-height: 50px !important; text-decoration: none !important; box-sizing: border-box !important; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.14) !important; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important; margin-top: 14px !important;">
              Check out
            </button>
          </div>
        </div>
      </div>
    `;

    // Cache current detected offers on root for checkout button access
    root._currentDetectedOffers = detectedOffers;

    // Attach Delegated Event Listeners to root container (binds once, survives re-renders)
    if (!root.dataset.eventsBound) {
      root.dataset.eventsBound = 'true';

      root.addEventListener('click', (e) => {
        // 1. Delete button
        const deleteBtn = e.target.closest('.storebridge-delete-btn');
        if (deleteBtn) {
          e.preventDefault();
          e.stopPropagation();
          const card = deleteBtn.closest('.storebridge-cart-item-card');
          const key = deleteBtn.getAttribute('data-key') || card?.getAttribute('data-key');
          const line = deleteBtn.getAttribute('data-line') || card?.getAttribute('data-line');
          if (card) {
            card.style.transition = 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.96)';
            setTimeout(() => {
              card.remove();
              updateCartTotalsInPlace(root);
            }, 200);
          }
          queueQuantityUpdate(key, 0, line);
          return;
        }

        // 2. Quantity Minus
        const minusBtn = e.target.closest('.storebridge-qty-minus');
        if (minusBtn) {
          e.preventDefault();
          e.stopPropagation();
          const card = minusBtn.closest('.storebridge-cart-item-card');
          const key = minusBtn.getAttribute('data-key') || card?.getAttribute('data-key');
          const line = minusBtn.getAttribute('data-line') || card?.getAttribute('data-line');
          const qtySpan = card?.querySelector('.storebridge-qty-value') || minusBtn.parentElement?.querySelector('.storebridge-qty-value');
          const curQty = parseInt(qtySpan?.textContent || minusBtn.getAttribute('data-qty') || '1', 10);
          const nextQty = Math.max(0, curQty - 1);

          if (nextQty === 0) {
            if (card) {
              card.style.transition = 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
              card.style.opacity = '0';
              card.style.transform = 'scale(0.96)';
              setTimeout(() => {
                card.remove();
                updateCartTotalsInPlace(root);
              }, 200);
            }
            queueQuantityUpdate(key, 0, line);
          } else {
            if (qtySpan) qtySpan.textContent = String(nextQty);
            updateCartTotalsInPlace(root);
            queueQuantityUpdate(key, nextQty, line);
          }
          return;
        }

        // 3. Quantity Plus
        const plusBtn = e.target.closest('.storebridge-qty-plus');
        if (plusBtn) {
          e.preventDefault();
          e.stopPropagation();
          const card = plusBtn.closest('.storebridge-cart-item-card');
          const key = plusBtn.getAttribute('data-key') || card?.getAttribute('data-key');
          const line = plusBtn.getAttribute('data-line') || card?.getAttribute('data-line');
          const qtySpan = card?.querySelector('.storebridge-qty-value') || plusBtn.parentElement?.querySelector('.storebridge-qty-value');
          const curQty = parseInt(qtySpan?.textContent || plusBtn.getAttribute('data-qty') || '1', 10);
          const nextQty = curQty + 1;

          if (qtySpan) qtySpan.textContent = String(nextQty);
          updateCartTotalsInPlace(root);
          queueQuantityUpdate(key, nextQty, line);
          return;
        }

        // 4. Discount Box Toggle
        const discountToggle = e.target.closest('#storebridge-discount-toggle');
        if (discountToggle) {
          e.preventDefault();
          const discountDrawer = root.querySelector('#storebridge-discount-drawer');
          const discountIcon = root.querySelector('#storebridge-discount-icon');
          if (discountDrawer) {
            const isOpen = discountDrawer.style.display !== 'none';
            discountDrawer.style.display = isOpen ? 'none' : 'block';
            if (discountIcon) discountIcon.textContent = isOpen ? '+' : '−';
          }
          return;
        }

        // 5. Discount Apply Button
        const discountApplyBtn = e.target.closest('#storebridge-discount-apply-btn');
        if (discountApplyBtn) {
          e.preventDefault();
          const discountInput = root.querySelector('#storebridge-discount-input');
          const discountMsg = root.querySelector('#storebridge-discount-message');
          const code = (discountInput?.value || '').trim();
          if (code) {
            activeDiscountCode = code;
            if (discountMsg) {
              discountMsg.textContent = `Discount code "${code}" applied. It will be reflected at checkout.`;
              discountMsg.style.display = 'block';
            }
          }
          return;
        }

        // 6. Checkout Action Button
        const checkoutBtn = e.target.closest('#storebridge-checkout-action-btn');
        if (checkoutBtn) {
          e.preventDefault();
          const cards = Array.from(root.querySelectorAll('.storebridge-cart-item-card'));
          const hasHalf = cards.some(c => c.getAttribute('data-is-half') === '1');

          if (hasHalf) {
            const offers = root._currentDetectedOffers || [];
            let offerPct = 0;
            if (offers.length > 0 && offers[0].type === 'percentage') {
              offerPct = Math.round(Number(offers[0].value));
            } else if (cachedRemoteCartConfig?.preorder?.discountType === 'percentage') {
              offerPct = Math.round(Number(cachedRemoteCartConfig.preorder.discountValue || 0));
            }

            const halfCode = offerPct > 0
              ? `PREORDER-HALF-${offerPct}PCT`
              : (cachedRemoteCartConfig?.preorder?.depositDiscountCode || 'PREORDER-HALF-DEPOSIT');

            window.location.href = `/discount/${encodeURIComponent(halfCode)}?redirect=/checkout`;
            return;
          }

          let codeToApply = activeDiscountCode;
          const offers = root._currentDetectedOffers || [];
          if (!codeToApply && offers.length > 0) {
            const firstOffer = offers[0];
            const cleanVal = Math.round(Number(firstOffer.value));
            codeToApply = firstOffer.type === 'percentage' ? `PREORDER-${cleanVal}PCT` : `PREORDER-${cleanVal}OFF`;
          }
          if (!codeToApply && cachedRemoteCartConfig?.preorder?.discountCode) {
            codeToApply = cachedRemoteCartConfig.preorder.discountCode;
          }

          if (codeToApply) {
            window.location.href = `/checkout?discount=${encodeURIComponent(codeToApply)}`;
          } else {
            window.location.href = '/checkout';
          }
          return;
        }
      });
    }

    // Input Enter key for discount
    const discountInput = root.querySelector('#storebridge-discount-input');
    if (discountInput) {
      discountInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const btn = root.querySelector('#storebridge-discount-apply-btn');
          if (btn) btn.click();
        }
      });
    }
  }

  async function enhanceCartPage() {
    if (isEnhancingCart || isCartUpdating || !isCartPage()) return;
    if (Date.now() - lastCartUpdateTimestamp < 4000) return;

    try {
      isEnhancingCart = true;

      const rootPath = window.Shopify?.routes?.root || '/';
      const response = await fetch(`${rootPath}cart.js`, {
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json'
        }
      });

      if (!response.ok) return;
      const cart = await response.json();

      if (!cart || !cart.items || cart.items.length === 0) {
        renderStoreBridgeCart(cart);
        return;
      }

      // Fetch live StoreBridge store configuration if not cached yet
      if (!cachedRemoteCartConfig) {
        try {
          ensureConfig();
          const shopDomain = config.shop || window.Shopify?.shop || window.location.hostname;
          const apiUrl = (config.apiUrl || 'https://dz50mdfc-3000.inc1.devtunnels.ms').replace(/\/+$/, '');
          if (shopDomain) {
            const cfgRes = await fetch(`${apiUrl}/api/storefront/config?shop=${encodeURIComponent(shopDomain)}`);
            if (cfgRes.ok) {
              const cfgData = await cfgRes.json();
              if (cfgData?.success) {
                cachedRemoteCartConfig = cfgData;
              }
            }
          }
        } catch (err) {
          // Graceful fallback
        }
      }

      renderStoreBridgeCart(cart);

    } catch (error) {
      console.warn('[StoreBridge:CartEnhancer]', error);
    } finally {
      isEnhancingCart = false;
    }
  }

  function debouncedEnhanceCart() {
    if (enhanceTimeout) clearTimeout(enhanceTimeout);
    enhanceTimeout = setTimeout(() => {
      enhanceCartPage();
    }, 60);
  }

  let cartObserverStarted = false;

  function setupCartObserver() {
    if (cartObserverStarted) return;
    cartObserverStarted = true;

    const cartContainer =
      document.querySelector('#main-cart-items, .cart, form#cart, .cart-items, cart-items') || document.body;

    const cartObserver = new MutationObserver((mutations) => {
      if (!isCartPage()) return;
      if (Date.now() - lastCartUpdateTimestamp < 4000) return;
      const isInternalMutation = mutations.every((m) => {
        const t = m.target;
        return (
          t &&
          (t.id === 'storebridge-cart-page' ||
           t.closest?.('#storebridge-cart-page') ||
           t.classList?.contains('storebridge-cart-page'))
        );
      });
      if (isInternalMutation) return;
      debouncedEnhanceCart();
    });

    cartObserver.observe(cartContainer, {
      childList: true,
      subtree: true
    });

    document.addEventListener('change', (e) => {
      if (isCartPage() && e.target && e.target.closest('form[action*="/cart"], .cart-item, quantity-input')) {
        if (e.target.closest('#storebridge-cart-page')) return;
        if (Date.now() - lastCartUpdateTimestamp < 4000) return;
        debouncedEnhanceCart();
      }
    });
  }


  
  async function checkAndEnforceStorefrontRule() {
    try {
      const root = getRootElement();
      const shop = root?.dataset?.shop || window.Shopify?.shop || window.location.hostname;
      const apiUrl = (root?.dataset?.apiUrl || 'https://dz50mdfc-3000.inc1.devtunnels.ms').replace(/\/+$/, '');

      const res = await fetch(`${apiUrl}/api/storefront/config?shop=${encodeURIComponent(shop)}`, {
        headers: {
          'X-Shopify-Shop-Domain': shop,
          'X-Tunnel-Skip-Anti-Phishing-Page': '1',
          Accept: 'application/json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        // If this store is NOT a standalone store, preorder and notifyMe MUST be disabled everywhere
        if (data.success && data.preorder && data.preorder.enabled === false) {
          enforceNoPreorderOnStore();
        }
      }
    } catch (e) {
      // Ignore network errors
    }
  }

  function enforceNoPreorderOnStore() {
    function sanitizeButtons() {
      const candidates = document.querySelectorAll(
        'button, a.button, [role="button"], form[action*="/cart/add"] button, .product-form__submit, [name="add"], .card__information button, [class*="card"] button, [class*="product"] button, [class*="product-card"] button'
      );
      candidates.forEach((el) => {
        if (el.closest('[data-storebridge="ui-container"]') || el.hasAttribute('data-storebridge-action')) {
          return;
        }
        const text = (el.textContent || '').trim();
        const lower = text.toLowerCase();
        if (lower === 'pre-order' || lower === 'pre order' || lower === 'preorder' || lower.includes('pre-order') || lower.includes('pre order')) {
          const isSoldOut = el.disabled || el.getAttribute('aria-disabled') === 'true' || el.closest('.sold-out, .card--sold-out, [class*="sold-out"]') !== null;
          if (isSoldOut) {
            el.textContent = 'Out of stock';
          } else {
            el.textContent = 'Add to cart';
          }
        }
      });
    }

    sanitizeButtons();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', sanitizeButtons, { once: true });
    }
    setTimeout(sanitizeButtons, 150);
    setTimeout(sanitizeButtons, 500);
    setTimeout(sanitizeButtons, 1200);

    if (window.MutationObserver && !window.__sbNonStandaloneObserver) {
      window.__sbNonStandaloneObserver = true;
      const observer = new MutationObserver(() => {
        sanitizeButtons();
      });
      observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
      });
    }
  }

  function start() {
    log('Script loaded on storefront.');
    attachGlobalDelegatedListeners();
    checkAndEnforceStorefrontRule();

    // CART PAGE: Execute immediately without waiting for DOMContentLoaded if possible
    if (isCartPage()) {
      log('Running Cart Page logic');

      // Instant synchronous render from server cart JSON if present
      const serverCartEl = document.getElementById('storebridge-server-cart');
      if (serverCartEl) {
        try {
          const parsed = JSON.parse(serverCartEl.textContent || '{}');
          if (parsed && parsed.items && parsed.items.length > 0) {
            renderStoreBridgeCart(parsed);
          }
        } catch (e) {}
      }

      enhanceCartPage();
      setupCartObserver();

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          enhanceCartPage();
          setupCartObserver();
        }, { once: true });
      }

      let attempts = 0;
      const intervalId = setInterval(() => {
        attempts++;
        enhanceCartPage();
        if (attempts >= 6) clearInterval(intervalId);
      }, 250);

      return;
    }

    // PRODUCT PAGE: Execute immediately without waiting for DOMContentLoaded if form is present
    if (isProductPage()) {
      log('Running Product Availability logic');
      ensureConfig();

      if (getProductForm() || document.querySelector('button[name="add"], .product-form__submit')) {
        initializeStoreBridge();
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeStoreBridge, { once: true });
      } else {
        initializeStoreBridge();
      }

      let attempts = 0;
      const intervalId = setInterval(() => {
        attempts++;
        if (!document.querySelector('[data-storebridge="ui-container"]')) {
          initializeStoreBridge();
        }
        if (attempts >= 6) clearInterval(intervalId);
      }, 250);

      return;
    }

    // ORDER CONFIRMATION / THANK YOU PAGE: Record completed pre-order
    if (isOrderConfirmationPage()) {
      log('Running Order Confirmation / Thank You logic');
      ensureConfig();
      recordCompletedPreorder();
      return;
    }

    // OTHER PAGES
    log('No StoreBridge page-specific functionality required.');
  }

  function isOrderConfirmationPage() {
    const p = window.location.pathname.toLowerCase();
    return (
      p.includes('thank_you') ||
      p.includes('/orders/') ||
      p.includes('order-status') ||
      Boolean(window.Shopify?.checkout) ||
      document.querySelector('.os-order-number, [data-order-status]') !== null
    );
  }

  async function recordCompletedPreorder() {
    try {
      const checkout = window.Shopify?.checkout;
      let orderId = checkout?.order_id ? String(checkout.order_id) : '';
      let orderNumber = checkout?.order_name || '';
      let email = checkout?.email || '';
      let name = '';
      if (checkout?.shipping_address) {
        name = `${checkout.shipping_address.first_name || ''} ${checkout.shipping_address.last_name || ''}`.trim();
      }

      if (!orderNumber) {
        const orderEl = document.querySelector('.os-order-number, .order-number, [data-order-number], .thank-you__order-number, [data-checkout-order-number]');
        if (orderEl) orderNumber = orderEl.textContent.trim();
      }
      if (!orderNumber) {
        const match = document.body.innerText.match(/Order\s+(#\d+)/i) || document.body.innerText.match(/Confirmation\s+(#\d+)/i);
        if (match) orderNumber = match[1];
      }

      if (!orderId && window.__st?.oid) {
        orderId = String(window.__st.oid);
      }
      if (!orderNumber && orderId) {
        orderNumber = `#${orderId}`;
      }
      if (!orderNumber && window.__st?.oid) {
        orderNumber = `#${window.__st.oid}`;
      }

      if (!email) {
        const emailEl = document.querySelector('.os-step__description, [data-customer-email], .thank-you__email');
        if (emailEl) email = emailEl.textContent.trim();
      }
      if (!email && window.Shopify?.customer?.email) {
        email = window.Shopify.customer.email;
      }
      if (!name && window.Shopify?.customer?.name) {
        name = window.Shopify.customer.name;
      }

      const pendingStr = localStorage.getItem('storebridge_pending_preorder');
      if (!pendingStr && (!checkout?.line_items || checkout.line_items.length === 0)) {
        return;
      }

      const pending = pendingStr ? JSON.parse(pendingStr) : null;
      if (!orderNumber) {
        log('No Shopify order number found yet on confirmation page.');
        return;
      }

      if (!orderNumber.startsWith('#') && /^\d+$/.test(orderNumber)) {
        orderNumber = `#${orderNumber}`;
      }
      if (!orderId) {
        orderId = `gid://shopify/Order/${orderNumber.replace(/\D/g, '')}`;
      }

      const recordedKey = `storebridge_recorded_${orderNumber}`;
      if (sessionStorage.getItem(recordedKey)) return;
      sessionStorage.setItem(recordedKey, 'true');

      const apiUrl = config.apiUrl || 'https://dz50mdfc-3000.inc1.devtunnels.ms';
      const shop = config.shop || window.Shopify?.shop || 'eshan-inventory-solutions.myshopify.com';

      const payload = {
        shop,
        orderId: orderId || orderNumber,
        orderNumber,
        variantId: pending?.variantId || (checkout?.line_items?.[0]?.variant_id ? String(checkout.line_items[0].variant_id) : '49066316955867'),
        customerName: name || null,
        customerEmail: email || null,
        customerPhone: checkout?.phone || null,
        quantity: pending?.quantity || 1,
        productTitle: pending?.productTitle || 'Pre-order Item',
        variantTitle: pending?.variantTitle || null,
        paymentOption: pending?.paymentOption || 'HALF',
        totalAmount: pending?.totalAmount || 0,
        depositAmount: pending?.depositAmount || 0,
        remainingBalance: pending?.remainingBalance || 0,
        paymentStatus: pending?.paymentOption === 'HALF' ? 'PARTIALLY_PAID' : 'PAID',
        currency: 'INR'
      };

      await fetch(`${apiUrl}/api/storefront/record-preorder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Shop-Domain': shop,
          'X-Tunnel-Skip-Anti-Phishing-Page': '1',
          Accept: 'application/json'
        },
        body: JSON.stringify(payload)
      });

      localStorage.removeItem('storebridge_pending_preorder');
      log('Successfully recorded pre-order for order', orderNumber);
    } catch (e) {
      console.warn('[StoreBridge:RecordPreorder] Failed:', e);
    }
  }

  start();
})();
