/**
 * Returns an API URL that works in every runtime:
 *
 *  - Browser / localhost:  returns the relative path unchanged → "/api/chat"
 *    (the local Next.js dev server handles it, no CORS issue)
 *
 *  - Capacitor WebView:    serves from file:// so relative paths fail.
 *    Prefixes with NEXT_PUBLIC_API_BASE_URL (your Vercel deployment URL).
 *
 * IMPORTANT: NEXT_PUBLIC_API_BASE_URL must be set ONLY for Capacitor builds,
 * not for local dev — otherwise every fetch goes to Vercel and CORS blocks it.
 */
export function getApiUrl(path: string): string {
  // Only redirect when genuinely inside a Capacitor native WebView.
  const isCapacitor =
    typeof window !== "undefined" &&
    (window.location.protocol === "file:" ||
      !!(window as any).Capacitor?.isNativePlatform?.());

  if (isCapacitor) {
    const base =
      (process.env.NEXT_PUBLIC_API_BASE_URL || "https://swasthya-ai.vercel.app")
        .replace(/\/$/, "");
    return `${base}${path}`;
  }

  // Local dev or regular web browser — use relative path, no CORS.
  return path;
}
