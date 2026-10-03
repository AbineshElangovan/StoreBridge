import React from 'react';

interface Store {
  id: string;
  shopDomain: string;
  label?: string | null;
}

interface StoreSelectorProps {
  masterStore: Store;
  connections: Store[];
  selectedStores: string[];
  onToggleStore: (storeId: string) => void;
}

export function StoreSelector({ masterStore, connections, selectedStores, onToggleStore }: StoreSelectorProps) {
  return (
    <div className="flex flex-col md:flex-row gap-6 mb-6">
      <div className="w-full md:w-1/3 lg:w-1/4 p-6 rounded-lg border flex flex-col justify-center" style={{ background: 'var(--color-primary-light)', borderColor: 'var(--border-color)' }}>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">SOURCE</h4>
        <p className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>{masterStore.label || masterStore.shopDomain}</p>
      </div>
      
      <div className="flex-1">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">DESTINATION STORES</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {connections.map((store) => {
            const isSelected = selectedStores.includes(store.id);
            return (
              <label 
                key={store.id} 
                className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${isSelected ? '' : 'border-gray-200 hover:bg-gray-50'}`}
                style={isSelected ? { borderColor: 'var(--color-primary)', background: 'var(--bg-hover, #d1fae5)', opacity: 1 } : {}}
              >
                <input 
                  type="checkbox" 
                  className="h-4 w-4 border-gray-300 rounded" style={{ accentColor: 'var(--color-primary)' }}
                  checked={isSelected}
                  onChange={() => onToggleStore(store.id)}
                />
                <span className="ml-3 text-sm font-medium text-gray-700 truncate">
                  {store.label || store.shopDomain}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
