import sharp from 'sharp';

export const SERVER_MAX_INPUT_SIZE = 100 * 1024 * 1024; // 100 MB
export const SHOPIFY_MAX_SIZE = 20 * 1024 * 1024; // 20 MB
export const TARGET_4K_DIMENSION = 3840;

export interface ServerOptimizationResult {
  buffer: Buffer;
  mimeType: string;
  filename: string;
  originalSize: number;
  optimizedSize: number;
  wasOptimized: boolean;
  dimensions?: { width: number; height: number };
}

/**
 * Validates magic bytes of an image buffer.
 */
export function validateImageBuffer(buffer: Buffer): { valid: boolean; error?: string; detectedMime?: string } {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: 'Empty buffer provided.' };
  }

  if (buffer.length > SERVER_MAX_INPUT_SIZE) {
    const sizeMb = (buffer.length / (1024 * 1024)).toFixed(1);
    return { valid: false, error: `Image size (${sizeMb} MB) exceeds maximum limit of 100 MB.` };
  }

  // Magic bytes
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  const isWebp =
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50;
  const isGif = buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46; // GIF87a or GIF89a

  if (isJpeg) return { valid: true, detectedMime: 'image/jpeg' };
  if (isPng) return { valid: true, detectedMime: 'image/png' };
  if (isWebp) return { valid: true, detectedMime: 'image/webp' };
  if (isGif) return { valid: true, detectedMime: 'image/gif' };

  return { valid: false, error: 'File content does not match a valid image format (JPEG, PNG, WebP, or GIF).' };
}

/**
 * Automatically optimizes an image buffer on the server if it exceeds Shopify's 20 MB limit
 * or 4472px dimension, preserving 4K quality (up to 3840px) at high visual fidelity.
 */
export async function optimizeImageBufferIfNeeded(
  inputBuffer: Buffer,
  filename: string,
  preferredMime?: string
): Promise<ServerOptimizationResult> {
  const check = validateImageBuffer(inputBuffer);
  if (!check.valid) {
    throw new Error(check.error || 'Invalid image buffer');
  }

  const originalSize = inputBuffer.length;
  const image = sharp(inputBuffer);
  const metadata = await image.metadata();

  const width = metadata.width || 0;
  const height = metadata.height || 0;

  const needsResize = width > 4472 || height > 4472;
  const needsCompression = originalSize > SHOPIFY_MAX_SIZE * 0.95; // > 19 MB

  // If already within Shopify limits, return untouched
  if (!needsResize && !needsCompression && originalSize <= SHOPIFY_MAX_SIZE) {
    return {
      buffer: inputBuffer,
      mimeType: check.detectedMime || preferredMime || 'image/jpeg',
      filename,
      originalSize,
      optimizedSize: originalSize,
      wasOptimized: false,
      dimensions: { width, height },
    };
  }

  // Calculate 4K target dimensions
  let targetWidth: number | undefined = undefined;
  let targetHeight: number | undefined = undefined;

  if (width > TARGET_4K_DIMENSION || height > TARGET_4K_DIMENSION) {
    if (width >= height) {
      targetWidth = TARGET_4K_DIMENSION;
      targetHeight = Math.round((height / width) * TARGET_4K_DIMENSION);
    } else {
      targetHeight = TARGET_4K_DIMENSION;
      targetWidth = Math.round((width / height) * TARGET_4K_DIMENSION);
    }
  }

  let pipeline = sharp(inputBuffer);
  if (targetWidth && targetHeight) {
    pipeline = pipeline.resize(targetWidth, targetHeight, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  // Preserve 4K crispness with 90% quality WebP or JPEG
  const outMime = metadata.format === 'png' && !needsCompression ? 'image/png' : 'image/webp';
  let optimizedBuffer: Buffer;
  let outFilename = filename;

  if (outMime === 'image/webp') {
    optimizedBuffer = await pipeline.webp({ quality: 90, effort: 4 }).toBuffer();
    outFilename = filename.replace(/\.[^/.]+$/, '') + '-4k.webp';
  } else {
    optimizedBuffer = await pipeline.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
    outFilename = filename.replace(/\.[^/.]+$/, '') + '-4k.jpg';
  }

  return {
    buffer: optimizedBuffer,
    mimeType: outMime,
    filename: outFilename,
    originalSize,
    optimizedSize: optimizedBuffer.length,
    wasOptimized: true,
    dimensions: {
      width: targetWidth || width,
      height: targetHeight || height,
    },
  };
}
