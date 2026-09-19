export interface ColorItem {
  name: string;
  category: "Standard" | "Default entries" | "Patterns & Prints";
  hex?: string;
  isPattern?: boolean;
  patternType?:
    | "animal"
    | "camouflage"
    | "checkered"
    | "dots"
    | "floral"
    | "multicolor"
    | "plaid"
    | "rainbow"
    | "striped"
    | "geometric"
    | "clear";
}

export const PREDEFINED_COLORS: ColorItem[] = [
  // Standard Top Entries
  { name: "Black", category: "Standard", hex: "#000000" },
  { name: "Clear", category: "Standard", isPattern: true, patternType: "clear" },
  { name: "Green", category: "Standard", hex: "#00B050" },
  { name: "Blue", category: "Standard", hex: "#0066FF" },
  { name: "Navy", category: "Standard", hex: "#1B1B87" },
  { name: "White", category: "Standard", hex: "#FFFFFF" },
  { name: "Gray", category: "Standard", hex: "#808080" },
  { name: "Brown", category: "Standard", hex: "#8B4513" },
  { name: "Gold", category: "Standard", hex: "#D4AF37" },
  { name: "Red", category: "Standard", hex: "#EF4444" },
  { name: "Beige", category: "Standard", hex: "#F5F5DC" },

  // Default entries
  { name: "Bronze", category: "Default entries", hex: "#CD7F32" },
  { name: "Orange", category: "Default entries", hex: "#FF8C00" },
  { name: "Pink", category: "Default entries", hex: "#FFC0CB" },
  { name: "Purple", category: "Default entries", hex: "#9333EA" },
  { name: "Rose gold", category: "Default entries", hex: "#B76E79" },
  { name: "Silver", category: "Default entries", hex: "#C0C0C0" },
  { name: "Yellow", category: "Default entries", hex: "#FFE600" },

  // Patterns & Prints
  { name: "Animal", category: "Patterns & Prints", isPattern: true, patternType: "animal" },
  { name: "Camouflage", category: "Patterns & Prints", isPattern: true, patternType: "camouflage" },
  { name: "Checkered", category: "Patterns & Prints", isPattern: true, patternType: "checkered" },
  { name: "Dots", category: "Patterns & Prints", isPattern: true, patternType: "dots" },
  { name: "Floral", category: "Patterns & Prints", isPattern: true, patternType: "floral" },
  { name: "Multicolor", category: "Patterns & Prints", isPattern: true, patternType: "multicolor" },
  { name: "Plaid", category: "Patterns & Prints", isPattern: true, patternType: "plaid" },
  { name: "Rainbow", category: "Patterns & Prints", isPattern: true, patternType: "rainbow" },
  { name: "Striped", category: "Patterns & Prints", isPattern: true, patternType: "striped" },
  { name: "Geometric", category: "Patterns & Prints", isPattern: true, patternType: "geometric" },
];

/**
 * Returns metadata (hex, isPattern, patternType) for any color string.
 * Supports custom colors (e.g. "Midnight Teal") and known defaults.
 */
export function getColorMetadata(colorName: string): Partial<ColorItem> {
  const normalized = colorName.trim().toLowerCase();
  const found = PREDEFINED_COLORS.find((c) => c.name.toLowerCase() === normalized);
  if (found) return found;

  // Additional aliases & standard web color fallbacks
  if (normalized.includes("navy")) return { hex: "#1B1B87" };
  if (normalized.includes("black")) return { hex: "#000000" };
  if (normalized.includes("white")) return { hex: "#FFFFFF" };
  if (normalized.includes("rose gold") || normalized.includes("rosegold")) return { hex: "#B76E79" };
  if (normalized.includes("pink")) return { hex: "#FFC0CB" };
  if (normalized.includes("purple")) return { hex: "#9333EA" };
  if (normalized.includes("red")) return { hex: "#EF4444" };
  if (normalized.includes("green")) return { hex: "#00B050" };
  if (normalized.includes("blue")) return { hex: "#0066FF" };
  if (normalized.includes("yellow")) return { hex: "#FFE600" };
  if (normalized.includes("orange")) return { hex: "#FF8C00" };
  if (normalized.includes("grey") || normalized.includes("gray")) return { hex: "#808080" };
  if (normalized.includes("silver")) return { hex: "#C0C0C0" };
  if (normalized.includes("gold")) return { hex: "#D4AF37" };
  if (normalized.includes("bronze")) return { hex: "#CD7F32" };
  if (normalized.includes("beige")) return { hex: "#F5F5DC" };
  if (normalized.includes("brown")) return { hex: "#8B4513" };
  if (normalized.includes("teal")) return { hex: "#0D9488" };
  if (normalized.includes("maroon") || normalized.includes("burgundy")) return { hex: "#800000" };
  if (normalized.includes("olive")) return { hex: "#556B2F" };
  if (normalized.includes("coral")) return { hex: "#FF7F50" };
  if (normalized.includes("turquoise") || normalized.includes("cyan")) return { hex: "#40E0D0" };
  if (normalized.includes("lavender") || normalized.includes("lilac")) return { hex: "#E6E6FA" };
  if (normalized.includes("peach")) return { hex: "#FFDAB9" };
  if (normalized.includes("mint")) return { hex: "#98FF98" };
  if (normalized.includes("mustard")) return { hex: "#FFDB58" };
  if (normalized.includes("camo") || normalized.includes("camouflage")) return { isPattern: true, patternType: "camouflage" };
  if (normalized.includes("stripe")) return { isPattern: true, patternType: "striped" };
  if (normalized.includes("dot")) return { isPattern: true, patternType: "dots" };
  if (normalized.includes("floral") || normalized.includes("flower")) return { isPattern: true, patternType: "floral" };
  if (normalized.includes("rainbow")) return { isPattern: true, patternType: "rainbow" };
  if (normalized.includes("check")) return { isPattern: true, patternType: "checkered" };

  // Fallback: Generate deterministic hash color hex for unmapped custom colors so every custom color gets a unique swatch!
  let hash = 0;
  for (let i = 0; i < colorName.length; i++) {
    hash = colorName.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = "#";
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xff;
    color += ("00" + value.toString(16)).substring(2);
  }
  return { hex: color };
}
