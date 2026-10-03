import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('public network-event fallback', () => {
  const route = readFileSync(new URL('./route.ts', import.meta.url), 'utf8');

  it('uses source-backed public fallbacks without inventing attacker origin', () => {
    expect(route).toContain("startsWith('176')");
    expect(route).toContain('GDELT 2.0 · CAMEO 176');
    expect(route).toContain('abuse.ch Feodo Tracker');
    expect(route).toContain("indicator_type: 'observed-c2-infrastructure'");
    expect(route).toContain("source_mode: 'public-fallback'");
    expect(route).not.toContain('THREAT_ORIGINS');
    expect(route).not.toContain('Math.random');
  });

  it('does not expose Feodo IP addresses through the map-facing fallback', () => {
    expect(route).not.toContain('row?.ip_address');
    expect(route).not.toContain('target_ip');
    expect(route).toContain('counts.set(code');
    expect(route).toContain('country: code');
  });

  it('keeps Cloudflare preferred when its server-side credential is available', () => {
    expect(route).toContain('process.env.CLOUDFLARE_API_TOKEN');
    expect(route).toContain("source_mode: fallbackActive ? 'mixed' : 'cloudflare-radar'");
    expect(route).toContain('cloudflare_status');
  });
});
