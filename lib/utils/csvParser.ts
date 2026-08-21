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
  variants: ParsedVariant[];
}

export interface ParseResult {
  products: ParsedProduct[];
  errors: { row: number; error: string }[];
}

/**
 * Normalizes rows from any CSV (Shopify standard or custom StoreBridge template)
 * into a structured product list.
 */
export function parseProductsFromCsv(rows: any[]): ParseResult {
  const errors: { row: number; error: string }[] = [];
  const groupedProducts: Record<string, ParsedProduct> = {};

  rows.forEach((row, index) => {
    const rowNum = index + 1; // 1-indexed for user
    
    // Support standard Shopify headers OR StoreBridge custom headers
    const title = row["Title"];
    const handle = row["Handle"] || "";
    const description = row["Body (HTML)"] || row["Description"] || "";
    const vendor = row["Vendor"] || "StoreBridge";
    const productType = row["Type"] || "";
    const collection = row["collection"] || row["Collection"] || "";
    const tags = row["Tags"] ? row["Tags"].split(',').map((t: string) => t.trim()).filter(Boolean) : [];
    let status = "ACTIVE";
    if (row["Status"]) {
      status = row["Status"].toUpperCase();
    } else if (row["Published"] && row["Published"].toString().toLowerCase() === "false") {
      status = "DRAFT";
    }

    // Variant fields
    const price = parseFloat(row["Variant Price"] || row["Price"] || "0");
    const sku = row["Variant SKU"] || row["SKU"] || "";
    const available = parseInt(row["Variant Inventory Qty"] || row["Available"] || row["Inventory quantity"] || "0", 10);
    const rawTracked = (row["Variant Inventory Tracker"] || row["Inventory tracked"] || "").toString().trim().toLowerCase();
    const inventoryTracked = rawTracked !== "no" && rawTracked !== "false" && rawTracked !== "0";

    if (!title && !handle) {
      errors.push({ row: rowNum, error: "Missing Title or Handle" });
      return;
    }
    
    const groupingKey = handle || title; // Group by handle if exists, else by title

    if (!title && !groupedProducts[groupingKey]) {
      // Title is required for the first row of a product
      errors.push({ row: rowNum, error: "Missing Title for new product" });
    }
    if (isNaN(price) || price < 0) {
      errors.push({ row: rowNum, error: "Invalid price" });
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
        variants: []
      };
    }

    groupedProducts[groupingKey].variants.push({
      sku,
      price: price.toString(),
      option1Name: row["Option1 Name"] || "Title",
      option1Value: row["Option1 Value"] || "Default Title",
      option2Name: row["Option2 Name"] || "",
      option2Value: row["Option2 Value"] || "",
      option3Name: row["Option3 Name"] || "",
      option3Value: row["Option3 Value"] || "",
      inventoryQuantity: available,
      inventoryTracked: inventoryTracked,
    });
  });

  return {
    products: Object.values(groupedProducts),
    errors
  };
}
