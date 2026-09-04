'use client';

import React from 'react';
import { Table, ColumnConfig } from '@/components/common/Table';
import { RiskBadge } from './RiskBadge';

interface StockRiskTableProps {
  products: any[];
  loading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
}

export function StockRiskTable({
  products,
  loading,
  page,
  totalPages,
  onPageChange
}: StockRiskTableProps) {
  const columns: ColumnConfig[] = [
    { title: 'PRODUCT', key: 'product_node', type: 'react_node', width: '36%', align: 'left' },
    { title: 'SKU', key: 'sku_node', type: 'react_node', width: '24%', align: 'left' },
    { title: 'CURRENT STOCK', key: 'stock_formatted', type: 'bold', width: '10%', align: 'center' },
    { title: 'AVG SALES/DAY', key: 'avgDailySalesFormatted', type: 'text', width: '10%', align: 'center' },
    { title: 'EST. STOCKOUT', key: 'stockout_node', type: 'react_node', width: '10%', align: 'center' },
    { title: 'RISK', key: 'risk_node', type: 'react_node', width: '10%', align: 'center' },
  ];

  const formattedItems = products.map((p) => ({
    ...p,
    stock_formatted: (p.currentStock || 0).toLocaleString(),
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
          <div className="text-sm font-bold text-gray-900 leading-snug" title={p.title}>
            {p.title}
          </div>
          {p.storeLabel && (
            <div className="mt-0.5">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200 shadow-2xs whitespace-nowrap">
                {p.storeLabel}
              </span>
            </div>
          )}
        </div>
      </div>
    ),
    stockout_node: p.expectedStockoutDays !== null ? (
      <span className={p.expectedStockoutDays <= 7 ? 'text-red-600 font-extrabold whitespace-nowrap' : 'text-gray-900 font-bold whitespace-nowrap'}>
        {p.expectedStockoutDays} {p.expectedStockoutDays === 1 ? 'day' : 'days'}
      </span>
    ) : (
      <span className="text-gray-400 font-medium whitespace-nowrap">No demand</span>
    ),
    risk_node: (
      <div className="flex justify-center">
        <RiskBadge risk={p.risk} />
      </div>
    )
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden w-full max-w-full">
      <Table
        title="Stock Risk"
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
