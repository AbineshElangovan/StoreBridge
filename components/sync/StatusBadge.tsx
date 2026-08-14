import React from 'react';

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = status.toUpperCase();
  
  let styles = "bg-gray-100 text-gray-800";
  let label = "Unknown";
  
  switch(normalized) {
    case 'SUCCESS':
      styles = "bg-green-100 text-green-800";
      label = "Success";
      break;
    case 'FAILED':
      styles = "bg-red-100 text-red-800";
      label = "Failed";
      break;
    case 'PENDING':
    case 'PROCESSING':
      styles = "bg-yellow-100 text-yellow-800";
      label = "Pending";
      break;
    case 'SKIPPED':
      styles = "bg-gray-100 text-gray-600";
      label = "Skipped";
      break;
  }
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles}`}>
      {label}
    </span>
  );
}
