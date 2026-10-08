/**
 * Publisher links are browser-only evidence URLs. Never expose internal,
 * private, local or numeric-address links as attributed public sources.
 */
export function publicPublisherLink(raw: unknown, allowedHosts?: readonly string[]): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    const reserved = [
      'localhost', 'localdomain', 'local', 'internal', 'lan', 'home',
      'home.arpa', 'arpa', 'test', 'invalid', 'example',
    ];
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password ||
        (url.port && !['80', '443'].includes(url.port)) ||
        host.includes(':') || !host.includes('.') ||
        /^\d+(?:\.\d+){3}$/.test(host) ||
        reserved.some(suffix => host === suffix || host.endsWith('.' + suffix))) return null;
    if (allowedHosts?.length && !allowedHosts.some(allowed => {
      const name = allowed.toLowerCase().replace(/\.$/, '');
      return host === name || host.endsWith('.' + name);
    })) return null;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_.+|fbclid|gclid|mc_cid|mc_eid|ref_src|ref_url)$/i.test(key))
        url.searchParams.delete(key);
    }
    return url.href;
  } catch { return null; }
}
