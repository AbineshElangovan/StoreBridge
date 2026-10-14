'use client';

import React from 'react';
import { BarChart, PieChart } from '@/components/common/BarChart';

export interface StoreChartEntry {
  name: string;
  'Total Products': number;
  'Total Inventory': number;
  'Total Sales Value': number;
}

export interface DashboardChartsProps {
  chartData: {
    combinedData: StoreChartEntry[];
    currentStoreData: StoreChartEntry[];
  };
  isStandalone?: boolean;
}

// Distinct, vibrant, high-contrast palette for multi-store comparison
const STORE_COLORS = [
  '#0284c7', // 1. Electric Ocean Blue
  '#f59e0b', // 2. Warm Amber Gold
  '#10b981', // 3. Vibrant Emerald Green
  '#ec4899', // 4. Coral Rose Pink
  '#6366f1', // 5. Royal Indigo
  '#ea580c', // 6. Bright Tangerine Orange
  '#14b8a6', // 7. Caribbean Teal
  '#8b5cf6', // 8. Vivid Violet
];

export function DashboardCharts({ chartData, isStandalone }: DashboardChartsProps) {
  const { combinedData, currentStoreData } = chartData;

  // Use combinedData to show relative share of each store across the network
  const storesForShare = combinedData && combinedData.length > 0 ? combinedData : currentStoreData;

  const storesForShareWithColors = storesForShare.map((s, i) => ({
    ...s,
    color: STORE_COLORS[i % STORE_COLORS.length],
  }));

  const salesPieData = storesForShareWithColors.map((s) => ({
    name: s.name,
    value: s['Total Sales Value'],
    color: s.color,
  }));

  const productsPieData = storesForShareWithColors.map((s) => ({
    name: s.name,
    value: s['Total Products'],
    color: s.color,
  }));

  const isSingle = isStandalone || storesForShare.length <= 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Row 1 – Products (Electric Blue) vs Inventory (Warm Amber) grouped bar chart */}
      <BarChart
        title={isSingle ? "Store Inventory Overview" : "Inventory Comparison Chart"}
        subtitle={isSingle ? "Products & Inventory breakdown" : "Store Comparison — Products & Inventory"}
        data={combinedData}
        xKey="name"
        bars={[
          { key: 'Total Products',  color: '#0284c7', name: 'Total Products'  },
          { key: 'Total Inventory', color: '#f59e0b', name: 'Total Inventory' },
        ]}
      />

      {/* Row 2 – Two multi-colored pie charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5 w-full min-w-0">
        <div className="col-span-1 md:col-span-1 min-w-0 overflow-hidden">
          <PieChart
            title={isSingle ? "Sales Value Share" : "Sales Share %"}
            subtitle={isSingle ? "Inventory sales value contribution" : "Store sales distribution across network"}
            data={salesPieData}
            unit="₹"
          />
        </div>
        <div className="col-span-1 md:col-span-1 min-w-0 overflow-hidden">
          <PieChart
            title={isSingle ? "Product Catalog Share" : "Products Share %"}
            subtitle={isSingle ? "Active catalog breakdown" : "Product catalog distribution across stores"}
            data={productsPieData}
          />
        </div>
      </div>

    </div>
  );
}
