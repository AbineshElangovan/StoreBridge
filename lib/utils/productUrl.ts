export function getProductUrl(item: { id?: string | null; shopifyProductId?: string | null; sku?: string | null }): string {
  let shopParam = '';
  if (typeof window !== 'undefined' && window.location) {
    const shop = new URLSearchParams(window.location.search).get('shop');
    if (shop) {
      shopParam = `?shop=${encodeURIComponent(shop)}`;
    }
  }

  if (!item) return `/products${shopParam}`;
  
  let basePath = '/products';
  // Prefer Prisma UUID if valid non-slashed string
  if (item.id && !item.id.includes('/') && !item.id.includes(':')) {
    const cleanId = item.id.trim().replace(/\s+/g, '-');
    basePath = `/products/${encodeURIComponent(cleanId)}`;
  } else if (item.shopifyProductId) {
    const parts = item.shopifyProductId.split('/');
    const numericId = parts[parts.length - 1];
    if (numericId && numericId.trim() !== '') {
      basePath = `/products/${encodeURIComponent(numericId.trim())}`;
    }
  } else if (item.sku && item.sku !== 'N/A') {
    basePath = `/products/${encodeURIComponent(item.sku.trim())}`;
  } else {
    basePath = `/products/${encodeURIComponent(item.id || '')}`;
  }

  return `${basePath}${shopParam}`;
}
