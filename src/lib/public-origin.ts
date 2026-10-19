/**
 * The origin users reached the app on.
 *
 * Behind Render's proxy, `request.url` can be the container's internal
 * `http://localhost:10000`, so auth redirects built from it send browsers to a
 * refused connection. Prefer an explicitly configured public URL and fall back
 * to the proxy headers before trusting the request URL.
 */
export function getPublicOrigin(request: Request): string {
  const configured =
    process.env.SITE_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    process.env["NEXT_PUBLIC_SITE_URL"];

  if (configured) return configured.replace(/\/$/, "");

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host");
  if (host) {
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    return `${forwardedProto || "https"}://${host}`;
  }

  return new URL(request.url).origin;
}
