export async function onRequest(context) {
  const url = new URL(context.request.url);
  const response = await context.next();

  if (url.pathname !== "/" && url.pathname !== "/index.html") return response;
  const type = response.headers.get("content-type") || "";
  if (!type.includes("text/html")) return response;

  return new HTMLRewriter()
    .on("body", {
      element(element) {
        element.append('<script src="/prep-v5.js?v=5"></script>', { html: true });
      }
    })
    .transform(response);
}
