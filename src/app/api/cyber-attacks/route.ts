import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * The former endpoint invented attacker locations, movement arcs, and attack
 * verbs from public Feodo C2 host observations, then disclosed individual IPs.
 * Those arcs were not actual observed attacks and must not be distributed as
 * intelligence. WORLD renders the source-backed Cloudflare/Feodo national
 * overview using /api/cloudflare-radar and cf_attacks instead.
 */
export async function GET() {
  return NextResponse.json({
    attacks: [],
    total: 0,
    data_state: 'legacy_synthetic_arcs_disabled',
    source: 'M3TM.WORLD',
    replacement: '/api/cloudflare-radar',
    guidance: 'Only published country-level observations are shown; no invented attacker paths or individual infrastructure identifiers.',
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
}