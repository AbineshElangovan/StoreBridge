'use client';

import React from 'react';
import { Table, ColumnConfig } from '@/components/common/Table';
import { RiskBadge } from './RiskBadge';

interface CrossStoreAvailabilityProps {
  products: any[];
  loading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
}

export function CrossStoreAvailability({
  products,
  loading,
  page,
  totalPages,
  onPageChange
}: CrossStoreAvailabilityProps) {
  const columns: ColumnConfig[] = [
    { title: 'PRODUCT', key: 'product_node', type: 'react_node' },
    { title: 'MULTI-STORE SCOPE', key: 'store_node', type: 'react_node' },
    { title: 'COMBINED STOCK', key: 'stock_formatted', type: 'bold' },
    { title: 'STORE BREAKDOWN', key: 'breakdown_node', type: 'react_node' },
  ];

  const formattedItems = products.map((p) => ({
    ...p,
    stock_formatted: (p.currentStock || 0).toLocaleString(),
    product_node: (
      <div className="flex items-center gap-2.5">
        {p.imageUrl ? (
          <img src={p.imageUrl} alt={p.title} className="w-8 h-8 rounded-lg object-cover border border-gray-200 flex-shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 font-bold text-[10px] border border-gray-200 flex-shrink-0">
            PROD
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-xs sm:text-sm font-semibold text-gray-900 truncate max-w-[150px] sm:max-w-[200px]" title={p.title}>
            {p.title}
          </div>
          <div className="text-[11px] text-gray-500 font-mono mt-0.5">{p.sku}</div>
        </div>
      </div>
    ),
    store_node: (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-sky-100 text-sky-800 border border-sky-200 shadow-2xs whitespace-nowrap">
        {p.storeLabel}
      </span>
    ),
    breakdown_node: (
      <div className="flex flex-col gap-1.5 py-1">
        {(p.storesBreakdown || []).map((sb: any, idx: number) => (
          <div key={idx} className="flex items-center justify-between gap-3 p-2 bg-gray-50/90 rounded-lg border border-gray-200 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-900">{sb.storeName}</span>
              {sb.skus && sb.skus.length > 0 && (
                <span className="px-2 py-0.5 rounded bg-gray-200 text-gray-700 font-mono text-[11px]">
                  SKUs: {sb.skus.join(', ')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="font-bold text-gray-800">Stock: {sb.currentStock}</span>
              <span className="text-gray-500 font-medium">Avg/day: {sb.avgDailySales.toFixed(1)}</span>
              <RiskBadge risk={sb.risk} />
            </div>
          </div>
        ))}
      </div>
    )
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
      <Table
        title="Cross-Store Inventory Breakdown"
        headerColor="#0db69d"
        columns={columns}
        items={formattedItems}
        loading={loading}
        searchable={false}
        filterable={false}
        paginate={true}
        serverSide={true}
        page={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </div>
  );
}
