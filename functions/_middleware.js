export async function onRequest(context) {
  const url = new URL(context.request.url);
  const response = await context.next();

  if (url.pathname !== "/" && url.pathname !== "/index.html") return response;
  const type = response.headers.get("content-type") || "";
  if (!type.includes("text/html")) return response;

  return new HTMLRewriter()
    .on("head", {
      element(element) {
        element.append('<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png?v=2"><link rel="icon" type="image/png" sizes="180x180" href="/icons/apple-touch-icon.png?v=2"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="default"><meta name="apple-mobile-web-app-title" content="武汉中秋">', { html: true });
      }
    })
    .on("body", {
      element(element) {
        element.append('<script src="/prep-v6.js?v=6"></script>', { html: true });
      }
    })
    .transform(response);
}
