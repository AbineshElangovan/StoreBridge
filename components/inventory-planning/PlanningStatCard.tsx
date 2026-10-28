'use client';

import React from 'react';

interface PlanningStatCardProps {
  label: string;
  value: string | number;
  subtext: string;
  isAlert?: boolean;
}

export function PlanningStatCard({ label, value, subtext, isAlert = false }: PlanningStatCardProps) {
  const getTheme = () => {
    const l = label.toLowerCase();
    if (isAlert || l.includes('high') || l.includes('risk') || l.includes('stockout')) {
      // 1. High Risk (Red / Rose)
      return {
        border: 'border-red-100/90 hover:border-red-300',
        shadow: 'hover:shadow-xl hover:shadow-red-500/15',
        label: 'text-red-900 group-hover:text-red-600',
        value: 'group-hover:text-red-600',
        subtext: 'text-red-700 group-hover:text-red-950',
      };
    }
    if (l.includes('low') || l.includes('adequate') || l.includes('healthy') || l.includes('coverage')) {
      // 2. Low Risk (Emerald Green)
      return {
        border: 'border-emerald-100/90 hover:border-emerald-300',
        shadow: 'hover:shadow-xl hover:shadow-emerald-500/15',
        label: 'text-emerald-900 group-hover:text-emerald-600',
        value: 'group-hover:text-emerald-600',
        subtext: 'text-emerald-700 group-hover:text-emerald-950',
      };
    }
    if (l.includes('replenish') || l.includes('order') || l.includes('warn') || l.includes('medium')) {
      // 3. Replenishment Needed (Amber / Orange)
      return {
        border: 'border-amber-100/90 hover:border-amber-300',
        shadow: 'hover:shadow-xl hover:shadow-amber-500/15',
        label: 'text-amber-900 group-hover:text-amber-600',
        value: 'group-hover:text-amber-600',
        subtext: 'text-amber-700 group-hover:text-amber-950',
      };
    }
    // 4. Monitored Catalog (Sky Blue)
    return {
      border: 'border-sky-100/90 hover:border-sky-300',
      shadow: 'hover:shadow-xl hover:shadow-sky-500/15',
      label: 'text-sky-900 group-hover:text-sky-600',
      value: 'group-hover:text-sky-600',
      subtext: 'text-sky-700 group-hover:text-sky-950',
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
