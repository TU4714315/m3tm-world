import {NextResponse} from 'next/server';
import {fetchGdeltPublishedHistory} from '@/lib/gdeltPublicHistory';

export const dynamic='force-dynamic';

export async function GET(request:Request) {
  const params = new URL(request.url).searchParams;
  const hoursRaw = Number(params.get('hours')||24);
  const hours = [1,6,24,168].includes(hoursRaw) ? hoursRaw : 24;
  const limit = Math.min(200,Math.max(10,Number(params.get('limit')||80)||80));
  try {
    const history=await fetchGdeltPublishedHistory(hours,limit);
    return NextResponse.json(history,{
      headers:{'Cache-Control':'public, s-maxage=90, stale-while-revalidate=120'}
    });
  } catch {
    return NextResponse.json({
      data_state:'unavailable',source:'GDELT 2.0 Events',
      message:'The historical published-report archive is temporarily unavailable. Live GDELT remains independent.',
      events:[],totalReportRows:null,
    },{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
