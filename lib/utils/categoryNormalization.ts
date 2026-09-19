/**
 * Dynamic Tag and Collection Normalization Utility.
 * 
 * Converts raw tags or collection titles into standardized collection names regardless of:
 * - Casing ("t-shirt", "T-Shirt", "T-SHIRT", "T Shirt")
 * - Spaces/Hyphens ("t-shirts", "tshirts", "t shirts")
 * - Singular / Plural ("shirt" vs "shirts", "pant" vs "pants", "accessory" vs "accessories")
 * - Any new custom tags (automatically capitalized into UPPERCASE)
 */

export function normalizeTagOrCollection(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  
  // Normalize string by stripping hyphens, underscores, spaces and converting to lowercase
  const normalized = trimmed.toLowerCase().replace(/[-_\s]+/g, '');

  // 1. T-Shirts: tshirt, tshirts, t-shirt, t-shirts, t shirt, tee, tees
  if (normalized.startsWith('tshirt') || normalized === 'tee' || normalized === 'tees') {
    return 'T-SHIRTS';
  }

  // 2. Shirts (only exact shirt/shirts, avoiding t-shirt which was caught above)
  if (normalized === 'shirt' || normalized === 'shirts') {
    return 'SHIRTS';
  }

  // 3. Inners: inner, inners, underwear
  if (normalized === 'inner' || normalized === 'inners' || normalized === 'underwear') {
    return 'INNERS';
  }

  // 4. Pants: pant, pants
  if (normalized === 'pant' || normalized === 'pants') {
    return 'PANTS';
  }

  // 5. Trousers: trouser, trousers
  if (normalized === 'trouser' || normalized === 'trousers') {
    return 'TROUSERS';
  }

  // 6. Mens Accessories: accessory, accessories, mensaccessories, menaccessories
  if (
    normalized.includes('accessori') ||
    normalized.includes('accessory') ||
    normalized === 'mensaccessories' ||
    normalized === 'menaccessories'
  ) {
    return 'MENS ACCESSORIES';
  }

  // 7. Shoes: shoe, shoes, footwear
  if (normalized === 'shoe' || normalized === 'shoes' || normalized === 'footwear') {
    return 'SHOES';
  }

  // 8. Socks: sock, socks
  if (normalized === 'sock' || normalized === 'socks') {
    return 'SOCKS';
  }

  // Exact fallback map for any specific legacy string key
  const TAG_MAP: Record<string, string> = {
    'inner': 'INNERS',
    'inners': 'INNERS',
    'pant': 'PANTS',
    'pants': 'PANTS',
    'shirt': 'SHIRTS',
    'shirts': 'SHIRTS',
    'tshirt': 'T-SHIRTS',
    'tshirts': 'T-SHIRTS',
    't-shirt': 'T-SHIRTS',
    't-shirts': 'T-SHIRTS',
    'accessory': 'MENS ACCESSORIES',
    'accessories': 'MENS ACCESSORIES',
    'mens accessories': 'MENS ACCESSORIES',
    'shoe': 'SHOES',
    'shoes': 'SHOES',
    'sock': 'SOCKS',
    'socks': 'SOCKS',
    'trouser': 'TROUSERS',
    'trousers': 'TROUSERS',
  };

  const lowerRaw = trimmed.toLowerCase();
  if (TAG_MAP[lowerRaw]) {
    return TAG_MAP[lowerRaw];
  }

  // If already uppercase (e.g., custom collection title "CASUAL WEAR"), keep exact title
  if (trimmed === trimmed.toUpperCase()) {
    return trimmed;
  }

  // Default fallback for any other tag: uppercase string (e.g. "Jacket" -> "JACKET")
  return trimmed.toUpperCase();
}
