
import { Unzip, UnzipInflate } from 'npm:fflate@0.8.2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const GDELT_HOST = 'data.gdeltproject.org';
const SLOT_MS = 15 * 60_000;
const MAX_ZIP = 8 * 1024 * 1024;
const MAX_CSV = 16 * 1024 * 1024;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
};
function json(data: unknown, status = 200, ttl = 0): Response {
  return new Response(JSON.stringify(data), {
    status, headers: {
      ...cors, 'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': ttl ? 'public, max-age=60, s-maxage=90, stale-while-revalidate=90' : 'no-store',
      'X-Content-Type-Options': 'nosniff',
    }
  });
}
async function db(path: string, options: RequestInit = {}) {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Service runtime is not configured');
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
    ...options,
    headers: {
      apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY,
      'Content-Type': 'application/json', ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(9000), cache: 'no-store',
  });
  if (!r.ok) throw new Error('Internal source storage returned HTTP ' + r.status);
  const value = await r.text();
  return value ? JSON.parse(value) : null;
}
const rpc = (name: string, body: unknown) => db('rpc/' + name, {
  method: 'POST', body: JSON.stringify(body)
});
const stamp = (date: Date) =>
  String(date.getUTCFullYear()) +
  [date.getUTCMonth() + 1,date.getUTCDate(),date.getUTCHours(),date.getUTCMinutes(),date.getUTCSeconds()]
    .map(v => String(v).padStart(2, '0')).join('');
function asMillis(name: string): number | null {
  if (!/^20\d{12}\.export\.CSV\.zip$/.test(name)) return null;
  const d = name.slice(0, 14);
  const timestamp = Date.UTC(
    Number(d.slice(0,4)),Number(d.slice(4,6))-1,Number(d.slice(6,8)),
    Number(d.slice(8,10)),Number(d.slice(10,12)),Number(d.slice(12,14))
  );
  return Number.isFinite(timestamp) && stamp(new Date(timestamp)) === d ? timestamp : null;
}
function classify(code: string, root: string, quad: number) {
  if (code.startsWith('195')) return 'aerial_attack';
  if (code.startsWith('194')) return 'heavy_weapons';
  if (code.startsWith('183')) return 'bombing';
  if (root === '19') return 'armed_clash';
  if (root === '20') return 'mass_violence';
  if (root === '18') return 'assault';
  if (root === '14') return 'civil_unrest';
  return quad === 4 ? 'material_conflict' : 'verbal_report';
}
const dateOnly = (s: string) => /^\d{8}$/.test(s)
  ? s.slice(0,4) + '-' + s.slice(4,6) + '-' + s.slice(6,8) : null;
const fullDate = (s: string) => /^\d{14}$/.test(s)
  ? new Date(Date.UTC(
      Number(s.slice(0,4)), Number(s.slice(4,6))-1, Number(s.slice(6,8)),
      Number(s.slice(8,10)), Number(s.slice(10,12)), Number(s.slice(12,14))
    )).toISOString() : null;
function parseReports(csv: string) {
  const reports = [];
  let scanned = 0;
  const dedup = new Set<number>();
  for (const line of csv.split(/\r?\n/)) {
    if (!line) continue;
    scanned++;
    const c = line.split('\t');
    if (c.length < 61) continue;
    const event_id = Number(c[0]);
    const latitude = Number(c[56]), longitude = Number(c[57]);
    const quad = Number(c[29]) || 0, event_code = c[26] || '', root = c[28] || '';
    const article_count = Number(c[33]) || 0;
    if (!Number.isSafeInteger(event_id) || event_id <= 0 || dedup.has(event_id)) continue;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
      || latitude < 8 || latitude > 43 || longitude < 20 || longitude > 65) continue;
    if (!((quad === 4) || (quad === 3 && root === '14')) || article_count < 1) continue;
    const url = String(c[60] || '').trim().slice(0,700);
    // Text is a published report, not an independently confirmed battlefield event.
    reports.push({
      event_id,event_date:dateOnly(c[1] || ''),
      report_time:fullDate(c[59] || ''),
      latitude:Math.round(latitude * 4) / 4,longitude:Math.round(longitude * 4) / 4,
      event_category:classify(event_code,root,quad),
      event_code:event_code.slice(0,12),quad,
      country:String(c[53] || '').slice(0,6),
      place:String(c[52] || '').replace(/[\x00-\x1f<>]/g,' ').slice(0,180),
      source_url:/^https?:\/\//i.test(url) ? url : '',
      source_count:Math.max(0,Number(c[32]) || 0),
      article_count,
    });
    dedup.add(event_id);
    if (reports.length > 2500) throw new Error('GDELT archive exceeds bounded regional row count');
  }
  return {reports,scanned};
}
async function boundedZip(name: string): Promise<{reports:unknown[];scanned:number}> {
  if (asMillis(name) === null) throw new Error('Invalid source archive name');
  const url = new URL('https://' + GDELT_HOST + '/gdeltv2/' + name);
  if (url.hostname !== GDELT_HOST || url.protocol !== 'https:') throw new Error('Invalid host');
  const response = await fetch(url.toString(), { signal: AbortSignal.timeout(15000), redirect:'error' });
  if (!response.ok) throw new Error('GDELT export returned HTTP '+response.status);
  const length = Number(response.headers.get('content-length') || 0);
  if (length > MAX_ZIP) throw new Error('ZIP limit exceeded');
  // Content-Length may be absent or forged. Bound incoming bytes *while*
  // reading the stream, and decompress only the matching CSV entry in bounded
  // chunks. unzipSync would inflate every ZIP member before any size check.
  if (!response.body) throw new Error('GDELT ZIP stream unavailable');
  const reader = response.body.getReader();
  let zipped = 0, expanded = 0, found = false, complete = false;
  let error: Error | null = null;
  const pieces: Uint8Array[] = [];
  const unzip = new Unzip(file => {
    if (!file.name.endsWith('.export.CSV')) return;
    if (found) { error = new Error('Multiple GDELT CSV entries'); return; }
    found = true;
    if (file.size !== undefined && file.size > MAX_CSV) {
      error = new Error('GDELT CSV declared size exceeds cap');
      return;
    }
    file.ondata = (failure, data, last) => {
      if (failure) { error = new Error('GDELT inflate failed'); return; }
      expanded += data.byteLength;
      if (expanded > MAX_CSV) { error = new Error('GDELT CSV too large'); return; }
      pieces.push(data);
      if (last) complete = true;
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      zipped += value.byteLength;
      if (zipped > MAX_ZIP) throw new Error('ZIP exceeds maximum size');
      unzip.push(value, false);
      if (error) throw error;
    }
    unzip.push(new Uint8Array(0), true);
    if (error) throw error;
    if (!found || !complete) throw new Error('ZIP lacks a complete GDELT events CSV');
  } catch (cause) {
    await reader.cancel().catch(() => undefined);
    throw cause;
  } finally {
    reader.releaseLock();
  }
  const csv = new Uint8Array(expanded);
  let offset = 0;
  for (const chunk of pieces) { csv.set(chunk, offset); offset += chunk.byteLength; }
  return parseReports(new TextDecoder('utf-8', { fatal:false }).decode(csv));
}
async function latestName() {
  const r = await fetch('https://' + GDELT_HOST + '/gdeltv2/lastupdate.txt',
    { signal: AbortSignal.timeout(8500), redirect: 'error' });
  if (!r.ok) throw new Error('GDELT manifest is unavailable');
  const manifest = await r.text();
  const match = manifest.match(/(20\d{12}\.export\.CSV\.zip)/);
  if (!match || asMillis(match[1]) === null) throw new Error('GDELT manifest lacks a valid export');
  return match[1];
}
async function ingest() {
  const announced = await latestName();
  let newest = asMillis(announced);
  if (newest === null) throw new Error('Invalid GDELT source window');
  const now = Date.now();
  // GDELT announces an upcoming archive early; only ingest completed windows.
  while (newest > now + 60_000) newest -= SLOT_MS;
  if (newest < now - 3 * 60 * 60_000)
    throw new Error('GDELT latest usable export is stale');
  const latest = stamp(new Date(newest)) + '.export.CSV.zip';
  // Missing archives older than one hour must not disappear merely because
  // the live GDELT manifest advanced. Scan bounded seven-day receipts; at
  // most four downloads per run protect Edge time and source quota.
  const earliest=Math.ceil((now-7*86400000)/SLOT_MS)*SLOT_MS;
  const stored = await db(
    'world_gdelt_export_windows?select=window_name&window_name=gte.' +
    encodeURIComponent(stamp(new Date(earliest))+'.export.CSV.zip') +
    '&order=window_name.asc&limit=750'
  ) as Array<{window_name:string}>;
  const seen = new Set((stored||[]).map(row=>row.window_name));
  const missing:number[]=[];
  for(let t=earliest;t<=newest;t+=SLOT_MS){
    if(!seen.has(stamp(new Date(t))+'.export.CSV.zip'))missing.push(t);
  }
  const recent=missing.filter(t=>t>=newest-2*SLOT_MS).reverse().slice(0,2);
  const older=missing.filter(t=>t<newest-2*SLOT_MS);
  // Rotate retries: a permanently unavailable ZIP cannot starve the backlog.
  const offset=older.length?Math.floor(now/SLOT_MS)%older.length:0;
  const historical=Array.from({length:Math.min(2,older.length)},
    (_,i)=>older[(offset+i)%older.length]);
  const targets=Array.from(new Set([...recent,...historical]));
  const ingested: Array<{window:string,regional:number,scanned:number}> = [];
  const errors: Array<{window:string,code:string}> = [];
  for (const t of targets) {
    const window=stamp(new Date(t))+'.export.CSV.zip';
    try {
      const sample=await boundedZip(window);
      await rpc('world_gdelt_commit_export', {
        p_window:window,p_scanned:sample.scanned,p_rows:sample.reports,
      });
      ingested.push({window,regional:sample.reports.length,scanned:sample.scanned});
    } catch (error) {
      errors.push({window,code:error instanceof Error?error.message.slice(0,130):'unknown'});
    }
  }
  return {status:errors.length?'partial':ingested.length?'ok':'up_to_date', latest,ingested,errors};
}
function percentiles(values: number[],p: number): number|null {
  if (!values.length) return null;
  const v=[...values].sort((a,b)=>a-b);
  return Number(v[Math.min(v.length-1,Math.ceil(v.length*p)-1)].toFixed(1));
}
async function publicCoverage() {
  // Grade the same delayed eligible slots that are actually counted.
  const now=Date.now(),slot=SLOT_MS;
  const dueThrough=Math.floor((now-30*60000)/slot)*slot;
  const cutoff=new Date(dueThrough-(672-1)*slot).toISOString();
  const windows = await db(
    'world_gdelt_export_windows?select=window_name,published_at,first_observed_at,mena_rows,scanned_rows' +
    '&published_at=gte.'+encodeURIComponent(cutoff)+'&order=published_at.asc&limit=750'
  ) as Array<{window_name:string,published_at:string,first_observed_at:string,mena_rows:number,scanned_rows:number}>;
  if (!Array.isArray(windows) || !windows.length) return {
    source:'GDELT 2.0 Events',sampling:'not-yet-collected',backend:'supabase',
    durable:true, expectedWindows:0,observedWindows:0,coveragePercent:null,
    firstSeenLagMinutes:{p50:null,p95:null},publishedReports:0,
    status:'warming-up',
    note:'No source archives have been persisted yet. This is not evidence of a quiet region.',
  };
  // The 30-minute delayed cutoff anchors BOTH ends of the week; an
  // uninterrupted 7-day archive can reach 672/672 instead of 670/672.
  // Start from the independently verified original collector opening
  // (2026-10-05 11:45 UTC), not the oldest *retained* receipt. Once seven
  // days elapse, a missing oldest slot must remain a gap in all 672 slots.
  const archiveBeganAt=Date.parse('2026-10-05T11:45:00Z');
  const windowStart=Math.max(dueThrough-(672-1)*slot,archiveBeganAt);
  const expected=Math.max(0,Math.min(672,Math.floor((dueThrough-windowStart)/slot)+1));
  const valid=windows.filter(x=>{
    const t=asMillis(x.window_name);
    return t !== null && t>=windowStart && t<=dueThrough;
  });
  const unique=new Set(valid.map(x=>x.window_name));
  const gaps=Math.max(0,expected-unique.size);
  const delays=valid.map(x=>Math.max(0,
    (Date.parse(x.first_observed_at)-Date.parse(x.published_at))/60000))
    .filter(x=>Number.isFinite(x));
  return {
    source:'GDELT 2.0 Events',
    sampling:'observed-export-checkpoints', backend:'supabase',durable:true,
    windowDays:7, fullWindowTarget:672,
    expectedWindows:expected,observedWindows:unique.size,missingWindows:gaps,
    coveragePercent:expected ? Number((unique.size*100/expected).toFixed(1)):null,
    uninterrupted: expected >= 672 && gaps === 0,
    firstSeenLagMinutes:{p50:percentiles(delays,.5),p95:percentiles(delays,.95)},
    publishedReports: valid.reduce((s,x)=>s+Number(x.mena_rows||0),0),
    newestSourceArchive:valid.length ? valid[valid.length-1].published_at : null,
    coverageStart:new Date(windowStart).toISOString(),
    scope:'Middle East / Red Sea; published source-coded reports; not operational unit tracking',
    note:'Coverage counts GDELT 15-minute exports persisted since the first collection. Missing windows mean no collected archive, not proof that no events occurred.',
  };
}
async function publicEvents(url:URL) {
  const requested=Number(url.searchParams.get('hours')||'24');
  const hours=[1,6,24,168].includes(requested)?requested:24;
  const limit=Math.min(250,Math.max(10,Number(url.searchParams.get('limit')||'80')||80));
  const earliest=stamp(new Date(Date.now()-hours*3600000))+'.export.CSV.zip';
  const [rows,analytics] = await Promise.all([
    db(
      'world_gdelt_published_reports?' +
      'select=window_name,event_id,event_date,report_time,latitude,longitude,event_category,quad,country,place,source_url,source_count,article_count' +
      '&window_name=gte.'+encodeURIComponent(earliest) +
      '&order=window_name.desc&limit='+Math.trunc(limit)
    ),
    rpc('world_gdelt_public_analytics',{p_hours:hours}),
  ]);
  return {
    source:'GDELT 2.0 Events',sampling:'stored-source-reports',
    region:'middle-east-red-sea',
    publicationLookbackHours:hours,
    returnedRows:rows?.length??0,
    completeness:'sample-limited',
    precision:'generalized-0.25deg',
    sourceClock:'window_name',
    confidence:'published-report-not-independently-confirmed',
    analytics,
    events:rows??[],
  };
}
Deno.serve(async(request:Request):Promise<Response>=>{
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(request.method==='GET') {
    try{
      const url=new URL(request.url);
      if(url.searchParams.get('mode')==='events')return json(await publicEvents(url),200,60);
      return json(await publicCoverage(),200,60);
    }catch(error){
      return json({status:'unavailable',source:'GDELT',reason:error instanceof Error?error.message:'unavailable'},503);
    }
  }
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  try{
    const payload=await request.json();
    const ticket=payload?.ticket;
    if(typeof ticket!=='string' || !/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(ticket))
      return json({error:'Unauthorized'},401);
    const valid=await rpc('world_gdelt_redeem_ingest_ticket',{p_ticket:ticket});
    if(valid!==true)return json({error:'Unauthorized or expired'},401);
    const result=await ingest();
    return json(result,result.status==='partial'?207:200);
  }catch(error){
    return json({status:'error',reason:error instanceof Error?error.message:'ingest failed'},503);
  }
});
