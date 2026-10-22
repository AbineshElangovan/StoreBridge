"use client";

import React, { useMemo } from 'react';

export type PaginationItem = number | 'ellipsis-start' | 'ellipsis-end';

export interface PaginationProps {
  currentPage?: number;
  page?: number;
  totalPages: number;
  totalCount?: number;
  totalItems?: number;
  limit?: number;
  itemsPerPage?: number;
  onPageChange?: (page: number) => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
  prevLabel?: string;
  nextLabel?: string;
  label?: string;
  className?: string;
  hideOnSinglePage?: boolean;
}

/**
 * Generates an array of visible page numbers and ellipses based on current and total pages.
 * Matches reference: << Prev (1) (2) (3) ... (9) Next >|
 */
export function generatePaginationItems(current: number, total: number): PaginationItem[] {
  if (total <= 6) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  // Near the start: 1, 2, 3, ..., total (e.g. current = 1, 2)
  if (current <= 2) {
    return [1, 2, 3, 'ellipsis-end', total];
  }

  // At page 3: 1, 2, 3, 4, ..., total
  if (current === 3) {
    return [1, 2, 3, 4, 'ellipsis-end', total];
  }

  // Near the end: 1, ..., total-2, total-1, total
  if (current >= total - 1) {
    return [1, 'ellipsis-start', total - 2, total - 1, total];
  }

  // At page total - 2: 1, ..., total-3, total-2, total-1, total
  if (current === total - 2) {
    return [1, 'ellipsis-start', total - 3, total - 2, total - 1, total];
  }

  // In the middle: 1, ..., current-1, current, current+1, ..., total
  return [1, 'ellipsis-start', current - 1, current, current + 1, 'ellipsis-end', total];
}

export function Pagination({
  currentPage,
  page,
  totalPages,
  totalCount,
  totalItems,
  limit,
  itemsPerPage,
  onPageChange,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  prevLabel = 'Go Back',
  nextLabel = 'Keep Going',
  label,
  className = '',
  hideOnSinglePage = true,
}: PaginationProps) {
  const current = Math.max(1, currentPage ?? page ?? 1);
  const safeTotal = Math.max(1, totalPages || 1);

  const isPreviousDisabled = hasPrevious !== undefined ? !hasPrevious : current <= 1;
  const isNextDisabled = hasNext !== undefined ? !hasNext : current >= safeTotal;

  const handlePrevious = () => {
    if (isPreviousDisabled) return;
    if (onPrevious) {
      onPrevious();
    } else if (onPageChange) {
      onPageChange(Math.max(1, current - 1));
    }
  };

  const handleNext = () => {
    if (isNextDisabled) return;
    if (onNext) {
      onNext();
    } else if (onPageChange) {
      onPageChange(Math.min(safeTotal, current + 1));
    }
  };

  const handleSelectPage = (pageNumber: number) => {
    if (pageNumber === current || pageNumber < 1 || pageNumber > safeTotal) return;
    if (onPageChange) onPageChange(pageNumber);
  };

  const items = useMemo(() => {
    return generatePaginationItems(current, safeTotal);
  }, [current, safeTotal]);

  if (hideOnSinglePage && safeTotal <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="Pagination Navigation"
      className={`inline-flex items-center justify-center gap-1.5 sm:gap-2.5 py-1 select-none font-sans ${className}`}
    >
      {/* ── Go Back Button ── */}
      <button
        type="button"
        disabled={isPreviousDisabled}
        onClick={handlePrevious}
        aria-label="Previous page (Go Back)"
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-semibold transition-all duration-150 text-[var(--color-primary,#4F75FF)] hover:text-[var(--color-primary-hover,#335ACF)] hover:bg-[var(--color-primary,#4F75FF)]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary,#4F75FF)] focus-visible:ring-offset-1 disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        <span className="text-base font-bold leading-none select-none">«</span>
        <span className="select-none tracking-tight">{prevLabel}</span>
      </button>

      {/* ── Numbered Page Circles & Ellipses ── */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {items.map((item, idx) => {
          if (item === 'ellipsis-start' || item === 'ellipsis-end') {
            return (
              <span
                key={`${item}-${idx}`}
                className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-xs sm:text-sm font-bold text-[var(--color-primary,#4F75FF)]/60 tracking-widest select-none"
                aria-hidden="true"
              >
                ...
              </span>
            );
          }

          const isActive = item === current;

          return (
            <button
              key={item}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              aria-label={`Page ${item}`}
              onClick={() => handleSelectPage(item)}
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary,#4F75FF)] focus-visible:ring-offset-1 select-none ${
                isActive
                  ? 'border-2 border-[var(--color-primary,#4F75FF)] text-[var(--color-primary,#4F75FF)] font-bold bg-[var(--color-primary,#4F75FF)]/15 shadow-xs ring-2 ring-[var(--color-primary,#4F75FF)]/20 cursor-default'
                  : 'border border-[var(--color-primary,#4F75FF)]/45 text-[var(--color-primary,#4F75FF)]/80 font-medium hover:border-[var(--color-primary,#4F75FF)] hover:text-[var(--color-primary,#4F75FF)] hover:bg-[var(--color-primary,#4F75FF)]/10 hover:shadow-2xs cursor-pointer'
              }`}
            >
              {item}
            </button>
          );
        })}
      </div>

      {/* ── Keep Going Button ── */}
      <button
        type="button"
        disabled={isNextDisabled}
        onClick={handleNext}
        aria-label="Next page (Keep Going)"
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-semibold transition-all duration-150 text-[var(--color-primary,#4F75FF)] hover:text-[var(--color-primary-hover,#335ACF)] hover:bg-[var(--color-primary,#4F75FF)]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary,#4F75FF)] focus-visible:ring-offset-1 disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        <span className="select-none tracking-tight">{nextLabel}</span>
        <span className="text-sm font-mono font-bold leading-none select-none">&gt;|</span>
      </button>
    </nav>
  );
}
