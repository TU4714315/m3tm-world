import { withRestrictedMapResponse } from '@/lib/mapAccessServer';
import { NextResponse } from 'next/server';
import { getGdeltCoverage } from '@/lib/gdeltCoverageLedger';

export const dynamic = 'force-dynamic';

async function providerGET() {
  return NextResponse.json(await getGdeltCoverage(), {
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  });
}

export const GET = withRestrictedMapResponse(providerGET);
