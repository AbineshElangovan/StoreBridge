"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { shopifyFetch } from '@/lib/shopify/Client';

export interface StoreInfo {
  id: string;
  shopDomain: string;
  label: string | null;
  masterLabel: string | null;
  isMaster: boolean;
  isActive: boolean;
  scope: string;
  productCount?: number;
  variantCount?: number;
  syncCount?: number;
  isStandalone?: boolean;
}

interface StoreContextValue {
  activeStores: StoreInfo[];
  currentStore: StoreInfo | null;
  sessionStore: StoreInfo | null;
  sessionShopDomain: string | null;
  isMasterSession: boolean;
  canSwitchStores: boolean;
  storeCount: number;
  isStandalone: boolean;
  isMultiStore: boolean;
  isMaster: boolean;
  canManageCatalog: boolean;
  canManageSku: boolean;
  canManagePricing: boolean;
  canManageNetwork: boolean;
  canSyncToConnectedStores: boolean;
  loading: boolean;
  refreshStores: () => Promise<void>;
}

const StoreContext = createContext<StoreContextValue>({
  activeStores: [],
  currentStore: null,
  sessionStore: null,
  sessionShopDomain: null,
  isMasterSession: false,
  canSwitchStores: false,
  storeCount: 0,
  isStandalone: false,
  isMultiStore: false,
  isMaster: false,
  canManageCatalog: false,
  canManageSku: false,
  canManagePricing: false,
  canManageNetwork: false,
  canSyncToConnectedStores: false,
  loading: true,
  refreshStores: async () => {},
});

export const useStoreContext = () => useContext(StoreContext);

function matchesStore(s: StoreInfo, target: string | null) {
  if (!target) return false;
  const clean = target.trim().toLowerCase();
  const prefix = clean.split('.')[0].replace(/^https?:\/\//, '');

  const sDomain = (s.shopDomain || '').toLowerCase();
  const sLabel = (s.label || '').toLowerCase();
  const sMasterLabel = (s.masterLabel || '').toLowerCase();
  const sId = (s.id || '').toLowerCase();

  return (
    sDomain === clean ||
    sDomain.includes(prefix) ||
    (prefix.length > 2 && sDomain.split('.')[0].includes(prefix)) ||
    sLabel.includes(prefix) ||
    sMasterLabel.includes(prefix) ||
    sId === clean
  );
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [activeStores, setActiveStores] = useState<StoreInfo[]>([]);
  const [serverCurrentStoreId, setServerCurrentStoreId] = useState<string | null>(null);
  const [serverCurrentShopDomain, setServerCurrentShopDomain] = useState<string | null>(null);
  const [sessionShopDomain, setSessionShopDomain] = useState<string | null>(null);
  const [isMasterSession, setIsMasterSession] = useState<boolean>(false);
  const [sessionStore, setSessionStore] = useState<StoreInfo | null>(null);
  const [savedShopDomain, setSavedShopDomain] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const currentShopDomain = searchParams.get('shop');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const shopParam = new URLSearchParams(window.location.search).get('shop');
      if (shopParam) {
        setSavedShopDomain(shopParam);
        try { localStorage.setItem('storebridge_active_shop', shopParam); } catch (e) {}
      } else {
        try {
          const stored = localStorage.getItem('storebridge_active_shop');
          if (stored) setSavedShopDomain(stored);
        } catch (e) {}
      }
    }
  }, [currentShopDomain]);

  const loadStores = React.useCallback(async () => {
    try {
      const res = await shopifyFetch('/api/stores');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.stores) {
          // Only consider genuinely active stores for the count
          const active = data.stores.filter((s: StoreInfo) => s.isActive);
          setActiveStores(active);
          if (data.currentStoreId) setServerCurrentStoreId(data.currentStoreId);
          if (data.currentShopDomain) setServerCurrentShopDomain(data.currentShopDomain);
          if (data.sessionShopDomain) setSessionShopDomain(data.sessionShopDomain);

          const isMaster = Boolean(data.isMasterSession);
          setIsMasterSession(isMaster);

          if (!isMaster) {
            // Connected store: clear any master shops from localStorage
            try {
              localStorage.removeItem('storebridge_master_shop');
            } catch (e) {}
          }

          if (data.sessionStoreId) {
            const foundSession = active.find((s: StoreInfo) => s.id === data.sessionStoreId);
            if (foundSession) setSessionStore(foundSession);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching stores for StoreProvider", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStores();
  }, [loadStores, currentShopDomain]);

  // For connected stores (!isMasterSession), currentStore is strictly activeStores[0] (itself)
  // For master sessions, user can view any activeStore
  const currentStore = !isMasterSession && activeStores.length > 0
    ? activeStores[0]
    : (
        (currentShopDomain ? activeStores.find(s => matchesStore(s, currentShopDomain)) : null) ||
        (serverCurrentStoreId ? activeStores.find(s => s.id === serverCurrentStoreId) : null) ||
        (serverCurrentShopDomain ? activeStores.find(s => s.shopDomain === serverCurrentShopDomain) : null) ||
        (savedShopDomain ? activeStores.find(s => matchesStore(s, savedShopDomain)) : null) ||
        (activeStores.length > 0 ? activeStores[0] : null)
      );

  const canSwitchStores = isMasterSession && activeStores.length > 1;
  const storeCount = activeStores.length;
  
  const isMaster = currentStore?.isMaster || false;
  // A store is standalone if it's explicitly marked via the API (no connections and not a master of another network)
  const isStandalone = currentStore?.isStandalone === true;
  const isMultiStore = !isStandalone;

  // Capability Model
  const canManageCatalog = isMaster || isStandalone;
  const canManageSku = isMaster || isStandalone;
  const canManagePricing = isMaster || isStandalone;
  
  // Network operations remain strictly Master-only
  const canManageNetwork = isMasterSession || isMaster;
  const canSyncToConnectedStores = isMasterSession || isMaster;

  return (
    <StoreContext.Provider value={{
      activeStores,
      currentStore,
      sessionStore,
      sessionShopDomain,
      isMasterSession,
      canSwitchStores,
      storeCount,
      isStandalone,
      isMultiStore,
      isMaster,
      canManageCatalog,
      canManageSku,
      canManagePricing,
      canManageNetwork,
      canSyncToConnectedStores,
      loading,
      refreshStores: loadStores
    }}>
      {children}
    </StoreContext.Provider>
  );
}
