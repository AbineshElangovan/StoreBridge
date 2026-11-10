'use client';

import React from 'react';
import { StockHealthBadge } from '../insights/StockHealthBadge';
import { shopifyFetch } from '@/lib/shopify/Client';
import { WishlistHeartButton } from '@/components/wishlist/WishlistHeartButton';
import { useStoreContext } from '@/components/providers/StoreProvider';

interface ProductInfoCardProps {
  productId?: string;
  imageUrl?: string | null;
  title: string;
  sku: string;
  collection: string;
  vendor: string;
  basePrice: number;
  status: string;
  currentStock: number;
  healthStatus: 'Healthy' | 'Low' | 'Critical' | 'Out of Stock';
  preorderStatus?: string | null;
  variantTitle?: string | null;
}

export function ProductInfoCard({
  productId,
  imageUrl,
  title,
  sku,
  collection,
  vendor,
  basePrice,
  status,
  currentStock,
  healthStatus,
  preorderStatus,
  variantTitle,
}: ProductInfoCardProps) {
  const { isStandalone } = useStoreContext();
  const [isWishlisted, setIsWishlisted] = React.useState(false);

  React.useEffect(() => {
    if (!productId) return;
    const cleanId = String(productId).replace(/^gid:\/\/shopify\/Product\//i, '');

    // Check initial wishlist status
    shopifyFetch(`/api/wishlist/check?productId=${encodeURIComponent(cleanId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.statusMap && data.statusMap[cleanId]) {
          setIsWishlisted(Boolean(data.statusMap[cleanId].isWishlisted));
        }
      })
      .catch(() => {});

    const handleUpdate = (e: any) => {
      if (e.detail && e.detail.productId === cleanId) {
        setIsWishlisted(Boolean(e.detail.wishlisted));
      }
    };
    window.addEventListener('wishlist-updated', handleUpdate);
    return () => window.removeEventListener('wishlist-updated', handleUpdate);
  }, [productId]);

  const formattedPrice = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(basePrice || 0);

  const isAvailable = currentStock > 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-2xs">
      {/* Product Image with Card View Overlays */}
      <div className="w-full aspect-square bg-gray-50 border border-gray-200 rounded-xl mb-6 overflow-hidden flex items-center justify-center relative group">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="text-center p-4">
            <svg
              className="w-12 h-12 text-gray-300 mx-auto mb-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="text-xs font-semibold text-gray-400">Product image</span>
          </div>
        )}

        {/* Top-Left Stock Badge Overlay (like Wishlist Card View) */}
        <div className="absolute top-3 left-3 z-10">
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider ${
              isAvailable
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs'
                : 'bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs'
            }`}
          >
            {isAvailable ? `${currentStock} IN STOCK` : 'OUT OF STOCK'}
          </span>
        </div>

        {/* Top-Right Floating Wishlist Heart Button Overlay (like Wishlist Card View) */}
        {productId && isStandalone && (
          <div className="absolute top-3 right-3 z-10">
            <WishlistHeartButton
              productId={productId}
              productTitle={title}
              sku={sku}
              price={basePrice}
              imageUrl={imageUrl}
              inventoryQuantity={currentStock}
              variantTitle={variantTitle}
              size="medium"
              showLabel={false}
            />
          </div>
        )}
      </div>

      {/* Details List */}
      <div className="space-y-3 text-xs sm:text-sm">
        <div className="flex items-center justify-between py-1 border-b border-gray-100">
          <span className="font-medium text-gray-500">SKU</span>
          <span className="font-mono font-bold text-gray-900">{sku}</span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-gray-100">
          <span className="font-medium text-gray-500">Collection</span>
          <span className="font-bold text-gray-900 uppercase">{collection}</span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-gray-100">
          <span className="font-medium text-gray-500">Vendor</span>
          <span className="font-bold text-gray-900 uppercase">{vendor}</span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-gray-100">
          <span className="font-medium text-gray-500">Base price</span>
          <span className="font-bold text-gray-900">{formattedPrice}</span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-gray-100">
          <span className="font-medium text-gray-500">Status</span>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              status.toLowerCase() === 'active'
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : 'bg-gray-100 text-gray-700 border border-gray-200'
            }`}
          >
            {status}
          </span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-gray-100">
          <span className="font-medium text-gray-500">Stock level</span>
          <div className="flex items-center gap-2">
            <StockHealthBadge status={healthStatus} stockQuantity={currentStock} />
          </div>
        </div>

        {(preorderStatus === 'Pre-order Available' || preorderStatus === 'Available') && (
          <div className="flex items-center justify-between py-1">
            <span className="font-medium text-gray-500">Pre-order</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              Available
            </span>
          </div>
        )}
        {(preorderStatus === 'Pre-order Not Available' || preorderStatus === 'Not Available') && (
          <div className="flex items-center justify-between py-1">
            <span className="font-medium text-gray-500">Pre-order</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
              Not Available
            </span>
          </div>
        )}

        {/* Wishlist Status Banner */}
        {isWishlisted && (
          <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-rose-50 border border-rose-200 mt-3 transition-all">
            <span className="font-bold text-rose-800 text-xs flex items-center gap-1.5">
              <span className="text-rose-500 text-sm">♥</span> Wishlisted
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-600 text-white shadow-2xs">
              Saved
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
