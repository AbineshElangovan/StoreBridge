"use client";

import React, { useState, useEffect } from 'react';
import { shopifyFetch } from '@/lib/shopify/Client';
import { StoreSelector } from './StoreSelector';

export function ManualSyncPanel() {
  const [connections, setConnections] = useState<any[]>([]);
  const [masterStore, setMasterStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error' | 'warning', message: string } | null>(null);

  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    try {
      const res = await shopifyFetch('/api/connections', { cache: 'no-store' });
      if (!res.ok) {
        setConnections([]);
        return;
      }
      const text = await res.text();
      if (!text || text.trim() === '') {
        setConnections([]);
        return;
      }
      const data = JSON.parse(text);
      if (data && data.connections) {
        // Find master store
        const master = data.masterStore || (data.connections.length > 0 && data.connections[0].sourceStore) || { id: 'unknown', shopDomain: 'Master Store' };
        setMasterStore(master);
        
        // Extract unique target stores
        const targets = data.connections.map((c: any) => c.targetStore);
        const uniqueTargets = Array.from(new Map(targets.map((item: any) => [item.id, item])).values());
        
        setConnections(uniqueTargets);
        setSelectedStores(uniqueTargets.map((s: any) => s.id));
      }
    } catch (err) {
      console.error('Failed to fetch connections:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStore = (storeId: string) => {
    setSelectedStores(prev => 
      prev.includes(storeId) ? prev.filter(id => id !== storeId) : [...prev, storeId]
    );
  };

  const handleSync = async () => {
    if (selectedStores.length === 0) {
      setResult({ type: 'error', message: 'Please select at least one store to sync.' });
      return;
    }

    setSyncing(true);
    setResult(null);

    try {
      const res = await shopifyFetch('/api/sync/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          selectedTargetStoreIds: selectedStores
        })
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (res.ok && data.success) {
        if (data.isAlreadySynced) {
          setResult({ type: 'warning', message: data.message || 'Selected stores are already fully in sync! No changes were needed.' });
        } else {
          setResult({ type: 'success', message: data.message || 'Synchronization completed successfully!' });
        }
      } else {
        setResult({ type: 'error', message: data.error || 'Failed to trigger sync' });
      }
    } catch (error: any) {
      setResult({ type: 'error', message: 'Network error triggering sync' });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500 animate-pulse">Loading connected stores...</div>;
  }

  if (!masterStore || connections.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-12 text-center shadow-sm">
        <h3 className="text-lg font-medium text-gray-900 mb-2">No connected stores found</h3>
        <p className="text-gray-500">You need to connect secondary stores before you can synchronize data.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Master store → connected stores</h2>
        <p className="text-sm text-gray-500">Force an immediate catalog push.</p>
      </div>
      
      <div className="p-6 border-b border-gray-200">
        <StoreSelector 
          masterStore={masterStore}
          connections={connections}
          selectedStores={selectedStores}
          onToggleStore={handleToggleStore}
        />

        <div className="mt-4 border-t border-gray-100 pt-6">
          <button 
            onClick={handleSync}
            disabled={syncing || selectedStores.length === 0}
            className="px-6 py-2.5 bg-[var(--color-primary,#a7cd18)] hover:bg-[var(--color-primary-hover,#96bb13)] text-black text-sm font-black rounded-xl border border-[#91b212] transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
          >
            {syncing ? (
              <>
                <svg className="animate-spin h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Syncing...
              </>
            ) : 'Sync to Selected Stores'}
          </button>
        </div>
      </div>

      {result && (
        <div
          className={`px-6 py-4 text-sm font-bold border-t ${
            result.type === 'warning'
              ? 'bg-amber-50 text-amber-900 border-amber-200'
              : result.type === 'error'
              ? 'bg-red-50 text-red-800 border-red-200'
              : ''
          }`}
          style={result.type === 'success' ? {
            background: 'var(--color-primary-light)',
            color: 'var(--color-primary-dark)',
            borderColor: 'var(--border-color)',
          } : {}}
        >
          {result.message}
        </div>
      )}
    </div>
  );
}
