'use client';
import React, { useState } from 'react';
import { Icon } from '@shopify/polaris';
import { DeliveryIcon, CheckIcon, NotificationIcon } from '@shopify/polaris-icons';
import { useTheme } from '@/components/providers/ThemeContext';

export interface PreorderPreviewProps {
  enabled: boolean;
  customerMessage: string;
  shippingMessage: string;
  fulfillmentMessage: string;
  notifyMeEnabled?: boolean;
  allowHalfPayment?: boolean;
  allowFullPayment?: boolean;
  defaultPaymentOption?: 'HALF' | 'FULL';
  showSavings?: boolean;
  calculation?: {
    originalPrice: number;
    discountType: 'none' | 'percentage' | 'fixed';
    discountValue: number;
    discountAmount: number;
    finalPrice: number;
    formattedOriginalPrice: string;
    formattedDiscountAmount: string;
    formattedFinalPrice: string;
    savingsText?: string;
    offerBadge?: string;
  } | null;
}

export function PreviewCard({
  enabled,
  customerMessage,
  shippingMessage,
  fulfillmentMessage,
  notifyMeEnabled = true,
  allowHalfPayment = true,
  allowFullPayment = true,
  defaultPaymentOption = 'HALF',
  showSavings = true,
  calculation,
}: PreorderPreviewProps) {
  const { currentTheme } = useTheme();
  const primaryColor = currentTheme?.primaryColor || '#047857';
  const accentColor = currentTheme?.accentColor || '#d1fae5';
  const darkColor = currentTheme?.darkColor || '#022c22';

  const [selectedVariant, setSelectedVariant] = useState<'L' | 'M' | 'S'>('L');
  const [selectorType, setSelectorType] = useState<'dropdown' | 'buttons'>('dropdown');

  const isHalfPayment = Boolean(allowHalfPayment);
  const basePrice = calculation && typeof calculation.finalPrice === 'number' ? calculation.finalPrice : 1240;
  const originalPrice = calculation && typeof calculation.originalPrice === 'number' && calculation.originalPrice > 0 ? calculation.originalPrice : 1240;
  const payableAmount = isHalfPayment ? basePrice / 2 : basePrice;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Browser mockup header */}
      <div className="bg-gray-100 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        </div>
        <span className="text-[11px] font-mono text-gray-500 font-semibold tracking-wider uppercase">
          Live Storefront Preview
        </span>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-bold transition-colors"
          style={{ backgroundColor: accentColor, color: primaryColor }}
        >
          Product Page
        </span>
      </div>

      <div className="p-6 max-w-[420px] mx-auto space-y-4">
        {/* Product Title & Store */}
        <div>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">Cotton T-shirt</h1>
            {enabled && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-extrabold border transition-colors"
                style={{ backgroundColor: accentColor, color: darkColor, borderColor: `${primaryColor}40` }}
              >
                Preorder
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 font-medium mt-0.5">ESHAN Chennai Store</p>
        </div>

        {/* Variant Selectors with Dropdown / Scroll-Down support */}
        <div className="space-y-3 pt-1">
          {/* Selector Type Tabs */}
          <div className="flex items-center justify-between pb-1">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Variant Selector</span>
            <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg border border-gray-200">
              <button
                type="button"
                onClick={() => setSelectorType('dropdown')}
                className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${
                  selectorType === 'dropdown' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500'
                }`}
              >
                Dropdown (Scroll down)
              </button>
              <button
                type="button"
                onClick={() => setSelectorType('buttons')}
                className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${
                  selectorType === 'buttons' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500'
                }`}
              >
                Pills
              </button>
            </div>
          </div>

          {selectorType === 'dropdown' ? (
            /* Scroll down / dropdown selector */
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Select Variant</label>
              <div className="relative">
                <select
                  value={selectedVariant}
                  onChange={(e) => setSelectedVariant(e.target.value as any)}
                  className="w-full appearance-none px-3.5 py-2.5 text-xs font-semibold text-gray-900 bg-white border border-gray-300 rounded-xl shadow-2xs focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none pr-9 cursor-pointer transition-all hover:border-gray-400"
                >
                  <option value="L">White / L — Sold Out (Pre-order)</option>
                  <option value="M">White / M — 12 in stock (Add to Cart)</option>
                  <option value="S">White / S — 0 in stock (Pre-order)</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>
              <span className="text-[10px] text-gray-400 block mt-1">
                {selectedVariant === 'L' || selectedVariant === 'S'
                  ? 'Selected variant stock is 0 → Shows Pre-order'
                  : 'Selected variant stock is 12 → Shows Add to Cart'}
              </span>
            </div>
          ) : (
            /* Option pills selector */
            <div className="space-y-2.5">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Color: White</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border-2 border-gray-900 bg-white text-gray-900"
                  >
                    White
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-gray-700">Size</label>
                  <span className="text-[10px] text-gray-500">
                    {selectedVariant === 'L' || selectedVariant === 'S'
                      ? 'Stock: 0 (Pre-order)'
                      : 'Stock: 12 (Available)'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedVariant('L')}
                    style={
                      selectedVariant === 'L'
                        ? { backgroundColor: darkColor || primaryColor, borderColor: darkColor || primaryColor }
                        : {}
                    }
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                      selectedVariant === 'L'
                        ? 'text-white shadow-xs'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    L (Out of stock)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedVariant('M')}
                    style={
                      selectedVariant === 'M'
                        ? { backgroundColor: darkColor || primaryColor, borderColor: darkColor || primaryColor }
                        : {}
                    }
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                      selectedVariant === 'M'
                        ? 'text-white shadow-xs'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    M (In stock)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Price */}
        <div className="pt-1 border-t border-gray-100">
          <div className="flex items-baseline gap-2 flex-wrap">
            {isHalfPayment && selectedVariant === 'L' ? (
              <>
                <span className="text-2xl font-black text-gray-900">
                  Rs. {payableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-sm font-semibold text-gray-400 line-through">
                  Rs. {originalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {showSavings && calculation && calculation.discountType !== 'none' && calculation.discountAmount > 0 && calculation.offerBadge && (
                  <span
                    className="text-[11px] font-black px-2 py-0.5 rounded-full transition-colors bg-emerald-100 text-emerald-800 border border-emerald-300"
                  >
                    {calculation.offerBadge}
                  </span>
                )}
                {showSavings && (
                  <span
                    className="text-[11px] font-black px-2 py-0.5 rounded-full transition-colors"
                    style={{
                      backgroundColor: accentColor,
                      color: primaryColor,
                      border: `1px solid ${primaryColor}40`,
                    }}
                  >
                    50% DEPOSIT
                  </span>
                )}
              </>
            ) : calculation && calculation.discountType !== 'none' && calculation.discountAmount > 0 && selectedVariant === 'L' ? (
              <>
                <span className="text-2xl font-black text-gray-900">{calculation.formattedFinalPrice}</span>
                <span className="text-sm font-semibold text-gray-400 line-through">{calculation.formattedOriginalPrice}</span>
                {showSavings && calculation.offerBadge && (
                  <span
                    className="text-[11px] font-black px-2 py-0.5 rounded-full transition-colors"
                    style={{
                      backgroundColor: accentColor,
                      color: primaryColor,
                      border: `1px solid ${primaryColor}40`,
                    }}
                  >
                    {calculation.offerBadge}
                  </span>
                )}
              </>
            ) : (
              <span className="text-2xl font-black text-gray-900">
                Rs. {payableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
          </div>
          {showSavings && isHalfPayment && selectedVariant === 'L' ? (
            <p
              className="text-xs font-bold tracking-tight mt-1 transition-colors"
              style={{ color: primaryColor }}
            >
              {calculation && calculation.discountType !== 'none' && calculation.discountAmount > 0 ? (
                <>
                  <span className="font-extrabold text-emerald-700">{calculation.savingsText}</span> •{' '}
                </>
              ) : null}
              Pay Rs. {payableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} today (50% deposit) • Rs. {payableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} balance due upon restock
            </p>
          ) : showSavings && calculation && calculation.discountType !== 'none' && calculation.discountAmount > 0 && selectedVariant === 'L' && calculation.savingsText ? (
            <p
              className="text-xs font-black tracking-tight mt-1 transition-colors"
              style={{ color: primaryColor }}
            >
              {calculation.savingsText}
            </p>
          ) : null}
        </div>

        {/* Purchase option */}
        <div className="flex items-center gap-2 text-xs font-medium text-gray-700 py-0.5">
          <input
            type="radio"
            checked
            readOnly
            style={{ accentColor: primaryColor }}
            className="cursor-pointer"
          />
          <span>One-time Purchase</span>
        </div>

        {/* StoreBridge availability block */}
        {selectedVariant === 'L' ? (
          enabled ? (
            <div className="space-y-3.5 animate-fadeIn">
              {/* Pre-order Information Card */}
              <div
                className="rounded-xl p-3.5 text-xs space-y-1.5 transition-colors border"
                style={{
                  backgroundColor: `${accentColor}40`,
                  borderColor: `${primaryColor}30`,
                  color: darkColor,
                }}
              >
                <p className="font-bold">{customerMessage || "Pre-order before it's gone."}</p>
                <div
                  className="flex items-center gap-1.5 font-semibold text-[11px]"
                  style={{ color: primaryColor }}
                >
                  <div className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                    <Icon source={DeliveryIcon} />
                  </div>
                  <span>{shippingMessage || 'Shipping: As soon as possible'}</span>
                </div>
                {calculation && calculation.discountType !== 'none' && calculation.discountAmount > 0 && (
                  <div
                    className="mt-1 pt-1.5 border-t flex items-center justify-between text-[11px] font-bold"
                    style={{
                      borderColor: `${primaryColor}20`,
                      color: darkColor,
                    }}
                  >
                    <span>Pre-order Offer:</span>
                    <span
                      className="text-white text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-extrabold shadow-2xs"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {calculation.offerBadge} Applied
                    </span>
                  </div>
                )}
              </div>

              {/* Payment Plan Breakdown Card matching live storefront */}
              {isHalfPayment && (
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 text-xs space-y-1.5">
                  <div className="flex justify-between items-center pb-1.5 border-b border-emerald-200">
                    <span className="font-extrabold text-emerald-800 flex items-center gap-1.5 text-xs">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                      Pre-order Payment Plan
                    </span>
                    <span className="bg-emerald-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                      50% Deposit
                    </span>
                  </div>

                  {calculation && calculation.discountType !== 'none' && calculation.discountAmount > 0 ? (
                    <>
                      <div className="flex justify-between text-gray-500 text-[11px]">
                        <span>Original Price:</span>
                        <span className="line-through">{calculation.formattedOriginalPrice}</span>
                      </div>
                      <div className="flex justify-between text-emerald-700 font-bold text-[11px]">
                        <span>Pre-order Discount ({calculation.offerBadge}):</span>
                        <span>- {calculation.formattedDiscountAmount}</span>
                      </div>
                      <div className="flex justify-between text-gray-900 font-bold text-xs pt-1 border-t border-dashed border-emerald-200">
                        <span>Total Product Price:</span>
                        <span>{calculation.formattedFinalPrice}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-gray-700 font-semibold text-xs">
                      <span>Total Product Price:</span>
                      <span className="font-bold text-gray-900">Rs. {basePrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-emerald-800 font-extrabold text-xs">
                    <span>Due Today (50% Deposit):</span>
                    <span>Rs. {payableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-amber-700 font-semibold text-[11px]">
                    <span>Remaining Balance:</span>
                    <span>Rs. {payableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Due upon restock)</span>
                  </div>
                  <div className="text-[11px] font-semibold text-emerald-800 text-center pt-1.5 border-t border-dashed border-emerald-200">
                    Only 50% payment required today to reserve your item.
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-600 font-medium leading-relaxed text-center">
                Don't miss out - Grab yours now before we sell out again!
              </p>

              {/* Pre-order Button */}
              <button
                type="button"
                style={{ backgroundColor: darkColor || primaryColor }}
                className="w-full py-3.5 px-4 rounded-xl text-white font-bold text-sm shadow-md transition-all hover:brightness-110 active:scale-[0.99] flex items-center justify-center gap-2"
              >
                <span>
                  {isHalfPayment
                    ? `Pre Order (Pay ₹${payableAmount.toFixed(2)} Deposit)`
                    : `Pre Order (Pay ₹${payableAmount.toFixed(2)})`}
                </span>
              </button>

              {/* Fulfillment Message */}
              <p className="text-[11px] text-gray-500 text-center leading-tight">
                {fulfillmentMessage || 'We will fulfill the item as soon as it becomes available'}
              </p>

              {/* Back in Stock Button */}
              {notifyMeEnabled && (
                <button
                  type="button"
                  className="w-full py-2.5 px-4 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 font-bold text-xs shadow-2xs transition-all flex items-center justify-center gap-1.5"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  <span>Back in stock</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                disabled
                className="w-full py-3.5 px-4 rounded-xl bg-gray-200 text-gray-400 font-bold text-sm cursor-not-allowed"
              >
                Sold Out
              </button>
              {notifyMeEnabled && (
                <button
                  type="button"
                  className="w-full py-2.5 px-4 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 font-bold text-xs shadow-2xs transition-all flex items-center justify-center gap-1.5"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  <span>Back in stock</span>
                </button>
              )}
            </div>
          )
        ) : (
          <button
            type="button"
            className="w-full py-3.5 px-4 rounded-xl bg-gray-950 hover:bg-black text-white font-bold text-sm shadow-md transition-all active:scale-[0.99]"
          >
            Add to Cart
          </button>
        )}

        {/* Pickup info matching design */}
        <div className="pt-2 border-t border-gray-100 text-[11px] text-gray-600 space-y-0.5">
          <div className="flex items-center gap-1.5 font-bold text-emerald-700">
            <div className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
              <Icon source={CheckIcon} />
            </div>
            <span>Pickup available at ESHAN Chennai Store</span>
          </div>
          <p className="text-gray-500 pl-4">Usually ready in 24 hours</p>
          <p className="text-[10px] text-gray-400 pl-4 underline cursor-pointer">View store information</p>
        </div>
      </div>
    </div>
  );
}
