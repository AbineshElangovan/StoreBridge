'use client';

import React from 'react';
import { useStoreContext } from '@/components/providers/StoreProvider';
import { useTheme } from '@/components/providers/ThemeContext';

const EXTENSION_UID = 'ce4ecd70-a6af-0114-8258-a2358b9a935a62b67176';
const EMBED_HANDLE = 'storebridge-embed';

export function ThemeActivationBanner() {
  const { currentStore } = useStoreContext();
  const { currentTheme } = useTheme();

  const primaryColor = currentTheme?.primaryColor || '#047857';
  const accentColor = currentTheme?.accentColor || '#d1fae5';
  const darkColor = currentTheme?.darkColor || '#022c22';
  const isLimeTheme = currentTheme?.id === 'emerald_forest';
  const buttonTextColor = isLimeTheme ? '#142403' : '#ffffff';

  const shopDomain = currentStore?.shopDomain || '';
  const storeSubdomain = shopDomain.replace(/\.myshopify\.com$/i, '').trim();

  // Official Shopify Theme Editor App Embed Deep Link
  const deepLink = storeSubdomain
    ? `https://admin.shopify.com/store/${storeSubdomain}/themes/current/editor?context=apps&activateAppId=${EXTENSION_UID}/${EMBED_HANDLE}`
    : `https://admin.shopify.com/store/themes/current/editor?context=apps`;

  return (
    <div className="space-y-6">
      {/* Hero Activation Card */}
      <div
        className="rounded-2xl border p-6 sm:p-7 shadow-xs transition-all duration-200"
        style={{
          borderColor: `${primaryColor}30`,
          background: `linear-gradient(135deg, ${accentColor}40 0%, rgba(255,255,255,0.98) 100%)`,
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl shadow-xs transition-all"
              style={{
                backgroundColor: primaryColor,
                color: buttonTextColor,
              }}
            >
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">
                  New to StoreOrbit? Activate on your Theme
                </h3>
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-bold border transition-colors"
                  style={{
                    backgroundColor: accentColor,
                    color: darkColor,
                    borderColor: `${primaryColor}40`,
                  }}
                >
                  Required for Storefront
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed max-w-2xl font-medium">
                Shopify requires merchants to enable the App Embed so Pre-order and Notify Me buttons
                appear automatically on product pages and cart drawers without touching theme code.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <a
              href={deepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold shadow-xs hover:opacity-95 hover:shadow-md transition-all active:scale-98 cursor-pointer"
              style={{
                backgroundColor: primaryColor,
                color: buttonTextColor,
              }}
            >
              <span>Activate in Theme</span>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>

        <div
          className="mt-6 border-t pt-5"
          style={{ borderColor: `${primaryColor}20` }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold text-gray-700">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/70 border border-gray-100 shadow-2xs">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full font-bold text-xs shrink-0 shadow-2xs"
                style={{
                  backgroundColor: accentColor,
                  color: darkColor,
                  border: `1px solid ${primaryColor}40`,
                }}
              >
                1
              </span>
              <span>Click <strong>Activate in Theme</strong></span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/70 border border-gray-100 shadow-2xs">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full font-bold text-xs shrink-0 shadow-2xs"
                style={{
                  backgroundColor: accentColor,
                  color: darkColor,
                  border: `1px solid ${primaryColor}40`,
                }}
              >
                2
              </span>
              <span>Click <strong>Save</strong> in Shopify Theme Editor</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/70 border border-gray-100 shadow-2xs">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full font-bold text-xs shrink-0 shadow-2xs"
                style={{
                  backgroundColor: accentColor,
                  color: darkColor,
                  border: `1px solid ${primaryColor}40`,
                }}
              >
                3
              </span>
              <span>Pre-orders display automatically on storefront</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Activation Walkthrough Card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-7 shadow-xs space-y-5">
        <div>
          <h4 className="text-base font-bold text-gray-900">How App Embed Activation Works</h4>
          <p className="text-xs text-gray-500 mt-1">
            StoreOrbit utilizes Shopify Theme App Extensions (App Embeds) to seamlessly integrate without modifying your theme files.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/70 space-y-2">
            <div className="flex items-center gap-2">
              <span
                className="flex h-5 w-5 items-center justify-center rounded-md font-bold text-[11px]"
                style={{ backgroundColor: accentColor, color: darkColor }}
              >
                ✓
              </span>
              <span className="text-xs font-bold text-gray-900">Zero Liquid Code Modification</span>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Your theme code stays 100% clean. You can update or switch themes at any time without losing any settings or leaving orphan code.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/70 space-y-2">
            <div className="flex items-center gap-2">
              <span
                className="flex h-5 w-5 items-center justify-center rounded-md font-bold text-[11px]"
                style={{ backgroundColor: accentColor, color: darkColor }}
              >
                ✓
              </span>
              <span className="text-xs font-bold text-gray-900">Instant Real-time Sync</span>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Discounts, countdown deadlines, and messaging update dynamically on your live store whenever you save changes in StoreOrbit.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/70 space-y-2">
            <div className="flex items-center gap-2">
              <span
                className="flex h-5 w-5 items-center justify-center rounded-md font-bold text-[11px]"
                style={{ backgroundColor: accentColor, color: darkColor }}
              >
                ✓
              </span>
              <span className="text-xs font-bold text-gray-900">Automatic Variant & Cart Support</span>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Supports single variants, all products, collections, deposit payment plans, and cart drawer badges automatically.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/70 space-y-2">
            <div className="flex items-center gap-2">
              <span
                className="flex h-5 w-5 items-center justify-center rounded-md font-bold text-[11px]"
                style={{ backgroundColor: accentColor, color: darkColor }}
              >
                ✓
              </span>
              <span className="text-xs font-bold text-gray-900">Optimized Storefront Performance</span>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              Assets load asynchronously via Shopify CDN, ensuring top Core Web Vitals and zero render blocking.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
