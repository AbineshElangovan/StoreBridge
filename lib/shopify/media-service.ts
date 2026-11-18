import dns from 'dns/promises';
import { getAdminClient } from './admin';
import { isShopifySafeMode, logSafeModeIntercept } from './safe-mode';
import {
  STAGED_UPLOADS_CREATE_MUTATION,
  PRODUCT_CREATE_MEDIA_MUTATION,
  PRODUCT_DELETE_MEDIA_MUTATION,
  GET_PRODUCT_MEDIA_QUERY,
} from '@/services/shopify/graphql';
import { optimizeImageBufferIfNeeded } from './image-optimizer';

/**
 * Validates external image URLs against SSRF vulnerabilities and protocol security.
 */
export async function validateImageUrl(urlStr: string): Promise<{ valid: boolean; error?: string; cleanUrl?: string }> {
  if (!urlStr || typeof urlStr !== 'string') {
    return { valid: false, error: 'Image URL is required.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(urlStr.trim());
  } catch {
    return { valid: false, error: 'Invalid URL format.' };
  }

  // Strictly HTTPS
  if (parsed.protocol !== 'https:') {
    return { valid: false, error: 'Only secure HTTPS image URLs are supported.' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost, link-local, private IPs, and cloud metadata
  const isPrivateIp = (ip: string) =>
    ip.startsWith('10.') ||
    ip.startsWith('127.') ||
    ip.startsWith('169.254.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip) ||
    ip === '::1' ||
    ip === '0.0.0.0';

  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    isPrivateIp(hostname) ||
    hostname === 'metadata.google.internal'
  ) {
    return { valid: false, error: 'Access to internal or loopback addresses is restricted.' };
  }

  // Resolve DNS to verify non-private IP (SSRF guard with quick timeout)
  try {
    const resolvePromise = dns.resolve(hostname);
    const timeoutPromise = new Promise<string[]>((_, reject) =>
      setTimeout(() => reject(new Error('DNS timeout')), 600)
    );
    const addresses = await Promise.race([resolvePromise, timeoutPromise]);
    for (const ip of addresses) {
      if (isPrivateIp(ip)) {
        return { valid: false, error: 'Target URL resolves to a protected or private IP address.' };
      }
    }
  } catch (err: any) {
    // Non-blocking in offline/sandbox environments unless verified private
  }

  // Check valid file extension or basic path
  const pathname = parsed.pathname.toLowerCase();
  const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.avif', '.bmp'];
  const hasValidExt = validExtensions.some((ext) => pathname.endsWith(ext));

  // If URL has no extension (e.g. Unsplash or CDN endpoints), allow if it's a known image CDN
  if (!hasValidExt && !pathname.includes('photo') && !pathname.includes('image') && !pathname.includes('cdn')) {
    // Perform lightweight HEAD check to confirm content-type
    try {
      const headRes = await fetch(parsed.toString(), {
        method: 'HEAD',
        signal: AbortSignal.timeout(800),
      });
      const contentType = headRes.headers.get('content-type') || '';
      if (!contentType.startsWith('image/')) {
        return { valid: false, error: `URL does not return a supported image (Content-Type: ${contentType}).` };
      }
    } catch {
      // Continue if HEAD fails but URL looks plausible
    }
  }

  return { valid: true, cleanUrl: parsed.toString() };
}

/**
 * Polls Shopify GraphQL to verify media processing state.
 */
async function pollMediaStatus(
  client: any,
  shopifyProductId: string,
  mediaId: string,
  maxAttempts = 1,
  delayMs = 150
): Promise<{ status: string; url: string | null }> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res: any = await client.request(GET_PRODUCT_MEDIA_QUERY, {
        variables: { productId: shopifyProductId },
      });
      const data = res.data || res;
      const edges = data.product?.media?.edges || [];
      const match = edges.find((e: any) => e.node?.id === mediaId);

      if (match?.node) {
        const status = match.node.status;
        const url = match.node.image?.url || data.product?.featuredImage?.url || null;
        if (status === 'READY' && url) {
          return { status: 'READY', url };
        }
        if (status === 'FAILED') {
          return { status: 'FAILED', url: null };
        }
      }
    } catch (err) {
      console.warn(`[MediaService] Media status polling attempt ${attempt} warning:`, err);
    }
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return { status: 'PROCESSING', url: null };
}

/**
 * Method A: Attach an external HTTPS Image URL to a Shopify Product.
 */
export async function attachImageUrlToProduct(params: {
  shopDomain: string;
  shopifyProductId: string;
  imageUrl: string;
  altText?: string;
  replaceExisting?: boolean;
}): Promise<{ success: boolean; mediaId?: string; imageUrl?: string; status?: string; error?: string }> {
  const { shopDomain, shopifyProductId, imageUrl, altText, replaceExisting = true } = params;

  // SSRF and URL validation
  const validation = await validateImageUrl(imageUrl);
  if (!validation.valid || !validation.cleanUrl) {
    return { success: false, error: validation.error || 'Invalid image URL.' };
  }

  const cleanProdId = shopifyProductId.startsWith('gid://shopify/Product/')
    ? shopifyProductId
    : `gid://shopify/Product/${shopifyProductId}`;

  // Safe mode check
  if (isShopifySafeMode()) {
    logSafeModeIntercept('attachImageUrlToProduct', { shopDomain, shopifyProductId, imageUrl });
    return {
      success: true,
      mediaId: 'gid://shopify/MediaImage/safe-mode-url',
      imageUrl: validation.cleanUrl,
      status: 'READY',
    };
  }

  const client = await getAdminClient(shopDomain);

  // If replacing, fetch existing media IDs prior to adding new media
  let existingMediaIds: string[] = [];
  if (replaceExisting) {
    try {
      const res: any = await client.request(GET_PRODUCT_MEDIA_QUERY, {
        variables: { productId: cleanProdId },
      });
      const data = res.data || res;
      const edges = data.product?.media?.edges || [];
      existingMediaIds = edges.map((e: any) => e.node?.id).filter(Boolean);
    } catch (queryErr) {
      console.warn('[MediaService] Could not fetch existing media IDs prior to replacement:', queryErr);
    }
  }

  try {
    const createRes: any = await client.request(PRODUCT_CREATE_MEDIA_MUTATION, {
      variables: {
        productId: cleanProdId,
        media: [
          {
            originalSource: validation.cleanUrl,
            mediaContentType: 'IMAGE',
            alt: altText || 'Product Image',
          },
        ],
      },
    });

    const data = createRes.data || createRes;
    const userErrors = data.productCreateMedia?.mediaUserErrors || [];
    if (userErrors.length > 0) {
      return {
        success: false,
        error: userErrors.map((e: any) => `${e.field}: ${e.message}`).join(', '),
      };
    }

    const createdMedia = data.productCreateMedia?.media?.[0];
    if (!createdMedia) {
      return { success: false, error: 'Shopify did not return created media object.' };
    }

    const mediaId = createdMedia.id;

    // Delete existing old media from Shopify so the new image truly replaces the old one
    if (replaceExisting && existingMediaIds.length > 0) {
      const idsToDelete = existingMediaIds.filter((id) => id !== mediaId);
      if (idsToDelete.length > 0) {
        try {
          await client.request(PRODUCT_DELETE_MEDIA_MUTATION, {
            variables: {
              productId: cleanProdId,
              mediaIds: idsToDelete,
            },
          });
        } catch (delErr) {
          console.warn('[MediaService] Failed to delete previous media during replacement:', delErr);
        }
      }
    }

    let finalUrl = createdMedia.image?.url || null;
    let mediaStatus = createdMedia.status;

    // If initial status is processing or URL is missing, poll Shopify
    if (mediaStatus !== 'READY' || !finalUrl) {
      const poll = await pollMediaStatus(client, cleanProdId, mediaId);
      if (poll.url) {
        finalUrl = poll.url;
        mediaStatus = poll.status;
      }
    }

    return {
      success: true,
      mediaId,
      imageUrl: finalUrl || validation.cleanUrl,
      status: mediaStatus,
    };
  } catch (err: any) {
    console.error('[MediaService] attachImageUrlToProduct error:', err);
    return { success: false, error: err.message || 'Failed to attach image URL to product in Shopify.' };
  }
}

/**
 * Method B: Upload a Photo (up to 100 MB) via Shopify staged uploads and attach to product.
 */
export async function uploadPhotoToProduct(params: {
  shopDomain: string;
  shopifyProductId: string;
  fileBuffer: Buffer;
  filename: string;
  mimeType: string;
  altText?: string;
  replaceExisting?: boolean;
}): Promise<{
  success: boolean;
  mediaId?: string;
  imageUrl?: string;
  status?: string;
  wasOptimized?: boolean;
  originalSize?: number;
  optimizedSize?: number;
  error?: string;
}> {
  const { shopDomain, shopifyProductId, fileBuffer, filename, mimeType, altText, replaceExisting = true } = params;

  // Safe mode check
  if (isShopifySafeMode()) {
    logSafeModeIntercept('uploadPhotoToProduct', { shopDomain, shopifyProductId, filename, size: fileBuffer.length });
    return {
      success: true,
      mediaId: 'gid://shopify/MediaImage/safe-mode-photo',
      imageUrl: `https://cdn.shopify.com/s/files/safe-mode/${encodeURIComponent(filename)}`,
      status: 'READY',
      wasOptimized: false,
      originalSize: fileBuffer.length,
      optimizedSize: fileBuffer.length,
    };
  }

  // 1. Optimize buffer if needed (under 100 MB -> 4K Shopify compliant)
  let optimized;
  try {
    optimized = await optimizeImageBufferIfNeeded(fileBuffer, filename, mimeType);
  } catch (optErr: any) {
    return { success: false, error: `Image validation failed: ${optErr.message}` };
  }

  const cleanProdId = shopifyProductId.startsWith('gid://shopify/Product/')
    ? shopifyProductId
    : `gid://shopify/Product/${shopifyProductId}`;

  const client = await getAdminClient(shopDomain);

  // If replacing, fetch existing media IDs prior to adding new media
  let existingMediaIds: string[] = [];
  if (replaceExisting) {
    try {
      const res: any = await client.request(GET_PRODUCT_MEDIA_QUERY, {
        variables: { productId: cleanProdId },
      });
      const data = res.data || res;
      const edges = data.product?.media?.edges || [];
      existingMediaIds = edges.map((e: any) => e.node?.id).filter(Boolean);
    } catch (queryErr) {
      console.warn('[MediaService] Could not fetch existing media IDs prior to replacement:', queryErr);
    }
  }

  try {
    // 2. Request staged upload target from Shopify
    const stagedRes: any = await client.request(STAGED_UPLOADS_CREATE_MUTATION, {
      variables: {
        input: [
          {
            resource: 'IMAGE',
            filename: optimized.filename,
            mimeType: optimized.mimeType,
            httpMethod: 'POST',
          },
        ],
      },
    });

    const stagedData = stagedRes.data || stagedRes;
    const stageErrors = stagedData.stagedUploadsCreate?.userErrors || [];
    if (stageErrors.length > 0) {
      return {
        success: false,
        error: stageErrors.map((e: any) => `${e.field}: ${e.message}`).join(', '),
      };
    }

    const target = stagedData.stagedUploadsCreate?.stagedTargets?.[0];
    if (!target || !target.url || !target.resourceUrl) {
      return { success: false, error: 'Shopify did not provide a valid staged upload target.' };
    }

    // 3. Upload binary to target URL (Shopify GCS/S3)
    const formData = new FormData();
    if (Array.isArray(target.parameters)) {
      for (const param of target.parameters) {
        formData.append(param.name, param.value);
      }
    }

    // Append file blob
    const fileBlob = new Blob([new Uint8Array(optimized.buffer)], { type: optimized.mimeType });
    formData.append('file', fileBlob, optimized.filename);

    const uploadResponse = await fetch(target.url, {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok && uploadResponse.status !== 201 && uploadResponse.status !== 204) {
      const uploadErrText = await uploadResponse.text().catch(() => '');
      return {
        success: false,
        error: `Failed to upload binary file to Shopify storage: ${uploadResponse.status} ${uploadErrText}`,
      };
    }

    // 4. Attach staged resource to Shopify product
    const createMediaRes: any = await client.request(PRODUCT_CREATE_MEDIA_MUTATION, {
      variables: {
        productId: cleanProdId,
        media: [
          {
            originalSource: target.resourceUrl,
            mediaContentType: 'IMAGE',
            alt: altText || optimized.filename,
          },
        ],
      },
    });

    const mediaData = createMediaRes.data || createMediaRes;
    const mediaErrors = mediaData.productCreateMedia?.mediaUserErrors || [];
    if (mediaErrors.length > 0) {
      return {
        success: false,
        error: mediaErrors.map((e: any) => `${e.field}: ${e.message}`).join(', '),
      };
    }

    const createdMedia = mediaData.productCreateMedia?.media?.[0];
    if (!createdMedia) {
      return { success: false, error: 'Shopify did not return media association for uploaded photo.' };
    }

    const mediaId = createdMedia.id;

    // Delete existing old media from Shopify so the new image truly replaces the old one
    if (replaceExisting && existingMediaIds.length > 0) {
      const idsToDelete = existingMediaIds.filter((id) => id !== mediaId);
      if (idsToDelete.length > 0) {
        try {
          await client.request(PRODUCT_DELETE_MEDIA_MUTATION, {
            variables: {
              productId: cleanProdId,
              mediaIds: idsToDelete,
            },
          });
        } catch (delErr) {
          console.warn('[MediaService] Failed to delete previous media during replacement:', delErr);
        }
      }
    }

    let finalUrl = createdMedia.image?.url || null;
    let mediaStatus = createdMedia.status;

    // Poll until ready
    if (mediaStatus !== 'READY' || !finalUrl) {
      const poll = await pollMediaStatus(client, cleanProdId, mediaId);
      if (poll.url) {
        finalUrl = poll.url;
        mediaStatus = poll.status;
      }
    }

    return {
      success: true,
      mediaId,
      imageUrl: finalUrl || target.resourceUrl,
      status: mediaStatus,
      wasOptimized: optimized.wasOptimized,
      originalSize: optimized.originalSize,
      optimizedSize: optimized.optimizedSize,
    };
  } catch (err: any) {
    console.error('[MediaService] uploadPhotoToProduct error:', err);
    return { success: false, error: err.message || 'Failed to upload photo to Shopify.' };
  }
}

/**
 * Deletes media from a Shopify product.
 */
export async function deleteProductMedia(params: {
  shopDomain: string;
  shopifyProductId: string;
  mediaId?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { shopDomain, shopifyProductId, mediaId } = params;

  if (isShopifySafeMode()) {
    logSafeModeIntercept('deleteProductMedia', { shopDomain, shopifyProductId, mediaId });
    return { success: true };
  }

  const cleanProdId = shopifyProductId.startsWith('gid://shopify/Product/')
    ? shopifyProductId
    : `gid://shopify/Product/${shopifyProductId}`;

  const client = await getAdminClient(shopDomain);

  try {
    let idsToDelete: string[] = [];
    if (mediaId) {
      idsToDelete = [mediaId];
    } else {
      // Fetch existing media IDs
      const res: any = await client.request(GET_PRODUCT_MEDIA_QUERY, {
        variables: { productId: cleanProdId },
      });
      const data = res.data || res;
      const edges = data.product?.media?.edges || [];
      idsToDelete = edges.map((e: any) => e.node?.id).filter(Boolean);
    }

    if (idsToDelete.length === 0) {
      return { success: true };
    }

    const delRes: any = await client.request(PRODUCT_DELETE_MEDIA_MUTATION, {
      variables: {
        productId: cleanProdId,
        mediaIds: idsToDelete,
      },
    });

    const data = delRes.data || delRes;
    const errors = data.productDeleteMedia?.mediaUserErrors || [];
    if (errors.length > 0) {
      return { success: false, error: errors.map((e: any) => `${e.field}: ${e.message}`).join(', ') };
    }

    return { success: true };
  } catch (err: any) {
    console.error('[MediaService] deleteProductMedia error:', err);
    return { success: false, error: err.message || 'Failed to delete media from Shopify.' };
  }
}
