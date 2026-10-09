/** CARTO serves CORS-enabled map assets. Avoid re-fetching every vector tile
 * through tiny free-tier Node instances on Render; that fan-out can exhaust
 * their CPU/network budget and hold back first paint. Preserve the established
 * same-origin proxy on other deployments until browser verification completes.
 * This is routing only: no external URL is accepted as a server proxy target.
 */
export function cartoMapRequestUrl(url: string, hostname: string, origin: string): string {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return url;
  }
  if (host !== 'cartocdn.com' && !host.endsWith('.cartocdn.com')) return url;
  // Render hosts keep the map provider traffic at the browser/CDN edge.
  if (hostname.toLowerCase().endsWith('.onrender.com')) return url;
  return `${origin}/api/proxy-tiles?url=${encodeURIComponent(url)}`;
}
