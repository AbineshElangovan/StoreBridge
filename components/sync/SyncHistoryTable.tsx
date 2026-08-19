import React, { useMemo } from 'react';
import { Table, ColumnConfig } from '@/components/common/Table';
import { StatusBadge } from './StatusBadge';

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
    
    // Fallback: just return clamped string
    if (msg.length > 50) return msg.substring(0, 47) + '...';
    return msg;
  };

  const columns: ColumnConfig[] = [
    { title: 'PRODUCT', key: 'product_title', type: 'bold' },
    { title: 'SKU', key: 'sku_formatted', type: 'text' },
    { title: 'SOURCE', key: 'source_store', type: 'text' },
    { title: 'DESTINATION', key: 'dest_store', type: 'text' },
    { title: 'TIME', key: 'time_formatted', type: 'text' },
    { title: 'STATUS', key: 'status_badge', type: 'react_node' },
    { title: 'ERROR DETAILS', key: 'error_details', type: 'text' },
  ];

  const statusOptions = [
    { label: 'All Statuses', value: 'ALL' },
    { label: 'SUCCESS', value: 'SUCCESS' },
    { label: 'FAILED', value: 'FAILED' },
    { label: 'PENDING', value: 'PENDING' },
  ];

  const formattedItems = useMemo(() => {
    return logs.map((log) => ({
      ...log,
      product_title: log.productTitle || 'Product Sync',
      sku_formatted: log.sku || '—',
      source_store: log.sourceStore?.label || log.sourceStore?.shopDomain || 'Unknown',
      dest_store: log.destinationStore?.label || log.destinationStore?.shopDomain || 'Unknown',
      time_formatted: new Date(log.createdAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      status_badge: <StatusBadge status={log.status} />,
      error_details: formatErrorMessage(log.errorMessage)
    }));
  }, [logs]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden w-full">
      <Table
        title="Synchronization History"
        headerColor="#0db69d"
        columns={columns}
        items={formattedItems}
        loading={isLoading}
        searchable={true}
        searchKey="sku_formatted"
        filterable={true}
        filterKey="status"
        filterOptions={statusOptions}
        paginate={true}
        serverSide={true}
        page={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </div>
  );
}
