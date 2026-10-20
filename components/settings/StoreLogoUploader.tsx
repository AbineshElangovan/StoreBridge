'use client';

import React, { useRef, useState } from 'react';
import { StoreLogo } from '@/components/common/StoreLogo';
import { shopifyFetch } from '@/lib/shopify/Client';
import { useStoreContext } from '@/components/providers/StoreProvider';

interface StoreLogoUploaderProps {
  storeId: string;
  shopDomain: string;
  label?: string | null;
  logoUrl?: string | null;
  isMaster?: boolean;
  isStandalone?: boolean;
  onLogoUpdated?: (storeId: string, newLogoUrl: string | null) => void;
  showTextButton?: boolean;
}

export function StoreLogoUploader({
  storeId,
  shopDomain,
  label,
  logoUrl,
  isMaster = false,
  isStandalone = false,
  onLogoUpdated,
  showTextButton = true
}: StoreLogoUploaderProps) {
  const { updateGlobalLogo, refreshStores } = useStoreContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      // If SVG, read as text or base64 directly
      if (file.type === 'image/svg+xml') {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
        return;
      }

      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };

      img.onload = () => {
        const maxSize = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(img.src);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Clean PNG data URL
        const dataUrl = canvas.toDataURL('image/png', 0.9);
        resolve(dataUrl);
      };

      img.onerror = () => reject(new Error('Failed to load image for processing'));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG, JPG, SVG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image size exceeds 5MB limit.');
      return;
    }

    setUploading(true);
    setErrorMsg(null);

    try {
      const processedDataUrl = await resizeImage(file);
      const res = await shopifyFetch('/api/stores/logo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId,
          logoUrl: processedDataUrl
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        updateGlobalLogo(storeId, processedDataUrl);
        refreshStores?.();
        onLogoUpdated?.(storeId, processedDataUrl);
      } else {
        setErrorMsg(data.error || 'Failed to save store logo.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error processing logo image.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Remove custom logo for this store?')) return;

    setUploading(true);
    setErrorMsg(null);
    try {
      const res = await shopifyFetch('/api/stores/logo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId,
          logoUrl: null
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        updateGlobalLogo(storeId, null);
        refreshStores?.();
        onLogoUpdated?.(storeId, null);
      } else {
        setErrorMsg(data.error || 'Failed to remove logo.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error removing logo.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div 
        className="relative group cursor-pointer"
        onClick={() => !uploading && fileInputRef.current?.click()}
        title="Click to upload custom store logo"
      >
        <StoreLogo
          shopDomain={shopDomain}
          label={label}
          logoUrl={logoUrl}
          isMaster={isMaster}
          isStandalone={isStandalone}
          size="md"
        />

        {/* Hover Camera Overlay */}
        <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white">
          {uploading ? (
            <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {showTextButton && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="text-[11px] font-semibold text-gray-600 hover:text-[var(--color-primary)] hover:underline cursor-pointer disabled:opacity-50 transition-colors"
          >
            {uploading ? 'Uploading...' : logoUrl ? 'Change Logo' : 'Upload Logo'}
          </button>
          {logoUrl && (
            <>
              <span className="text-gray-300 text-xs">•</span>
              <button
                type="button"
                disabled={uploading}
                onClick={handleRemoveLogo}
                className="text-[11px] font-semibold text-red-500 hover:text-red-700 hover:underline cursor-pointer disabled:opacity-50 transition-colors"
              >
                Remove
              </button>
            </>
          )}
        </div>
      )}

      {errorMsg && (
        <span className="text-[10px] text-red-600 font-medium ml-1">
          {errorMsg}
        </span>
      )}
    </div>
  );
}
