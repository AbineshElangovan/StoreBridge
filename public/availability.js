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
      enabled: true,
      inventoryThreshold: 0,
      customerMessage: "Pre-order before it's gone.",
      shippingMessage: "Shipping: As soon as possible",
      fulfillmentMessage:
        "We will fulfill the item as soon as it becomes available",
      maxQuantity: null,
      discountType: 'none',
      discountValue: 0
    },

    notifyMe: {
      enabled: true,
      notifyEmail: true,
      notifyWhatsApp: true,
      popupMessage: "Get notified when this item is back in stock.",
      buttonText: "Notify me when available",
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

  // ============================================================
  // ROOT ELEMENT
  // ============================================================

  function getRootElement() {
    return (
      document.getElementById('storebridge-availability') ||
      document.getElementById('storebridge-global-embed') ||
      document.querySelector('[data-storebridge-embed="true"]')
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
     */
    if (config.preorder.enabled) {
      return 'PREORDER';
    }

    if (config.notifyMe.enabled) {
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

    button.disabled = true;

    button.innerHTML =
      '<span class="storebridge-spinner"></span> Adding to cart...';

    try {
      const rootPath =
        window.Shopify?.routes?.root || '/';

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
        '✓ Added! Redirecting...';

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

    removeAvailabilityUI();

    const container = document.createElement('div');

    container.setAttribute(
      'data-storebridge',
      'ui-container'
    );

    container.className =
      'storebridge-wrapper';

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
          config.preorder.discountType &&
          config.preorder.discountType !== 'none' &&
          Number(config.preorder.discountValue) > 0
            ? `
              <div style="margin-top: 8px; padding: 6px 10px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; font-size: 11px; font-weight: 700; color: #065f46; display: flex; align-items: center; justify-content: space-between;">
                <span>Special Pre-order Offer:</span>
                <span style="background: #059669; color: #ffffff; padding: 2px 7px; border-radius: 4px; font-size: 11px; font-weight: 800;">
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

    const preorderButton =
      container.querySelector(
        '[data-storebridge-action="preorder"]'
      );

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
          <path d="M13.73 21a2 2 0 0 0-3.46 0" />
        </svg>

        <span>
          ${escapeHtml(
            config.notifyMe.buttonText ||
              'Notify me'
          )}
        </span>
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
      const timeoutHandle = setTimeout(() => controller.abort(), 8000);

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
        : 'Network error connecting to StoreBridge. Please try again.';

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
  // CART PAGE & DRAWER ENHANCER
  // ============================================================

  let isEnhancingCart = false;

  async function enhanceCartPage() {
    if (isEnhancingCart) return;
    try {
      const cartItemEls = document.querySelectorAll(
        '.cart-item, tr.cart-item, .cart__item, [data-cart-item], .line-item, .cart-drawer__item, .cart-items tbody tr'
      );

      const hasDomPreorder = Array.from(cartItemEls).some((row) => {
        const text = (row.innerText || row.textContent || '').toLowerCase();
        return (
          text.includes('pre-order note') ||
          text.includes('pre-order item') ||
          text.includes('pre-order') ||
          row.querySelector('[data-preorder="true"]')
        );
      });

      let preorderItems = [];
      try {
        const rootPath = window.Shopify?.routes?.root || '/';
        const cartRes = await fetch(`${rootPath}cart.js`, { credentials: 'same-origin' });
        if (cartRes.ok) {
          const cartData = await cartRes.json();
          if (cartData && cartData.items) {
            preorderItems = cartData.items.filter((item) => {
              const props = item.properties || {};
              if (Array.isArray(props)) {
                return props.some((p) => String(p.name || '').toLowerCase().includes('pre-order'));
              }
              return (
                props._preorder === 'true' ||
                props._preorder === true ||
                props['Pre-order'] ||
                props['Pre-order Note'] ||
                props['Pre-order Offer']
              );
            });
          }
        }
      } catch (e) {}

      // ONLY continue if there are pre-order items in the cart
      if (preorderItems.length === 0 && !hasDomPreorder) return;

      isEnhancingCart = true;
      ensureConfig();

      if (!config.preorder || config.preorder.discountType === undefined) {
        try {
          await fetchConfig();
        } catch (e) {}
      }

      let discountType = config.preorder?.discountType || 'none';
      let discountValue = Number(config.preorder?.discountValue) || 0;

      // Resilient Fallback: Extract offer preset directly from line item properties or DOM
      if (discountType === 'none' || discountValue <= 0) {
        for (const item of preorderItems) {
          const props = item.properties || {};
          const offerStr = props['Pre-order Offer'] || props['Offer'] || '';
          if (offerStr) {
            const pctMatch = offerStr.match(/(\d+)%\s*OFF/i);
            if (pctMatch) {
              discountType = 'percentage';
              discountValue = parseFloat(pctMatch[1]);
              break;
            }
            const fixMatch = offerStr.match(/(?:Rs\.?|₹|\$)\s*(\d+(?:\.\d+)?)\s*OFF/i);
            if (fixMatch) {
              discountType = 'fixed';
              discountValue = parseFloat(fixMatch[1]);
              break;
            }
          }
        }
      }

      if (discountType === 'none' || discountValue <= 0) {
        const fullCartText = document.body.innerText || '';
        const domOfferMatch = fullCartText.match(/Pre-order Offer:\s*(\d+)%\s*OFF/i);
        if (domOfferMatch) {
          discountType = 'percentage';
          discountValue = parseFloat(domOfferMatch[1]);
        } else {
          const domFixMatch = fullCartText.match(/Pre-order Offer:\s*(?:Rs\.?|₹|\$)\s*(\d+(?:\.\d+)?)\s*OFF/i);
          if (domFixMatch) {
            discountType = 'fixed';
            discountValue = parseFloat(domFixMatch[1]);
          }
        }
      }

      let fulfillmentMessage = config.preorder?.fulfillmentMessage || '';
      if (!fulfillmentMessage) {
        for (const item of preorderItems) {
          const props = item.properties || {};
          if (props['Pre-order Note']) {
            fulfillmentMessage = props['Pre-order Note'];
            break;
          }
        }
      }
      if (!fulfillmentMessage) {
        const domNoteMatch = (document.body.innerText || '').match(/Pre-order Note:\s*([^\n\r]+)/i);
        if (domNoteMatch) {
          fulfillmentMessage = domNoteMatch[1].trim();
        }
      }
      if (!fulfillmentMessage) {
        fulfillmentMessage = 'We will fulfill the item as soon as it becomes available';
      }

      const hasOffer = discountType !== 'none' && discountValue > 0;

      // Determine Theme / Preset (Case 1: percentage, Case 2: fixed, Case 3: none)
      let badgeThemeClass = 'storebridge-badge-green';
      let highlightThemeClass = 'storebridge-highlight-green';
      let badgeLabel = 'PRE-ORDER';
      let offerSummaryLabel = 'Offer:';

      if (discountType === 'percentage' && discountValue > 0) {
        badgeThemeClass = 'storebridge-badge-orange';
        highlightThemeClass = 'storebridge-highlight-orange';
        badgeLabel = `PRE-ORDER • ${discountValue}% OFF`;
        offerSummaryLabel = `Pre-order Offer (${discountValue}% OFF)`;
      } else if (discountType === 'fixed' && discountValue > 0) {
        badgeThemeClass = 'storebridge-badge-blue';
        highlightThemeClass = 'storebridge-highlight-blue';
        badgeLabel = `PRE-ORDER • Rs. ${discountValue} OFF`;
        offerSummaryLabel = `Pre-order Offer (Rs. ${discountValue} OFF)`;
      }

      const boxIconSvg = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:-2px; margin-right:4px;">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
          <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
      `;

      // 1. ENHANCE CART ITEMS (Left Side)
      let totalOriginalSum = 0;
      let totalDiscountSum = 0;
      let totalFinalSum = 0;
      let totalItemCount = 0;

      cartItemEls.forEach((row, idx) => {
        const text = (row.innerText || row.textContent || '').toLowerCase();
        const isPreorder =
          text.includes('pre-order note') ||
          text.includes('pre-order item') ||
          text.includes('pre-order') ||
          row.querySelector('[data-preorder="true"]');

        if (!isPreorder) return;

        // Hide raw unstyled Shopify property strings
        const allTextEls = row.querySelectorAll('li, dl, dt, dd, p, div.product-option, .product-option, .cart-item__properties, [data-line-item-property]');
        allTextEls.forEach((el) => {
          const txt = el.innerText || el.textContent || '';
          if (
            txt.includes('Pre-order:') ||
            txt.includes('Pre-order Note') ||
            txt.includes('Pre-order Offer') ||
            txt.includes('Pre-order Price') ||
            txt.includes('Offer Savings') ||
            txt.includes('_preorder')
          ) {
            if (!el.classList.contains('cart-item__details') && !el.classList.contains('cart-item') && !el.classList.contains('storebridge-cart-custom-block')) {
              el.style.setProperty('display', 'none', 'important');
              el.classList.add('storebridge-hidden-prop');
            }
          }
        });

        // Hide default single price line in details if present
        const strayPrices = row.querySelectorAll('.cart-item__details .price, .cart-item__details > div:not(.storebridge-cart-custom-block) .price, .cart-item__details [class*="price"]');
        strayPrices.forEach((sp) => {
          if (!sp.closest('.storebridge-cart-custom-block')) {
            sp.style.setProperty('display', 'none', 'important');
            sp.classList.add('storebridge-hidden-prop');
          }
        });

        const matchedItem = preorderItems.find((p) => {
          const pTitle = (p.title || p.product_title || '').toLowerCase();
          return pTitle && text.includes(pTitle);
        }) || preorderItems[idx] || preorderItems[0];

        let unitPrice = 0;
        if (matchedItem && matchedItem.price) {
          unitPrice = matchedItem.price / 100;
        }
        if (!unitPrice || unitPrice <= 0) {
          const priceEl = row.querySelector('.cart-item__price-wrapper, .price--end, .price, .cart-item__totals');
          if (priceEl) unitPrice = parseCurrencyAmount(priceEl.innerText || priceEl.textContent || '');
        }
        if (!unitPrice || unitPrice <= 0) {
          unitPrice = 1240;
        }

        let qty = 1;
        const qtyInput = row.querySelector('.quantity__input, input[name="updates[]"], input[type="number"]');
        if (qtyInput && qtyInput.value) {
          qty = parseInt(qtyInput.value, 10) || 1;
        } else if (matchedItem && matchedItem.quantity) {
          qty = matchedItem.quantity;
        }
        totalItemCount += qty;

        const discountAmt = hasOffer
          ? (discountType === 'percentage'
              ? (unitPrice * discountValue) / 100
              : discountValue)
          : 0;

        const finalPrice = Math.max(0, unitPrice - discountAmt);
        const lineOriginal = unitPrice * qty;
        const lineDiscount = discountAmt * qty;
        const lineFinal = finalPrice * qty;

        totalOriginalSum += lineOriginal;
        totalDiscountSum += lineDiscount;
        totalFinalSum += lineFinal;

        // Inject or update custom block in details
        let customBlock = row.querySelector('.storebridge-cart-custom-block');
        if (!customBlock) {
          customBlock = document.createElement('div');
          customBlock.className = 'storebridge-cart-custom-block';

          const detailsEl = row.querySelector('.cart-item__details, .cart__item-details') || row;
          const visibleOptions = Array.from(detailsEl.querySelectorAll('.product-option, .cart-item__name, h2, h3, a[href*="/products/"]'))
            .filter(el => el.style.display !== 'none' && !el.classList.contains('storebridge-hidden-prop'));
          const insertAnchor = visibleOptions[visibleOptions.length - 1];
          if (insertAnchor && insertAnchor.parentElement === detailsEl) {
            insertAnchor.insertAdjacentElement('afterend', customBlock);
          } else {
            detailsEl.appendChild(customBlock);
          }
        }

        const formattedOrig = unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const formattedFinal = finalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const formattedSavings = discountAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const pctText = discountType === 'percentage' ? `${discountValue}%` : `Rs. ${discountValue}`;

        customBlock.innerHTML = `
          <div class="storebridge-badge-pill ${badgeThemeClass}">
            ${boxIconSvg}
            <span>${escapeHtml(badgeLabel)}</span>
          </div>
          <div class="storebridge-cart-pricing-block">
            ${hasOffer ? `<div class="storebridge-cart-original-struck">Rs. ${formattedOrig}</div>` : ''}
            <div class="storebridge-cart-bold-price">Rs. ${formattedFinal}</div>
            ${hasOffer ? `<div class="storebridge-cart-savings-green">Save Rs. ${formattedSavings} (${pctText})</div>` : ''}
            <div class="storebridge-cart-note-card">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="1" y="3" width="15" height="13"></rect>
                <polygon points="16 8 20 8 23 11 23 16 16 16 8"></polygon>
                <circle cx="5.5" cy="18.5" r="2.5"></circle>
                <circle cx="18.5" cy="18.5" r="2.5"></circle>
              </svg>
              <span>${escapeHtml(fulfillmentMessage)}</span>
            </div>
          </div>
        `;

        // Update Right Column Line Price
        const rightTotals = row.querySelector('.cart-item__totals, .cart-item__price-wrapper, td.cart-item__totals');
        if (rightTotals) {
          let customRight = rightTotals.querySelector('.storebridge-cart-right-price-box');
          if (!customRight) {
            customRight = document.createElement('div');
            customRight.className = 'storebridge-cart-right-price-box';
            rightTotals.innerHTML = '';
            rightTotals.appendChild(customRight);
          }
          const formattedLineFinal = lineFinal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          const formattedLineOrig = lineOriginal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          customRight.innerHTML = `
            <div class="storebridge-cart-right-price">Rs. ${formattedLineFinal}</div>
            ${hasOffer ? `<div class="storebridge-cart-right-original">Rs. ${formattedLineOrig}</div>` : ''}
          `;
        }
      });

      // 2. ENHANCE ORDER SUMMARY (Right Side Box)
      const footerBlocks = document.querySelector(
        '.cart__blocks, .cart__footer, .cart__footer-wrapper, #cart-footer, .cart-sidebar'
      );

      if (footerBlocks && totalItemCount > 0) {
        // Ensure "Order Summary" Title is present at top
        if (!footerBlocks.querySelector('.storebridge-summary-header')) {
          const headerEl = document.createElement('h2');
          headerEl.className = 'storebridge-summary-header';
          headerEl.textContent = 'Order Summary';
          footerBlocks.prepend(headerEl);
        }

        // Hide default Dawn estimated total row
        const defaultTotals = footerBlocks.querySelectorAll('.totals, .cart-subtotal, .totals__subtotal');
        defaultTotals.forEach((dt) => {
          dt.style.setProperty('display', 'none', 'important');
        });

        // Inject or update Order Summary Breakdown block
        let summaryBlock = footerBlocks.querySelector('.storebridge-order-summary-block');
        if (!summaryBlock) {
          summaryBlock = document.createElement('div');
          summaryBlock.className = 'storebridge-order-summary-block';
          
          const taxNote = footerBlocks.querySelector('.tax-note, .cart__ctas');
          if (taxNote) {
            taxNote.insertAdjacentElement('beforebegin', summaryBlock);
          } else {
            footerBlocks.appendChild(summaryBlock);
          }
        }

        const formattedTotalOrig = totalOriginalSum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const formattedTotalDiscount = totalDiscountSum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const formattedTotalFinal = totalFinalSum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        summaryBlock.innerHTML = `
          <div class="storebridge-summary-row">
            <span>Original Price (${totalItemCount} item${totalItemCount > 1 ? 's' : ''})</span>
            <span>Rs. ${formattedTotalOrig}</span>
          </div>
          <div class="storebridge-summary-row">
            <span>${escapeHtml(offerSummaryLabel)}</span>
            <span class="storebridge-summary-offer-val">- Rs. ${formattedTotalDiscount}</span>
          </div>
          <div class="storebridge-summary-highlight-card ${highlightThemeClass}">
            <span class="storebridge-highlight-label">Pre-order Total</span>
            <span class="storebridge-highlight-price">Rs. ${formattedTotalFinal}</span>
          </div>
        `;
      }
    } catch (err) {
      console.warn('[StoreBridge:CartEnhancer]', err);
    } finally {
      isEnhancingCart = false;
    }
  }

  function start() {
    log('Script loaded on storefront.');
    attachGlobalDelegatedListeners();
    ensureConfig();

    enhanceCartPage();

    // Observe body for cart drawer open, cart updates, etc.
    const cartObserver = new MutationObserver(() => {
      if (
        document.querySelector(
          '.cart-item, tr.cart-item, .cart__item, [data-cart-item], .cart-drawer'
        )
      ) {
        enhanceCartPage();
      }
    });

    cartObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    if (
      document.readyState ===
      'loading'
    ) {
      document.addEventListener(
        'DOMContentLoaded',
        () => {
          initializeStoreBridge();
          enhanceCartPage();
        },
        {
          once: true
        }
      );
    } else {
      initializeStoreBridge();
      enhanceCartPage();
    }

    let attempts = 0;
    const intervalId = setInterval(() => {
      attempts++;
      enhanceCartPage();
      if (attempts >= 8) clearInterval(intervalId);
    }, 400);
  }

  start();

})();
