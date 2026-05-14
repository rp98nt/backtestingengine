/**
 * Resolves the base URL for FastAPI calls from the browser.
 *
 * - If `NEXT_PUBLIC_API_BASE_URL` is set → call the API directly (local dev or explicit prod).
 * - Else on Vercel (`VERCEL=1`) or when `NEXT_PUBLIC_USE_API_PROXY=1` → same-origin
 *   `/api/backend/...` proxy (avoids browser calls to 127.0.0.1 and sidesteps CORS).
 * - Else → `http://127.0.0.1:8000` for local `next dev`.
 *
 * @param path must start with `/api/` (e.g. `/api/data/instruments`)
 */
export function apiUrl(path: string): string {
  const explicit = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  if (explicit) return `${explicit}${path}`;
  const useProxy =
    process.env.NEXT_PUBLIC_USE_API_PROXY === "1" || process.env.VERCEL === "1";
  if (useProxy) return `/api/backend${path}`;
  return `http://127.0.0.1:8000${path}`;
}
