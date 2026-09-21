import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "localhost:3000",
    "127.0.0.1:3000",
    "*.devtunnels.ms",
    "*.loca.lt",
    "*.trycloudflare.com",
    "*.ngrok-free.app",
    "*.ngrok-free.dev",
    "dz50mdfc-3000.inc1.devtunnels.ms",
    "richmond-architectural-ellen-associate.trycloudflare.com",
    "respondent-seniors-disclaimer-hung.trycloudflare.com",
  ],
  serverExternalPackages: ["@prisma/client"],
  outputFileTracingRoot: path.join(__dirname, "./"),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.shopify.com',
      },
      {
        protocol: 'https',
        hostname: '*.shopify.com',
      },
    ],
  },
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
              "'self'",
              "https://*.myshopify.com",
              "https://admin.shopify.com",
              "https://*.devtunnels.ms",
              "https://*.trycloudflare.com",
              "https://*.ngrok-free.app",
              "https://*.ngrok-free.dev",
              "https://*.loca.lt",
              "https://*.spin.dev",
            ].join(" "),
          },
          {
            // Override Next.js default SAMEORIGIN which blocks Shopify admin iframe
            key: "X-Frame-Options",
            value: "ALLOWALL",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
