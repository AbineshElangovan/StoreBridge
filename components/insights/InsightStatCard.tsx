'use client';

import React from 'react';

interface InsightStatCardProps {
  label: string;
  value: string | number;
  subtext: string;
  isAlert?: boolean;
}

export function InsightStatCard({ label, value, subtext, isAlert = false }: InsightStatCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200/90 p-6 sm:p-7 shadow-2xs hover:shadow-md hover:border-gray-300 transition-all flex flex-col justify-between">
      <div>
        <p className="text-[11px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
          {label}
        </p>
        <h3 className={`text-2xl sm:text-3xl font-black tracking-tight mb-2 ${isAlert ? 'text-red-600' : 'text-gray-900'}`}>
          {value}
        </h3>
      </div>
      <p className="text-xs text-gray-500 font-medium pt-1">
        {subtext}
      </p>
    </div>
  );
}
