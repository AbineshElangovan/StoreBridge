export interface ParsedVariant {
  sku: string;
  price: string;
  option1Name: string;
  option1Value: string;
  option2Name: string;
  option2Value: string;
  option3Name: string;
  option3Value: string;
  inventoryQuantity: number;
  inventoryTracked: boolean;
  imageUrl?: string;
  imageFile?: string;
  hasImageConflict?: boolean;
}

export interface ParsedProduct {
  handle: string;
  title: string;
  descriptionHtml: string;
  tags: string[];
  vendor: string;
  productType: string;
  status: string;
  collection?: string;
  imageUrl?: string;
  imageFile?: string;
  hasImageConflict?: boolean;
  variants: ParsedVariant[];
}

export interface ParseResult {
  products: ParsedProduct[];
  errors: { row: number; error: string }[];
}

/**
 * Finds a field value from a row using case-insensitive trimmed matching
 * against an array of synonyms or regex patterns.
 */
function getNormalizedValue(row: any, synonyms: string[]): string {
  if (!row || typeof row !== 'object') return '';
  const rowKeys = Object.keys(row);

  for (const synonym of synonyms) {
    const matchedKey = rowKeys.find((k) => k.trim().toLowerCase() === synonym.toLowerCase());
    if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
      const val = String(row[matchedKey]).trim();
      if (val) return val;
    }
  }
  return '';
}

/**
 * Normalizes rows from any CSV/Excel (Shopify standard, custom StoreOrbit template,
 * or mixed URL / file templates with arbitrary column order) into a structured product list.
 */
export function parseProductsFromCsv(rows: any[]): ParseResult {
  const errors: { row: number; error: string }[] = [];
  const groupedProducts: Record<string, ParsedProduct> = {};

  rows.forEach((row, index) => {
    const rowNum = index + 1; // 1-indexed for user display

    // 1. Title with fallback for missing/damaged first column header
    const title =
      getNormalizedValue(row, [
        'title',
        'product name',
        'product_name',
        'name',
        'item name',
        '', // Fallback when first header is blank
      ]) || (row[''] !== undefined ? String(row['']).trim() : '');

    // 2. Handle / Product ID
    const handle = getNormalizedValue(row, ['handle', 'product_id', 'product id', 'id']);

    // 3. Description
    const description = getNormalizedValue(row, [
      'body (html)',
      'description',
      'body_html',
      'details',
      'body',
    ]);

    // 4. Vendor & Category
    const vendor = getNormalizedValue(row, ['vendor', 'brand', 'supplier']) || 'StoreOrbit';
    const productType = getNormalizedValue(row, ['type', 'product category', 'product type', 'category']);
    const collection = getNormalizedValue(row, ['collection', 'collections', 'product collection']);

    // 5. Tags
    const rawTags = getNormalizedValue(row, ['tags', 'product tags']);
    const tags = rawTags
      ? rawTags.split(',').map((t: string) => t.trim()).filter(Boolean)
      : [];

    // 6. Status
    let status = 'ACTIVE';
    const rawStatus = getNormalizedValue(row, ['status', 'product status']);
    if (rawStatus) {
      status = rawStatus.toUpperCase();
    } else {
      const published = getNormalizedValue(row, ['published']).toLowerCase();
      if (published === 'false' || published === '0' || published === 'no') {
        status = 'DRAFT';
      }
    }

    // 7. Image Resolution (Supports single "Image" column OR separate "Image URL" and "Image File" columns)
    let imageUrl = getNormalizedValue(row, [
      'image url',
      'image_url',
      'image uri',
      'image_uri',
      'image src',
      'image_src',
      'photo url',
      'photo_url',
      'image link',
    ]);

    let imageFile = getNormalizedValue(row, [
      'image file',
      'image_file',
      'filename',
      'file name',
      'photo file',
      'photo_file',
      'local photo',
    ]);

    // Check for a single combined "Image" or "Photo" column
    const singleImage = getNormalizedValue(row, [
      'image',
      'photo',
      'product image',
      'image url / file',
      'image file / url',
      'picture',
    ]);

    if (singleImage) {
      if (singleImage.startsWith('http://') || singleImage.startsWith('https://')) {
        if (!imageUrl) imageUrl = singleImage;
      } else {
        if (!imageFile) imageFile = singleImage;
      }
    }

    // Smart fallback: If imageUrl does not start with http(s)://, it is a local filename
    if (imageUrl && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      if (!imageFile) imageFile = imageUrl;
      imageUrl = '';
    }

    // Detect row-level conflict only if separate conflicting values were provided
    const hasImageConflict = Boolean(imageUrl && imageFile && imageUrl !== imageFile);

    // 9. Variant fields
    const rawPrice = getNormalizedValue(row, ['variant price', 'price', 'unit price', 'selling price']) || '0';
    const price = parseFloat(rawPrice);
    const sku = getNormalizedValue(row, ['variant sku', 'sku', 'item code', 'barcode']);

    const rawAvailable = getNormalizedValue(row, [
      'variant inventory qty',
      'available',
      'inventory quantity',
      'inventory_quantity',
      'qty',
      'stock',
    ]) || '0';
    const available = parseInt(rawAvailable, 10);

    const rawTracked = getNormalizedValue(row, [
      'variant inventory tracker',
      'inventory tracked',
      'inventory_tracked',
      'tracked',
    ]).toLowerCase();
    const inventoryTracked = rawTracked !== 'no' && rawTracked !== 'false' && rawTracked !== '0';

    if (!title && !handle) {
      errors.push({ row: rowNum, error: 'Missing Title or Handle' });
      return;
    }

    const groupingKey = handle || title;

    if (!title && !groupedProducts[groupingKey]) {
      errors.push({ row: rowNum, error: 'Missing Title for new product' });
    }
    if (isNaN(price) || price < 0) {
      errors.push({ row: rowNum, error: 'Invalid price' });
    }

    if (!groupedProducts[groupingKey]) {
      groupedProducts[groupingKey] = {
        handle,
        title: title || handle,
        descriptionHtml: description,
        tags,
        vendor,
        productType,
        status,
        collection,
        imageUrl: imageUrl || undefined,
        imageFile: imageFile || undefined,
        hasImageConflict,
        variants: [],
      };
    } else {
      if (!groupedProducts[groupingKey].imageUrl && imageUrl) {
        groupedProducts[groupingKey].imageUrl = imageUrl;
      }
      if (!groupedProducts[groupingKey].imageFile && imageFile) {
        groupedProducts[groupingKey].imageFile = imageFile;
      }
      if (hasImageConflict) {
        groupedProducts[groupingKey].hasImageConflict = true;
      }
    }

    // Option Names and Values
    const option1Name = getNormalizedValue(row, ['option1 name', 'option 1 name']) || 'Title';
    const option1Value = getNormalizedValue(row, ['option1 value', 'option 1 value']) || 'Default Title';
    const option2Name = getNormalizedValue(row, ['option2 name', 'option 2 name']);
    const option2Value = getNormalizedValue(row, ['option2 value', 'option 2 value']);
    const option3Name = getNormalizedValue(row, ['option3 name', 'option 3 name']);
    const option3Value = getNormalizedValue(row, ['option3 value', 'option 3 value']);

    groupedProducts[groupingKey].variants.push({
      sku,
      price: isNaN(price) ? '0' : price.toString(),
      option1Name,
      option1Value,
      option2Name,
      option2Value,
      option3Name,
      option3Value,
      inventoryQuantity: isNaN(available) ? 0 : available,
      inventoryTracked,
      imageUrl: imageUrl || undefined,
      imageFile: imageFile || undefined,
      hasImageConflict,
    });
  });

  return {
    products: Object.values(groupedProducts),
    errors,
  };
}
