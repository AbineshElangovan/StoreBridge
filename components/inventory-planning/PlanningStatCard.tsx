'use client';

import React from 'react';

interface PlanningStatCardProps {
  label: string;
  value: string | number;
  subtext: string;
  isAlert?: boolean;
}

export function PlanningStatCard({ label, value, subtext, isAlert = false }: PlanningStatCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200/90 p-5 sm:p-6 lg:p-7 shadow-2xs hover:shadow-md hover:border-gray-300 transition-all flex flex-col justify-between w-full min-w-0">
      <div className="min-w-0">
        <p className="text-[11px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 sm:mb-3 truncate">
          {label}
        </p>
        <h3 className={`text-2xl sm:text-3xl font-black tracking-tight mb-1 sm:mb-2 break-words ${isAlert ? 'text-red-600' : 'text-gray-900'}`}>
          {value}
        </h3>
      </div>
      <p className="text-xs text-gray-500 font-medium pt-1 truncate">
        {subtext}
      </p>
    </div>
  );
}
