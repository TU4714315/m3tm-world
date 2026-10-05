import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const bounded = readFileSync(new URL('../infra/supabase_applied/20261005123648_world_gdelt_bounded_public_archive_and_cron.sql', import.meta.url),'utf8');
const analytics = readFileSync(new URL('../infra/supabase_applied/20261005124720_world_gdelt_analytics_public_source_time_bins.sql', import.meta.url),'utf8');
const worker = readFileSync(new URL('../supabase/functions/world-gdelt-archive/index.ts',import.meta.url),'utf8');
for(const table of ['world_gdelt_export_windows','world_gdelt_published_reports','world_gdelt_ingest_tickets']){
  assert.match(bounded,new RegExp('CREATE TABLE IF NOT EXISTS public\\.'+table+'\\b'),'missing archived '+table);
  assert.match(bounded,new RegExp('ALTER TABLE public\\.'+table+' ENABLE ROW LEVEL SECURITY'),'missing RLS '+table);
}
assert.match(bounded,/REVOKE ALL ON TABLE[\s\S]+?FROM PUBLIC, anon, authenticated\s*;/);
for(const fn of ['world_gdelt_redeem_ingest_ticket','world_gdelt_commit_export','world_gdelt_schedule_ingest']){
  assert.ok(bounded.includes('REVOKE ALL ON FUNCTION public.'+fn),'missing function permission '+fn);
}
assert.match(analytics,/REVOKE ALL ON FUNCTION public\.world_gdelt_public_analytics/);
assert.match(worker,/world_gdelt_redeem_ingest_ticket/);
assert.match(worker,/world_gdelt_commit_export/);
assert.match(worker,/MAX_ZIP\s*=/);
assert.match(worker,/MAX_CSV\s*=/);
assert.match(worker,/const\s+targets\s*=/);
assert.match(worker,/Math\.min\(2,older\.length\)/);
console.log('PASS: static offline migration privilege and Edge ticket contract audit; not a live SQL migration test');
