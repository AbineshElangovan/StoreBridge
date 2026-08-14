import React, { useState, useMemo } from 'react';
import { StatusBadge } from './StatusBadge';
import { TableFilter } from './TableFilter';
import { LocalizedDate } from '@/components/common/LocalizedDate';

interface SyncLog {
  id: string;
  sku: string | null;
  productTitle?: string;
  sourceStore: { label: string | null; shopDomain: string };
  destinationStore: { label: string | null; shopDomain: string };
  createdAt: string;
  status: string;
  errorMessage: string | null;
}

interface SyncHistoryTableProps {
  logs: any[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function SyncHistoryTable({ 
  logs, 
  isLoading, 
  page, 
  totalPages, 
  onPageChange
}: SyncHistoryTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Status Filter
      if (statusFilter !== 'ALL' && log.status !== statusFilter) {
        return false;
      }
      
      // Search Query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const skuMatch = log.sku?.toLowerCase().includes(query);
        const titleMatch = log.productTitle?.toLowerCase().includes(query);
        const sourceMatch = log.sourceStore?.label?.toLowerCase().includes(query) || log.sourceStore?.shopDomain?.toLowerCase().includes(query);
        const destMatch = log.destinationStore?.label?.toLowerCase().includes(query) || log.destinationStore?.shopDomain?.toLowerCase().includes(query);
        
        if (!skuMatch && !titleMatch && !sourceMatch && !destMatch) {
          return false;
        }
      }
      return true;
    });
  }, [logs, searchQuery, statusFilter]);

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-12 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const statusOptions = [
    { label: 'All Statuses', value: 'ALL' },
    { label: 'Success', value: 'SUCCESS' },
    { label: 'Failed', value: 'FAILED' },
    { label: 'Pending', value: 'PENDING' },
  ];

  const formatErrorMessage = (msg: string | null) => {
    if (!msg) return '—';
    const lowerMsg = msg.toLowerCase();
    
    // Unauthorized / API errors
    if (lowerMsg.includes('401 unauthorized') || lowerMsg.includes('graphql client: unauthorized')) {
      return '401 Unauthorized';
    }
    if (lowerMsg.includes('403 forbidden') || lowerMsg.includes('access denied')) {
      return '403 Forbidden';
    }
    if (lowerMsg.includes('networkstatuscode')) {
      return 'Network/API Error';
    }
    
    // Validation / Data errors
    if (lowerMsg.includes('invalid variant option value')) {
      return 'Variant is invalid';
    }
    if (lowerMsg.includes('sku') || lowerMsg.includes('mismatch sku')) {
      return 'Mismatch SKU';
    }
    if (lowerMsg.includes("can't be blank")) {
      return 'Missing required field';
    }
    if (lowerMsg.includes("not sync")) {
       return 'Not sync';
    }
    
    // Fallback: just return the first few words or a clamped string
    if (msg.length > 50) return msg.substring(0, 47) + '...';
    return msg;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden w-full">
      <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Synchronization history</h2>
          <p className="text-sm text-gray-500">Every replication attempt with its result.</p>
        </div>
        
        <TableFilter 
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search SKU or Store..."
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          statusOptions={statusOptions}
        />
      </div>
      
      {filteredLogs.length === 0 ? (
        <div className="p-12 text-center border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No history found</h3>
          <p className="text-gray-500">Try adjusting your search or filter criteria.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">PRODUCT</th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">SKU</th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">SOURCE</th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">DESTINATION</th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">TIME</th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">STATUS</th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">ERROR DETAILS</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900 max-w-[150px] truncate" title={log.productTitle || 'Product Sync'}>
                      {log.productTitle || 'Product Sync'}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                      {log.sku || '—'}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-500" title={log.sourceStore?.label || log.sourceStore?.shopDomain || 'Unknown'}>
                      {log.sourceStore?.label || log.sourceStore?.shopDomain || 'Unknown'}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-500" title={log.destinationStore?.label || log.destinationStore?.shopDomain || 'Unknown'}>
                      {log.destinationStore?.label || log.destinationStore?.shopDomain || 'Unknown'}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                      {new Date(log.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-sm">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-500">
                      <div className="line-clamp-2 max-w-[200px]" title={log.errorMessage || ''}>
                        {formatErrorMessage(log.errorMessage)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white px-4 py-3 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4 sm:px-6">
            <div>
              <p className="text-sm text-gray-700">
                Showing page <span className="font-medium">{page}</span> of <span className="font-medium">{Math.max(1, totalPages)}</span>
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => onPageChange(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="relative inline-flex items-center px-4 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                  className="relative inline-flex items-center px-4 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </nav>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
