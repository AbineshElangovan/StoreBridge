'use client';

import React from 'react';
import { Pagination } from '@/components/common/Pagination';

interface PlanningPaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  onPageChange: (newPage: number) => void;
}

export function PlanningPagination({
  page,
  totalPages,
  totalCount,
  limit,
  onPageChange
}: PlanningPaginationProps) {
  if (totalCount === 0 || totalPages <= 0) return null;

  const startRecord = (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, totalCount);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-gray-200">
      <div className="text-xs text-gray-500 font-medium">
        Showing <span className="font-bold text-gray-900">{startRecord}</span> to{' '}
        <span className="font-bold text-gray-900">{endRecord}</span> of{' '}
        <span className="font-bold text-gray-900">{totalCount}</span> actionable items
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </div>
  );
}
