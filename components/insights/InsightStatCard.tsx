'use client';

import React from 'react';

interface InsightStatCardProps {
  label: string;
  value: string | number;
  subtext: string;
  isAlert?: boolean;
}

export function InsightStatCard({ label, value, subtext, isAlert = false }: InsightStatCardProps) {
  const getTheme = () => {
    const l = label.toLowerCase();
    if (l.includes('revenue') || l.includes('sales') || l.includes('amount')) {
      // 2. Revenue (Emerald Green)
      return {
        border: 'border-emerald-100/90 hover:border-emerald-300',
        shadow: 'hover:shadow-xl hover:shadow-emerald-500/15',
        label: 'text-emerald-900 group-hover:text-emerald-600',
        value: 'group-hover:text-emerald-600',
        subtext: 'text-emerald-700 group-hover:text-emerald-950',
      };
    }
    if (l.includes('slow') || l.includes('threshold')) {
      // 3. Slow Movers (Amber / Orange)
      return {
        border: 'border-amber-100/90 hover:border-amber-300',
        shadow: 'hover:shadow-xl hover:shadow-amber-500/15',
        label: 'text-amber-900 group-hover:text-amber-600',
        value: 'group-hover:text-amber-600',
        subtext: 'text-amber-700 group-hover:text-amber-950',
      };
    }
    if (isAlert || l.includes('dead') || l.includes('risk') || l.includes('stockout')) {
      // 4. Dead Stock (Rose / Red)
      return {
        border: 'border-red-100/90 hover:border-red-300',
        shadow: 'hover:shadow-xl hover:shadow-red-500/15',
        label: 'text-red-900 group-hover:text-red-600',
        value: 'group-hover:text-red-600',
        subtext: 'text-red-700 group-hover:text-red-950',
      };
    }
    // 1. Units Sold (Pure Blue - distinct from purple)
    return {
      border: 'border-blue-100/90 hover:border-blue-300',
      shadow: 'hover:shadow-xl hover:shadow-blue-500/15',
      label: 'text-blue-900 group-hover:text-blue-600',
      value: 'group-hover:text-blue-600',
      subtext: 'text-blue-700 group-hover:text-blue-950',
    };
  };

  const theme = getTheme();

  return (
    <div className={`group bg-white rounded-2xl border p-5 shadow-xs hover:-translate-y-1.5 transition-all duration-300 ease-out cursor-pointer select-none flex flex-col justify-between w-full h-full min-w-0 ${theme.border} ${theme.shadow}`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold uppercase tracking-tight truncate transition-colors duration-300 ${theme.label}`}>
          {label}
        </span>
      </div>
      <div className="mt-3">
        <span className={`text-2xl sm:text-3xl font-black tracking-tight transition-all duration-300 transform origin-left inline-block group-hover:scale-105 ${isAlert ? 'text-red-600' : 'text-slate-900'} ${theme.value}`}>
          {value}
        </span>
        <p className={`text-xs font-semibold mt-1 truncate transition-colors duration-300 ${theme.subtext}`}>
          {subtext}
        </p>
      </div>
    </div>
  );
}
