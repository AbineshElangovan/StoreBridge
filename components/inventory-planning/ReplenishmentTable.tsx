'use client';

import React from 'react';
import { Table, ColumnConfig } from '@/components/common/Table';
import { useStoreContext } from '@/components/providers/StoreProvider';
import { PreorderBadge } from '@/components/preorder/PreorderBadge';

interface ReplenishmentTableProps {
  products: any[];
  loading: boolean;
  page: number;
  totalPages: number;
  totalItems?: number;
  onPageChange: (newPage: number) => void;
}

export function ReplenishmentTable({
  products,
  loading,
  page,
  totalPages,
  totalItems,
  onPageChange
}: ReplenishmentTableProps) {
  const { isStandalone } = useStoreContext();
  const columns: ColumnConfig[] = [
    { title: 'PRODUCT', key: 'product_node', type: 'react_node', width: '32%', align: 'left' },
    { title: 'SKU', key: 'sku_node', type: 'react_node', width: '22%', align: 'left' },
    { title: 'CURRENT STOCK', key: 'stock_formatted', type: 'bold', width: '9%', align: 'center' },
    { title: 'HORIZON', key: 'lead_time_formatted', type: 'text', width: '9%', align: 'center' },
    { title: 'REQUIRED STOCK', key: 'required_stock_formatted', type: 'bold', width: '9%', align: 'center' },
    { title: 'ORDER QTY', key: 'recommended_qty_node', type: 'react_node', width: '10%', align: 'center' },
    { title: 'ACTION', key: 'action_node', type: 'react_node', width: '9%', align: 'center' },
  ];

  const formattedItems = products.map((p) => ({
    ...p,
    stock_formatted: (p.currentStock || 0).toLocaleString(),
    lead_time_formatted: `${p.replenishDays || p.leadTimeDays || 7} days`,
    required_stock_formatted: `${(p.requiredStock || 0).toLocaleString()} units`,
    sku_node: (
      <span className="font-mono text-xs sm:text-sm font-bold text-gray-900 select-all break-all" title={p.sku}>
        {p.sku || 'N/A'}
      </span>
    ),
    product_node: (
      <div className="flex items-center gap-2.5 min-w-0">
        {p.imageUrl ? (
          <img src={p.imageUrl} alt={p.title} className="w-9 h-9 rounded-lg object-cover border border-gray-200 flex-shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 font-bold text-[10px] border border-gray-200 flex-shrink-0">
            PROD
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-gray-900 leading-snug" title={p.title}>
              {p.title}
            </span>
            {p.isPreorderEligible && <PreorderBadge size="sm" />}
          </div>
          {!isStandalone && p.storeLabel && (
            <div className="mt-0.5">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200 shadow-2xs whitespace-nowrap">
                {p.storeLabel}
              </span>
            </div>
          )}
        </div>
      </div>
    ),
    recommended_qty_node: (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black bg-red-100 text-red-800 border border-red-200 whitespace-nowrap">
        {(p.recommendedReplenishment || 0).toLocaleString()} units
      </span>
    ),
    action_node: (
      <div className="flex justify-center">
        <button
          type="button"
          className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
        >
          Replenish
        </button>
      </div>
    )
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden w-full max-w-full">
      <Table
        title={totalItems !== undefined && totalItems > 0 ? `Replenishment Orders (${totalItems})` : 'Replenishment Orders'}
        headerColor="#0db69d"
        columns={columns}
        items={formattedItems}
        loading={loading}
        searchable={false}
        filterable={false}
        paginate={true}
        serverSide={true}
        totalItems={totalItems}
        page={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </div>
  );
}
