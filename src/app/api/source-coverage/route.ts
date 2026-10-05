import { NextResponse } from 'next/server';
import { getGdeltCoverage } from '@/lib/gdeltCoverageLedger';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await getGdeltCoverage(), {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60' },
  });
}
