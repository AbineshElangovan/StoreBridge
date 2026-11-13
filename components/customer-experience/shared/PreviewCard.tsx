'use client';
import React, { useState, useEffect } from 'react';
import { Icon } from '@shopify/polaris';
import { DeliveryIcon, CheckIcon, NotificationIcon } from '@shopify/polaris-icons';
import { useTheme } from '@/components/providers/ThemeContext';
import { PolarisSelect } from '@/components/common';

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
  // Status & Scheduling
  statusScheduleType?: 'AVAILABLE_NOW' | 'UNTIL_END_DATE' | 'NOT_AVAILABLE' | string;
  startDate?: string | null;
  endDate?: string | null;
  // Countdown Timer
  showTimer?: boolean;
  timerDisplayMode?: string;
  timerDateMode?: string;
  timerCustomDate?: string | null;
  timerHeading?: string;
  timerHeadingEnd?: string;
  timerTextColor?: string;
  timerBgColor?: string;
  timerTextColorEnd?: string;
  timerBgColorEnd?: string;
  timerBorderRadius?: number | string;
  timerShowDays?: boolean;
  timerShowHours?: boolean;
  timerShowMinutes?: boolean;
  timerShowSeconds?: boolean;
  timerDaysLabel?: string;
  timerHoursLabel?: string;
  timerMinutesLabel?: string;
  timerSecondsLabel?: string;
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
  statusScheduleType = 'AVAILABLE_NOW',
  endDate,
  showTimer = false,
  timerDateMode = 'USE_STATUS_DATE',
  timerCustomDate,
  timerHeading = 'Hurry up! Pre-order ending soon',
  timerHeadingEnd = 'Hurry up! Pre-order ending soon',
  timerTextColor = '#000000',
  timerBgColor = '#fee2e2',
  timerTextColorEnd = '#000000',
  timerBgColorEnd = '#fee2e2',
  timerBorderRadius = 8,
  timerShowDays = true,
  timerShowHours = true,
  timerShowMinutes = true,
  timerShowSeconds = true,
  timerDaysLabel = 'Days',
  timerHoursLabel = 'Hours',
  timerMinutesLabel = 'Mins',
  timerSecondsLabel = 'Secs',
}: PreorderPreviewProps) {
  const { currentTheme } = useTheme();
  const primaryColor = currentTheme?.primaryColor || '#047857';
  const accentColor = currentTheme?.accentColor || '#d1fae5';
  const darkColor = currentTheme?.darkColor || '#022c22';

  const [selectedVariant, setSelectedVariant] = useState<'L' | 'M' | 'S'>('L');
  const [selectorType, setSelectorType] = useState<'dropdown' | 'buttons'>('buttons');

  const [currentPlan, setCurrentPlan] = useState<'HALF' | 'FULL'>(defaultPaymentOption || (allowHalfPayment ? 'HALF' : 'FULL'));

  useEffect(() => {
    if (allowHalfPayment && !allowFullPayment) setCurrentPlan('HALF');
    else if (!allowHalfPayment && allowFullPayment) setCurrentPlan('FULL');
    else if (defaultPaymentOption) setCurrentPlan(defaultPaymentOption);
  }, [allowHalfPayment, allowFullPayment, defaultPaymentOption]);

  const hasOffer = Boolean(calculation && calculation.discountType !== 'none' && calculation.discountAmount > 0);
  const numFinalPrice = calculation && typeof calculation.finalPrice === 'number' ? calculation.finalPrice : 1240;
  const numOriginalPrice = calculation && typeof calculation.originalPrice === 'number' && calculation.originalPrice > 0 ? calculation.originalPrice : 1240;
  const discountAmt = calculation?.discountAmount || 0;
  const halfInitial = numFinalPrice / 2;
  const halfRemaining = numFinalPrice - halfInitial;
  const isHalfPayment = currentPlan === 'HALF';
  const payableAmount = isHalfPayment ? halfInitial : numFinalPrice;

  // In the admin settings preview, always show the live Pre-order offer being configured
  const effectiveIsLive = true;

  // Determine countdown target date (End Date / Deadline only)
  const end = endDate ? new Date(endDate) : null;
  let targetDate: Date | null = null;
  if (timerDateMode === 'CUSTOM_DATES' || timerDateMode === 'CUSTOM_END_DATE' || timerDateMode === 'CUSTOM_DATE') {
    targetDate = timerCustomDate ? new Date(timerCustomDate) : (end || null);
  } else {
    targetDate = end || (timerCustomDate ? new Date(timerCustomDate) : null);
  }

  // Ticking countdown timer - defaults to lively sample countdown matching user design
  const [timeLeft, setTimeLeft] = useState<{ days: string; hours: string; minutes: string; seconds: string }>({
    days: '20',
    hours: '12',
    minutes: '54',
    seconds: '18',
  });

  useEffect(() => {
    let mockSeconds = 20 * 24 * 3600 + 12 * 3600 + 54 * 60 + 18;

    const calculateTime = () => {
      if (targetDate && !isNaN(targetDate.getTime()) && targetDate.getTime() > Date.now()) {
        const diff = targetDate.getTime() - Date.now();
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const m = Math.floor((diff / (1000 * 60)) % 60);
        const s = Math.floor((diff / 1000) % 60);
        setTimeLeft({
          days: String(d).padStart(2, '0'),
          hours: String(h).padStart(2, '0'),
          minutes: String(m).padStart(2, '0'),
          seconds: String(s).padStart(2, '0'),
        });
      } else {
        mockSeconds = mockSeconds > 0 ? mockSeconds - 1 : 20 * 24 * 3600 + 12 * 3600 + 54 * 60 + 18;
        const d = Math.floor(mockSeconds / (3600 * 24));
        const h = Math.floor((mockSeconds % (3600 * 24)) / 3600);
        const m = Math.floor((mockSeconds % 3600) / 60);
        const s = Math.floor(mockSeconds % 60);
        setTimeLeft({
          days: String(d).padStart(2, '0'),
          hours: String(h).padStart(2, '0'),
          minutes: String(m).padStart(2, '0'),
          seconds: String(s).padStart(2, '0'),
        });
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [targetDate?.getTime()]);

  // Render timer block
  const renderTimerWidget = () => {
    if (!showTimer) return null;
    const currentHeading = timerHeadingEnd || timerHeading || 'Hurry up! Pre-order ending soon';
    const currentBg = timerBgColorEnd || timerBgColor || '#fee2e2';
    const currentText = timerTextColorEnd || timerTextColor || '#000000';

    return (
      <div className="space-y-2 py-2 animate-fadeIn bg-gray-50/70 p-3 rounded-xl border border-gray-100">
        {currentHeading && (
          <div className="text-center text-xs font-bold text-gray-800">
            {currentHeading}
          </div>
        )}
        <div className="flex items-center justify-center gap-2.5">
          {timerShowDays && (
            <div className="flex flex-col items-center">
              <div
                className="w-12 h-12 flex items-center justify-center font-bold text-base sm:text-lg shadow-2xs transition-all border border-black/5"
                style={{
                  backgroundColor: currentBg,
                  color: currentText,
                  borderRadius: `${Number(timerBorderRadius) || 8}px`,
                }}
              >
                {timeLeft.days}
              </div>
              <span className="text-[10px] text-gray-500 font-medium mt-1">
                {timerDaysLabel || 'Days'}
              </span>
            </div>
          )}
          {timerShowHours && (
            <div className="flex flex-col items-center">
              <div
                className="w-12 h-12 flex items-center justify-center font-bold text-base sm:text-lg shadow-2xs transition-all border border-black/5"
                style={{
                  backgroundColor: currentBg,
                  color: currentText,
                  borderRadius: `${Number(timerBorderRadius) || 8}px`,
                }}
              >
                {timeLeft.hours}
              </div>
              <span className="text-[10px] text-gray-500 font-medium mt-1">
                {timerHoursLabel || 'Hours'}
              </span>
            </div>
          )}
          {timerShowMinutes && (
            <div className="flex flex-col items-center">
              <div
                className="w-12 h-12 flex items-center justify-center font-bold text-base sm:text-lg shadow-2xs transition-all border border-black/5"
                style={{
                  backgroundColor: currentBg,
                  color: currentText,
                  borderRadius: `${Number(timerBorderRadius) || 8}px`,
                }}
              >
                {timeLeft.minutes}
              </div>
              <span className="text-[10px] text-gray-500 font-medium mt-1">
                {timerMinutesLabel || 'Mins'}
              </span>
            </div>
          )}
          {timerShowSeconds && (
            <div className="flex flex-col items-center">
              <div
                className="w-12 h-12 flex items-center justify-center font-bold text-base sm:text-lg shadow-2xs transition-all border border-black/5"
                style={{
                  backgroundColor: currentBg,
                  color: currentText,
                  borderRadius: `${Number(timerBorderRadius) || 8}px`,
                }}
              >
                {timeLeft.seconds}
              </div>
              <span className="text-[10px] text-gray-500 font-medium mt-1">
                {timerSecondsLabel || 'Secs'}
              </span>
            </div>
          )}
        </div>
        <div className="text-center text-[11px] font-semibold text-gray-500 pt-0.5 space-y-0.5">
          <div>
            Preorder ends: {targetDate && !isNaN(targetDate.getTime())
              ? targetDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
              : '4 Dec 2026, 5:30 am'}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Browser mockup header */}
      <div className="bg-gray-100 px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          <span className="text-[11px] font-mono text-gray-500 font-semibold tracking-wider uppercase ml-1.5">
            Storefront Preview
          </span>
        </div>
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
              <PolarisSelect
                label="Select Variant"
                labelHidden={false}
                value={selectedVariant}
                onChange={(val) => setSelectedVariant(val as any)}
                options={[
                  { label: 'White / L — Sold Out (Pre-order)', value: 'L' },
                  { label: 'White / M — 12 in stock (Add to Cart)', value: 'M' },
                  { label: 'White / S — 0 in stock (Pre-order)', value: 'S' },
                ]}
              />
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
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-gray-700">Size</label>
                </div>
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedVariant('L')}
                    className={`min-w-[56px] px-4 py-2 text-xs font-bold rounded-xl border transition-all ${
                      selectedVariant === 'L'
                        ? 'bg-black text-white border-black shadow-xs'
                        : 'border-gray-200 bg-white text-gray-800 hover:border-gray-400'
                    }`}
                  >
                    L
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedVariant('M')}
                    className={`min-w-[56px] px-4 py-2 text-xs font-bold rounded-xl border transition-all ${
                      selectedVariant === 'M'
                        ? 'bg-black text-white border-black shadow-xs'
                        : 'border-gray-200 bg-white text-gray-800 hover:border-gray-400'
                    }`}
                  >
                    M
                  </button>
                </div>
              </div>

              {/* Quantity Stepper matching live store */}
              <div className="pt-1">
                <div className="inline-flex items-center border border-gray-300 rounded-xl bg-white overflow-hidden shadow-2xs">
                  <button type="button" className="px-3.5 py-1.5 text-gray-600 hover:text-gray-950 text-xs font-bold select-none cursor-pointer hover:bg-gray-50">-</button>
                  <span className="px-3 py-1.5 text-xs font-bold text-gray-900 select-none border-x border-gray-100 min-w-[28px] text-center">1</span>
                  <button type="button" className="px-3.5 py-1.5 text-gray-600 hover:text-gray-950 text-xs font-bold select-none cursor-pointer hover:bg-gray-50">+</button>
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
                  Rs. {numOriginalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {showSavings && calculation && calculation.discountType !== 'none' && calculation.discountAmount > 0 && calculation.offerBadge && (
                  <span
                    className="text-[11px] font-black px-2 py-0.5 rounded-full transition-colors bg-emerald-100 text-emerald-800 border border-emerald-300"
                  >
                    {calculation.offerBadge}
                  </span>
                )}
                {showSavings && (
                  <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    50% DEPOSIT
                  </span>
                )}
              </>
            ) : calculation && calculation.discountType !== 'none' && calculation.discountAmount > 0 && selectedVariant === 'L' ? (
              <>
                <span className="text-2xl font-black text-gray-900">{calculation.formattedFinalPrice}</span>
                <span className="text-sm font-semibold text-gray-400 line-through">{calculation.formattedOriginalPrice}</span>
                {showSavings && calculation.offerBadge && (
                  <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
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
            <p className="text-xs font-bold tracking-tight mt-1 text-emerald-700">
              {calculation && calculation.discountType !== 'none' && calculation.discountAmount > 0 ? (
                <>
                  <span className="font-extrabold text-emerald-700">{calculation.savingsText}</span> •{' '}
                </>
              ) : null}
              Pay Rs. {payableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} today (50% deposit) • Rs. {payableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} balance due upon restock
            </p>
          ) : showSavings && calculation && calculation.discountType !== 'none' && calculation.discountAmount > 0 && selectedVariant === 'L' && calculation.savingsText ? (
            <p className="text-xs font-black tracking-tight mt-1 text-emerald-700">
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

        {/* StoreOrbit availability block */}
        {selectedVariant === 'L' ? (
          effectiveIsLive ? (
            <div className="space-y-3.5 animate-fadeIn">
              {/* Countdown Timer if enabled */}
              {showTimer && renderTimerWidget()}

              {/* Pre-order Information Card (Matching live storefront styling) */}
              <div className="bg-[#fffbeb] border border-[#fde68a] rounded-xl p-3.5 text-xs space-y-1.5 transition-colors text-[#451a03]">
                <p className="font-bold text-[13px] text-[#713f12] leading-tight">
                  {customerMessage || "Pre-order before it's gone."}
                </p>
                <div className="flex items-center gap-1.5 font-semibold text-xs text-[#78350f]">
                  <div className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                    <Icon source={DeliveryIcon} />
                  </div>
                  <span>{shippingMessage || 'Shipping: As soon as possible'}</span>
                </div>
                {hasOffer && (
                  <div className="mt-2 p-2 bg-[#ecfdf5] border border-[#a7f3d0] rounded-lg text-xs font-bold text-[#065f46] flex items-center justify-between">
                    <span>Special Pre-order Offer:</span>
                    <span className="bg-[#16a34a] text-white px-2 py-0.5 rounded text-[11px] font-extrabold shadow-2xs">
                      {calculation?.offerBadge || 'OFFER APPLIED'}
                    </span>
                  </div>
                )}
              </div>

              {/* Payment Plan Breakdown Card matching live storefront */}
              {allowHalfPayment && !allowFullPayment ? (
                /* Half Payment Only (50% Deposit) */
                <div className="bg-[#f0fdf4] border border-[#86efac] rounded-xl p-3 text-xs space-y-1.5">
                  <div className="flex justify-between items-center pb-2 border-b border-[#bbf7d0]">
                    <span className="font-extrabold text-[#166534] text-xs flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#22c55e] inline-block"></span>
                      Pre-order Payment Plan
                    </span>
                    <span className="bg-[#22c55e] text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">
                      50% Deposit
                    </span>
                  </div>
                  {hasOffer ? (
                    <>
                      <div className="flex justify-between text-[#64748b] text-[11px]">
                        <span>Original Price:</span>
                        <span className="line-through text-[#94a3b8] font-semibold">{calculation?.formattedOriginalPrice}</span>
                      </div>
                      <div className="flex justify-between text-[#047857] font-bold text-[11px]">
                        <span>Pre-order Discount ({calculation?.offerBadge}):</span>
                        <span>- {calculation?.formattedDiscountAmount}</span>
                      </div>
                      <div className="flex justify-between text-[#0f172a] font-bold text-xs pt-1 border-t border-dashed border-[#bbf7d0]">
                        <span>Total Product Price:</span>
                        <span className="font-extrabold">{calculation?.formattedFinalPrice}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-[#475569] font-semibold text-xs">
                      <span>Total Product Price:</span>
                      <span className="font-bold text-[#0f172a]">Rs. {numFinalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[#15803d] font-extrabold text-xs">
                    <span>Due Today (50% Deposit):</span>
                    <span>Rs. {halfInitial.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-[#b45309] font-semibold text-[11px]">
                    <span>Remaining Balance:</span>
                    <span>Rs. {halfRemaining.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Due upon restock)</span>
                  </div>
                  <div className="text-[11px] font-semibold text-[#166534] text-center pt-1.5 border-t border-dashed border-[#bbf7d0]">
                    Only 50% payment required today to reserve your item.
                  </div>
                </div>
              ) : !allowHalfPayment && allowFullPayment ? (
                /* Full Payment Only (Matching Image 1) */
                <div className="bg-[#f8fafc] border border-[#cbd5e1] rounded-xl p-3 text-xs space-y-1.5">
                  <div className="flex justify-between items-center pb-2 border-b border-[#e2e8f0]">
                    <span className="font-extrabold text-[#0f172a] text-xs flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#047857] inline-block"></span>
                      Pre-order Pricing
                    </span>
                    <span className="bg-[#0f172a] text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">
                      Full Payment
                    </span>
                  </div>
                  {hasOffer && (
                    <>
                      <div className="flex justify-between text-[#64748b] text-[11px]">
                        <span>Original Price:</span>
                        <span className="line-through text-[#94a3b8] font-semibold">{calculation?.formattedOriginalPrice}</span>
                      </div>
                      <div className="flex justify-between text-[#047857] font-bold text-[11px]">
                        <span>Pre-order Discount ({calculation?.offerBadge}):</span>
                        <span>- {calculation?.formattedDiscountAmount}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-[#0f172a] font-extrabold text-xs pt-1.5 border-t border-dashed border-[#cbd5e1]">
                    <span>Final Price (Due Today):</span>
                    <span className="text-[#047857] font-black">{hasOffer ? calculation?.formattedFinalPrice : `Rs. ${numFinalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</span>
                  </div>
                </div>
              ) : allowHalfPayment && allowFullPayment ? (
                /* Both Half and Full Payment Options */
                <div className="space-y-2">
                  <div className="text-[11px] font-extrabold text-gray-700 uppercase tracking-wider">
                    Payment Options
                  </div>
                  <div className="space-y-2">
                    <label
                      onClick={() => setCurrentPlan('HALF')}
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                        currentPlan === 'HALF'
                          ? 'border-[#047857] bg-[#f0fdf4]'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="preview_pay_plan"
                        checked={currentPlan === 'HALF'}
                        onChange={() => setCurrentPlan('HALF')}
                        className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                      />
                      <div className="flex-1 text-xs">
                        <div className="flex justify-between items-baseline">
                          <span className="font-bold text-gray-900">Half Payment (50% Deposit)</span>
                          <span className="font-extrabold text-[#047857]">Pay Rs. {halfInitial.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {hasOffer ? `50% of discounted total (${calculation?.formattedFinalPrice}) • ` : ''}Rs. {halfRemaining.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} balance due when ready to ship
                        </p>
                      </div>
                    </label>

                    <label
                      onClick={() => setCurrentPlan('FULL')}
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                        currentPlan === 'FULL'
                          ? 'border-[#047857] bg-[#f0fdf4]'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="preview_pay_plan"
                        checked={currentPlan === 'FULL'}
                        onChange={() => setCurrentPlan('FULL')}
                        className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                      />
                      <div className="flex-1 text-xs">
                        <div className="flex justify-between items-baseline">
                          <span className="font-bold text-gray-900">Full Payment (100%)</span>
                          <span className="font-extrabold text-gray-900">Pay Rs. {numFinalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Pay in full today • Zero remaining balance
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Plan Breakdown */}
                  <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3 text-xs space-y-1 mt-1">
                    {hasOffer && (
                      <>
                        <div className="flex justify-between text-[#64748b] text-[11px]">
                          <span>Original Price:</span>
                          <span className="line-through text-[#94a3b8] font-semibold">{calculation?.formattedOriginalPrice}</span>
                        </div>
                        <div className="flex justify-between text-[#047857] font-bold text-[11px]">
                          <span>Pre-order Discount ({calculation?.offerBadge}):</span>
                          <span>- {calculation?.formattedDiscountAmount}</span>
                        </div>
                        <div className="flex justify-between text-[#0f172a] font-bold text-xs pt-1 border-t border-dashed border-[#cbd5e1]">
                          <span>Total Product Price:</span>
                          <span className="font-extrabold">{calculation?.formattedFinalPrice}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between text-[#047857] font-extrabold text-xs">
                      <span>Due Today ({currentPlan === 'HALF' ? '50% Initial Payment' : 'Full Payment'}):</span>
                      <span>Rs. {(currentPlan === 'HALF' ? halfInitial : numFinalPrice).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-[#b45309] font-semibold text-[11px]">
                      <span>Remaining Balance:</span>
                      <span>Rs. {(currentPlan === 'HALF' ? halfRemaining : 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currentPlan === 'HALF' ? '(Due upon restock)' : ''}</span>
                    </div>
                    {currentPlan === 'HALF' && (
                      <div className="text-[11px] font-semibold text-[#166534] text-center pt-1 border-t border-dashed border-[#e2e8f0]">
                        Only 50% payment required today to reserve your item.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              <p className="text-xs text-gray-600 font-medium leading-relaxed text-center">
                Don&apos;t miss out - Grab yours now before we sell out again!
              </p>

              {/* Pre-order Button (Dark slate / black matching live storefront) */}
              <button
                type="button"
                className="w-full py-3.5 px-4 rounded-xl bg-[#111827] hover:bg-black text-white font-bold text-sm shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Pre Order</span>
              </button>

              {/* Fulfillment Message */}
              <p className="text-xs text-gray-500 text-center leading-tight">
                {fulfillmentMessage || 'We will fulfill the item as soon as it becomes available'}
              </p>

              {/* Notify Me / Back in Stock Button (Matching Image 1) */}
              {notifyMeEnabled && (
                <button
                  type="button"
                  className="w-full py-2.5 px-4 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 font-semibold text-xs shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  <span>Notify me</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
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
                  className="w-full py-3 px-4 rounded-xl bg-[#e5a83b] hover:bg-[#d97706] text-gray-950 font-bold text-sm shadow-xs border border-amber-600/30 transition-all flex items-center justify-center gap-1.5"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  <span>Notify me</span>
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
