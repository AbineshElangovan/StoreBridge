'use client';

import React from 'react';
import { StockHealthBadge } from '../insights/StockHealthBadge';

export interface StoreInventoryItem {
  storeId: string;
  storeName: string;
  quantity: number;
  healthStatus: 'Healthy' | 'Low' | 'Critical' | 'Out of Stock';
  isMaster?: boolean;
}

interface StoreAvailabilityProps {
  stores: StoreInventoryItem[];
}

export function StoreAvailability({ stores }: StoreAvailabilityProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-2xs">
      <div className="mb-4">
        <h3 className="text-base font-bold text-gray-900 tracking-tight">
          Store availability
        </h3>
        <p className="text-xs text-gray-500 font-medium mt-0.5">
          Inventory by connected store.
        </p>
      </div>

      <div className="divide-y divide-gray-100">
        {stores.length === 0 ? (
          <div className="py-4 text-center text-xs text-gray-400 font-medium">
            No authorized stores found.
          </div>
        ) : (
          stores.map((store) => (
            <div key={store.storeId} className="py-3.5 flex items-center justify-between gap-3 text-xs sm:text-sm">
              <div className="flex-1 pr-2">
                <span className="font-semibold text-gray-900 leading-snug block">
                  {store.storeName}
                </span>
                {store.isMaster && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 mt-1">
                    MASTER
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5 shrink-0 ml-auto">
                <span className="font-bold text-gray-900 text-sm">{store.quantity}</span>
                <StockHealthBadge status={store.healthStatus} stockQuantity={store.quantity} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
