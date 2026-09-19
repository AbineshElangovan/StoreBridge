import { prisma } from "@/lib/db/prisma";
import { GeneratedCombination } from "./variant-combinations";

export interface SkuGeneratorConfig {
  globalPrefix: string;
  storePrefix: string;
  startSequence: number;
  collectionPrefix?: string;
}

/**
 * Sanitizes option string values for clean SKU slugs.
 * Example: "Heather Grey / 10Y" -> "HGREY-10Y" or "BLACK-10Y"
 */
export function formatOptionSlug(optionValue: string): string {
  if (!optionValue) return "";
  return optionValue
    .trim()
    .toUpperCase()
    .replace(/[\s\/]+/g, "-")
    .replace(/[^A-Z0-9\-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Generates candidate SKUs for dynamic variant combinations.
 */
export async function generateSkusForCombinations(
  storeId: string,
  productTitle: string,
  combinations: GeneratedCombination[],
  collectionId?: string
): Promise<string[]> {
  const globalPrefix = "STB";

  // Load store SKU setting
  let setting = await prisma.storeSetting.findUnique({ where: { storeId } });
  if (!setting) {
    setting = await prisma.storeSetting.create({
      data: {
        storeId,
        skuPrefix: "SKU",
        skuSequence: 1,
        isSkuGenerationEnabled: true,
      },
    });
  }

  const storePrefix = setting.skuPrefix || "SKU";
  let currentSeq = setting.skuSequence || 1;

  // Check for Collection SKU rule if collectionId provided
  let colPrefix = "";
  if (collectionId) {
    const rule = await prisma.collectionSkuRule.findFirst({
      where: { storeId, collectionId, enabled: true },
      include: { collection: true },
    });
    if (rule) {
      if (rule.skuPrefix && rule.skuPrefix.trim()) {
        colPrefix = rule.skuPrefix.trim().toUpperCase();
      } else if (rule.collection?.title) {
        const words = rule.collection.title.trim().split(/[\s\-]+/).filter(Boolean);
        if (words.length === 1) {
          colPrefix = words[0].substring(0, 3).toUpperCase();
        } else if (words.length >= 2) {
          colPrefix = (words[0][0] + words[1].substring(0, 2)).toUpperCase();
        }
      }
    }
  }

  const skus: string[] = [];

  for (let i = 0; i < combinations.length; i++) {
    const combo = combinations[i];
    const comboValues = Object.values(combo.options)
      .map((val) => formatOptionSlug(val))
      .filter(Boolean);

    const comboSlug = comboValues.join("-");
    const seqStr = (currentSeq + i).toString().padStart(4, "0");

    let parts = [globalPrefix, storePrefix];
    if (colPrefix) parts.push(colPrefix);
    if (comboSlug) parts.push(comboSlug);
    parts.push(seqStr);

    skus.push(parts.join("-"));
  }

  return skus;
}
