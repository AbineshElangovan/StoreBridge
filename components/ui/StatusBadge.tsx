import React from 'react';

export interface StatusBadgeProps {
  status: 'success' | 'warning' | 'critical' | 'info' | 'default';
  label: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const statusConfig = {
    success: 'bg-emerald-700 text-white border-emerald-800',
    warning: 'bg-amber-600 text-white border-amber-700',
    critical: 'bg-rose-700 text-white border-rose-800',
    info: 'bg-sky-700 text-white border-sky-800',
    default: 'bg-slate-700 text-white border-slate-800',
  };

  const cssClass = statusConfig[status] || statusConfig.default;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border shadow-2xs ${cssClass}`}>
      {label}
    </span>
  );
}
