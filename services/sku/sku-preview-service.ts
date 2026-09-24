import { prisma } from "@/lib/db/prisma";
import { generateCartesianCombinations, VariantOptionInput } from "./variant-combinations";
import { matchCombinationsWithExisting, MatchedCombination } from "./variant-matcher";
import { generateSkusForCombinations } from "./sku-generator-engine";
import { validateVariantOptions, validateSkuUniqueness, ValidationErrorItem } from "./sku-validator";

export interface PreviewTableItem {
  id: string;
  options: Record<string, string>;
  title: string;
  generatedSku: string;
  existingSku?: string;
  status: "Existing" | "New";
  validationStatus: "VALID" | "DUPLICATE_SKU" | "SKU_EXISTS_DB";
  validationMessage?: string;
  price: number;
  inventoryQuantity: number;
  existingVariantId?: string;
}

export interface SkuPreviewResponse {
  success: boolean;
  product: {
    id: string;
    shopifyProductId: string;
    title: string;
  };
  optionNames: string[];
  totalCombinations: number;
  existingCount: number;
  newCount: number;
  duplicateSkuCount: number;
  items: PreviewTableItem[];
  validationErrors: ValidationErrorItem[];
  canApply: boolean;
}

export async function generateSkuPreview(
  storeId: string,
  shopifyProductId: string,
  options: VariantOptionInput[]
): Promise<SkuPreviewResponse> {
  // 1. Validate option inputs
  const validationErrors = validateVariantOptions(options);

  const cleanNumericId = shopifyProductId
    .replace(/^gid:\/\/shopify\/Product\//i, "")
    .replace(/^gid%3a%2f%2fshopify%2fproduct%2f/i, "")
    .split("/")
    .pop() || shopifyProductId;

  const matchConditions = [
    { id: shopifyProductId },
    { shopifyProductId: shopifyProductId },
    { shopifyProductId: cleanNumericId },
    { shopifyProductId: `gid://shopify/Product/${cleanNumericId}` },
    { shopifyProductId: { endsWith: cleanNumericId } },
  ];

  // 2. Fetch product and existing variants from DB with flexible ID matching
  const product = await prisma.productCache.findFirst({
    where: {
      storeId,
      OR: matchConditions,
    },
    include: {
      collections: {
        include: { collection: true },
      },
    },
  });

  if (!product) {
    throw new Error("Product not found in authorized store.");
  }

  const existingVariants = await prisma.productCache.findMany({
    where: {
      storeId,
      shopifyProductId: product.shopifyProductId,
    },
  });

  if (validationErrors.length > 0) {
    return {
      success: false,
      product: {
        id: product.id,
        shopifyProductId: product.shopifyProductId,
        title: product.title,
      },
      optionNames: options.map((o) => o.name).filter(Boolean),
      totalCombinations: 0,
      existingCount: 0,
      newCount: 0,
      duplicateSkuCount: 0,
      items: [],
      validationErrors,
      canApply: false,
    };
  }

  // 3. Generate Cartesian combinations
  const combinations = generateCartesianCombinations(options);

  // 4. Match against existing variants
  const matchedCombinations: MatchedCombination[] = matchCombinationsWithExisting(
    combinations,
    existingVariants
  );

  // 5. Generate candidate SKUs using base product title
  const baseProductTitle = (product.title ? product.title.split(" - ")[0].trim() : "Product") || "Product";
  const candidateSkus = await generateSkusForCombinations(
    storeId,
    baseProductTitle,
    combinations,
    product.collections[0]?.collectionId
  );

  // 6. Assign SKUs and check uniqueness
  const skusToCheck: string[] = [];
  const items: PreviewTableItem[] = matchedCombinations.map((combo, idx) => {
    const candidateSku = combo.existingSku || candidateSkus[idx] || `SKU-${idx + 1}`;
    skusToCheck.push(candidateSku);

    return {
      id: `preview-${idx + 1}`,
      options: combo.options,
      title: combo.title,
      generatedSku: candidateSku,
      status: combo.status,
      validationStatus: "VALID",
      price: combo.price || product.price || 0,
      inventoryQuantity: combo.inventoryQuantity || 0,
      existingVariantId: combo.existingVariantId,
    };
  });

  // 7. Validate SKU uniqueness in DB & request
  const uniquenessResult = await validateSkuUniqueness(skusToCheck, storeId, product.shopifyProductId);
  const dupRequestSet = new Set(uniquenessResult.duplicateInRequest.map((s) => s.toLowerCase()));
  const dupDbSet = new Set(uniquenessResult.duplicateInDb.map((s) => s.toLowerCase()));

  let duplicateSkuCount = 0;
  items.forEach((item) => {
    const lowerSku = item.generatedSku.toLowerCase();
    if (dupDbSet.has(lowerSku)) {
      item.validationStatus = "SKU_EXISTS_DB";
      item.validationMessage = `This SKU (${item.generatedSku}) already exists in your store.`;
      duplicateSkuCount++;
    } else if (dupRequestSet.has(lowerSku)) {
      item.validationStatus = "DUPLICATE_SKU";
      item.validationMessage = `Duplicate SKU (${item.generatedSku}) generated within current preview.`;
      duplicateSkuCount++;
    }
  });

  const existingCount = items.filter((i) => i.status === "Existing").length;
  const newCount = items.filter((i) => i.status === "New").length;
  const canApply = validationErrors.length === 0 && duplicateSkuCount === 0;

  return {
    success: true,
    product: {
      id: product.id,
      shopifyProductId: product.shopifyProductId,
      title: baseProductTitle,
    },
    optionNames: options.map((o) => o.name).filter(Boolean),
    totalCombinations: items.length,
    existingCount,
    newCount,
    duplicateSkuCount,
    items,
    validationErrors,
    canApply,
  };
}
