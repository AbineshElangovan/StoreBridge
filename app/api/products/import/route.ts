import { NextRequest, NextResponse } from "next/server";
import { authenticate, handleApiError } from "@/lib/shopify/authenticate";
import { prisma } from "@/lib/db/prisma";
import { getAdminClient } from "@/lib/shopify/admin";
import { parseProductsFromCsv } from "@/lib/utils/csvParser";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { store } = await authenticate(req);
    
    const body = await req.json();
    const { rows, targetStoreId, action, filename } = body; // action can be 'validate' or 'import'

    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json({ success: false, error: "Invalid payload: missing rows" }, { status: 400 });
    }

    // Determine which store to import into
    const importStoreId = targetStoreId || store.id;
    
    // Make sure they have access to the target store
    if (importStoreId !== store.id) {
      const connection = await (prisma as any).storeConnection.findUnique({
        where: { sourceStoreId_targetStoreId: { sourceStoreId: store.id, targetStoreId: importStoreId } }
      });
      if (!connection) {
        return NextResponse.json({ success: false, error: "Unauthorized target store" }, { status: 403 });
      }
    }

    const targetStore = await prisma.store.findUnique({ where: { id: importStoreId } });
    if (!targetStore) {
      return NextResponse.json({ success: false, error: "Target store not found" }, { status: 404 });
    }

    // 1. Validation & Grouping via generic CSV Parser
    const { products: productsToImport, errors } = parseProductsFromCsv(rows);

    if (errors.length > 0) {
      // Per architectural rules, completely block if there's any error
      return NextResponse.json({ success: false, errors });
    }

    if (action === 'validate') {
      return NextResponse.json({ success: true, products: productsToImport, totalVariants: rows.length });
    }

    if (action === 'import') {
      // 2. Import into Shopify
      let successCount = 0;
      let failedCount = 0;
      const failedDetails: any[] = [];

      // Initialize Shopify Client ONCE before the loop
      const client = await getAdminClient(targetStore.shopDomain);

      // Fetch primary location and publications (sales channels) ONCE
      let locationId = "";
      let publications: any[] = [];
      try {
        const initResponse = await client.request(`
          query {
            locations(first: 1) {
              edges { node { id } }
            }
            publications(first: 10) {
              edges { node { id } }
            }
          }
        `);
        const initData = initResponse.data || initResponse;
        locationId = initData.locations.edges[0]?.node?.id;
        publications = initData.publications.edges.map((e: any) => ({ publicationId: e.node.id }));
      } catch (err) {
        console.error("Failed to fetch location and publications", err);
      }

      // Import in series to respect rate limits and follow rules safely
      for (const productData of productsToImport) {
        try {
          const productInput: any = {
            title: productData.title,
            descriptionHtml: productData.descriptionHtml,
            vendor: productData.vendor,
            productType: productData.productType,
            status: productData.status,
          };
          
          if (productData.handle) productInput.handle = productData.handle;
          
          if (productData.tags && productData.tags.length > 0) {
            productInput.tags = productData.tags;
          }

          // Extract all unique option names from variants (up to 3 options)
          const extractedOptions = new Set<string>();
          productData.variants.forEach((v: any) => {
            if (v.option1Name && v.option1Value && v.option1Value !== "Default Title") extractedOptions.add(v.option1Name);
            if (v.option2Name && v.option2Value) extractedOptions.add(v.option2Name);
            if (v.option3Name && v.option3Value) extractedOptions.add(v.option3Name);
          });

          const optionsList: any[] = [];
          for (const optName of Array.from(extractedOptions)) {
            const values = Array.from(
              new Set(
                productData.variants
                  .map((v: any) => {
                    if (v.option1Name === optName) return v.option1Value;
                    if (v.option2Name === optName) return v.option2Value;
                    if (v.option3Name === optName) return v.option3Value;
                    return null;
                  })
                  .filter(Boolean)
              )
            );
            optionsList.push({
              name: optName,
              values: values.map(val => ({ name: val }))
            });
          }
          if (optionsList.length > 0) {
            productInput.productOptions = optionsList;
          } else {
            // Shopify strictly requires productOptions if variants are provided
            productInput.productOptions = [{
              name: "Title",
              values: [{ name: "Default Title" }]
            }];
          }
          
          // Convert variants to productSet variant format
          productInput.variants = productData.variants.map((v: any) => {
            const variantInput: any = {
              price: v.price?.toString(),
              sku: v.sku, // StoreBridge SKU generator fallback should ideally happen here if sku is empty
              inventoryItem: v.inventoryTracked ? { tracked: true } : undefined, // Tell Shopify to track inventory
              inventoryQuantities: (v.inventoryQuantity > 0 && locationId) ? [{
                locationId: locationId,
                name: "available",
                quantity: v.inventoryQuantity
              }] : undefined
            };
            
            // Clean up undefined fields
            if (!variantInput.inventoryItem) delete variantInput.inventoryItem;
            if (!variantInput.inventoryQuantities) delete variantInput.inventoryQuantities;

            const optValues: any[] = [];
            if (v.option1Name && v.option1Value && v.option1Value !== "Default Title") {
              optValues.push({ name: v.option1Value, optionName: v.option1Name });
            }
            if (v.option2Name && v.option2Value) {
              optValues.push({ name: v.option2Value, optionName: v.option2Name });
            }
            if (v.option3Name && v.option3Value) {
              optValues.push({ name: v.option3Value, optionName: v.option3Name });
            }

            if (optValues.length > 0) {
              variantInput.optionValues = optValues;
            } else {
              // Shopify productSet mutation strictly requires optionValues even for default variants
              variantInput.optionValues = [
                { name: "Default Title", optionName: "Title" }
              ];
            }
            return variantInput;
          });

          // GraphQL mutation to create product using productSet (Required in API 2024-04+)
          const query = `
            mutation productSet($synchronous: Boolean!, $input: ProductSetInput!) {
              productSet(synchronous: $synchronous, input: $input) {
                product {
                  id
                  title
                  handle
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `;

          // Client is already initialized above
          
          const response = await client.request(query, {
            variables: { synchronous: true, input: productInput }
          });

          // @ts-ignore - The Shopify client returns the GraphQL data directly
          const data = response.data || response;
          
          if (data.productSet?.userErrors?.length > 0) {
            failedCount++;
            failedDetails.push({ handle: productData.handle, errors: data.productSet.userErrors });
          } else {
            successCount++;
            
                // Explicitly publish to all Sales Channels if Active
                if (productData.status === 'ACTIVE' && publications.length > 0 && data.productSet?.product?.id) {
                  try {
                    await client.request(`
                      mutation publishablePublish($id: ID!, $input: [PublicationInput!]!) {
                        publishablePublish(id: $id, input: $input) {
                          userErrors { field message }
                        }
                      }
                    `, {
                      variables: {
                        id: data.productSet.product.id,
                        input: publications
                      }
                    });
                  } catch (pubErr) {
                    console.error("Failed to publish to all channels (You likely need to add 'read_publications,write_publications' to SHOPIFY_SCOPES in .env and reconnect the store):", pubErr);
                  }
                }
          }
        } catch (err: any) {
          failedCount++;
          // @shopify/shopify-api GraphqlQueryError returns errors in err.response.errors
          const apiErrors = err.response?.errors || [{ message: err.message }];
          failedDetails.push({ handle: productData.handle, errors: apiErrors });
        }
      }

      // 3. Log Activity to central log
      try {
        if (!prisma.activityLog) {
          console.error("CRITICAL: prisma.activityLog is undefined! Prisma keys:", Object.keys(prisma));
        } else {
          await prisma.activityLog.create({
            data: {
              storeId: targetStore.id,
              eventType: 'CREATE',
              productTitle: 'Bulk Import',
              description: `${successCount} products imported via CSV.`,
            }
          });
        }
      } catch (err: any) {
        console.error("Failed to log activity:", err);
      }

      // 4. Log to ImportHistory
      try {
        if (!prisma.importHistory) {
          console.error("CRITICAL: prisma.importHistory is undefined! Prisma keys:", Object.keys(prisma));
        } else {
          await prisma.importHistory.create({
            data: {
              storeId: targetStore.id,
              filename: filename || 'unknown.csv',
              totalProducts: productsToImport.length,
              successCount,
              failedCount,
              skippedCount: 0,
              status: failedCount === 0 ? 'SUCCESS' : (successCount === 0 ? 'FAILED' : 'PARTIAL'),
            }
          });
        }
      } catch (err: any) {
        console.error("Failed to log import history:", err);
      }

      return NextResponse.json({ 
        success: true, 
        result: {
          totalProducts: productsToImport.length,
          successCount,
          failedCount,
          failedDetails
        }
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });

  } catch (err: any) {
    console.error("[Products Import API] Error:", err);
    return handleApiError(err);
  }
}
