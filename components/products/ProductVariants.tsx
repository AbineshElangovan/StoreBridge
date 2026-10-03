'use client';

import React, { useState } from 'react';
import { Icon } from '@shopify/polaris';
import { XIcon } from '@shopify/polaris-icons';
import { shopifyFetch } from '@/lib/shopify/Client';
import { ConfirmToast } from '@/components/ui/ConfirmToast';
import { useStoreContext } from '@/components/providers/StoreProvider';
import { useToast } from '@/components/providers/ToastContext';

export interface ProductVariantItem {
  id: string;
  shopifyVariantId: string;
  variantName: string;
  sku: string;
  price: number;
  quantity: number;
  status: string;
}

interface ProductVariantsProps {
  productId: string;
  variants: ProductVariantItem[];
  onVariantUpdated?: () => void;
}

export function ProductVariants({ productId, variants: initialVariants, onVariantUpdated }: ProductVariantsProps) {
  const { isMaster } = useStoreContext();
  const { showSuccess, showError } = useToast();
  const [variantList, setVariantList] = useState<ProductVariantItem[]>(initialVariants);
  const [isSavingAll, setIsSavingAll] = useState<boolean>(false);
  const [modifiedIds, setModifiedIds] = useState<Set<string>>(new Set());
  const [deletingVariant, setDeletingVariant] = useState<ProductVariantItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sync state if prop changes
  React.useEffect(() => {
    setVariantList(initialVariants);
    setModifiedIds(new Set());
  }, [initialVariants]);

  const handlePriceChange = (variantId: string, val: string) => {
    setSaveError(null);
    const onlyDigits = val.replace(/[^\d]/g, '');
    const cleanStr = onlyDigits.replace(/^0+(?=\d)/, '');
    const num = cleanStr === '' ? 0 : Math.max(0, parseInt(cleanStr, 10) || 0);
    setVariantList(prev => prev.map(v => v.id === variantId ? { ...v, price: num } : v));
    setModifiedIds(prev => new Set(prev).add(variantId));
  };

  const handleQuantityChange = (variantId: string, val: string) => {
    setSaveError(null);
    const onlyDigits = val.replace(/[^\d]/g, '');
    const cleanStr = onlyDigits.replace(/^0+(?=\d)/, '');
    const num = cleanStr === '' ? 0 : Math.max(0, parseInt(cleanStr, 10) || 0);
    setVariantList(prev => prev.map(v => v.id === variantId ? { ...v, quantity: num } : v));
    setModifiedIds(prev => new Set(prev).add(variantId));
  };

  const saveAllModified = async () => {
    if (modifiedIds.size === 0) return;
    setIsSavingAll(true);
    setSaveError(null);
    try {
      const modifiedVariants = variantList.filter(v => modifiedIds.has(v.id));
      let hasError = false;
      let lastErrorMessage = '';
      const successfullySavedIds = new Set<string>();

      for (const v of modifiedVariants) {
        const res = await shopifyFetch(`/api/products/${encodeURIComponent(productId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            variantId: v.id,
            price: v.price,
            quantity: v.quantity
          })
        });

        const json = await res.json().catch(() => ({ success: false, error: 'Invalid server response' }));

        if (res.ok && json.success) {
          successfullySavedIds.add(v.id);
        } else {
          hasError = true;
          lastErrorMessage = json.error || `Failed to update variant ${v.variantName} (HTTP ${res.status})`;
          break;
        }
      }

      setModifiedIds(prev => {
        const next = new Set(prev);
        successfullySavedIds.forEach(id => next.delete(id));
        return next;
      });

      if (hasError) {
        setSaveError(lastErrorMessage);
      } else {
        setSaveError(null);
      }

      // Re-fetch authoritative persisted product details from server
      if (onVariantUpdated) {
        onVariantUpdated();
      }
    } catch (err: any) {
      console.error('Failed to save variants:', err);
      setSaveError(err.message || 'Network error while saving variants');
    } finally {
      setIsSavingAll(false);
    }
  };

  const handleDeleteVariant = async () => {
    if (!deletingVariant) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      let url = `/api/products/${encodeURIComponent(productId)}?variantId=${encodeURIComponent(deletingVariant.id)}`;
      if (isMaster) {
        url += `&syncToConnected=true`;
      }
      const res = await shopifyFetch(url, {
        method: 'DELETE',
      });
      const json = await res.json().catch(() => ({ success: false, error: 'Invalid server response' }));
      if (res.ok && json.success) {
        setVariantList(prev => prev.filter(v => v.id !== deletingVariant.id));
        showSuccess(`Variant "${deletingVariant.variantName}" deleted successfully`);
        setDeletingVariant(null);
        if (onVariantUpdated) onVariantUpdated();
      } else {
        const errMsg = json.error || `Failed to delete variant (HTTP ${res.status})`;
        setDeleteError(errMsg);
        showError(errMsg);
      }
    } catch (err: any) {
      console.error('Failed to delete variant:', err);
      const errMsg = err.message || 'Network error deleting variant';
      setDeleteError(errMsg);
      showError(errMsg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div id="product-variants-section" className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-2xs mb-6 scroll-mt-6">
      {saveError && (
        <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800">
          <svg className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <span className="font-bold block">Save Error</span>
            <span>{saveError}</span>
          </div>
          <button type="button" onClick={() => setSaveError(null)} className="text-rose-500 hover:text-rose-700 p-0.5 flex items-center justify-center cursor-pointer" title="Dismiss error">
            <span className="w-3.5 h-3.5 flex items-center"><Icon source={XIcon} tone="inherit" /></span>
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-bold text-gray-900 tracking-tight">
            Variants
          </h3>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Edit quantity and price inline, then click Save All to apply changes.
          </p>
        </div>

        <button
          type="button"
          onClick={saveAllModified}
          disabled={isSavingAll || modifiedIds.size === 0}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-2xs transition-all cursor-pointer shrink-0 ${
            modifiedIds.size > 0
              ? 'bg-[#0db69d] hover:bg-[#0b9c86] text-white'
              : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
          }`}
        >
          {isSavingAll ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Saving All...
            </>
          ) : (
            `Save All${modifiedIds.size > 0 ? ` (${modifiedIds.size})` : ''}`
          )}
        </button>
      </div>

      <div className="overflow-x-auto w-full min-w-0">
        <table className="w-full min-w-[580px] text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-400 font-extrabold uppercase text-[10px] tracking-wider">
              <th className="py-2.5 px-3">Variant</th>
              <th className="py-2.5 px-3">SKU</th>
              <th className="py-2.5 px-3 text-right">Price</th>
              <th className="py-2.5 px-3 text-center">Quantity</th>
              <th className="py-2.5 px-3 text-center">Status</th>
              <th className="py-2.5 px-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 font-medium text-gray-900">
            {variantList.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-400 text-xs font-medium">
                  No variants found for this product.
                </td>
              </tr>
            ) : (
              variantList.map((v) => {
                return (
                  <tr key={v.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-3.5 px-3 font-semibold text-gray-900">
                      {v.variantName}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-gray-600">
                      {v.sku}
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={v.price === 0 ? '0' : String(v.price).replace(/^0+(?=\d)/, '')}
                        onChange={(e) => handlePriceChange(v.id, e.target.value)}
                        className="w-24 text-right bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0db69d]/20 focus:border-[#0db69d] shadow-2xs transition-colors"
                      />
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={v.quantity <= 0 ? '0' : String(v.quantity).replace(/^0+(?=\d)/, '')}
                        onChange={(e) => handleQuantityChange(v.id, e.target.value)}
                        className="w-20 text-center bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0db69d]/20 focus:border-[#0db69d] shadow-2xs transition-colors"
                      />
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        v.quantity > 0
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-red-100 text-red-800 border border-red-200'
                      }`}>
                        {v.quantity > 0 ? 'Active' : 'Out of stock'}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => setDeletingVariant(v)}
                        className="p-1.5 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/70 rounded-lg transition-colors cursor-pointer shadow-2xs inline-flex items-center justify-center"
                        title={`Delete ${v.variantName}`}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ConfirmToast
        open={Boolean(deletingVariant)}
        message={`Delete variant "${deletingVariant?.variantName}"?`}
        subMessage={
          deleteError
            ? `Error: ${deleteError}`
            : isMaster
            ? `SKU: ${deletingVariant?.sku || 'N/A'}. This will permanently remove this variant from Master and all connected stores.`
            : `SKU: ${deletingVariant?.sku || 'N/A'}. This will permanently remove this variant from this store.`
        }
        confirmLabel="Yes, Delete"
        cancelLabel="No"
        variant="danger"
        loading={isDeleting}
        onConfirm={handleDeleteVariant}
        onCancel={() => { setDeletingVariant(null); setDeleteError(null); }}
      />
    </div>
  );
}
