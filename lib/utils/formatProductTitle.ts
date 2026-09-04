/**
 * Utility to format and clean product titles for product detail views.
 * Removes redundant variant parameters (e.g. "- Blue / Medium", "(XL)", "- Red"),
 * collection prefixes, and converts slug strings into clean, concise names.
 */
export function getCleanProductName(
  title?: string | null,
  collection?: string | null
): string {
  if (!title || !title.trim()) return 'Product Details';

  let clean = title.trim();

  // 1. If string is a raw slug/handle (e.g., "baggy-pant" or "blue-denim-pant"), convert to readable title
  if (!clean.includes(' ') && clean.includes('-')) {
    clean = clean.replace(/[-_]+/g, ' ');
  }

  // 2. Remove variant suffixes like " - Blue / Medium", " - Navy / L", " - XL", " - Red"
  clean = clean.replace(
    /\s*[-–—]\s*(?:(?:[A-Z0-9\s,\\/]*(?:Small|Medium|Large|XL|XXL|XS|S|M|L|Red|Blue|Green|Black|White|Navy|Grey|Gray|Yellow|Pink|Purple|Brown|Beige|Orange|Maroon|Olive)[A-Z0-9\s,\\/]*)|(?:[A-Za-z0-9\s]+\/[A-Za-z0-9\s]+))\s*$/i,
    ''
  );

  // 3. Remove trailing parenthetical variants like "(Blue / Medium)" or "(Large)"
  clean = clean.replace(
    /\s*\([^)]*(?:Small|Medium|Large|XL|XXL|XS|S|M|L|Red|Blue|Green|Black|White|\/)[^)]*\)$/i,
    ''
  );

  // 4. Remove collection prefix if title starts with "CollectionName - " or "CollectionName:"
  if (collection && collection.trim()) {
    const colName = collection.trim();
    const prefixRegex = new RegExp(`^${colName}\\s*[-–—:]\\s*`, 'i');
    clean = clean.replace(prefixRegex, '');
  }

  // 5. Capitalize properly
  clean = clean.replace(/\b[a-z]/g, (char) => char.toUpperCase());

  return clean.trim() || title;
}
