export function getProductUrl(item: { id?: string | null; shopifyProductId?: string | null; sku?: string | null }): string {
  let queryParamStr = '';
  if (typeof window !== 'undefined' && window.location) {
    const params = new URLSearchParams(window.location.search);
    const q = new URLSearchParams();
    const shop = params.get('shop');
    const host = params.get('host');
    if (shop) q.set('shop', shop);
    if (host) q.set('host', host);
    const qs = q.toString();
    if (qs) queryParamStr = `?${qs}`;
  }

  if (!item) return `/products${queryParamStr}`;
  
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

  return `${basePath}${queryParamStr}`;
}
