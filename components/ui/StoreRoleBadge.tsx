'use client';
import React from 'react';
import { useStoreContext } from '@/components/providers/StoreProvider';

export function StoreRoleBadge() {
  const { currentStore, isMaster, isStandalone, loading } = useStoreContext();

  if (loading) {
    return (
      <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-extrabold bg-gray-200 text-gray-700 uppercase tracking-wider shadow-xs">
        Loading...
      </span>
    );
  }

  const storeName = currentStore?.label || currentStore?.shopDomain || 'Store';

  if (isStandalone) {
    return (
      <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-extrabold bg-[#1d4ed8] text-white uppercase tracking-wider shadow-xs border border-blue-600 transition-all">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L22 7L12 12L2 7L12 2ZM12 14.5L20 10.5L22 11.5L12 16.5L2 11.5L4 10.5L12 14.5ZM12 19L20 15L22 16L12 21L2 16L4 15L12 19Z"/>
        </svg>
        <span>STANDALONE</span>
        <span className="opacity-75 font-semibold text-[11px]">• {storeName}</span>
      </span>
    );
  }

  if (isMaster) {
    return (
      <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-extrabold bg-[#059669] text-white uppercase tracking-wider shadow-xs border border-emerald-600 transition-all">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L22 7L12 12L2 7L12 2ZM12 14.5L20 10.5L22 11.5L12 16.5L2 11.5L4 10.5L12 14.5ZM12 19L20 15L22 16L12 21L2 16L4 15L12 19Z"/>
        </svg>
        <span>MASTER</span>
        <span className="opacity-75 font-semibold text-[11px]">• {storeName}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-extrabold bg-[#0d9488] text-white uppercase tracking-wider shadow-xs border border-teal-600 transition-all">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L22 7L12 12L2 7L12 2ZM12 14.5L20 10.5L22 11.5L12 16.5L2 11.5L4 10.5L12 14.5ZM12 19L20 15L22 16L12 21L2 16L4 15L12 19Z"/>
      </svg>
      <span>CONNECTED</span>
      <span className="opacity-75 font-semibold text-[11px]">• {storeName}</span>
    </span>
  );
}
