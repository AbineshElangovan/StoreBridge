"use client";

import React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@shopify/polaris-icons';

export interface PaginationProps {
  currentPage?: number;
  page?: number;
  totalPages: number;
  onPageChange?: (page: number) => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
  label?: string;
  className?: string;
}

export function Pagination({
  currentPage,
  page,
  totalPages,
  onPageChange,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  label,
  className = '',
}: PaginationProps) {
  const current = currentPage ?? page ?? 1;
  const isPreviousDisabled = hasPrevious !== undefined ? !hasPrevious : current <= 1;
  const isNextDisabled = hasNext !== undefined ? !hasNext : current >= totalPages;

  const handlePrevious = () => {
    if (isPreviousDisabled) return;
    if (onPrevious) onPrevious();
    else if (onPageChange) onPageChange(Math.max(1, current - 1));
  };

  const handleNext = () => {
    if (isNextDisabled) return;
    if (onNext) onNext();
    else if (onPageChange) onPageChange(Math.min(totalPages, current + 1));
  };

  if (totalPages <= 1) return null;

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="inline-flex items-center gap-3 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-2xs">
        <button
          type="button"
          disabled={isPreviousDisabled}
          onClick={handlePrevious}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
            isPreviousDisabled
              ? 'bg-[#eaebee] text-gray-400 cursor-not-allowed opacity-50'
              : 'bg-[#e4e5e7] hover:bg-[#d8d9dc] text-gray-800 cursor-pointer shadow-2xs'
          }`}
          aria-label="Previous page"
        >
          <div style={{ width: 16, height: 16 }}>
            <ChevronLeftIcon />
          </div>
        </button>

        <span className="text-sm font-semibold text-gray-700 select-none px-1">
          {label || `Page ${current} of ${totalPages}`}
        </span>

        <button
          type="button"
          disabled={isNextDisabled}
          onClick={handleNext}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
            isNextDisabled
              ? 'bg-[#eaebee] text-gray-400 cursor-not-allowed opacity-50'
              : 'bg-[#e4e5e7] hover:bg-[#d8d9dc] text-gray-800 cursor-pointer shadow-2xs'
          }`}
          aria-label="Next page"
        >
          <div style={{ width: 16, height: 16 }}>
            <ChevronRightIcon />
          </div>
        </button>
      </div>
    </div>
  );
}
