'use client';

import React from 'react';
import { Icon } from '@shopify/polaris';
import { StoreIcon } from '@shopify/polaris-icons';

export interface StoreLogoProps {
  shopDomain?: string | null;
  label?: string | null;
  size?: 'sm' | 'md' | 'lg';
  isMaster?: boolean;
  isStandalone?: boolean;
  className?: string;
}

export function StoreLogo({
  shopDomain,
  label,
  size = 'md',
  isMaster = false,
  isStandalone = false,
  className = ''
}: StoreLogoProps) {
  const sizeClasses = {
    sm: 'w-7 h-7 rounded-lg text-xs',
    md: 'w-8 h-8 rounded-lg text-sm',
    lg: 'w-10 h-10 rounded-xl text-base'
  }[size];

  const iconSizes = {
    sm: 16,
    md: 18,
    lg: 22
  }[size];

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 shadow-2xs border transition-all ${
        isMaster 
          ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]/40 text-[var(--color-primary)]' 
          : isStandalone
            ? 'border-[var(--theme-border-accent,var(--color-primary))] bg-[var(--color-primary-light)]/40 text-[var(--color-primary)]'
            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
      } ${sizeClasses} ${className}`}
      title={label || shopDomain || undefined}
    >
      <div style={{ width: iconSizes, height: iconSizes }} className="flex items-center justify-center">
        <Icon source={StoreIcon} tone={isMaster ? 'primary' : 'base'} />
      </div>
    </div>
  );
}
