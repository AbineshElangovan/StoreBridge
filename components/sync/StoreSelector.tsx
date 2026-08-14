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
      <div className="w-full md:w-1/3 lg:w-1/4 bg-green-50 p-6 rounded-lg border border-green-100 flex flex-col justify-center">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">SOURCE</h4>
        <p className="text-sm font-bold text-green-900">{masterStore.label || masterStore.shopDomain}</p>
        <p className="text-xs text-gray-500 truncate mt-1">{masterStore.shopDomain}</p>
      </div>
      
      <div className="flex-1">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">DESTINATION STORES</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {connections.map((store) => {
            const isSelected = selectedStores.includes(store.id);
            return (
              <label 
                key={store.id} 
                className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${isSelected ? 'border-green-500 bg-green-50/30' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <input 
                  type="checkbox" 
                  className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
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
