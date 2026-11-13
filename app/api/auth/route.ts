import { NextRequest, NextResponse } from "next/server";
import { beginAuth } from "@/services/shopify";
import { getAppHost } from "@/lib/shopify/app-url";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get("shop");
  console.log("===== OAUTH START =====");
  console.log("Shop:", shop);
  console.log("Timestamp:", new Date().toISOString());

  if (!shop) {
    return new Response("Missing shop parameter", { status: 400 });
  }

  const host = req.nextUrl.searchParams.get("host");
  const embedded = req.nextUrl.searchParams.get("embedded");

  if (embedded === "1" || host) {
    const hostName = getAppHost(req);
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
    const response = await beginAuth(shop, req);
    const location = response.headers.get("location");

    if (location) {
      const redirectRes = NextResponse.redirect(location, 302);
      response.headers.forEach((val: string, key: string) => {
        if (key.toLowerCase() !== "location") {
          redirectRes.headers.set(key, val);
        }
      });
      return redirectRes;
    }

    return response;
  } catch (error: any) {
    console.error("[Install] auth.begin failed", {
      message: error?.message,
      stack: error?.stack,
    });
    return new Response(`Failed to start OAuth flow: ${error.message}`, { status: 500 });
  }
}
