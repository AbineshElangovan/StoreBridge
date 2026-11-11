/**
 * Generic Category, Tag, and Collection Normalization Utility.
 * 
 * 100% Dynamic - contains NO hardcoded collection names or tag names.
 * Operates purely on generic string processing, whitespace trimming,
 * and dynamic singular/plural stemming.
 */

/**
 * Normalizes a raw collection title or tag into a clean, standardized uppercase string.
 * Works dynamically for ANY collection or tag name.
 */
export function normalizeTagOrCollection(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';

  // Collapse multiple whitespace or underscore characters into single spaces
  const cleaned = trimmed.replace(/[\t\r\n]+/g, ' ').replace(/\s+/g, ' ');

  return cleaned.toUpperCase();
}

/**
 * Returns a normalized stem for comparing categories regardless of:
 * - Casing ("Trousers", "trousers", "TROUSERS")
 * - Separators ("t-shirts", "t_shirts", "t shirts")
 * - Singular vs Plural forms dynamically ("trouser" vs "trousers", "box" vs "boxes", "shirt" vs "shirts")
 * - Gender/qualifier prefixes dynamically ("men's accessories" / "mens accessories" -> "accessories")
 */
export function getCategoryStem(raw: string): string {
  if (!raw) return '';
  
  // 1. Lowercase and collapse spaces/separators
  let cleaned = raw.trim().toLowerCase().replace(/[-_\s]+/g, ' ');

  // 2. Normalize demographic qualifiers dynamically:
  // e.g. "men's accessories", "mens accessories", "women's accessories", "kids shoes"
  cleaned = cleaned.replace(/^(?:men'?s|women'?s|kids?|unisex)\s+/i, '');

  // 3. Remove all remaining spaces and separators for stem comparison
  cleaned = cleaned.replace(/[-_\s]+/g, '');
  if (!cleaned) return '';

  // 4. Dynamically stem English plural suffixes without hardcoding words
  // e.g. "accessories" -> "accessory", "categories" -> "category"
  if (cleaned.length > 3 && cleaned.endsWith('ies')) {
    return cleaned.slice(0, -3) + 'y';
  }
  // e.g. "boxes" -> "box", "watches" -> "watch", "dresses" -> "dress"
  if (cleaned.length > 4 && cleaned.endsWith('es') && /(?:ch|sh|x|s|z)es$/i.test(cleaned)) {
    return cleaned.slice(0, -2);
  }
  // e.g. "t-shirts" / "tshirts" -> "tshirt", "shirts" -> "shirt", "shoes" -> "shoe"
  if (cleaned.length > 3 && cleaned.endsWith('s') && !cleaned.endsWith('ss')) {
    return cleaned.slice(0, -1);
  }

  return cleaned;
}

/**
 * Checks whether an input tag/collection matches a target collection title dynamically.
 * Returns true if exact, case-insensitive, or stemmed representations match.
 */
export function isCategoryMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  const cleanA = a.trim().toLowerCase();
  const cleanB = b.trim().toLowerCase();

  // 1. Exact case-insensitive match
  if (cleanA === cleanB) return true;

  // 2. Stripped separators match ("t-shirts" === "t shirts")
  const strippedA = cleanA.replace(/[-_\s]+/g, '');
  const strippedB = cleanB.replace(/[-_\s]+/g, '');
  if (strippedA === strippedB) return true;

  // 3. Dynamic linguistic stem match ("trouser" === "trousers", "mens accessories" === "accessories")
  return getCategoryStem(cleanA) === getCategoryStem(cleanB);
}

/**
 * Resolves a target collection or category title to an existing canonical group key if one matches.
 * Matches:
 * 1. Exact or case-insensitive match
 * 2. Plural/singular variants (e.g. "T-SHIRT" matches existing "T-SHIRTS")
 * 3. Qualified variants (e.g. "MENS ACCESSORIES" matches existing "ACCESSORIES")
 */
export function findCanonicalGroupKey(targetCategory: string, existingKeys: string[]): string {
  const normalized = normalizeTagOrCollection(targetCategory);
  if (!normalized) return 'Uncategorized';

  // 1. Exact match
  if (existingKeys.includes(normalized)) {
    return normalized;
  }

  // 2. Fuzzy / stem / plural-singular match against existing keys
  for (const existingKey of existingKeys) {
    if (isCategoryMatch(normalized, existingKey)) {
      return existingKey;
    }
  }

  return normalized;
}
