/**
 * Single source of truth for the app's public base URL.
 *
 * Precedence:
 *   1. NEXT_PUBLIC_APP_URL — explicit override, any environment
 *   2. VERCEL_PROJECT_PRODUCTION_URL — auto-set by Vercel (hostname only)
 *   3. APP_URL_FALLBACK — the Cinderfell deployment default
 */

export const APP_URL_FALLBACK = "https://cinderfell.vercel.app";

export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  // VERCEL_PROJECT_PRODUCTION_URL is hostname-only (no scheme)
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return APP_URL_FALLBACK;
}
