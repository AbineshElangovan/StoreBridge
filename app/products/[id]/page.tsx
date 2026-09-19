'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { shopifyFetch } from '@/lib/shopify/Client';
import { Loading } from '@/components/common/Loading';
import { ProductHeader } from '@/components/products/ProductHeader';
import { ProductInfoCard } from '@/components/products/ProductInfoCard';
import { StoreAvailability } from '@/components/products/StoreAvailability';
import { ProductVariants } from '@/components/products/ProductVariants';
import { ProductPerformance } from '@/components/products/ProductPerformance';
import { useNavbarTitle } from '@/components/providers/NavbarTitleContext';
import { getCleanProductName } from '@/lib/utils/formatProductTitle';
import { ConfirmToast } from '@/components/ui/ConfirmToast';
import { useStoreContext } from '@/components/providers/StoreProvider';

export default function ProductDetailsPage() {
  const { isMaster } = useStoreContext();
  const params = useParams();
  const router = useRouter();
  const { setCustomTitle } = useNavbarTitle();
  const rawParam = params?.id;
  const rawIdStr = Array.isArray(rawParam) ? rawParam.join('/') : (rawParam as string || '');
  const decodedId = rawIdStr ? decodeURIComponent(rawIdStr).trim() : '';
  const productId = decodedId
    .replace(/^gid:\/\/shopify\/Product\//i, '')
    .replace(/^gid%3a%2f%2fshopify%2fproduct%2f/i, '')
    .replace(/\s+/g, '-')
    .split('/')
    .pop() || decodedId;

  const [loading, setLoading] = useState<boolean>(true);
  const [productData, setProductData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [activeProductId, setActiveProductId] = useState<string>(productId);

  const fetchProductDetails = useCallback(async () => {
    const idToFetch = activeProductId || productId;
    if (!idToFetch) return;
    setLoading(true);
    setError(null);
    try {
      const res = await shopifyFetch(`/api/products/${encodeURIComponent(idToFetch)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.product) {
          setProductData(json.product);
          if (json.product.shopifyProductId) {
            const cleanId = json.product.shopifyProductId.replace(/^gid:\/\/shopify\/Product\//i, '');
            if (cleanId && cleanId !== activeProductId) {
              setActiveProductId(cleanId);
            }
          }
        } else {
          // If 404 happens (e.g. after deleting the product or last variant), redirect to products page
          if (productData) {
            router.push('/products');
          } else {
            setError(json.error || 'Product not found');
          }
        }
      } else {
        if (productData) {
          router.push('/products');
        } else {
          setError('Failed to load product details');
        }
      }
    } catch (err: any) {
      console.error('[Product Details Page] Fetch error:', err);
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, [productId, activeProductId, productData, router]);

  useEffect(() => {
    fetchProductDetails();
  }, [productId]);

  const handleDeleteProduct = async (syncToConnected: boolean = false) => {
    if (!productId) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const targetId = productData?.shopifyProductId || productData?.id || productId;
      let url = `/api/products/${encodeURIComponent(targetId)}`;
      if (isMaster) {
        url += `?syncToConnected=${syncToConnected}`;
      }

      const res = await shopifyFetch(url, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setShowDeleteModal(false);
        router.push('/products');
      } else {
        setDeleteError(json.error || 'Failed to delete product');
      }
    } catch (err: any) {
      console.error('[Product Details Page] Delete error:', err);
      setDeleteError(err.message || 'Network error deleting product');
    } finally {
      setIsDeleting(false);
    }
  };

  // Update navbar breadcrumb title dynamically with live product title
  useEffect(() => {
    if (productData?.title) {
      const cleanTitle = getCleanProductName(productData.title, productData.collection);
      setCustomTitle(cleanTitle);
    }
    return () => {
      setCustomTitle(null);
    };
  }, [productData?.title, productData?.collection, setCustomTitle]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 min-h-screen">
        <Loading label="Loading product details..." />
      </div>
    );
  }

  if (error || !productData) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 min-h-screen">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center max-w-xl mx-auto shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 font-bold text-lg">
            !
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Product Not Found</h2>
          <p className="text-sm text-gray-500 mb-6">
            {error || 'We could not find details for the requested product.'}
          </p>
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center justify-center bg-[#0db69d] hover:bg-[#0b9c86] text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer shadow-2xs"
          >
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full mb-16">
      {/* Top Page Heading & Subheading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-gray-200 mb-6 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Product Details</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">
            Real-time inventory status, variant pricing, performance analytics, and store synchronization.
          </p>
        </div>
      </div>

      {/* Reusable Product Header */}
      <ProductHeader
        title={productData.title}
        sku={productData.sku}
        collection={productData.collection}
        vendor={productData.vendor}
        onDelete={() => setShowDeleteModal(true)}
        isDeleting={isDeleting}
      />

      {/* Main Responsive Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Product Info Card */}
        <div className="lg:col-span-4 space-y-6 w-full">
          <ProductInfoCard
            imageUrl={productData.imageUrl}
            title={productData.title}
            sku={productData.sku}
            collection={productData.collection}
            vendor={productData.vendor}
            basePrice={productData.basePrice}
            status={productData.status}
            currentStock={productData.currentStock}
            healthStatus={productData.healthStatus}
          />
        </div>

        {/* Right Column: Variants + Performance Metrics + Store Availability */}
        <div className="lg:col-span-8 space-y-6 w-full">
          <ProductVariants
            productId={productData.shopifyProductId || productData.id}
            variants={productData.variants || []}
            onVariantUpdated={fetchProductDetails}
          />

          <ProductPerformance performance={productData.performance} />

          <StoreAvailability stores={productData.storeAvailability || []} />
        </div>
      </div>

      {/* Confirmation for Product Deletion */}
      <ConfirmToast
        open={showDeleteModal}
        message={`Delete product "${productData?.title}"?`}
        subMessage={deleteError ? `Error: ${deleteError}` : "This will permanently remove the product from Shopify and StoreBridge."}
        confirmLabel="Yes, Delete"
        cancelLabel="No"
        variant="danger"
        loading={isDeleting}
        onConfirm={() => handleDeleteProduct()}
        onCancel={() => { setShowDeleteModal(false); setDeleteError(null); }}
      />
    </div>
  );
}
