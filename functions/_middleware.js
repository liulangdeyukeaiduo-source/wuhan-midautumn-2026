function noStore(response) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const response = await context.next();

  const freshAssets = new Set([
    "/sync-v10.js",
    "/prep-v6.js",
    "/responsive-v8.css",
    "/manifest.webmanifest",
    "/sw.js"
  ]);
  if (freshAssets.has(url.pathname)) return noStore(response);

  if (url.pathname !== "/" && url.pathname !== "/index.html") return response;
  const type = response.headers.get("content-type") || "";
  if (!type.includes("text/html")) return response;

  const transformed = new HTMLRewriter()
    .on('meta[name="viewport"]', {
      element(element) {
        element.setAttribute("content", "width=device-width, initial-scale=1, viewport-fit=cover");
      }
    })
    .on("head", {
      element(element) {
        element.append('<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png?v=3"><link rel="icon" type="image/png" sizes="180x180" href="/icons/apple-touch-icon.png?v=3"><link rel="stylesheet" href="/responsive-v8.css?v=8"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="default"><meta name="apple-mobile-web-app-title" content="武汉中秋"><meta name="format-detection" content="telephone=no">', { html: true });
      }
    })
    .on("body", {
      element(element) {
        element.append('<script src="/prep-v6.js?v=6"></script><script src="/sync-v10.js?v=10"></script>', { html: true });
      }
    })
    .transform(response);

  return noStore(transformed);
}
