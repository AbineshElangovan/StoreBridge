'use client';

import React from 'react';

interface SyncTabsProps {
  activeTab: 'IMPORT' | 'SYNC' | 'HISTORY';
  onChange: (tab: 'IMPORT' | 'SYNC' | 'HISTORY') => void;
  isMaster: boolean;
  isConnected: boolean;
  isStandalone?: boolean;
}

export function SyncTabs({ activeTab, onChange, isMaster, isConnected, isStandalone = false }: SyncTabsProps) {
  return (
    <div className="border border-[var(--border-color)] w-full bg-white/80 backdrop-blur-md rounded-xl px-4 sm:px-6 py-1 overflow-x-auto mb-6 shadow-2xs transition-colors">
      <nav className="flex space-x-4 sm:space-x-8 min-w-max" aria-label="Tabs">
        
        <button
          type="button"
          onClick={() => onChange('IMPORT')}
          className={`${
            activeTab === 'IMPORT'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)] font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300 font-semibold'
          } whitespace-nowrap py-3 sm:py-3.5 px-1 border-b-2 text-xs sm:text-sm transition-all duration-150 cursor-pointer`}
        >
          Import
        </button>

        <button
          type="button"
          onClick={() => onChange('SYNC')}
          className={`${
            activeTab === 'SYNC'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)] font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300 font-semibold'
          } whitespace-nowrap py-3 sm:py-3.5 px-1 border-b-2 text-xs sm:text-sm transition-all duration-150 cursor-pointer`}
        >
          Sync
        </button>

        {!isStandalone && (
          <button
            type="button"
            onClick={() => onChange('HISTORY')}
            className={`${
              activeTab === 'HISTORY'
                ? 'border-[var(--color-primary)] text-[var(--color-primary)] font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300 font-semibold'
            } whitespace-nowrap py-3 sm:py-3.5 px-1 border-b-2 text-xs sm:text-sm transition-all duration-150 cursor-pointer`}
          >
            History
          </button>
        )}
        
      </nav>
    </div>
  );
}
