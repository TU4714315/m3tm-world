import { withRestrictedMapResponse } from '@/lib/mapAccessServer';
import { NextResponse } from 'next/server';
import { getReferenceAtlasSnapshot, readReferenceAtlasSnapshot } from '@/lib/iswnAtlasServer';
import { maskSaudiPublicIndicators } from '@/lib/publicCountryVisibility';
import { validAtlasEventId } from '@/lib/iswnAtlas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 40;

/** Fixed public sources only. Query strings cannot select providers or bypass refresh limits. */
async function providerGET(request: Request) {
  const eventId = request.headers.get('x-m3tm-atlas-event-id');
  const collectorRequest = request.headers.get('x-m3tm-atlas-collect') === '1';
  const manualRequest = request.headers.get('x-m3tm-atlas-force') === '1';
  if (collectorRequest || eventId !== null || manualRequest) {
    // A viewing grant, email address or URL query is never collector authority.
    const scheduler = process.env.WORLD_MAP_REFRESH_TOKEN;
    if (!collectorRequest || !scheduler || scheduler.length < 32 || request.headers.get('authorization') !== `Bearer ${scheduler}`) {
      return NextResponse.json({ error: 'collector_required' }, { status: 403 });
    }
    if (eventId !== null && !validAtlasEventId(eventId)) return NextResponse.json({ error: 'invalid_event_signal' }, { status: 400 });
  }
  // Public callers always get an existing snapshot; the authorized collector
  // alone can make outbound source requests. No background fetch per visitor.
  const snapshot = collectorRequest
    ? await getReferenceAtlasSnapshot(eventId ?? undefined, manualRequest)
    : await readReferenceAtlasSnapshot();
  const visible = maskSaudiPublicIndicators({ reference_atlas: snapshot }).reference_atlas;
  return NextResponse.json(visible, { headers: {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  } });
}

export const GET = withRestrictedMapResponse(providerGET);
