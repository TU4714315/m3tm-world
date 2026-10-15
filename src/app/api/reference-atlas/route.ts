import { NextResponse } from 'next/server';
import { getReferenceAtlasSnapshot } from '@/lib/iswnAtlasServer';
import { maskSaudiPublicIndicators } from '@/lib/publicCountryVisibility';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 40;

/** Fixed public sources only. Query strings cannot select providers or bypass refresh limits. */
export async function GET() {
  const snapshot = await getReferenceAtlasSnapshot();
  const visible = maskSaudiPublicIndicators({ reference_atlas: snapshot }).reference_atlas;
  return NextResponse.json(visible, { headers: {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  } });
}
