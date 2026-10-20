/** Accepts only same-origin, absolute-path redirect targets. */
export function safeNextPath(value: string | null | undefined, fallback = "/app/library"): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes("\\") || value.includes("://") || value.includes("\n") || value.includes("\r")) {
    return fallback;
  }
  return value;
}
