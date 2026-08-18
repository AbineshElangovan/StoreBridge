import { shopifyFetch } from "@/lib/shopify/Client";

export function useAuthenticatedFetch() {
  return (uri: RequestInfo, options?: RequestInit) => shopifyFetch(uri, options);
}
