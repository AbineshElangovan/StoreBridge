'use client';
import React from 'react';
import {
  ProductIcon,
  ChartVerticalIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  CartIcon,
} from '@shopify/polaris-icons';
import { StatCard } from '@/components/ui/StatCard';

export interface DashboardCardsProps {
  stats: {
    totalProducts: number;
    totalInventory: number;
    lowStock: number;
    activeProducts: number;
    lastUpdated: string;
    preorderActive?: number;
  };
  lowStockThreshold?: number;
  crossStore?: boolean;
  isStandalone?: boolean;
  page?: 'dashboard' | 'products';
}

export function DashboardCards({
  stats,
  lowStockThreshold = 15,
  crossStore = false,
  isStandalone = false,
  page = 'dashboard',
}: DashboardCardsProps) {
  const isProductsPage = page === 'products';

  // If NOT standalone, both sides (dashboard & products) show the same original 4 cards
  const statsConfig = !isStandalone
    ? [
        {
          key: 'totalProducts' as const,
          title: 'Total Products',
          description: crossStore ? 'Products across all stores' : 'Products in this store',
          icon: ProductIcon,
          color: 'primary' as const,
        },
        {
          key: 'totalInventory' as const,
          title: 'Total Inventory',
          description: crossStore ? 'Total stock across all stores' : 'Total stock in this store',
          icon: ChartVerticalIcon,
          color: 'info' as const,
        },
        {
          key: 'lowStock' as const,
          title: 'Low Stock',
          description: `Products needing restock (≤${lowStockThreshold} units)`,
          icon: AlertTriangleIcon,
          color: 'warning' as const,
        },
        {
          key: 'activeProducts' as const,
          title: 'Active Products',
          description: 'Products with available inventory',
          icon: CheckCircleIcon,
          color: 'success' as const,
        },
      ]
    : isProductsPage
    ? [
        // Standalone Products Page: 4 cards (Pre-order Products replaces Low Stock)
        {
          key: 'totalProducts' as const,
          title: 'Total Products',
          description: 'Products in this store',
          icon: ProductIcon,
          color: 'primary' as const,
        },
        {
          key: 'totalInventory' as const,
          title: 'Total Inventory',
          description: 'Total stock in this store',
          icon: ChartVerticalIcon,
          color: 'info' as const,
        },
        {
          key: 'preorderActive' as const,
          title: 'Pre-order Products',
          description: 'Products available for pre-order',
          icon: CartIcon,
          color: 'purple' as const,
        },
        {
          key: 'activeProducts' as const,
          title: 'Active Products',
          description: 'Products with available inventory',
          icon: CheckCircleIcon,
          color: 'success' as const,
        },
      ]
    : [
        // Standalone Dashboard Page: 5 cards in 1 line
        {
          key: 'totalProducts' as const,
          title: 'Total Products',
          description: 'Total store catalog',
          icon: ProductIcon,
          color: 'primary' as const,
        },
        {
          key: 'totalInventory' as const,
          title: 'Total Inventory',
          description: 'Total stock on hand',
          icon: ChartVerticalIcon,
          color: 'info' as const,
        },
        {
          key: 'activeProducts' as const,
          title: 'Active Products',
          description: 'In-stock live products',
          icon: CheckCircleIcon,
          color: 'success' as const,
        },
        {
          key: 'lowStock' as const,
          title: 'Low Stock',
          description: `Needing restock (≤${lowStockThreshold})`,
          icon: AlertTriangleIcon,
          color: 'warning' as const,
        },
        {
          key: 'preorderActive' as const,
          title: 'Pre-orders',
          description: 'Eligible for pre-order',
          icon: CartIcon,
          color: 'purple' as const,
        },
      ];

  const isFiveCards = isStandalone && !isProductsPage;

  const gridClass = isFiveCards
    ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-3.5'
    : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4';

  return (
    <div className={gridClass}>
      {statsConfig.map(({ key, title, description, icon, color }) => (
        <div key={key} className="min-w-0">
          <StatCard
            title={title}
            description={description}
            value={(stats[key] ?? 0).toLocaleString('en-US')}
            icon={icon}
            color={color}
            compact={isFiveCards}
          />
        </div>
      ))}
    </div>
  );
}
