import { NextRequest, NextResponse } from "next/server";
import { beginAuth } from "@/services/shopify";
import { shopify } from "@/lib/shopify";

export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get("shop");
  console.log("===== OAUTH START =====");
  console.log("Shop:", shop);
  console.log("Timestamp:", new Date().toISOString());
  
  console.log("[Install] auth route hit", { 
    shop, 
    url: req.url,
    host: req.headers.get("host"),
    forwardedHost: req.headers.get("x-forwarded-host"),
    forwardedProto: req.headers.get("x-forwarded-proto")
  });

  if (!shop) {
    console.log("[Install] missing shop parameter");
    return new Response("Missing shop parameter", { status: 400 });
  }

  const host = req.nextUrl.searchParams.get("host");
  const embedded = req.nextUrl.searchParams.get("embedded");

  if (embedded === "1" || host) {
    console.log("[Install] Iframe detected in /api/auth. Returning HTML breakout redirect to top-level.");
    const hostName = shopify.config.hostName || req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
    const topRedirectUrl = `https://${hostName}/api/auth?shop=${encodeURIComponent(shop)}`;
    
    return new Response(
      `<!DOCTYPE html>
      <html>
        <head>
          <meta http-equiv="refresh" content="0; url=${topRedirectUrl}" />
          <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
          <script type="text/javascript">
            function redirectTop() {
              if (window.shopify && typeof window.shopify.open === "function") {
                window.shopify.open("${topRedirectUrl}", "_top");
              } else {
                var link = document.getElementById("redir-link");
                if (link) link.click();
              }
            }
            if (document.readyState === "loading") {
              document.addEventListener("DOMContentLoaded", redirectTop);
            } else {
              redirectTop();
            }
          </script>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f6f6f7;">
          <div style="text-align: center;">
            <p style="color: #6d7175; font-size: 14px; margin-bottom: 12px;">Redirecting to Shopify authorization...</p>
            <a id="redir-link" href="${topRedirectUrl}" target="_top" style="display: inline-block; padding: 8px 16px; background: #008060; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13px;">
              Click here to continue
            </a>
          </div>
        </body>
      </html>`,
      {
        headers: {
          "Content-Type": "text/html",
        },
      }
    );
  }

  try {
    console.log("[OAuthStart] Incoming request URL:", req.url);
    console.log("[OAuthStart] Shop domain:", shop);
    console.log("[Install] Invoking beginAuth for shop:", shop);
    const response = await beginAuth(shop, req);
    
    const location = response.headers.get("location") || "";
    const stateMatch = location.match(/state=([^&]+)/);
    const state = stateMatch ? stateMatch[1] : "not found";
    console.log("[OAuthStart] Generated OAuth state:", state);
    console.log("[OAuthStart] Redirect URL:", location);
    console.log("[OAuthStart] Set-Cookie headers:", response.headers.getSetCookie());
    console.log("[Install] auth.begin successful redirect", { status: response.status, headers: [...response.headers.entries()] });
    return response;
  } catch (error: any) {
    console.error("[Install] auth.begin failed", {
      message: error?.message,
      stack: error?.stack,
    });
    return new Response(`Failed to start OAuth flow: ${error.message}`, { status: 500 });
  }
}