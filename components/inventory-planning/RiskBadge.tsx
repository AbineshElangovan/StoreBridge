'use client';

import React from 'react';

export type RiskLevel = 'OUT_OF_STOCK' | 'HIGH' | 'LOW' | 'NO_DEMAND';

interface RiskBadgeProps {
  risk: RiskLevel | string;
}

export function RiskBadge({ risk }: RiskBadgeProps) {
  switch (risk) {
    case 'OUT_OF_STOCK':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-700 text-white border border-rose-800 shadow-2xs whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-200 shrink-0"></span>
          Out of Stock
        </span>
      );

    case 'HIGH':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-700 text-white border border-rose-800 shadow-2xs whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-200 shrink-0"></span>
          High Risk
        </span>
      );

    case 'LOW':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-700 text-white border border-emerald-800 shadow-2xs whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-200 shrink-0"></span>
          Low Risk
        </span>
      );

    case 'NO_DEMAND':
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-700 text-white border border-slate-800 shadow-2xs whitespace-nowrap">
          No Demand
        </span>
      );
  }
}
