import "@shopify/shopify-api/adapters/web-api";
import { webApiAdapterInitialized } from "@shopify/shopify-api/adapters/web-api";
import { shopifyApi, ApiVersion, DeliveryMethod } from "@shopify/shopify-api";
import { sessionStorage } from "./session-storage";
import { getAppHost } from "./app-url";

// This ensures the adapter import is not tree-shaken
console.log(`Shopify Web API Adapter Initialized: ${webApiAdapterInitialized}`);

const defaultScopes = "write_inventory,read_inventory,read_locations,read_products,write_products,read_publications,write_publications,write_discounts,read_discounts,read_orders";

export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY || "",
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  scopes: (process.env.SHOPIFY_SCOPES || defaultScopes).split(","),
  hostName: getAppHost(),
  apiVersion: ApiVersion.July26,
  isEmbeddedApp: true,
  sessionStorage,
});

shopify.webhooks.addHandlers({
  INVENTORY_LEVELS_UPDATE: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: "/api/webhooks/inventory-levels-update",
  },
  PRODUCTS_CREATE: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: "/api/webhooks/products-create",
  },
  PRODUCTS_UPDATE: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: "/api/webhooks/products-update",
  },
  PRODUCTS_DELETE: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: "/api/webhooks/products-delete",
  },
  APP_UNINSTALLED: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: "/api/webhooks/app-uninstalled",
  },
  ORDERS_CREATE: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: "/api/webhooks/orders-create",
  },
});
