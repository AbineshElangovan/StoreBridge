'use client';
import React from 'react';
import { Icon } from '@shopify/polaris';

export interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ComponentProps<typeof Icon>['source'];
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
  loading?: boolean;
  compact?: boolean;
}

export function StatCard({
  title,
  value,
  description,
  icon,
  color = 'primary',
  loading,
  compact = false,
}: StatCardProps) {
  const colorMap = {
    primary: {
      // 1. Total Products (Teal / Ocean Cyan - distinct from purple)
      border: 'border-teal-100/90 hover:border-teal-300',
      shadow: 'hover:shadow-xl hover:shadow-teal-500/15',
      title: 'text-teal-900 group-hover:text-teal-600',
      value: 'text-slate-900 group-hover:text-teal-600',
      desc: 'text-teal-700 group-hover:text-teal-950',
      iconBox: 'bg-teal-50 text-teal-700 border-teal-100/60 group-hover:bg-teal-100 group-hover:text-teal-800',
      iconRotate: 'group-hover:rotate-6',
    },
    info: {
      // 2. Total Inventory (Sky Blue)
      border: 'border-sky-100/90 hover:border-sky-300',
      shadow: 'hover:shadow-xl hover:shadow-sky-500/15',
      title: 'text-sky-900 group-hover:text-sky-600',
      value: 'text-slate-900 group-hover:text-sky-600',
      desc: 'text-sky-700 group-hover:text-sky-950',
      iconBox: 'bg-sky-50 text-sky-700 border-sky-100/60 group-hover:bg-sky-100 group-hover:text-sky-800',
      iconRotate: 'group-hover:rotate-6',
    },
    success: {
      // 3. Active Products (Emerald Green)
      border: 'border-emerald-100/90 hover:border-emerald-300',
      shadow: 'hover:shadow-xl hover:shadow-emerald-500/15',
      title: 'text-emerald-900 group-hover:text-emerald-600',
      value: 'text-slate-900 group-hover:text-emerald-600',
      desc: 'text-emerald-700 group-hover:text-emerald-950',
      iconBox: 'bg-emerald-50 text-emerald-700 border-emerald-100/60 group-hover:bg-emerald-100 group-hover:text-emerald-800',
      iconRotate: 'group-hover:rotate-6',
    },
    warning: {
      // 4. Low Stock (Amber / Orange)
      border: 'border-amber-100/90 hover:border-amber-300',
      shadow: 'hover:shadow-xl hover:shadow-amber-500/15',
      title: 'text-amber-900 group-hover:text-amber-600',
      value: 'text-slate-900 group-hover:text-amber-600',
      desc: 'text-amber-700 group-hover:text-amber-950',
      iconBox: 'bg-amber-50 text-amber-700 border-amber-100/60 group-hover:bg-amber-100 group-hover:text-amber-800',
      iconRotate: 'group-hover:-rotate-6',
    },
    purple: {
      // 5. Pre-orders (Purple / Fuchsia)
      border: 'border-purple-100/90 hover:border-purple-300',
      shadow: 'hover:shadow-xl hover:shadow-purple-500/15',
      title: 'text-purple-900 group-hover:text-purple-600',
      value: 'text-slate-900 group-hover:text-purple-600',
      desc: 'text-purple-700 group-hover:text-purple-950',
      iconBox: 'bg-purple-50 text-purple-700 border-purple-100/60 group-hover:bg-purple-100 group-hover:text-purple-800',
      iconRotate: 'group-hover:rotate-6',
    },
    danger: {
      border: 'border-red-100/90 hover:border-red-300',
      shadow: 'hover:shadow-xl hover:shadow-red-500/15',
      title: 'text-red-900 group-hover:text-red-600',
      value: 'text-slate-900 group-hover:text-red-600',
      desc: 'text-red-700 group-hover:text-red-950',
      iconBox: 'bg-red-50 text-red-700 border-red-100/60 group-hover:bg-red-100 group-hover:text-red-800',
      iconRotate: 'group-hover:-rotate-6',
    },
  };

  const theme = colorMap[color] || colorMap.primary;

  return (
    <div
      className={`group bg-white ${
        compact ? 'p-4 min-h-[120px]' : 'p-5 min-h-[140px]'
      } rounded-2xl border shadow-xs flex flex-col justify-between hover:border-opacity-100 hover:-translate-y-1.5 transition-all duration-300 ease-out cursor-pointer select-none w-full h-full ${
        theme.border
      } ${theme.shadow}`}
    >
      {/* Top Header: Title and Icon */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-xs font-bold tracking-tight uppercase truncate transition-colors duration-300 ${theme.title}`}
          title={title}
        >
          {title}
        </span>
        {icon && (
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all duration-300 group-hover:scale-110 flex-shrink-0 ${theme.iconBox} ${theme.iconRotate}`}
          >
            <Icon source={icon} tone="base" />
          </div>
        )}
      </div>

      {/* Bottom Section: Value and Description */}
      <div className="mt-3">
        {loading ? (
          <div className="h-8 w-3/5 bg-gray-100 rounded-lg animate-pulse" />
        ) : (
          <span
            className={`text-2xl sm:text-3xl font-black tracking-tight transition-all duration-300 transform origin-left inline-block group-hover:scale-105 ${theme.value}`}
          >
            {value}
          </span>
        )}
        {description && (
          <p
            className={`text-xs font-semibold mt-1 truncate transition-colors duration-300 ${theme.desc}`}
            title={description}
          >
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
