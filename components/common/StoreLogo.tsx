'use client';

import React from 'react';
import { useStoreContext } from '@/components/providers/StoreProvider';

export interface StoreLogoProps {
  shopDomain?: string | null;
  label?: string | null;
  logoUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  isMaster?: boolean;
  isStandalone?: boolean;
  className?: string;
}

// Built-in static fallback mapping for known stores
const KNOWN_STORE_LOGOS: Record<string, string> = {
  coimbatore: '/logos/coimbatore.jpg',
  karur: '/logos/karur.jpg',
  chennai: '/logos/chennai.jpg',
  'inventory-solutions': '/logos/chennai.jpg',
  namakkal: '/logos/namakkal.jpg',
};

export function StoreLogo({
  shopDomain,
  label,
  logoUrl,
  size = 'md',
  isMaster = false,
  isStandalone = false,
  className = ''
}: StoreLogoProps) {
  const [imgError, setImgError] = React.useState(false);

  // Read global store context for unified global logo state
  const storeContext = useStoreContext();
  const activeStores = storeContext?.activeStores || [];
  const currentStore = storeContext?.currentStore || null;

  const cleanDomain = (shopDomain || '').trim().toLowerCase();
  const cleanLabel = (label || '').trim().toLowerCase();
  const cleanPrefix = cleanDomain.split('.')[0].replace(/^https?:\/\//, '');

  const globalStore = activeStores.find((s: any) => {
    const sDomain = (s.shopDomain || '').trim().toLowerCase();
    const sLabel = (s.label || '').trim().toLowerCase();
    return (
      (cleanDomain && sDomain === cleanDomain) ||
      (cleanPrefix && cleanPrefix.length > 2 && sDomain.includes(cleanPrefix)) ||
      (cleanLabel && sLabel === cleanLabel)
    );
  }) || (cleanDomain && currentStore?.shopDomain?.toLowerCase() === cleanDomain ? currentStore : null);

  // Derive known fallback by domain or label keyword
  const domainKey = `${shopDomain || ''} ${label || ''}`.toLowerCase();
  const matchedKey = Object.keys(KNOWN_STORE_LOGOS).find(k => domainKey.includes(k));
  const knownFallback = matchedKey ? KNOWN_STORE_LOGOS[matchedKey] : null;

  // Global resolution hierarchy: explicit prop > global context helper > store context item > static fallback
  const contextLogo = storeContext?.getGlobalLogo ? storeContext.getGlobalLogo(shopDomain || label) : null;
  const effectiveLogoUrl = logoUrl || contextLogo || globalStore?.logoUrl || knownFallback || null;
  const effectiveIsMaster = isMaster || globalStore?.isMaster || false;
  const effectiveIsStandalone = isStandalone || globalStore?.isStandalone || false;

  // Reset img error if effective logoUrl changes
  React.useEffect(() => {
    setImgError(false);
  }, [effectiveLogoUrl]);

  const sizeClasses = {
    sm: 'w-7 h-7 rounded-lg text-[10px]',
    md: 'w-8 h-8 rounded-lg text-xs',
    lg: 'w-10 h-10 rounded-xl text-sm'
  }[size];

  const hasCustomLogo = Boolean(effectiveLogoUrl && !imgError);

  // Extract clean monogram fallback (e.g., "ESHAN Coimbatore" -> "EC", "ESHAN Karur" -> "EK")
  const cleanName = (label || shopDomain || 'Store')
    .replace(/\.myshopify\.com/i, '')
    .replace(/^https?:\/\//i, '')
    .trim();

  const words = cleanName.split(/[\s-_]+/).filter(Boolean);
  let monogram = 'E';
  if (words.length >= 2 && words[0].toLowerCase() === 'eshan') {
    monogram = `E${words[1][0]}`.toUpperCase();
  } else if (words.length >= 2) {
    monogram = `${words[0][0]}${words[1][0]}`.toUpperCase();
  } else if (cleanName.length > 0) {
    monogram = cleanName.slice(0, 2).toUpperCase();
  }

  return (
    <div
      suppressHydrationWarning
      className={`relative inline-flex items-center justify-center shrink-0 select-none overflow-hidden transition-all ${
        hasCustomLogo
          ? 'bg-white border border-gray-200 shadow-2xs'
          : effectiveIsMaster 
            ? 'bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark,#312e81)] text-white font-black tracking-tight border border-white/25 shadow-xs ring-1 ring-[var(--color-primary)]/30' 
            : effectiveIsStandalone
              ? 'bg-gradient-to-br from-[var(--color-primary-light)] via-[var(--color-primary-light)]/80 to-white text-[var(--color-primary-dark,var(--color-primary))] font-black tracking-tight border border-[var(--theme-border-accent,var(--color-primary))] shadow-2xs'
              : 'bg-gradient-to-br from-white via-[var(--color-primary-light)]/40 to-[var(--color-primary-light)] text-[var(--color-primary)] font-black tracking-tight border border-[var(--color-primary)]/40 shadow-2xs'
      } ${sizeClasses} ${className}`}
      title={label || shopDomain || undefined}
    >
      {hasCustomLogo ? (
        <img
          src={effectiveLogoUrl!}
          alt={label || shopDomain || 'Store logo'}
          className="w-full h-full object-contain p-0.5 bg-white"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="relative z-10 leading-none drop-shadow-2xs">
          {monogram}
        </span>
      )}

      {/* Subtle glossy top highlight on non-image badge */}
      {!hasCustomLogo && effectiveIsMaster && (
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
      )}
    </div>
  );
}
