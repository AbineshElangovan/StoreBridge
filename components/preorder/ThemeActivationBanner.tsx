'use client';

import React, { useState } from 'react';
import { useStoreContext } from '@/components/providers/StoreProvider';

const EXTENSION_UID = 'ce4ecd70-a6af-0114-8258-a2358b9a935a62b67176';
const EMBED_HANDLE = 'storebridge-embed';

export function ThemeActivationBanner() {
  const { currentStore } = useStoreContext();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const shopDomain = currentStore?.shopDomain || '';
  const storeSubdomain = shopDomain.replace(/\.myshopify\.com$/i, '').trim();

  // Official Shopify Theme Editor App Embed 1-Click Deep Link
  const deepLink = storeSubdomain
    ? `https://admin.shopify.com/store/${storeSubdomain}/themes/current/editor?context=apps&activateAppId=${EXTENSION_UID}/${EMBED_HANDLE}`
    : `https://admin.shopify.com/store/themes/current/editor?context=apps`;

  return (
    <div className="mb-6 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-teal-50 to-white p-5 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
            <svg
              className="h-5 w-5"
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
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-emerald-950">
                New to StoreOrbit? Activate on your Theme in 1 Click
              </h3>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                Required for Storefront
              </span>
            </div>
            <p className="mt-1 text-sm text-emerald-800 leading-relaxed max-w-2xl">
              Shopify requires merchants to enable the App Embed so Pre-order and Notify Me buttons
              appear automatically on product pages and cart drawers without touching theme code.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href={deepLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-700 transition-colors"
          >
            <span>Activate in Theme (1-Click)</span>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-100 transition-colors"
            title="Dismiss banner"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mt-4 border-t border-emerald-200/60 pt-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-emerald-900">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-200 font-bold text-emerald-900 text-[11px]">1</span>
            <span>Click <strong>Activate in Theme</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-200 font-bold text-emerald-900 text-[11px]">2</span>
            <span>Click <strong>Save</strong> in Shopify Theme Editor</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-200 font-bold text-emerald-900 text-[11px]">3</span>
            <span>Pre-orders display automatically for out-of-stock items</span>
          </div>
        </div>
      </div>
    </div>
  );
}
