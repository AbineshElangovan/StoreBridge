'use client';

import React from 'react';
import { StockHealthBadge } from '../insights/StockHealthBadge';

interface ProductInfoCardProps {
  imageUrl?: string | null;
  title: string;
  sku: string;
  collection: string;
  vendor: string;
  basePrice: number;
  status: string;
  currentStock: number;
  healthStatus: 'Healthy' | 'Low' | 'Critical' | 'Out of Stock';
  preorderStatus?: string | null;
}

export function ProductInfoCard({
  imageUrl,
  title,
  sku,
  collection,
  vendor,
  basePrice,
  status,
  currentStock,
  healthStatus,
  preorderStatus
}: ProductInfoCardProps) {
  const formattedPrice = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(basePrice || 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-2xs">
      {/* Product Image */}
      <div className="w-full aspect-square bg-gray-50 border border-gray-200 rounded-xl mb-6 overflow-hidden flex items-center justify-center relative">
        {imageUrl ? (
          <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
        ) : (
          <div className="text-center p-4">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-xs font-semibold text-gray-400">Product image</span>
          </div>
        )}
      </div>

      {/* Details List */}
      <div className="space-y-3 text-xs sm:text-sm">
        <div className="flex items-center justify-between py-1 border-b border-gray-100">
          <span className="font-medium text-gray-500">SKU</span>
          <span className="font-mono font-bold text-gray-900">{sku}</span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-gray-100">
          <span className="font-medium text-gray-500">Collection</span>
          <span className="font-bold text-gray-900 uppercase">{collection}</span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-gray-100">
          <span className="font-medium text-gray-500">Vendor</span>
          <span className="font-bold text-gray-900 uppercase">{vendor}</span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-gray-100">
          <span className="font-medium text-gray-500">Base price</span>
          <span className="font-bold text-gray-900">{formattedPrice}</span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-gray-100">
          <span className="font-medium text-gray-500">Status</span>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
            status.toLowerCase() === 'active'
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              : 'bg-gray-100 text-gray-700 border border-gray-200'
          }`}>
            {status}
          </span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-gray-100">
          <span className="font-medium text-gray-500">Stock level</span>
          <div className="flex items-center gap-2">
            <StockHealthBadge status={healthStatus} stockQuantity={currentStock} />
          </div>
        </div>

        {preorderStatus && (
          <div className="flex items-center justify-between py-1">
            <span className="font-medium text-gray-500">Pre-order</span>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                preorderStatus === 'Pre-order Active'
                  ? 'bg-purple-100 text-purple-800 border-purple-200'
                  : preorderStatus === 'Pre-order Ready'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  : 'bg-gray-100 text-gray-600 border-gray-200'
              }`}
            >
              {preorderStatus === 'Pre-order Active' && (
                <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse" />
              )}
              {preorderStatus}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
