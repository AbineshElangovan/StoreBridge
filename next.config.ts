import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client"],
  outputFileTracingRoot: path.join(__dirname, "./"),
  async headers() {
    return [
      {
        // Apply to every route
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "frame-ancestors",
              "https://*.myshopify.com",
              "https://admin.shopify.com",
              "https://*.devtunnels.ms",
              "https://*.spin.dev",
            ].join(" "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
