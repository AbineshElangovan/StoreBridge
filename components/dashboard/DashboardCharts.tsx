'use client';

import React, { useState } from 'react';
import { BarChart, PieChart, formatYTick } from '@/components/common/BarChart';
import type { PreorderMetrics } from '@/services/preorder/preorder-service';

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
  preorderMetrics?: PreorderMetrics;
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

interface ToggleButtonGroupProps<T extends string> {
  options: { label: string; value: T }[];
  value: T;
  onChange: (val: T) => void;
}

function ToggleButtonGroup<T extends string>({
  options,
  value,
  onChange,
}: ToggleButtonGroupProps<T>) {
  return (
    <div className="inline-flex items-center p-0.5 bg-gray-100 rounded-lg border border-gray-200/80 shadow-inner">
      {options.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1 text-xs transition-all duration-150 select-none cursor-pointer rounded-md ${
              isActive
                ? 'bg-[var(--color-primary)] toggle-btn-active font-black shadow-xs border border-[var(--color-primary-dark,var(--color-primary))]'
                : 'text-gray-600 hover:text-black font-semibold border border-transparent hover:bg-gray-200/50'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function DashboardCharts({ chartData, isStandalone, preorderMetrics }: DashboardChartsProps) {
  const { combinedData, currentStoreData } = chartData;

  // Use combinedData to show relative share of each store across the network
  const storesForShare = combinedData && combinedData.length > 0 ? combinedData : currentStoreData;
  const isSingle = isStandalone || storesForShare.length <= 1;

  // Top Bar Chart Toggle: 'inventory_products' (Total Products & Total Inventory) vs 'sales_value' (Total Sales Value)
  const [barMetric, setBarMetric] = useState<'inventory_products' | 'sales_value'>('inventory_products');

  // Left Pie Chart Toggle: 'sales_value' vs 'inventory_products'
  const [firstPieMetric, setFirstPieMetric] = useState<'sales_value' | 'inventory_products'>('sales_value');

  // Right Pie Chart Toggles:
  // For Standalone: 'revenue' (Collected vs Pending Revenue) vs 'stock' (Stock Allocated vs Awaiting Stock)
  const [preorderMetric, setPreorderMetric] = useState<'revenue' | 'stock'>('revenue');
  // For Multi-Store: 'products' vs 'inventory'
  const [multiStoreMetric, setMultiStoreMetric] = useState<'products' | 'inventory'>('products');

  const storesForShareWithColors = storesForShare.map((s, i) => ({
    ...s,
    color: STORE_COLORS[i % STORE_COLORS.length],
  }));

  // ── First Pie Chart Data ──
  let firstPieData: { name: string; value: number; color: string }[] = [];
  let firstPieTitle = '';
  let firstPieSubtitle = '';
  let firstPieUnit = '';

  const singleStore = storesForShare[0] || {
    name: 'Inventory',
    'Total Products': 0,
    'Total Inventory': 0,
    'Total Sales Value': 0,
  };

  if (firstPieMetric === 'sales_value') {
    if (isSingle) {
      firstPieTitle = 'Sales Value Overview';
      firstPieSubtitle = `₹${(singleStore['Total Sales Value'] || 0).toLocaleString('en-IN')} total inventory value`;
      firstPieData = [{ name: 'Sales Value', value: singleStore['Total Sales Value'] || 0, color: '#10b981' }];
      firstPieUnit = '₹';
    } else {
      firstPieTitle = 'Sales Share %';
      firstPieSubtitle = 'Store sales distribution across network';
      firstPieData = storesForShareWithColors.map((s) => ({
        name: s.name,
        value: s['Total Sales Value'],
        color: s.color,
      }));
      firstPieUnit = '₹';
    }
  } else {
    if (isSingle) {
      firstPieTitle = 'Products & Inventory';
      firstPieSubtitle = `${singleStore['Total Products'] || 0} products • ${singleStore['Total Inventory'] || 0} inventory units`;
      firstPieData = [
        { name: 'Total Products', value: singleStore['Total Products'] || 0, color: '#0284c7' },
        { name: 'Total Inventory', value: singleStore['Total Inventory'] || 0, color: '#f59e0b' },
      ];
      firstPieUnit = '';
    } else {
      firstPieTitle = 'Products Share %';
      firstPieSubtitle = 'Product catalog distribution across stores';
      firstPieData = storesForShareWithColors.map((s) => ({
        name: s.name,
        value: s['Total Products'],
        color: s.color,
      }));
      firstPieUnit = '';
    }
  }

  // ── Pre-order Metrics (for Standalone Store) ──
  const totalPreorders = preorderMetrics?.totalPreorders || 0;
  const collectedRevenue = preorderMetrics?.revenue || 0;
  const pendingRevenue = preorderMetrics?.pendingRevenue || 0;
  const totalPreorderRevenue = preorderMetrics?.totalRevenue || (collectedRevenue + pendingRevenue);
  const allocatedStockCount = preorderMetrics?.allocatedStockCount || 0;
  const awaitingStockCount = preorderMetrics?.awaitingStockCount || 0;
  const hasPreorders = totalPreorders > 0 || totalPreorderRevenue > 0;
  const hasStockMetrics = allocatedStockCount > 0 || awaitingStockCount > 0;

  // ── Second Pie Chart Data ──
  let secondPieData: { name: string; value: number; color: string }[] = [];
  let secondPieTitle = '';
  let secondPieSubtitle = '';
  let secondPieUnit = '';
  let secondPieHeaderAction: React.ReactNode = null;

  if (isSingle) {
    // Standalone store: Pre-order related with toggle for Revenue vs Product & Awaiting Stock
    secondPieHeaderAction = (
      <ToggleButtonGroup
        options={[
          { label: 'Revenue', value: 'revenue' },
          { label: 'Product & Await', value: 'stock' },
        ]}
        value={preorderMetric}
        onChange={setPreorderMetric}
      />
    );

    if (preorderMetric === 'revenue') {
      secondPieTitle = 'Pre-order Revenue Share';
      secondPieSubtitle = hasPreorders
        ? `${totalPreorders} pre-orders • ₹${totalPreorderRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total value`
        : 'Collected vs pending pre-order revenue';
      secondPieData = [
        { name: 'Collected Revenue', value: collectedRevenue, color: '#10b981' },
        { name: 'Pending Revenue', value: pendingRevenue, color: '#0284c7' },
      ].filter((d) => d.value > 0);
      secondPieUnit = '₹';
    } else {
      secondPieTitle = 'Pre-order Stock & Awaiting';
      secondPieSubtitle = hasStockMetrics
        ? `${allocatedStockCount} allocated • ${awaitingStockCount} awaiting restock`
        : 'Stock allocated vs awaiting restock';
      secondPieData = [
        { name: 'Stock Allocated', value: allocatedStockCount, color: '#10b981' },
        { name: 'Awaiting Stock', value: awaitingStockCount, color: '#ea580c' },
      ].filter((d) => d.value > 0);
      secondPieUnit = '';
    }
  } else {
    // Multi-store network: Catalog distribution with toggle for Products vs Inventory
    secondPieHeaderAction = (
      <ToggleButtonGroup
        options={[
          { label: 'Products', value: 'products' },
          { label: 'Inventory', value: 'inventory' },
        ]}
        value={multiStoreMetric}
        onChange={setMultiStoreMetric}
      />
    );

    if (multiStoreMetric === 'products') {
      secondPieTitle = 'Products Share %';
      secondPieSubtitle = 'Product catalog distribution across stores';
      secondPieData = storesForShareWithColors.map((s) => ({
        name: s.name,
        value: s['Total Products'],
        color: s.color,
      }));
      secondPieUnit = '';
    } else {
      secondPieTitle = 'Inventory Share %';
      secondPieSubtitle = 'Inventory unit distribution across stores';
      secondPieData = storesForShareWithColors.map((s) => ({
        name: s.name,
        value: s['Total Inventory'],
        color: s.color,
      }));
      secondPieUnit = '';
    }
  }

  // ── Top Bar Chart Config ──
  const barChartAction = (
    <ToggleButtonGroup
      options={[
        { label: 'Inventory & Products', value: 'inventory_products' },
        { label: 'Sales Value', value: 'sales_value' },
      ]}
      value={barMetric}
      onChange={setBarMetric}
    />
  );

  const barChartTitle = barMetric === 'inventory_products'
    ? (isSingle ? 'Store Inventory Overview' : 'Inventory Comparison Chart')
    : (isSingle ? 'Store Sales Value Overview' : 'Sales Value Comparison Chart');

  const barChartSubtitle = barMetric === 'inventory_products'
    ? (isSingle ? 'Products & Inventory breakdown' : 'Store Comparison — Products & Inventory')
    : (isSingle ? 'Estimated inventory sales value' : 'Store Comparison — Sales Value');

  const barChartBars = barMetric === 'inventory_products'
    ? [
        { key: 'Total Products',  color: '#0284c7', name: 'Total Products'  },
        { key: 'Total Inventory', color: '#f59e0b', name: 'Total Inventory' },
      ]
    : [
        { key: 'Total Sales Value', color: '#10b981', name: 'Total Sales Value' },
      ];

  const barChartYTickFormatter = barMetric === 'sales_value'
    ? (v: number) => `₹${formatYTick(v)}`
    : formatYTick;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Row 1 – Bar Chart with 2-option Toggle: [Inventory & Products] [Sales Value] */}
      <BarChart
        title={barChartTitle}
        subtitle={barChartSubtitle}
        data={combinedData}
        xKey="name"
        bars={barChartBars}
        headerAction={barChartAction}
        yTickFormatter={barChartYTickFormatter}
      />

      {/* Row 2 – First Pie Chart (Sales Value / Products & Inventory) on Left, Second Pie Chart (Pre-order for Standalone / Network Share) on Right */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5 w-full min-w-0 items-stretch">
        <div className="col-span-1 md:col-span-1 min-w-0 overflow-hidden flex flex-col h-full">
          <PieChart
            title={firstPieTitle}
            subtitle={firstPieSubtitle}
            data={firstPieData}
            unit={firstPieUnit}
            headerAction={
              <ToggleButtonGroup
                options={[
                  { label: 'Sales Value', value: 'sales_value' },
                  { label: 'Inventory & Products', value: 'inventory_products' },
                ]}
                value={firstPieMetric}
                onChange={setFirstPieMetric}
              />
            }
          />
        </div>
        <div className="col-span-1 md:col-span-1 min-w-0 overflow-hidden flex flex-col h-full">
          <PieChart
            title={secondPieTitle}
            subtitle={secondPieSubtitle}
            data={secondPieData}
            unit={secondPieUnit}
            headerAction={secondPieHeaderAction}
          />
        </div>
      </div>

    </div>
  );
}

