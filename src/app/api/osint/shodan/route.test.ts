import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const KEY = 'test-shodan-key-abc';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Fetch mock routing by URL so the same global stub covers both providers. */
function mockFetch(fn: (url: string, init?: RequestInit) => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn((input: any, init?: RequestInit) => fn(String(input), init)));
}

beforeEach(() => {
  delete process.env.SHODAN_API_KEY;
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.SHODAN_API_KEY;
});

/** Realistic host fixture per https://developer.shodan.io/api — location object
 * plus top-level coordinates, data[] banners, vulns as a dictionary. */
function hostFixture(): any {
  return {
    asn: 'AS15169',
    ip_str: '8.8.8.8',
    hostnames: ['dns.google'],
    os: 'Linux',
    org: 'Google LLC',
    timestamp: '2026-01-01T00:00:00.000000',
    latitude: 37.4056,
    longitude: -122.0775,
    location: {
      city: 'Mountain View',
      country_name: 'United States',
      latitude: 37.4056,
      longitude: -122.0775,
      isp: 'Google LLC',
    },
    ports: [53, 443],
    data: [
      {
        port: 443,
        transport: 'tcp',
        product: 'nginx',
        data: 'HTTP/1.1 200 OK\r\nServer: nginx',
        http: { title: 'Google' },
        ssl: { versions: ['TLSv1.3'], cert: { subject: { CN: 'dns.google' } } },
      },
      { port: 53, transport: 'udp', product: '' },
    ],
    tags: ['dns'],
    vulns: { 'CVE-2021-0001': { summary: 'x' }, 'CVE-2021-0002': { summary: 'y' } },
  };
}

describe('Shodan adapter — key presence', () => {
  it('reports configured:false when SHODAN_API_KEY is absent (boolean only, never the key)', async () => {
    const response = await GET(new Request('http://localhost/api/osint/shodan?check=1'));
    const body = await response.json();
    expect(body).toEqual({ configured: false, source: 'internetdb' });
    expect(JSON.stringify(body)).not.toContain(KEY);
  });

  it('reports configured:true when SHODAN_API_KEY is present', async () => {
    process.env.SHODAN_API_KEY = KEY;
    const response = await GET(new Request('http://localhost/api/osint/shodan?check=1'));
    const body = await response.json();
    expect(body.configured).toBe(true);
    expect(JSON.stringify(body)).not.toContain(KEY);
  });

  it('never embeds the key in host responses', async () => {
    process.env.SHODAN_API_KEY = KEY;
    mockFetch(async (url) => {
      expect(url).toContain(KEY); // sent upstream server-side only...
      return jsonResponse(hostFixture());
    });
    const response = await GET(new Request('http://localhost/api/osint/shodan?ip=8.8.8.8'));
    const body = await response.json();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(KEY);
    expect(serialized).not.toContain('test-shodan-key');
  });
});

describe('Shodan adapter — host lookup without key (InternetDB fallback)', () => {
  it('returns an empty record on InternetDB 404, marked as internetdb and configured:false', async () => {
    mockFetch(async () => jsonResponse({ detail: 'No results found' }, 404));
    const response = await GET(new Request('http://localhost/api/osint/shodan?ip=203.0.113.9'));
    const body = await response.json();
    expect(body.source).toBe('internetdb');
    expect(body.configured).toBe(false);
    expect(body.ports).toEqual([]);
    expect(body.status).toContain('No Shodan InternetDB records found');
  });

  it('passes through InternetDB port/hostname data on a hit', async () => {
    mockFetch(async () =>
      jsonResponse({ ip: '203.0.113.10', ports: [22, 443], hostnames: ['router.example'], cpes: [], tags: [], vulns: [] })
    );
    const response = await GET(new Request('http://localhost/api/osint/shodan?ip=203.0.113.10'));
    const body = await response.json();
    expect(body.source).toBe('internetdb');
    expect(body.ports).toEqual([22, 443]);
    expect(body.hostnames).toEqual(['router.example']);
  });
});

describe('Shodan adapter — host lookup with key', () => {
  it('maps host metadata with coordinates (location + top-level), services, timestamp and vuln dictionary', async () => {
    process.env.SHODAN_API_KEY = KEY;
    mockFetch(async (url) => {
      expect(url).toContain('api.shodan.io/shodan/host/');
      return jsonResponse(hostFixture());
    });

    const response = await GET(new Request('http://localhost/api/osint/shodan?ip=8.8.8.8'));
    const body = await response.json();

    expect(body.source).toBe('shodan-api');
    expect(body.ip).toBe('8.8.8.8');
    expect(body.os).toBe('Linux');
    expect(body.org).toBe('Google LLC');
    expect(body.asn).toBe('AS15169');
    expect(body.timestamp).toBe('2026-01-01T00:00:00.000000');
    // Coordinates surfaced from location and/or top-level.
    expect(body.location.lat).toBe(37.4056);
    expect(body.location.lng).toBe(-122.0775);
    expect(body.location.country).toBe('United States');
    expect(body.location.city).toBe('Mountain View');
    expect(body.ports).toEqual([53, 443]);
    expect(body.vulns).toEqual(['CVE-2021-0001', 'CVE-2021-0002']);
    expect(body.services).toHaveLength(2);
    expect(body.services[0]).toMatchObject({ port: 443, protocol: 'tcp', service: 'nginx' });
    expect(body.services[0].banner).toContain('HTTP/1.1 200 OK');
    expect(body.services[0].ssl_cert_subject).toEqual({ CN: 'dns.google' });
  });

  it('normalizes a vulnerability LIST as well as a dictionary', async () => {
    process.env.SHODAN_API_KEY = KEY;
    const fx = hostFixture();
    fx.vulns = ['CVE-2020-0001', 'CVE-2020-0002'];
    mockFetch(async () => jsonResponse(fx));
    const response = await GET(new Request('http://localhost/api/osint/shodan?ip=8.8.8.8'));
    const body = await response.json();
    expect(body.vulns).toEqual(['CVE-2020-0001', 'CVE-2020-0002']);
  });

  it('falls back to top-level coordinates when location is absent', async () => {
    process.env.SHODAN_API_KEY = KEY;
    const fx = hostFixture();
    delete fx.location;
    mockFetch(async () => jsonResponse(fx));
    const response = await GET(new Request('http://localhost/api/osint/shodan?ip=8.8.8.8'));
    const body = await response.json();
    expect(body.location.lat).toBe(37.4056);
    expect(body.location.lng).toBe(-122.0775);
  });

  it('returns a 401 with configured:true (not the key) when the upstream key is rejected', async () => {
    process.env.SHODAN_API_KEY = KEY;
    mockFetch(async () => jsonResponse({ error: 'Unauthorized' }, 401));
    const response = await GET(new Request('http://localhost/api/osint/shodan?ip=8.8.8.8'));
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toContain('Shodan lookup failed');
    expect(body.configured).toBe(true);
    expect(JSON.stringify(body)).not.toContain(KEY);
  });

  it('propagates Shodan API server errors as 502', async () => {
    process.env.SHODAN_API_KEY = KEY;
    mockFetch(async () => jsonResponse({ error: 'boom' }, 500));
    const response = await GET(new Request('http://localhost/api/osint/shodan?ip=8.8.8.8'));
    expect(response.status).toBe(502);
    expect((await response.json()).detail).toBe('Shodan API request failed');
  });

  it('NEVER leaks raw fetch errors — a thrown error containing the keyed URL is replaced by a safe known message', async () => {
    process.env.SHODAN_API_KEY = KEY;
    const secret = `https://api.shodan.io/shodan/host/8.8.8.8?key=${KEY} exploded ECONNREFUSED`;
    mockFetch(async () => {
      throw new Error(secret);
    });
    const response = await GET(new Request('http://localhost/api/osint/shodan?ip=8.8.8.8'));
    expect(response.status).toBe(502);
    const body = await response.json();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(KEY);
    expect(serialized).not.toContain('api.shodan.io');
    expect(serialized).not.toContain('ECONNREFUSED');
    expect(body.detail).toBe('Shodan upstream request failed');
  });
});

describe('Shodan adapter — search', () => {
  it('refuses search without a key (REQUIRES_KEY), status 501', async () => {
    const response = await GET(new Request('http://localhost/api/osint/shodan?query=product%3Anginx'));
    expect(response.status).toBe(501);
    const body = await response.json();
    expect(body.configured).toBe(false);
    expect(body.error).toContain('SHODAN_API_KEY');
  });

  it('normalizes search matches as service banners and does NOT send an unsupported limit parameter', async () => {
    process.env.SHODAN_API_KEY = KEY;
    mockFetch(async (url) => {
      expect(url).not.toContain('limit=');
      return jsonResponse({
        total: 25,
        matches: [
          {
            ip_str: '9.9.9.9',
            port: 443,
            transport: 'tcp',
            product: 'nginx',
            data: 'HTTP/1.1 200 OK\r\nServer: nginx',
            location: { city: 'Berlin', country_name: 'Germany', latitude: 52.52, longitude: 13.405, isp: '' },
            timestamp: '2026-01-02T00:00:00.000000',
          },
        ],
      });
    });
    const response = await GET(new Request('http://localhost/api/osint/shodan?query=product%3Anginx'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.source).toBe('shodan-api');
    expect(body.total).toBe(25);
    expect(body.matches).toHaveLength(1);
    expect(body.matches[0].ip).toBe('9.9.9.9');
    expect(body.matches[0].port).toBe(443);
    expect(body.matches[0].product).toBe('nginx');
    expect(body.matches[0].banner).toContain('HTTP/1.1 200 OK');
    expect(body.matches[0].location.city).toBe('Berlin');
  });

  it('bounds returned matches locally to SEARCH_LIMIT (10)', async () => {
    process.env.SHODAN_API_KEY = KEY;
    const many = Array.from({ length: 15 }, (_, i) => ({
      ip_str: `10.0.0.${i + 1}`,
      port: 80,
      product: 'nginx',
      data: `banner-${i}`,
      location: null,
    }));
    mockFetch(async () => jsonResponse({ total: 15, matches: many }));
    const response = await GET(new Request('http://localhost/api/osint/shodan?query=nginx'));
    const body = await response.json();
    expect(body.total).toBe(15);
    expect(body.matches).toHaveLength(10);
    expect(body.matches[0].banner).toContain('banner-0');
    expect(body.matches[9].banner).toContain('banner-9');
  });
});
