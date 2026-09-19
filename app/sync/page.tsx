"use client";

import React, { useState, useEffect } from 'react';
import { shopifyFetch } from '@/lib/shopify/Client';
import { useStoreContext } from '@/components/providers/StoreProvider';

import { SyncStats } from '@/components/sync/SyncStats';
import { SyncTabs } from '@/components/sync/SyncTabs';
import { ImportTab } from '@/components/import/ImportTab';
import { ManualSyncPanel } from '@/components/sync/ManualSyncPanel';
import { SyncHistoryTable } from '@/components/sync/SyncHistoryTable';

export default function SyncPage() {
  const { isMaster, isStandalone, loading: contextLoading } = useStoreContext();
  
  // Default to IMPORT if not master, otherwise keep whatever is valid
  const [activeTab, setActiveTab] = useState<'IMPORT' | 'SYNC' | 'HISTORY'>('IMPORT');
  
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const isConnected = !isStandalone && !isMaster;

  // Initial load
  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [page]);

  // Enforce tab rules when role loads
  // We no longer auto-redirect. Users can see the tabs but will get a restricted message.

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const res = await shopifyFetch('/api/sync?page=1&limit=1');
      if (res.ok) {
        const json = await res.json();
        setStats(json.stats);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await shopifyFetch(`/api/sync?page=${page}&limit=10`);
      if (res.ok) {
        const json = await res.json();
        setHistoryLogs(json.logs || []);
        if (json.pagination) {
          setTotalPages(json.pagination.totalPages);
        }
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 w-full overflow-x-hidden">
      <div className="mb-6 pb-2">
        <h1 className="text-2xl font-bold text-gray-900">Store Synchronization</h1>
        <p className="text-gray-600 mt-1">Manage and monitor product replication between your stores.</p>
      </div>

      <SyncStats 
        stats={stats || { total: 0, success: 0, failed: 0, pending: 0, skipped: 0 }} 
        isLoading={statsLoading} 
      />

      <SyncTabs 
        activeTab={activeTab} 
        onChange={setActiveTab} 
        isMaster={!!isMaster} 
        isConnected={!!isConnected}
        isStandalone={!!isStandalone}
      />

      {activeTab === 'IMPORT' && (
        <div className="w-full">
          {isConnected ? (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md shadow-sm">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">Permission Restricted</h3>
                  <p className="mt-2 text-sm text-yellow-700">
                    Import functionality is only available on the Master store. As a connected store, you can only receive products, not import them.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <ImportTab />
          )}
        </div>
      )}

      {activeTab === 'SYNC' && (
        <div className="w-full">
          {isStandalone ? (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md shadow-sm">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">Multiple Stores Required</h3>
                  <p className="mt-2 text-sm text-yellow-700">
                    Sync functionality is only available when you have multiple stores connected. Please connect another store to use syncing features.
                  </p>
                </div>
              </div>
            </div>
          ) : !isMaster ? (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md shadow-sm">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">Permission Restricted</h3>
                  <p className="mt-2 text-sm text-yellow-700">
                    Manual syncing is only available on the Master store. As a connected store, sync operations are handled automatically from the Master.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <ManualSyncPanel />
          )}
        </div>
      )}

      {activeTab === 'HISTORY' && (
        <div className="w-full">
          <SyncHistoryTable 
            logs={historyLogs} 
            isLoading={historyLoading}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
