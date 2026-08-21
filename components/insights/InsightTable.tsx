'use client';

import React from 'react';
import { Table, ColumnConfig } from '@/components/common/Table';
import { StockHealthBadge } from './StockHealthBadge';
import { InsightTabType } from './InsightTabs';

interface InsightTableProps {
  activeTab: InsightTabType;
  data: any[];
  loading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
}

export function InsightTable({
  activeTab,
  data,
  loading,
  page,
  totalPages,
  onPageChange,
}: InsightTableProps) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  const getHeaderInfo = () => {
    switch (activeTab) {
      case 'best-sellers':
        return { title: 'Best sellers', subtitle: 'Top performing products exceeding store performance threshold.' };
      case 'slow-movers':
        return { title: 'Slow movers', subtitle: 'Products selling at or below store performance threshold.' };
      case 'dead-stock':
        return { title: 'Dead stock', subtitle: 'Products with stock on hand but 0 sales in selected period.' };
      case 'store-comparison':
        return { title: 'Store comparison', subtitle: 'Sales velocity & inventory health across your store network.' };
    }
  };

  const headerInfo = getHeaderInfo();

  if (activeTab === 'store-comparison') {
    const columns: ColumnConfig[] = [
      { title: 'STORE', key: 'store_node', type: 'react_node' },
      { title: 'DOMAIN', key: 'domain', type: 'text' },
      { title: 'UNITS SOLD', key: 'units_sold_formatted', type: 'bold' },
      { title: 'REVENUE', key: 'revenue_formatted', type: 'bold' },
      { title: 'TOTAL PRODUCTS', key: 'productCount', type: 'text' },
      { title: 'OUT OF STOCK', key: 'out_of_stock_node', type: 'react_node' },
    ];

    const formattedItems = data.map((row) => ({
      ...row,
      units_sold_formatted: row.unitsSold?.toLocaleString() || '0',
      revenue_formatted: formatCurrency(row.revenue),
      store_node: (
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-900">{row.storeName}</span>
          {row.isMaster && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
              MASTER
            </span>
          )}
        </div>
      ),
      out_of_stock_node: row.outOfStockCount > 0 ? (
        <span className="text-red-600 font-bold">{row.outOfStockCount}</span>
      ) : (
        <span className="text-gray-400">0</span>
      )
    }));

    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
        <Table
          title={headerInfo.title}
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

  const columns: ColumnConfig[] = activeTab === 'dead-stock' ? [
    { title: 'PRODUCT', key: 'product_node', type: 'react_node' },
    { title: 'SKU', key: 'sku', type: 'text' },
    { title: 'UNITS SOLD', key: 'units_sold_formatted', type: 'bold' },
    { title: 'REVENUE', key: 'revenue_formatted', type: 'bold' },
    { title: 'DAYS WITHOUT SALE', key: 'unsold_duration_node', type: 'react_node' },
  ] : [
    { title: 'PRODUCT', key: 'product_node', type: 'react_node' },
    { title: 'SKU', key: 'sku', type: 'text' },
    { title: 'UNITS SOLD', key: 'units_sold_formatted', type: 'bold' },
    { title: 'REVENUE', key: 'revenue_formatted', type: 'bold' },
    { title: 'CURRENT STOCK', key: 'stock_node', type: 'react_node' },
  ];

  const formattedItems = data.map((p) => ({
    ...p,
    units_sold_formatted: p.unitsSold?.toLocaleString() || '0',
    revenue_formatted: formatCurrency(p.revenue),
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
          <div className="text-xs sm:text-sm font-semibold text-gray-900 truncate max-w-full sm:max-w-xs md:max-w-sm" title={p.title}>
            {p.title}
          </div>
          {p.storeLabel && (
            <div className="mt-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-200 shadow-2xs whitespace-nowrap">
                {p.storeLabel}
              </span>
            </div>
          )}
        </div>
      </div>
    ),
    unsold_duration_node: (
      <span className="inline-flex items-center justify-center bg-[#fff0f0] text-[#991b1b] border border-[#fee2e2] px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap shadow-2xs">
        {p.daysWithoutSale ?? p.daysUnsold ?? 0} days
      </span>
    ),
    stock_node: (
      <StockHealthBadge status={p.stockHealth} stockQuantity={p.currentStock} />
    )
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
      <Table
        title={headerInfo.title}
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
