import React, { useState, useEffect } from 'react';

interface FilterOption {
  label: string;
  value: string;
}

interface TableFilterProps {
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  
  statusFilter?: string;
  onStatusChange?: (val: string) => void;
  statusOptions?: FilterOption[];
}

export function TableFilter({
  searchQuery = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  statusFilter = 'ALL',
  onStatusChange,
  statusOptions = []
}: TableFilterProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery);

  // Sync external changes to local state
  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  // Debounce the search input
  useEffect(() => {
    const handler = setTimeout(() => {
      if (onSearchChange && localSearch !== searchQuery) {
        onSearchChange(localSearch);
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [localSearch, onSearchChange, searchQuery]);

  if (!onSearchChange && !onStatusChange) return null;

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {onSearchChange && (
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-9 pr-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 w-full sm:w-64"
          />
        </div>
      )}
      
      {onStatusChange && statusOptions.length > 0 && (
        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          className="py-2 pl-3 pr-8 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 bg-white"
        >
          {statusOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
