'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Tooltip } from '@shopify/polaris';
import { shopifyFetch } from '@/lib/shopify/Client';
import { useToast } from '@/components/providers/ToastContext';
import { useStoreContext } from '@/components/providers/StoreProvider';

export interface WishlistHeartButtonProps {
  productId: string;
  variantId?: string | null;
  productTitle: string;
  variantTitle?: string | null;
  sku?: string | null;
  price?: number;
  imageUrl?: string | null;
  inventoryQuantity?: number;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

export function WishlistHeartButton({
  productId,
  variantId,
  productTitle,
  variantTitle,
  sku,
  price = 0,
  imageUrl,
  inventoryQuantity = 0,
  size = 'small',
  showLabel = false,
}: WishlistHeartButtonProps) {
  const { isStandalone } = useStoreContext();
  const { showSuccess, showError } = useToast();

  const [isWishlisted, setIsWishlisted] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const animTimeoutRef = useRef<any>(null);

  const cleanProductId = String(productId).replace(/^gid:\/\/shopify\/Product\//i, '');

  // Fetch initial wishlist status
  const checkStatus = useCallback(async () => {
    if (!cleanProductId || !isStandalone) return;

    try {
      const res = await shopifyFetch(`/api/wishlist/check?productId=${encodeURIComponent(cleanProductId)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.statusMap && json.statusMap[cleanProductId]) {
          setIsWishlisted(Boolean(json.statusMap[cleanProductId].isWishlisted));
        }
      }
    } catch (_) {}
  }, [cleanProductId, isStandalone]);

  useEffect(() => {
    checkStatus();

    const handleGlobalUpdate = (event: any) => {
      if (event.detail && event.detail.productId === cleanProductId) {
        setIsWishlisted(Boolean(event.detail.wishlisted));
      }
    };

    window.addEventListener('wishlist-updated', handleGlobalUpdate);
    return () => {
      window.removeEventListener('wishlist-updated', handleGlobalUpdate);
      if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
    };
  }, [cleanProductId, checkStatus]);

  if (!isStandalone) {
    return null;
  }

  const handleToggle = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (loading) return;

    const previousState = isWishlisted;
    const nextState = !previousState;

    // Trigger innovative pop/burst animation
    setIsAnimating(true);
    if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
    animTimeoutRef.current = setTimeout(() => setIsAnimating(false), 700);

    // Optimistic UI update
    setIsWishlisted(nextState);
    setLoading(true);

    try {
      const res = await shopifyFetch('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle',
          shopifyProductId: cleanProductId,
          shopifyVariantId: variantId || null,
          productTitle,
          variantTitle: variantTitle || null,
          sku: sku || null,
          price: Number(price) || 0,
          imageUrl: imageUrl || null,
          inventoryQuantity: Number(inventoryQuantity) || 0,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const finalWishlisted = json.wishlisted ?? nextState;
        setIsWishlisted(finalWishlisted);

        window.dispatchEvent(
          new CustomEvent('wishlist-updated', {
            detail: { productId: cleanProductId, wishlisted: finalWishlisted },
          })
        );

        if (finalWishlisted) {
          showSuccess(`Added "${productTitle}" to Wishlist`);
        } else {
          showSuccess(`Removed "${productTitle}" from Wishlist`);
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        setIsWishlisted(previousState);
        showError(errJson.error || 'Could not update wishlist. Please try again.');
      }
    } catch (err: any) {
      setIsWishlisted(previousState);
      showError(err.message || 'Error updating wishlist');
    } finally {
      setLoading(false);
    }
  };

  const tooltipContent = isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist';

  // Size styling dimensions
  const isLarge = size === 'large';
  const isMedium = size === 'medium';
  const boxDimension = isLarge ? 42 : isMedium ? 36 : 32;
  const iconDimension = isLarge ? 22 : isMedium ? 18 : 16;

  return (
    <>
      {/* Innovative Keyframe Animations */}
      <style jsx global>{`
        @keyframes heartPop {
          0% {
            transform: scale(1);
          }
          30% {
            transform: scale(1.4) rotate(-8deg);
          }
          60% {
            transform: scale(0.88) rotate(4deg);
          }
          85% {
            transform: scale(1.15) rotate(-2deg);
          }
          100% {
            transform: scale(1) rotate(0deg);
          }
        }
        @keyframes heartPulseRing {
          0% {
            transform: scale(0.7);
            opacity: 0.9;
          }
          100% {
            transform: scale(1.8);
            opacity: 0;
          }
        }
      `}</style>

      <Tooltip content={tooltipContent} dismissOnMouseOut>
        <div style={{ display: 'inline-flex', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleToggle}
            disabled={loading}
            aria-label={tooltipContent}
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: showLabel ? '8px' : '0px',
              minWidth: showLabel ? 'auto' : `${boxDimension}px`,
              height: `${boxDimension}px`,
              padding: showLabel ? '6px 14px' : '0px',
              borderRadius: isLarge ? '12px' : '10px',
              border: isWishlisted
                ? '1.5px solid #fda4af'
                : '1.5px solid #e2e8f0',
              backgroundColor: isWishlisted
                ? '#fff1f2'
                : '#ffffff',
              boxShadow: isWishlisted
                ? '0 2px 8px -1px rgba(225, 29, 72, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.8)'
                : '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
              cursor: loading ? 'wait' : 'pointer',
              transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              overflow: 'visible',
            }}
            className="group hover:border-rose-300 hover:shadow-md hover:shadow-rose-500/10 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-200 ease-out"
          >
            {/* Animative Ripple Ring when tapped */}
            {isAnimating && isWishlisted && (
              <span
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: isLarge ? '12px' : '10px',
                  border: '2px solid #f43f5e',
                  pointerEvents: 'none',
                  animation: 'heartPulseRing 0.65s cubic-bezier(0, 0, 0.2, 1) forwards',
                }}
              />
            )}

            {/* Innovative SVG Heart with Smooth Color Change & Burst Animation */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transformOrigin: 'center center',
                animation: isAnimating ? 'heartPop 0.65s cubic-bezier(0.175, 0.885, 0.32, 1.275)' : 'none',
                transition: 'transform 0.2s ease, filter 0.2s ease',
              }}
              className="group-hover:scale-110"
            >
              <svg
                width={iconDimension}
                height={iconDimension}
                viewBox="0 0 24 24"
                fill={isWishlisted ? '#e11d48' : 'transparent'}
                stroke={isWishlisted ? '#e11d48' : '#64748b'}
                strokeWidth={isWishlisted ? '1' : '2'}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transition: 'fill 0.25s ease, stroke 0.25s ease, filter 0.25s ease',
                  filter: isWishlisted
                    ? 'drop-shadow(0 2px 4px rgba(225, 29, 72, 0.35))'
                    : 'none',
                }}
              >
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              </svg>
            </span>

            {/* Label if requested (e.g. for Product Details Page Header) */}
            {showLabel && (
              <span
                style={{
                  fontSize: isLarge ? '14px' : '13px',
                  fontWeight: 700,
                  color: isWishlisted ? '#be123c' : '#334155',
                  transition: 'color 0.2s ease',
                  userSelect: 'none',
                }}
              >
                {isWishlisted ? 'Wishlisted' : 'Add to Wishlist'}
              </span>
            )}
          </button>
        </div>
      </Tooltip>
    </>
  );
}
