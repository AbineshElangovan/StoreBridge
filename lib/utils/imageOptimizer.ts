/**
 * Client-Side Image Optimizer and Validator for StoreOrbit
 *
 * Requirements:
 * - Accepts original images up to 100 MB.
 * - Automatically optimizes oversized images (> 20 MB or > 4472px) to Shopify-compatible files.
 * - Preserves 4K resolution (up to 3840px / 4096px) and high visual fidelity (~90% quality).
 * - Supported formats: JPG, JPEG, PNG, WEBP.
 */

export const MAX_INPUT_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
export const SHOPIFY_MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB (Shopify limit)
export const TARGET_MAX_DIMENSION = 3840; // 4K UHD max dimension
export const SHOPIFY_MAX_DIMENSION = 4472; // Shopify maximum pixel limit

export const SUPPORTED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
  file?: File;
  originalSize: number;
  optimizedSize?: number;
  wasOptimized: boolean;
  dimensions?: { width: number; height: number };
}

/**
 * Validates file type, size (under 100 MB), and magic bytes.
 */
export async function validateImageFile(file: File): Promise<{ valid: boolean; error?: string }> {
  if (!file) {
    return { valid: false, error: 'No file provided.' };
  }

  // Size check (under 100 MB)
  if (file.size > MAX_INPUT_FILE_SIZE) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File size (${sizeMb} MB) exceeds maximum limit of 100 MB.`,
    };
  }

  // MIME check
  const mime = file.type.toLowerCase();
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const validExts = ['jpg', 'jpeg', 'png', 'webp'];

  if (!SUPPORTED_MIME_TYPES.includes(mime) && !validExts.includes(ext)) {
    return {
      valid: false,
      error: `Unsupported file type (${file.type || ext}). Please upload JPG, PNG, or WebP.`,
    };
  }

  // Magic bytes inspection
  try {
    const slice = file.slice(0, 12);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const isPng =
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47;
    const isWebp =
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 && // 'RIFF'
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50; // 'WEBP'

    if (!isJpeg && !isPng && !isWebp) {
      return {
        valid: false,
        error: 'File content does not match a valid image format (JPEG, PNG, or WebP).',
      };
    }
  } catch (err) {
    console.warn('[ImageOptimizer] Magic byte check skipped:', err);
  }

  return { valid: true };
}

/**
 * Reads image dimensions using HTML Image object.
 */
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for dimension inspection.'));
    };
    img.src = url;
  });
}

/**
 * Automatically optimizes oversized images (> 20 MB or > 4472px) down to Shopify-compatible
 * sizes while preserving pristine 4K resolution (max 3840px / 4096px) and high visual fidelity.
 */
export async function optimizeImageIfNeeded(
  file: File,
  onProgress?: (msg: string) => void
): Promise<ImageValidationResult> {
  const validation = await validateImageFile(file);
  if (!validation.valid) {
    return {
      valid: false,
      error: validation.error,
      originalSize: file.size,
      wasOptimized: false,
    };
  }

  try {
    const dimensions = await getImageDimensions(file);
    const needsResize =
      dimensions.width > SHOPIFY_MAX_DIMENSION ||
      dimensions.height > SHOPIFY_MAX_DIMENSION;
    const needsCompression = file.size > SHOPIFY_MAX_FILE_SIZE * 0.9; // Compress if > 18 MB

    // If within Shopify limits, return original untouched
    if (!needsResize && !needsCompression) {
      return {
        valid: true,
        file,
        originalSize: file.size,
        wasOptimized: false,
        dimensions,
      };
    }

    onProgress?.('Optimizing high-resolution image to 4K Shopify-compatible format...');

    // Calculate 4K target dimensions preserving aspect ratio
    let targetWidth = dimensions.width;
    let targetHeight = dimensions.height;

    if (dimensions.width > TARGET_MAX_DIMENSION || dimensions.height > TARGET_MAX_DIMENSION) {
      if (dimensions.width >= dimensions.height) {
        targetWidth = TARGET_MAX_DIMENSION;
        targetHeight = Math.round((dimensions.height / dimensions.width) * TARGET_MAX_DIMENSION);
      } else {
        targetHeight = TARGET_MAX_DIMENSION;
        targetWidth = Math.round((dimensions.width / dimensions.height) * TARGET_MAX_DIMENSION);
      }
    }

    // Render to Canvas
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas context initialization failed.');
    }

    // High quality scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      const url = URL.createObjectURL(file);
      el.onload = () => {
        URL.revokeObjectURL(url);
        resolve(el);
      };
      el.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image into canvas.'));
      };
      el.src = url;
    });

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    // Prefer WebP or JPEG for optimal compression at 4K
    const outputMime = file.type === 'image/png' && !needsCompression ? 'image/png' : 'image/webp';
    const quality = 0.90; // 90% quality ensures 4K crispness

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), outputMime, quality);
    });

    if (!blob) {
      throw new Error('Canvas blob generation failed.');
    }

    // Name optimized file cleanly
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const outExt = outputMime === 'image/webp' ? 'webp' : 'jpg';
    const optimizedFile = new File([blob], `${baseName}-4k.${outExt}`, {
      type: outputMime,
      lastModified: Date.now(),
    });

    return {
      valid: true,
      file: optimizedFile,
      originalSize: file.size,
      optimizedSize: optimizedFile.size,
      wasOptimized: true,
      dimensions: { width: targetWidth, height: targetHeight },
    };
  } catch (err: any) {
    console.error('[ImageOptimizer] Optimization error:', err);
    // If canvas fails but original is under 20 MB, fallback to original
    if (file.size <= SHOPIFY_MAX_FILE_SIZE) {
      return {
        valid: true,
        file,
        originalSize: file.size,
        wasOptimized: false,
      };
    }
    return {
      valid: false,
      error: `Could not optimize oversized image (${err.message}).`,
      originalSize: file.size,
      wasOptimized: false,
    };
  }
}
