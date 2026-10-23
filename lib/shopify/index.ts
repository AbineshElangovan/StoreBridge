import "@shopify/shopify-api/adapters/web-api";
import { webApiAdapterInitialized } from "@shopify/shopify-api/adapters/web-api";
import { shopifyApi, ApiVersion, DeliveryMethod } from "@shopify/shopify-api";
import { sessionStorage } from "./session-storage";

import fs from "fs";
import path from "path";

// Extract hostName from SHOPIFY_APP_URL env var, or shopify.app.toml as fallback
function getAppHostName(): string {
  // When running on Vercel, guarantee production domain is used (never a stale devtunnel)
  if (process.env.VERCEL) {
    if (process.env.SHOPIFY_APP_URL && !process.env.SHOPIFY_APP_URL.includes("devtunnels.ms") && !process.env.SHOPIFY_APP_URL.includes("localhost")) {
      return process.env.SHOPIFY_APP_URL.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    }
    return "store-bridge-yemi.vercel.app";
  }

  if (process.env.SHOPIFY_APP_URL) {
    return process.env.SHOPIFY_APP_URL.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  }
  try {
    const rootDir = process.cwd();
    const files = fs.readdirSync(rootDir);
    // Find customized configs like shopify.app.eshan-coimbatore-store.toml
    const activeToml = files.find(f => f.startsWith("shopify.app.") && f.endsWith(".toml") && f !== "shopify.app.toml") || "shopify.app.toml";
    const tomlPath = path.join(rootDir, activeToml);
    if (fs.existsSync(tomlPath)) {
      const content = fs.readFileSync(tomlPath, "utf8");
      const match = content.match(/application_url\s*=\s*"([^"]+)"/);
      if (match && match[1]) {
        return match[1].replace(/^https?:\/\//, "");
      }
    }
  } catch (error) {
    console.error("Error reading shopify.app config:", error);
  }
  return "";
}

// This ensures the adapter import is not tree-shaken
console.log(`Shopify Web API Adapter Initialized: ${webApiAdapterInitialized}`);
export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  scopes: process.env.SHOPIFY_SCOPES!.split(","),
  hostName: getAppHostName(),
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