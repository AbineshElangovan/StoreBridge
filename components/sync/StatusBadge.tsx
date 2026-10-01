import React from 'react';

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = status.toUpperCase();
  
  let styles = "bg-slate-700 text-white border-slate-800";
  let label = "Unknown";
  
  switch(normalized) {
    case 'SUCCESS':
      styles = "bg-emerald-700 text-white border-emerald-800";
      label = "Success";
      break;
    case 'FAILED':
      styles = "bg-rose-700 text-white border-rose-800";
      label = "Failed";
      break;
    case 'PENDING':
    case 'PROCESSING':
      styles = "bg-amber-600 text-white border-amber-700";
      label = "Pending";
      break;
    case 'SKIPPED':
      styles = "bg-slate-600 text-white border-slate-700";
      label = "Skipped";
      break;
  }
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border shadow-2xs ${styles}`}>
      {label}
    </span>
  );
}
