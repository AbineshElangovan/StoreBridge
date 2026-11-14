import { prisma } from '@/lib/db/prisma';
import { getAdminClient } from '@/lib/shopify/admin';
import { setInventoryQuantity } from '@/lib/shopify/inventory';
import { createSyncLog } from '@/lib/shopify/sync-log';
import { linkConnectedProductMapping, findMappingByVariantId } from '@/services/product-mapping';
import {
  PRODUCT_SET_MUTATION, PRODUCT_DELETE_MUTATION, PRODUCT_VARIANTS_DELETE_MUTATION,
  GET_VARIANT_BY_SKU_QUERY, GET_PRODUCT_BY_ID_QUERY, LOCATIONS_QUERY,
  GET_PRODUCT_COLLECTIONS_QUERY, GET_COLLECTIONS_BY_TITLE_QUERY, CREATE_COLLECTION_MUTATION,
  ADD_PRODUCT_TO_COLLECTION_MUTATION, GET_PUBLICATIONS_QUERY, PUBLISH_MUTATION
} from './graphql';
import { syncProductCollectionsByTags } from './collection-sync';

export async function fetchDefaultLocation(shopDomain: string, fallbackInventoryItemId?: string | null): Promise<string | null> {
  try {
    // Strategy 0: Instant DB lookup - check if we already have a known Shopify location for this store
    try {
      const knownLoc = await prisma.variantMap.findFirst({
        where: {
          store: { shopDomain },
          locationId: { not: null }
        },
        select: { locationId: true }
      });
      if (knownLoc?.locationId) {
        return knownLoc.locationId;
      }
    } catch (dbErr: any) {
      console.warn(`[ProductSync] DB location lookup notice for ${shopDomain}:`, dbErr.message);
    }

    const client = await getAdminClient(shopDomain);

    // Strategy 1: If inventoryItemId is provided, check its existing inventoryLevel location
    if (fallbackInventoryItemId) {
      const formattedInvId = fallbackInventoryItemId.startsWith('gid://')
        ? fallbackInventoryItemId
        : `gid://shopify/InventoryItem/${fallbackInventoryItemId.replace(/\D/g, '') || fallbackInventoryItemId}`;

      try {
        const invRes: any = await client.request(`
          query getInvLocation($id: ID!) {
            inventoryItem(id: $id) {
              inventoryLevels(first: 5) {
                edges {
                  node {
                    location {
                      id
                    }
                  }
                }
              }
            }
          }
        `, { variables: { id: formattedInvId } });
        const locId = invRes?.data?.inventoryItem?.inventoryLevels?.edges?.[0]?.node?.location?.id ||
                      invRes?.inventoryItem?.inventoryLevels?.edges?.[0]?.node?.location?.id;
        if (locId) {
          return locId;
        }
      } catch (invErr: any) {
        console.warn(`[ProductSync] Could not resolve location from inventory item ${fallbackInventoryItemId}:`, invErr.message);
      }
    }

    // Strategy 2: Query store locations (with includeLegacy flag)
    try {
      const response: any = await client.request(`
        query getShopLocations {
          locations(first: 10, includeLegacy: true) {
            edges {
              node {
                id
                isActive
              }
            }
          }
        }
      `);
      const locEdges = response?.data?.locations?.edges || response?.locations?.edges || [];
      const activeLoc = locEdges.find((e: any) => e.node?.isActive !== false) || locEdges[0];
      if (activeLoc?.node?.id) {
        return activeLoc.node.id;
      }
    } catch (locErr: any) {
      console.warn(`[ProductSync] Direct locations query notice for ${shopDomain}:`, locErr.message);
    }

    // Strategy 3: Sample other products with inventory to discover the store's primary location
    try {
      const sampleRes: any = await client.request(`
        query getAnyInventoryLocation {
          products(first: 10) {
            edges {
              node {
                variants(first: 3) {
                  edges {
                    node {
                      inventoryItem {
                        inventoryLevels(first: 2) {
                          edges {
                            node {
                              location {
                                id
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `);
      const products = sampleRes?.data?.products?.edges || sampleRes?.products?.edges || [];
      for (const p of products) {
        for (const v of p.node?.variants?.edges || []) {
          const loc = v.node?.inventoryItem?.inventoryLevels?.edges?.[0]?.node?.location?.id;
          if (loc) return loc;
        }
      }
    } catch (sampleErr: any) {
      console.warn(`[ProductSync] Sample inventory location query notice for ${shopDomain}:`, sampleErr.message);
    }

    return null;
  } catch (error) {
    console.error(`[ProductSync] Failed to fetch location for ${shopDomain}:`, error);
    return null;
  }
}

export async function publishProductToAllChannels(shopDomain: string, productId: string) {
  try {
    const client = await getAdminClient(shopDomain);
    const pubResponse: any = await client.request(GET_PUBLICATIONS_QUERY);
    const publications = pubResponse?.data?.publications?.edges || [];

    if (publications.length === 0) return;

    const publicationInputs = publications.map((edge: any) => ({
      publicationId: edge.node.id
    }));

    const response: any = await client.request(PUBLISH_MUTATION, {
      variables: {
        id: productId,
        input: publicationInputs
      }
    });

    const userErrors = response?.data?.publishablePublish?.userErrors || [];
    if (userErrors.length > 0) {
      console.error(`[ProductSync:Publish] Failed to publish ${productId} in ${shopDomain}:`, userErrors);
    } else {
      console.log(`[ProductSync:Publish] Successfully published ${productId} to ${publications.length} channels in ${shopDomain}`);
    }
  } catch (error: any) {
    console.error(`[ProductSync:Publish] Error publishing ${productId} in ${shopDomain}:`, error.message);
  }
}

export async function findTargetProductBySku(shopDomain: string, sku: string) {
  try {
    const client = await getAdminClient(shopDomain);
    const response: any = await client.request(GET_VARIANT_BY_SKU_QUERY, {
      variables: { query: `sku:${sku}` },
    });
    const edges = response?.data?.productVariants?.edges || [];
    for (const edge of edges) {
      const node = edge.node;
      if (node.sku?.trim().toLowerCase() === sku.trim().toLowerCase()) {
        return {
          productId: node.product?.id,
          variantId: node.id,
          inventoryItemId: node.inventoryItem?.id,
          price: node.price,
        };
      }
    }
  } catch (error: any) {
    console.error(`[ProductSync:Lookup] SKU lookup failed for ${sku} in ${shopDomain}:`, error.message);
  }
  return null;
}
