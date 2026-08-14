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
    <div className="border-b border-gray-200 w-full bg-white px-2 sm:px-6 py-2 overflow-x-auto mb-6">
      <nav className="-mb-[9px] flex space-x-4 sm:space-x-8 min-w-max" aria-label="Tabs">
        
        <button
          onClick={() => onChange('IMPORT')}
          className={`${
            activeTab === 'IMPORT'
              ? 'border-green-500 text-green-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          } whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-sm sm:text-base transition-colors duration-200`}
        >
          Import
        </button>

        <button
          onClick={() => onChange('SYNC')}
          className={`${
            activeTab === 'SYNC'
              ? 'border-green-500 text-green-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          } whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-sm sm:text-base transition-colors duration-200`}
        >
          Sync
        </button>

        {!isStandalone && (
          <button
            onClick={() => onChange('HISTORY')}
            className={`${
              activeTab === 'HISTORY'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-sm sm:text-base transition-colors duration-200`}
          >
            History
          </button>
        )}
        
      </nav>
    </div>
  );
}
