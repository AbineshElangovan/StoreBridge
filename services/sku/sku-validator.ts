import { prisma } from "@/lib/db/prisma";
import { VariantOptionInput } from "./variant-combinations";

export interface ValidationErrorItem {
  field?: string;
  message: string;
  type: "OPTION_NAME_EMPTY" | "OPTION_DUPLICATE" | "VALUE_EMPTY" | "VALUE_DUPLICATE" | "SKU_DUPLICATE" | "SKU_EXISTS_DB" | "GENERAL";
}

/**
 * Validates variant option configurations before preview generation.
 * If options array is empty, allows fallback to Global SKU generation.
 */
export function validateVariantOptions(options: VariantOptionInput[]): ValidationErrorItem[] {
  const errors: ValidationErrorItem[] = [];
  const seenNames = new Set<string>();

  if (!options || options.length === 0) {
    // Empty options array is allowed for Global SKU fallback
    return errors;
  }

  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    const nameTrimmed = opt.name ? opt.name.trim() : "";

    if (!nameTrimmed) {
      errors.push({
        field: `Option #${i + 1}`,
        message: `Option name #${i + 1} cannot be empty.`,
        type: "OPTION_NAME_EMPTY",
      });
      continue;
    }

    const nameLower = nameTrimmed.toLowerCase();
    if (seenNames.has(nameLower)) {
      errors.push({
        field: nameTrimmed,
        message: `Duplicate option name "${nameTrimmed}". Option names must be unique.`,
        type: "OPTION_DUPLICATE",
      });
    } else {
      seenNames.add(nameLower);
    }

    if (!opt.values || opt.values.length === 0) {
      errors.push({
        field: nameTrimmed,
        message: `Option "${nameTrimmed}" must have at least one value.`,
        type: "VALUE_EMPTY",
      });
      continue;
    }

    const seenValues = new Set<string>();
    for (const val of opt.values) {
      const valTrimmed = val ? val.trim() : "";
      if (!valTrimmed) {
        errors.push({
          field: nameTrimmed,
          message: `Option "${nameTrimmed}" contains empty values.`,
          type: "VALUE_EMPTY",
        });
        continue;
      }

      const valLower = valTrimmed.toLowerCase();
      if (seenValues.has(valLower)) {
        errors.push({
          field: nameTrimmed,
          message: `Duplicate value "${valTrimmed}" in option "${nameTrimmed}".`,
          type: "VALUE_DUPLICATE",
        });
      } else {
        seenValues.add(valLower);
      }
    }
  }

  return errors;
}

/**
 * Checks SKU uniqueness in current request and against PostgreSQL database.
 */
export async function validateSkuUniqueness(
  skus: string[],
  storeId: string,
  excludeProductId?: string
): Promise<{ duplicateInRequest: string[]; duplicateInDb: string[] }> {
  const cleanSkus = skus.map((s) => s.trim()).filter(Boolean);
  const seenSkus = new Set<string>();
  const duplicateInRequestSet = new Set<string>();

  for (const sku of cleanSkus) {
    const lower = sku.toLowerCase();
    if (seenSkus.has(lower)) {
      duplicateInRequestSet.add(sku);
    } else {
      seenSkus.add(lower);
    }
  }

  if (cleanSkus.length === 0) {
    return { duplicateInRequest: [], duplicateInDb: [] };
  }

  let excludeCondition: any = {};
  if (excludeProductId) {
    const cleanNumericId = excludeProductId
      .replace(/^gid:\/\/shopify\/Product\//i, "")
      .replace(/^gid%3a%2f%2fshopify%2fproduct%2f/i, "")
      .split("/")
      .pop() || excludeProductId;

    excludeCondition = {
      NOT: {
        OR: [
          { id: excludeProductId },
          { shopifyProductId: excludeProductId },
          { shopifyProductId: cleanNumericId },
          { shopifyProductId: `gid://shopify/Product/${cleanNumericId}` },
          { shopifyProductId: { endsWith: cleanNumericId } },
        ],
      },
    };
  }

  // Find any existing SKUs in PostgreSQL ProductCache for this store outside the current product
  const existingInDb = await prisma.productCache.findMany({
    where: {
      storeId,
      sku: { in: cleanSkus },
      ...excludeCondition,
    },
    select: { sku: true },
  });

  const duplicateInDb = existingInDb.map((p) => p.sku!).filter(Boolean);

  return {
    duplicateInRequest: Array.from(duplicateInRequestSet),
    duplicateInDb,
  };
}
