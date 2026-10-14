'use client';
import React, { useState } from 'react';

export interface NotifyMeModalPreviewProps {
  popupMessage: string;
  buttonText: string;
  successMessage: string;
  notifyEmail: boolean;
  notifyWhatsApp: boolean;
}

export function NotifyMeModalPreview({
  popupMessage,
  buttonText,
  successMessage,
  notifyEmail,
  notifyWhatsApp,
}: NotifyMeModalPreviewProps) {
  const [previewState, setPreviewState] = useState<'form' | 'success'>('form');

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden sticky top-6">
      {/* Header bar */}
      <div className="bg-gray-100 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <span className="text-[11px] font-mono text-gray-500 font-semibold tracking-wider uppercase">
          Customer Modal Preview
        </span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setPreviewState('form')}
            className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${
              previewState === 'form' ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            Form
          </button>
          <button
            type="button"
            onClick={() => setPreviewState('success')}
            className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${
              previewState === 'success' ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            Success
          </button>
        </div>
      </div>

      <div className="p-6 max-w-[360px] mx-auto">
        <div className="rounded-2xl border border-gray-200 p-6 bg-white shadow-lg text-center space-y-4">
          {previewState === 'form' ? (
            <>
              {/* Bell Icon */}
              <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 text-amber-700 mx-auto flex items-center justify-center shadow-xs">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>

              <div>
                <h4 className="text-lg font-bold text-gray-900">Back in stock</h4>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  {popupMessage || 'Get notified when this item is back in stock.'}
                </p>
              </div>

              {/* Product Badge with Image */}
              <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-100 flex items-center gap-3 text-left text-xs">
                <img
                  src="https://cdn.shopify.com/s/files/1/0758/9848/6975/files/classic-cotton-t-shirt.png?v=1786435001"
                  alt="Cotton T-shirt"
                  className="w-10 h-10 object-contain rounded-lg bg-white border border-gray-200 shrink-0"
                />
                <div>
                  <p className="font-bold text-gray-900 leading-tight">Cotton T-shirt</p>
                  <p className="text-gray-500 text-[11px]">Variant: White / L</p>
                </div>
              </div>

              {/* Channel Inputs */}
              <div className="space-y-3 text-left">
                {notifyEmail && (
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">
                      Email <span className="text-red-500 font-bold">*</span>
                    </label>
                    <input
                      type="email"
                      readOnly
                      placeholder="Enter your email"
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
                    />
                  </div>
                )}

                {notifyWhatsApp && (
                  <div>
                    <div className="mb-1">
                      <label className="text-xs font-semibold text-gray-700 block">
                        WhatsApp Number <span className="text-[11px] font-normal text-gray-500">(Optional)</span>
                      </label>
                    </div>
                    <div className="flex">
                      <select
                        aria-label="Country Code"
                        className="inline-flex items-center px-2 rounded-l-lg border border-r-0 border-gray-300 bg-gray-100 text-gray-700 text-xs font-bold outline-none cursor-pointer"
                        defaultValue="+91"
                      >
                        <option value="+91">IN +91</option>
                        <option value="+1">US +1</option>
                        <option value="+44">UK +44</option>
                        <option value="+971">UAE +971</option>
                        <option value="+65">SG +65</option>
                      </select>
                      <input
                        type="tel"
                        readOnly
                        value="9876543210"
                        placeholder="10-digit mobile number"
                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded-r-lg bg-gray-50 text-gray-800 font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Submit CTA */}
              <button
                type="button"
                className="w-full py-3 px-4 rounded-xl bg-gray-950 hover:bg-black text-white font-bold text-xs shadow-md"
              >
                {buttonText || 'Notify me when available'}
              </button>

              <p className="text-[10px] text-gray-400 leading-tight">
                We'll only notify you when this variant becomes available. No spam guaranteed.
              </p>
            </>
          ) : (
            <div className="py-4 space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-700 mx-auto flex items-center justify-center">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <h4 className="text-base font-bold text-gray-900">{successMessage || "You're on the list!"}</h4>
                <p className="text-xs text-gray-500 mt-1">
                  We'll notify you as soon as this variant becomes available.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewState('form')}
                className="px-6 py-2 rounded-xl bg-gray-900 text-white font-bold text-xs"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
