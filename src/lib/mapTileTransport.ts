/** CARTO serves CORS-enabled public map assets. Avoid proxying every tile
 * through the small Render Node instance, which can delay first paint and
 * exhaust server resources. Retain the existing Vercel same-origin proxy.
 * No server-side upstream request is added by this helper.
 */
export function cartoMapRequestUrl(url: string, hostname: string, origin: string): string {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return url;
  }
  if (host !== 'cartocdn.com' && !host.endsWith('.cartocdn.com')) return url;
  const currentHost = hostname.toLowerCase().replace(/\.$/, '');
  if (currentHost.endsWith('.onrender.com') || currentHost === 'world.m3tm.app') return url;
  return `${origin}/api/proxy-tiles?url=${encodeURIComponent(url)}`;
}
