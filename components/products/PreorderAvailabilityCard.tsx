'use client';

import React from 'react';
import Link from 'next/link';

export interface PreorderInfo {
  enabled: boolean;
  isTargeted: boolean;
  isAvailable: boolean;
  status: 'Pre-order Active' | 'Pre-order Ready' | 'Not Targeted' | 'Disabled';
  inventoryThreshold: number;
  discountType: 'none' | 'percentage' | 'fixed' | string;
  discountValue: number;
  allowHalfPayment?: boolean;
  allowFullPayment?: boolean;
  defaultPaymentOption?: string;
  customerMessage?: string;
  shippingMessage?: string;
  selectionMode?: string;
}

interface PreorderAvailabilityCardProps {
  preorder: PreorderInfo | null;
  currentStock: number;
}

export function PreorderAvailabilityCard({ preorder, currentStock }: PreorderAvailabilityCardProps) {
  if (!preorder) {
    return null;
  }

  const {
    enabled,
    isTargeted,
    isAvailable,
    status,
    inventoryThreshold,
    discountType,
    discountValue,
    allowHalfPayment,
    allowFullPayment,
    customerMessage,
    shippingMessage,
    selectionMode,
  } = preorder;

  const isActive = status === 'Pre-order Active';
  const isReady = status === 'Pre-order Ready';
  const isNotTargeted = status === 'Not Targeted';
  const isDisabled = status === 'Disabled';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-2xs relative overflow-hidden transition-all duration-200 hover:shadow-sm">
      {/* Top Banner Accent */}
      <div
        className={`absolute top-0 left-0 right-0 h-1.5 ${
          isActive
            ? 'bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-600'
            : isReady
            ? 'bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-500'
            : 'bg-gray-200'
        }`}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
              isActive
                ? 'bg-purple-50 border-purple-200 text-purple-700'
                : isReady
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-gray-50 border-gray-200 text-gray-500'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 tracking-tight flex items-center gap-2">
              Pre-order Availability
            </h3>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Customer experience pre-order rules for this product
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div>
          {isActive ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-purple-100 text-purple-800 border border-purple-300 shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-600"></span>
              </span>
              Pre-order Active
            </span>
          ) : isReady ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              Pre-order Ready
            </span>
          ) : isNotTargeted ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-300">
              <span className="w-2 h-2 rounded-full bg-gray-400"></span>
              Not Included
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 border border-rose-300">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              Disabled
            </span>
          )}
        </div>
      </div>

      {/* Main Status Description Box */}
      <div
        className={`p-3.5 rounded-xl border text-xs sm:text-sm mb-4 leading-relaxed ${
          isActive
            ? 'bg-purple-50/70 border-purple-200 text-purple-950 font-medium'
            : isReady
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950 font-medium'
            : isNotTargeted
            ? 'bg-gray-50 border-gray-200 text-gray-700'
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}
      >
        {isActive && (
          <p>
            <strong>Pre-order is currently accepting orders!</strong> Stock is at{' '}
            <span className="font-bold underline">{currentStock}</span> (threshold &le;{' '}
            {inventoryThreshold}), so customers on your storefront can pre-order this item immediately.
          </p>
        )}
        {isReady && (
          <p>
            <strong>Product is pre-order eligible.</strong> Stock is currently healthy ({currentStock} units).
            Pre-orders will trigger automatically as soon as inventory drops to &le; {inventoryThreshold}.
          </p>
        )}
        {isNotTargeted && (
          <p>
            This product is not currently included in your store&apos;s pre-order selection (Current rule mode:{' '}
            <span className="font-semibold">{selectionMode || 'Specific Products'}</span>).
          </p>
        )}
        {isDisabled && (
          <p>
            Pre-orders are currently toggled off across the store. Enable pre-orders in Customer Experience settings to activate.
          </p>
        )}
      </div>

      {/* Rules Breakdown Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-4">
        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
          <span className="text-gray-500 block mb-0.5 font-medium">Trigger Threshold</span>
          <span className="font-bold text-gray-900">
            Stock &le; {inventoryThreshold} units (Current: {currentStock})
          </span>
        </div>

        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
          <span className="text-gray-500 block mb-0.5 font-medium">Pre-order Offer</span>
          <span className="font-bold text-gray-900">
            {discountValue && discountValue > 0
              ? discountType === 'percentage'
                ? `${discountValue}% OFF`
                : `₹${discountValue} Fixed Discount`
              : 'Standard Price (No discount)'}
          </span>
        </div>

        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
          <span className="text-gray-500 block mb-0.5 font-medium">Payment Allowed</span>
          <span className="font-bold text-gray-900">
            {allowHalfPayment && allowFullPayment
              ? 'Full Payment & 50% Deposit'
              : allowHalfPayment
              ? '50% Deposit Only'
              : 'Full Payment Only'}
          </span>
        </div>

        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
          <span className="text-gray-500 block mb-0.5 font-medium">Shipping Timeline</span>
          <span className="font-bold text-gray-900 truncate block">
            {shippingMessage || 'Shipping: As soon as possible'}
          </span>
        </div>
      </div>

      {/* Customer Message Preview */}
      {customerMessage && (
        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs mb-4">
          <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px] block mb-1">
            Storefront Message Display
          </span>
          <span className="italic text-slate-800">&ldquo;{customerMessage}&rdquo;</span>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs">
        <span className="text-gray-500 font-medium">Configure storewide pre-orders</span>
        <Link
          href="/preorder"
          className="inline-flex items-center gap-1 font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer transition-colors"
        >
          Manage in Pre-order Settings &rarr;
        </Link>
      </div>
    </div>
  );
}
