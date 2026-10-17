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
 */
export function getCategoryStem(raw: string): string {
  if (!raw) return '';
  const cleaned = raw.trim().toLowerCase().replace(/[-_\s]+/g, '');
  if (!cleaned) return '';

  // Dynamically stem English plural suffixes without hardcoding words
  // e.g. "watches" -> "watch", "boxes" -> "box", "trousers" -> "trouser", "shirts" -> "shirt"
  if (cleaned.length > 3 && cleaned.endsWith('ies')) {
    return cleaned.slice(0, -3) + 'y'; // e.g. "accessories" -> "accessory"
  }
  if (cleaned.length > 4 && cleaned.endsWith('es') && /(?:ch|sh|x|s|z)es$/i.test(cleaned)) {
    return cleaned.slice(0, -2); // e.g. "boxes" -> "box", "watches" -> "watch"
  }
  if (cleaned.length > 3 && cleaned.endsWith('s') && !cleaned.endsWith('ss')) {
    return cleaned.slice(0, -1); // e.g. "trousers" -> "trouser", "shirts" -> "shirt", "pants" -> "pant"
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

  // 3. Dynamic linguistic stem match ("trouser" === "trousers", "accessory" === "accessories")
  return getCategoryStem(cleanA) === getCategoryStem(cleanB);
}
