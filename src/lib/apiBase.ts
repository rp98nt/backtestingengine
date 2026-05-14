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

/**
 * WebSocket URL for the FastAPI host (browser cannot upgrade `/api/backend` proxy).
 * Set `NEXT_PUBLIC_API_BASE_URL` or `NEXT_PUBLIC_WS_BASE_URL` on Vercel for `/live` WS.
 *
 * @param path must start with `/api/` (e.g. `/api/live/ws/{sessionId}`)
 */
export function apiWsUrl(path: string): string | null {
  const p = path.startsWith("/") ? path : `/${path}`;
  const wsOnly = process.env.NEXT_PUBLIC_WS_BASE_URL?.replace(/\/$/, "");
  if (wsOnly) {
    const u = `${wsOnly}${p}`;
    if (u.startsWith("http://")) return `ws://${u.slice("http://".length)}`;
    if (u.startsWith("https://")) return `wss://${u.slice("https://".length)}`;
    if (u.startsWith("ws://") || u.startsWith("wss://")) return u;
  }
  const httpBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  if (httpBase) {
    if (httpBase.startsWith("https://")) return `wss://${httpBase.slice("https://".length)}${p}`;
    if (httpBase.startsWith("http://")) return `ws://${httpBase.slice("http://".length)}${p}`;
  }
  const useProxy =
    process.env.NEXT_PUBLIC_USE_API_PROXY === "1" || process.env.VERCEL === "1";
  if (useProxy) return null;
  return `ws://127.0.0.1:8000${p}`;
}
