"use client";
import React, { useState, useEffect } from 'react';
import { Table, Loading, StoreLogo } from '@/components/common';
import {
  TextField,
  Button,
  BlockStack,
  InlineStack,
  Box,
  Divider,
  Layout
} from '@shopify/polaris';
import { Checkbox } from '@/components/forms';
import { shopifyFetch } from '@/lib/shopify/Client';
import { useRouter } from 'next/navigation';
import { LocalizedDate } from '@/components/common/LocalizedDate';
import { Icon } from '@shopify/polaris';
import { DeleteIcon, AlertTriangleIcon, ArchiveIcon, RefreshIcon, ShieldCheckMarkIcon, XIcon } from '@shopify/polaris-icons';
import { TableCard } from '@/components/ui/TableCard';
import { ThemedSection } from '@/components/ui/ThemedSection';
import { StoreRoleBadge } from '@/components/ui/StoreRoleBadge';
import { ConfirmToast } from '@/components/ui/ConfirmToast';
import { useToast } from '@/components/providers/ToastContext';
import { useStoreContext } from '@/components/providers/StoreProvider';


export default function ConnectionsPage() {
  const [installedStores, setInstalledStores] = useState<any[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [masterProductCount, setMasterProductCount] = useState<number>(0);
  const [storeData, setStoreData] = useState<any>(null);

  function timeAgo(dateString: string | Date | undefined) {
    if (!dateString) return 'Never';
    const now = new Date();
    const past = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);
    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    return `${Math.floor(diffInHours / 24)} days ago`;
  }

  // Store Pairing State
  const [storeIdInput, setStoreIdInput] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [currentStoreUniqueId, setCurrentStoreUniqueId] = useState('');
  const [isMaster, setIsMaster] = useState(false);

  // Manual Sync State
  const [syncing, setSyncing] = useState(false);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);

  // Manual Store Generation State
  const [generatingStore, setGeneratingStore] = useState(false);

  // Store Connection Removal State
  const [removingConnection, setRemovingConnection] = useState<{ id: string; name: string } | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const { showSuccess, showError } = useToast();

  const [toastMessage, setToastMessage] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [storesRes, connectionsRes] = await Promise.all([
        shopifyFetch('/api/stores?active=false', { cache: 'no-store' }),
        shopifyFetch('/api/connections', { cache: 'no-store' })
      ]);

      if (storesRes.ok) {
        const storesJson = await storesRes.json();
        setInstalledStores(storesJson.stores || []);
      }

      const data = await connectionsRes.json();
      if (data.success) {
        setConnections(data.connections || []);
        if (data.masterProductCount !== undefined) setMasterProductCount(data.masterProductCount);
        if (data.store) {
          setStoreData(data.store);
          if (data.store.uniqueStoreId) {
            setCurrentStoreUniqueId(data.store.uniqueStoreId);
          }
          if (data.store.isMaster !== undefined) {
            setIsMaster(data.store.isMaster);
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const { refreshStores } = useStoreContext();

  const handleAddStore = async () => {
    if (!storeIdInput.trim()) return;
    setConnecting(true);
    setToastMessage(null);

    try {
      const res = await shopifyFetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uniqueStoreId: storeIdInput.trim() })
      });
      const data = await res.json();

      if (data.success) {
        const msg = data.promotedToMaster
          ? 'Store connected! This store has been promoted to Master store. Starting initial sync...'
          : 'Store connected successfully! Starting initial sync...';
        setToastMessage({ message: msg, type: 'success' });
        setStoreIdInput('');
        await fetchData();
        if (refreshStores) {
          await refreshStores();
        }

        // Auto-trigger sync
        setSyncing(true);
        try {
          await shopifyFetch('/api/sync/manual', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ selectedTargetStoreIds: [data.connection.targetStoreId] })
          });
        } catch (e) {
          console.error('Initial sync error:', e);
        } finally {
          setSyncing(false);
        }
      } else {
        setToastMessage({ message: data.error || 'Failed to connect store.', type: 'error' });
      }
    } catch (err: any) {
      setToastMessage({ message: err.message, type: 'error' });
    } finally {
      setConnecting(false);
    }
  };

  const handleGenerateManualStore = async () => {
    setGeneratingStore(true);
    setToastMessage(null);
    try {
      const res = await shopifyFetch('/api/stores/manual', {
        method: 'POST',
      });
      const data = await res.json();

      if (data.success) {
        setToastMessage({ message: `Manual store generated! Unique ID: ${data.store.uniqueStoreId}`, type: 'success' });
        // Automatically paste it in the input to make it easy for them
        setStoreIdInput(data.store.uniqueStoreId);
        fetchData();
      } else {
        setToastMessage({ message: 'Failed to generate store: ' + data.error, type: 'error' });
      }
    } catch (err: any) {
      setToastMessage({ message: 'Error: ' + err.message, type: 'error' });
    } finally {
      setGeneratingStore(false);
    }
  };

  const handleConfirmRemoveStore = async () => {
    if (!removingConnection) return;
    setIsRemoving(true);
    try {
      const res = await shopifyFetch(`/api/connections?targetStoreId=${removingConnection.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        showSuccess(`Store connection "${removingConnection.name}" removed successfully.`);
        setRemovingConnection(null);
        await fetchData();
        if (refreshStores) {
          await refreshStores();
        }
      } else {
        showError('Failed to remove: ' + data.error);
      }
    } catch (err: any) {
      showError('Error: ' + err.message);
    } finally {
      setIsRemoving(false);
    }
  };

  const handleToggleSyncSelection = (storeId: string) => {
    setSelectedStores(prev =>
      prev.includes(storeId)
        ? prev.filter(id => id !== storeId)
        : [...prev, storeId]
    );
  };

  const handleSelectAllSync = () => {
    if (selectedStores.length === connections.length) {
      setSelectedStores([]);
    } else {
      setSelectedStores(connections.map(c => c.targetStoreId));
    }
  };

  const handleSync = async () => {
    if (selectedStores.length === 0) return;
    try {
      setSyncing(true);
      setToastMessage({ message: 'Sync initiated in the background. Check the Sync logs for progress.', type: 'success' });

      const res = await shopifyFetch('/api/sync/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedTargetStoreIds: selectedStores })
      });

      const data = await res.json();
      if (!data.success) {
        setToastMessage({ message: 'Error starting sync: ' + data.error, type: 'error' });
      }
    } catch (err: any) {
      setToastMessage({ message: 'Error starting sync: ' + err.message, type: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  const formattedInstalledStores = installedStores.map((s) => ({
    id: s.id,
    domain: s.shopDomain,
    label: s.label || s.shopDomain,
    status: s.isActive ? 'CONNECTED' : 'DISCONNECTED',
    installedAt: <LocalizedDate date={s.installedAt} format="date" />,
  }));

  const tableColumns = [
    { title: 'Store Name', key: 'name', type: 'bold' as const },
    { title: 'Store ID', key: 'storeId' },
    { title: 'Status', key: 'status', type: 'status' as const, badgeRules: { 'Connected': 'success' as const, 'Disconnected': 'critical' as const } },
    { title: 'Action', key: 'action' }
  ];

  const tableItems = connections.map(conn => {
    const isInactive = conn.targetStore.isActive === false;

    return {
      id: conn.targetStoreId,
      name: (
        <div className="flex items-center gap-2.5">
          <StoreLogo 
            shopDomain={conn.targetStore.shopDomain} 
            label={conn.targetStore.label} 
            logoUrl={conn.targetStore.logoUrl} 
            isMaster={conn.direction === 'incoming'}
            size="sm" 
          />
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-slate-900 truncate">{conn.targetStore.label || conn.targetStore.shopDomain}</span>
            <span className="text-xs text-slate-500 font-normal truncate">https://{conn.targetStore.shopDomain}</span>
          </div>
        </div>
      ),
      storeId: conn.targetStore.uniqueStoreId,
      status: isInactive ? 'Disconnected' : 'Connected',
      action: (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRemovingConnection({
              id: conn.targetStoreId,
              name: conn.targetStore.label || conn.targetStore.shopDomain
            })}
            className="flex items-center gap-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1.5 rounded transition-colors cursor-pointer bg-transparent border-none font-medium text-xs"
            title="Remove Connection"
          >
            <div style={{ width: '16px', height: '16px' }}>
              <Icon source={DeleteIcon} tone="critical" />
            </div>
            Remove
          </button>
        </div>
      )
    };
  });

  if (loading && connections.length === 0) {
    return <Loading label="Loading connections..." />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="page-title text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight m-0">Store Connections</h1>
          <p className="page-subtitle text-lg sm:text-xl font-medium text-slate-500 mt-1.5 m-0">One master, unlimited connected stores</p>
        </div>
      </div>

      {!isMaster && currentStoreUniqueId && (
        <div className="mb-6 sm:mb-8 p-4 sm:p-6 bg-white border border-primary-200 rounded-2xl shadow-sm text-center">
          <h2 className="text-base sm:text-lg font-semibold text-slate-900 mb-2">Unique Store ID</h2>
          <p className="text-xs sm:text-sm text-slate-500 mb-4">Provide this Unique Store ID to link this catalog with a Master Store.</p>
          <div className="inline-flex items-center gap-3 bg-slate-50 border border-slate-200 px-3 sm:px-4 py-2 rounded-lg max-w-full truncate">
            <span className="font-mono text-base sm:text-lg text-primary-DEFAULT font-bold truncate">{currentStoreUniqueId}</span>
            <button
              onClick={() => { navigator.clipboard.writeText(currentStoreUniqueId); setToastMessage({ message: 'Copied!', type: 'success' }); }}
              className="text-slate-400 hover:text-primary-DEFAULT transition-colors shrink-0"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">

        {/* Render Master Store */}
        {installedStores.filter(s => s.isMaster || s.id === installedStores.find(i => i.isMaster)?.id).map(master => {
          const currency = 'INR';
          const region = 'India';
          const plan = '-';
          const productCount = storeData?.productCount || 0;
          const lastSync = master.updatedAt || storeData?.updatedAt;

          return (
            <div key="master" className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5 flex flex-col">
              <div className="flex justify-between items-start mb-4 gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-base sm:text-lg flex items-center gap-2 text-slate-900 flex-wrap">
                    <StoreLogo shopDomain={master.shopDomain} label={master.label} logoUrl={master.logoUrl} isMaster={true} size="sm" />
                    <span className="truncate">{master.label || master.shopDomain.split('.')[0]}</span>
                    <span className="bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 border border-[var(--color-primary)] shrink-0">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M2 22h20v-2H2v2zm9-5l5-4 4 4V5c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v12l4-4 5 4z" /></svg>
                      Master
                    </span>
                  </h3>
                  <p className="text-slate-500 text-xs mt-1 truncate">https://{master.shopDomain}</p>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0 ${master.isActive ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                  {master.isActive ? 'healthy' : 'stale'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-xs sm:text-sm mb-4 mt-4 sm:mt-6">
                <div>
                  <p className="text-slate-500 mb-0.5 text-xs">Currency</p>
                  <p className="font-medium text-slate-900">{currency}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-0.5 text-xs">Region</p>
                  <p className="font-medium text-slate-900">{region}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-0.5 text-xs">Plan</p>
                  <p className="font-medium text-slate-900">{plan}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-0.5 text-xs">Last sync</p>
                  <p className="font-medium text-slate-900">{timeAgo(lastSync)}</p>
                </div>
              </div>
            </div>
          )
        })}


        {/* Render Standalone Stores as Cards */}
        {installedStores
          .filter(s => !s.isMaster && !connections.some(c => c.targetStoreId === s.id))
          .map((standalone, index) => {
            const currency = 'INR';
            const region = 'India';
            const plan = '-';
            const lastSync = standalone.updatedAt;

            return (
              <div key={standalone.id || `standalone-${index}`} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5 flex flex-col">
                <div className="flex justify-between items-start mb-4 gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-base sm:text-lg flex items-center gap-2 text-slate-900 flex-wrap">
                      <StoreLogo shopDomain={standalone.shopDomain} label={standalone.label} logoUrl={standalone.logoUrl} isMaster={false} isStandalone={true} size="sm" />
                      <span className="truncate">{standalone.label || standalone.shopDomain.split('.')[0]}</span>
                    </h3>
                    <div className="mt-1 flex flex-col gap-0.5">
                      <p className="text-slate-700 text-xs sm:text-sm font-medium truncate">{standalone.uniqueStoreId || 'N/A'}</p>
                      <p className="text-slate-500 text-xs truncate">https://{standalone.shopDomain}</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0 ${standalone.isActive ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                    {standalone.isActive ? 'healthy' : 'stale'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-xs sm:text-sm mb-4 mt-4 sm:mt-6">
                  <div>
                    <p className="text-slate-500 mb-0.5 text-xs">Currency</p>
                    <p className="font-medium text-slate-900">{currency}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 mb-0.5 text-xs">Region</p>
                    <p className="font-medium text-slate-900">{region}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 mb-0.5 text-xs">Plan</p>
                    <p className="font-medium text-slate-900">{plan}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 mb-0.5 text-xs">Last sync</p>
                    <p className="font-medium text-slate-900">{timeAgo(lastSync)}</p>
                  </div>
                </div>
              </div>
            );
          })}

        {/* Render Target Stores as Cards */}
        {connections
          .filter(conn => {
            const masterId = installedStores.find(i => i.isMaster)?.id;
            return conn.targetStore.id !== masterId;
          })
          .map((conn, index) => {
            const store = conn.targetStore;
            const currency = 'INR';
            const region = 'India';
            const plan = '-';
            const productCount = store.productCount || 0;
            const lastSync = conn.lastSyncTime;

            return (
              <div key={conn.id || `${conn.targetStoreId}-${index}`} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5 flex flex-col">
                <div className="flex justify-between items-start mb-4 gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-base sm:text-lg flex items-center gap-2 text-slate-900 flex-wrap">
                      <StoreLogo 
                        shopDomain={store.shopDomain} 
                        label={store.label} 
                        logoUrl={store.logoUrl} 
                        isMaster={conn.direction === 'incoming' || Boolean(store.isMaster)} 
                        size="sm" 
                      />
                      <span className="truncate">{store.label || store.shopDomain.split('.')[0]}</span>
                      {conn.direction === 'incoming' && (
                        <span className="bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 border border-[var(--color-primary)] shrink-0">
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 22h20M2 18l4-10 4 6 2-8 2 8 4-6 4 10H2z" /></svg>
                          Master
                        </span>
                      )}
                    </h3>
                    <div className="mt-1 flex flex-col gap-0.5">
                      <p className="text-slate-700 text-xs sm:text-sm font-medium truncate">{store.uniqueStoreId || 'N/A'}</p>
                      <p className="text-slate-500 text-xs truncate">https://{store.shopDomain}</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0 ${store.isActive ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                    {store.isActive ? 'healthy' : 'stale'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-xs sm:text-sm mb-4 mt-4 sm:mt-6">
                  <div>
                    <p className="text-slate-500 mb-0.5 text-xs">Currency</p>
                    <p className="font-medium text-slate-900">{currency}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 mb-0.5 text-xs">Region</p>
                    <p className="font-medium text-slate-900">{region}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 mb-0.5 text-xs">Plan</p>
                    <p className="font-medium text-slate-900">{plan}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 mb-0.5 text-xs">Last sync</p>
                    <p className="font-medium text-slate-900">{timeAgo(lastSync)}</p>
                  </div>
                </div>
              </div>
            )
          })}
      </div>

      {/* Pair New Store for Master and Standalone stores */}
      {(() => {
        const isConnectedSubStore = connections.some(c => c.direction === 'incoming');
        const canPairStores = isMaster || !isConnectedSubStore;
        if (!canPairStores) return null;

        return (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-5 sm:p-8 shadow-sm mb-6 flex flex-col lg:flex-row items-start lg:items-center gap-4 sm:gap-6 hover:border-slate-300 transition-colors">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary-50 rounded-full flex items-center justify-center text-primary-DEFAULT shrink-0">
              <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-base sm:text-lg text-slate-900 mb-1">Pair New Store</h3>
              <p className="text-slate-500 text-xs sm:text-sm">
                {isMaster
                  ? 'Enter the Unique Store ID of the destination store to establish a connection.'
                  : 'Enter the Unique Store ID of a store to connect. Connecting a store will establish this store as the Master store.'}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row w-full lg:w-auto gap-3 shrink-0">
              <input
                type="text"
                placeholder="e.g. STORE-XYZ123"
                className="ys-input w-full lg:min-w-[250px]"
                value={storeIdInput}
                onChange={(e) => setStoreIdInput(e.target.value)}
              />
              <button
                className="w-full sm:w-auto px-5 py-2.5 bg-[var(--color-primary,#a7cd18)] text-black text-sm font-black rounded-xl border border-[#91b212] hover:bg-[var(--color-primary-hover,#96bb13)] transition-all shadow-2xs whitespace-nowrap text-center cursor-pointer disabled:opacity-50"
                onClick={handleAddStore}
                disabled={connecting || !storeIdInput.trim()}
              >
                {connecting ? 'Connecting...' : 'Connect Store'}
              </button>
            </div>
          </div>
        );
      })()}





      {/* Target Stores Table (For Master Store) */}
      {isMaster && connections.filter(c => c.direction === 'outgoing').length > 0 && (
        <div className="mb-8 w-full overflow-hidden">
          <TableCard title="Connected Stores">
            <div className="overflow-x-auto w-full max-w-full">
              <Table
                headerColor="var(--color-primary-dark)"
                columns={[
                  { title: 'Store Name', key: 'name', type: 'react_node' },
                  { title: 'Store URL', key: 'url' },
                  { title: 'Status', key: 'status', type: 'badge', badgeRules: { 'Healthy': 'success', 'Stale': 'warning' } },
                  { title: 'Action', key: 'action', type: 'react_node' }
                ]}
                items={connections.filter(c => c.direction === 'outgoing').map(conn => ({
                  name: (
                    <div className="flex items-center gap-2.5">
                      <StoreLogo
                        shopDomain={conn.targetStore.shopDomain}
                        label={conn.targetStore.label}
                        logoUrl={conn.targetStore.logoUrl}
                        size="sm"
                      />
                      <span className="font-bold text-slate-900 truncate">
                        {conn.targetStore.label || conn.targetStore.shopDomain.split('.')[0]}
                      </span>
                    </div>
                  ),
                  url: `https://${conn.targetStore.shopDomain}`,
                  status: conn.targetStore.isActive ? 'Healthy' : 'Stale',
                  action: (
                    <button
                      onClick={() => setRemovingConnection({
                        id: conn.targetStoreId,
                        name: conn.targetStore.label || conn.targetStore.shopDomain.split('.')[0]
                      })}
                      className="text-red-600 hover:text-red-700 font-semibold px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 transition-colors flex items-center gap-1.5 text-xs w-fit"
                      title="Remove Connection"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      </svg>
                      Remove
                    </button>
                  )
                }))}
              />
            </div>
          </TableCard>
        </div>
      )}


      <div
        className="rounded-2xl border overflow-hidden shadow-sm"
        style={{
          backgroundColor: 'var(--theme-surface, #fff)',
          borderColor: 'var(--theme-border-accent, var(--border-color))',
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-5 border-b flex items-center gap-4"
          style={{
            background: 'linear-gradient(135deg, var(--color-primary-light, #ede9fe), var(--theme-surface, #fff))',
            borderColor: 'var(--theme-border-accent, var(--border-color))',
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
            style={{ backgroundColor: 'var(--color-primary)', color: '#ffffff' }}
          >
            <Icon source={ShieldCheckMarkIcon} tone="inherit" />
          </div>
          <div>
            <h2 className="font-extrabold text-base" style={{ color: 'var(--color-primary)' }}>
              Master Store Behaviour
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              What happens when the source of truth is unavailable
            </p>
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
          {[
            {
              icon: ArchiveIcon,
              accent: 'var(--color-primary)',
              bg: 'var(--color-primary-light, #ede9fe)',
              border: 'var(--theme-border-accent, #d8b4fe)',
              title: 'Cached Snapshot',
              desc: 'Connected stores keep selling from the last known good inventory, flagged as stale in the header. No disruption to customer orders.',
              tag: 'Automatic',
            },
            {
              icon: RefreshIcon,
              accent: '#10b981',
              bg: 'rgba(16, 185, 129, 0.12)',
              border: 'rgba(16, 185, 129, 0.25)',
              title: 'Queued Writes',
              desc: 'Orders placed during an outage are queued and replayed in order once the master comes back online. Zero data loss.',
              tag: 'Self-healing',
            },
            {
              icon: ShieldCheckMarkIcon,
              accent: '#e11d48',
              bg: 'rgba(225, 29, 72, 0.12)',
              border: 'rgba(225, 29, 72, 0.25)',
              title: 'Failover Promotion',
              desc: 'If master is offline beyond your threshold, you can temporarily promote another store as master to keep sync running.',
              tag: 'Manual trigger',
            },
          ].map((card, idx) => (
            <div
              key={card.title}
              className={`p-5 flex flex-col gap-3 group hover:bg-black/[0.015] transition-colors ${idx > 0 ? 'border-t md:border-t-0 md:border-l' : ''
                }`}
              style={{
                borderColor: 'var(--theme-border-accent, var(--border-color))',
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shadow-xs shrink-0"
                  style={{ backgroundColor: card.bg, border: `1.5px solid ${card.border}`, color: card.accent }}
                >
                  <Icon source={card.icon} tone="inherit" />
                </div>
                <span
                  className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider mt-1 shrink-0"
                  style={{ backgroundColor: card.bg, color: card.accent }}
                >
                  {card.tag}
                </span>
              </div>
              <div>
                <h4
                  className="font-bold text-sm mb-1"
                  style={{ color: card.accent }}
                >
                  {card.title}
                </h4>
                <p className="text-xs text-gray-500 leading-relaxed">{card.desc}</p>
              </div>
              {/* Accent bar at bottom */}
              <div
                className="h-0.5 w-8 rounded-full mt-auto opacity-40 group-hover:w-full group-hover:opacity-70 transition-all duration-300"
                style={{ backgroundColor: card.accent }}
              />
            </div>
          ))}
        </div>
      </div>

      {toastMessage && (
        <div className={`fixed bottom-6 right-6 px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 text-sm font-medium z-50 text-white ${toastMessage.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toastMessage.message}
          <button onClick={() => setToastMessage(null)} className="ml-2 opacity-80 hover:opacity-100 flex items-center justify-center p-0.5" title="Close">
            <span className="w-3.5 h-3.5 flex items-center text-white"><Icon source={XIcon} tone="inherit" /></span>
          </button>
        </div>
      )}

      {/* Confirmation Modal for Store Connection Removal */}
      <ConfirmToast
        open={Boolean(removingConnection)}
        message={`Remove connection to "${removingConnection?.name}"?`}
        subMessage="This store will no longer receive synchronized catalog and inventory updates from Master."
        confirmLabel="Yes, Remove"
        cancelLabel="Cancel"
        variant="danger"
        loading={isRemoving}
        onConfirm={handleConfirmRemoveStore}
        onCancel={() => setRemovingConnection(null)}
      />
    </div>
  );
}
