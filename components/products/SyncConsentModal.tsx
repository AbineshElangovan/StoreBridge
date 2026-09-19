'use client';

import React from 'react';

export interface SyncConsentModalProps {
  open: boolean;
  title?: string;
  description?: string;
  onSync: () => void;
  onMasterOnly: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function SyncConsentModal({
  open,
  title = "Sync to Connected Stores?",
  description = "Do you want to replicate this update to all authorized Connected Stores or apply it to the Master Store only?",
  onSync,
  onMasterOnly,
  onCancel,
  loading = false,
}: SyncConsentModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white p-6 shadow-2xl border border-gray-100 dark:bg-slate-900 dark:border-slate-800">
        {/* Header Icon */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 shrink-0">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {title}
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Master Store Sync Consent Required
            </p>
          </div>
        </div>

        {/* Description Body */}
        <div className="mb-6 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
          <p className="text-sm leading-relaxed text-gray-600 dark:text-slate-300">
            {description}
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <svg className="h-4 w-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Connected Store data will only be updated if you select <strong>Sync to Connected Stores</strong>.</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          
          <button
            type="button"
            disabled={loading}
            onClick={onMasterOnly}
            className="px-4 py-2.5 rounded-xl border border-blue-200 bg-blue-50 text-sm font-semibold text-blue-700 hover:bg-blue-100 transition dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/80 disabled:opacity-50 cursor-pointer"
          >
            Master Store Only
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={onSync}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 shadow-md shadow-blue-500/20 transition dark:bg-blue-500 dark:hover:bg-blue-600 disabled:opacity-50 cursor-pointer"
          >
            {loading && (
              <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            Sync to Connected Stores
          </button>
        </div>
      </div>
    </div>
  );
}
