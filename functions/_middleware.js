export async function onRequest(context) {
  const url = new URL(context.request.url);
  const response = await context.next();

  if (url.pathname !== "/" && url.pathname !== "/index.html") return response;
  const type = response.headers.get("content-type") || "";
  if (!type.includes("text/html")) return response;

  return new HTMLRewriter()
    .on('meta[name="viewport"]', {
      element(element) {
        element.setAttribute("content", "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover");
      }
    })
    .on("head", {
      element(element) {
        element.append('<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png?v=3"><link rel="icon" type="image/png" sizes="180x180" href="/icons/apple-touch-icon.png?v=3"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="default"><meta name="apple-mobile-web-app-title" content="武汉中秋"><meta name="format-detection" content="telephone=no"><style>html{-webkit-text-size-adjust:100%;text-size-adjust:100%;overflow-x:hidden}body{width:100%;min-width:100%;overflow-x:hidden}.app{width:100%!important;max-width:402px!important;min-width:0!important}input,textarea,select{font-size:16px!important}.dock{width:calc(100% - 32px)!important;max-width:370px!important}</style>', { html: true });
      }
    })
    .on("body", {
      element(element) {
        element.append('<script src="/prep-v6.js?v=6"></script><script src="/sync-v7.js?v=7"></script>', { html: true });
      }
    })
    .transform(response);
}
