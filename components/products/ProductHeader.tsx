'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

interface ProductHeaderProps {
  title: string;
  sku: string;
  collection: string;
  vendor: string;
  onBack?: () => void;
}

export function ProductHeader({ title, sku, collection, vendor, onBack }: ProductHeaderProps) {
  const router = useRouter();
  const displayCollection = collection ? collection.toUpperCase() : '';
  const displayVendor = vendor ? vendor.toUpperCase() : '';

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h1
          className="!text-2xl sm:!text-3xl lg:!text-4xl !font-extrabold text-gray-900 tracking-tight leading-tight"
          style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1.25 }}
        >
          {title}
        </h1>
        <p
          className="!text-xs sm:!text-sm md:!text-base !font-bold text-gray-500 mt-1.5 uppercase tracking-wider"
          style={{ fontSize: '0.95rem' }}
        >
          SKU {sku}{displayCollection ? ` · ${displayCollection}` : ''}{displayVendor ? ` · ${displayVendor}` : ''}
        </p>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center justify-center gap-2 bg-[#0db69d] hover:bg-[#0b9c86] text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-2xs transition-all cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </button>
      </div>
    </div>
  );
}
