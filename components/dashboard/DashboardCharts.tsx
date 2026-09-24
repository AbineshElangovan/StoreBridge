'use client';
// Removed Polaris Grid
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
}

const STORE_COLORS = [
  '#38bdf8', // Light Sky Blue
  '#a78bfa', // Light Lavender
  '#fb923c', // Light Peach / Coral
  '#34d399', // Light Mint
  '#f472b6', // Light Rose
  '#fbbf24', // Light Amber
  '#818cf8', // Light Periwinkle
  '#2dd4bf', // Light Aqua
];

export function DashboardCharts({ chartData }: DashboardChartsProps) {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Row 1 – Products vs Inventory grouped bar chart */}
      <BarChart
        title="Inventory Comparison Chart"
        subtitle="Store Comparison — Products & Inventory"
        data={combinedData}
        xKey="name"
        bars={[
          { key: 'Total Products',  color: '#38bdf8', name: 'Total Products'  },
          { key: 'Total Inventory', color: '#a78bfa', name: 'Total Inventory' },
        ]}
      />

      {/* Row 2 – Sales Value bar + two pie charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
        <div className="col-span-1 md:col-span-2">
          <BarChart
            title="Sales Value — Store Comparison"
            subtitle="Estimated revenue across connected stores"
            data={storesForShareWithColors}
            xKey="name"
            bars={[
              { key: 'Total Sales Value', color: '#38bdf8', name: 'Sales Value' },
            ]}
          />
        </div>
        <div className="col-span-1 md:col-span-1">
          <PieChart
            title="Sales Share %"
            subtitle="Store sales distribution across network"
            data={salesPieData}
            unit="₹"
          />
        </div>
        <div className="col-span-1 md:col-span-1">
          <PieChart
            title="Products Share %"
            subtitle="Product catalog distribution across stores"
            data={productsPieData}
          />
        </div>
      </div>

    </div>
  );
}
