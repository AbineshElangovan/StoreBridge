'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { PreorderBadge } from '@/components/preorder/PreorderBadge';

interface ProductHeaderProps {
  title: string;
  sku: string;
  collection: string;
  vendor: string;
  isPreorderEligible?: boolean;
  onBack?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
}

export function ProductHeader({ title, sku, collection, vendor, isPreorderEligible, onBack, onDelete, isDeleting }: ProductHeaderProps) {
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
        <div className="flex items-center gap-3 flex-wrap">
          <h1
            className="!text-2xl sm:!text-3xl lg:!text-4xl !font-extrabold text-gray-900 tracking-tight leading-tight"
            style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1.25 }}
          >
            {title}
          </h1>
          {isPreorderEligible && <PreorderBadge size="md" />}
        </div>
        <p
          className="!text-xs sm:!text-sm md:!text-base !font-bold text-gray-500 mt-1.5 uppercase tracking-wider"
          style={{ fontSize: '0.95rem' }}
        >
          SKU {sku}{displayCollection ? ` · ${displayCollection}` : ''}{displayVendor ? ` · ${displayVendor}` : ''}
        </p>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            className="inline-flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-2xs transition-all cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Product
          </button>
        )}

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
