"use client";

import React from 'react';
import Link from 'next/link';
import { useStoreContext } from '@/components/providers/StoreProvider';
import { Loading } from '@/components/common/Loading';
import { Icon } from '@shopify/polaris';
import { LockIcon, AlertCircleIcon, HomeIcon } from '@shopify/polaris-icons';

interface StandaloneGuardProps {
  featureName: string;
  children: React.ReactNode;
}

/**
 * Access-control guard component that restricts Customer Experience features
 * (Pre-order, Notify Me, Back in Stock) to Standalone stores only.
 *
 * For Master and Connected stores, it renders a clean, informative restriction screen
 * and blocks direct access to configuration and management options.
 */
export function StandaloneGuard({ featureName, children }: StandaloneGuardProps) {
  const { currentStore, isStandalone, loading, sessionShopDomain } = useStoreContext();

  if (loading) {
    return (
      <div className="p-12 flex items-center justify-center min-h-[60vh]">
        <Loading />
      </div>
    );
  }

  if (!isStandalone) {
    const storeLabel = currentStore?.label || currentStore?.shopDomain || 'Current store';
    const storeTypeLabel = currentStore?.isMaster ? 'Master Store' : 'Connected Store';

    return (
      <div className="p-6 max-w-4xl mx-auto py-12">
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-8 sm:p-10 text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-5 shadow-2xs">
            <div className="w-8 h-8">
              <Icon source={LockIcon} />
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 uppercase tracking-wider mb-3">
            Standalone Feature Only
          </span>

          <h2 className="text-2xl font-black text-gray-900 tracking-tight mb-2">
            {featureName} is Restricted
          </h2>

          <p className="text-sm text-gray-600 max-w-lg mb-6 leading-relaxed">
            <strong>{featureName}</strong> is exclusively available for <strong>Standalone Stores</strong>.
            {' '}
            <span className="text-gray-900 font-semibold">{storeLabel}</span> is currently operating as a{' '}
            <span className="text-amber-800 font-bold">{storeTypeLabel}</span> within a multi-store network.
          </p>

          <div className="bg-amber-50/70 border border-amber-100 rounded-xl p-4 max-w-md w-full text-xs text-amber-900 text-left mb-8 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-amber-950">
              <div className="w-4 h-4 text-amber-600 shrink-0">
                <Icon source={AlertCircleIcon} />
              </div>
              <span>Why is this restricted?</span>
            </div>
            <p className="text-amber-800 leading-normal pl-6">
              Multi-store setups synchronize shared catalog and pricing data across paired stores. Customer experience modules (Pre-order, Notify Me, and Back in Stock) are reserved for standalone single-store setups.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-black text-white font-bold text-sm rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <div className="w-4 h-4">
              <Icon source={HomeIcon} />
            </div>
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
