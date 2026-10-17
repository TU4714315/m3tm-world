import { withRestrictedMapResponse } from '@/lib/mapAccessServer';
import { NextResponse } from 'next/server';
import { getReferenceAtlasSnapshot } from '@/lib/iswnAtlasServer';
import { maskSaudiPublicIndicators } from '@/lib/publicCountryVisibility';
import { validAtlasEventId } from '@/lib/iswnAtlas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 40;

/** Fixed public sources only. Query strings cannot select providers or bypass refresh limits. */
async function providerGET(request: Request) {
  const eventId = request.headers.get('x-m3tm-atlas-event-id');
  if (eventId !== null) {
    // Viewing grants and query strings cannot force a full source collection.
    const scheduler = process.env.WORLD_MAP_REFRESH_TOKEN;
    if (!scheduler || scheduler.length < 32 || request.headers.get('authorization') !== `Bearer ${scheduler}`) {
      return NextResponse.json({ error: 'collector_required' }, { status: 403 });
    }
    if (!validAtlasEventId(eventId)) return NextResponse.json({ error: 'invalid_event_signal' }, { status: 400 });
  }
  const snapshot = await getReferenceAtlasSnapshot(eventId ?? undefined);
  const visible = maskSaudiPublicIndicators({ reference_atlas: snapshot }).reference_atlas;
  return NextResponse.json(visible, { headers: {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  } });
}

export const GET = withRestrictedMapResponse(providerGET);
