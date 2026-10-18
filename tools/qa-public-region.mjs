// Read-only release check for public conflict scope. No private credentials.
import assert from 'node:assert/strict';
const base = 'https://m3tm-world-recovery.onrender.com';
const scope = 'middle-east-iran-sudan-horn';
const approvedZones = new Set(['gaza','lebanon','sudan','yemen','syria','red-sea','somalia','iraq','ethiopia']);
async function read(path) {
  const res = await fetch(base + path,{signal:AbortSignal.timeout(65000)});
  assert.equal(res.status,200,`${path} HTTP ${res.status}`);
  return res.json();
}
const conflicts = await read('/api/conflicts');
assert.equal(conflicts.displayRegion,scope);
assert.ok(Array.isArray(conflicts.zones));
assert.ok(Array.isArray(conflicts.liveEvents));
assert.ok(conflicts.zones.every(z=>approvedZones.has(z.id)),'out-of-scope context zone in production');
assert.equal(conflicts.totalZones,conflicts.zones.length);
assert.ok(conflicts.totalLiveEvents>=conflicts.liveEvents.length);
const gdelt=await read('/api/gdelt-events?quad=3%2C4&min_articles=2&limit=1000');
assert.equal(gdelt.priority_region,scope);
assert.ok(Array.isArray(gdelt.events));
assert.equal(gdelt.total,gdelt.events.length);
assert.equal(gdelt.reported_routes_total,gdelt.reported_routes.length);
const report={
  releaseScope:scope,
  conflictingZones:conflicts.zones.map(z=>z.id),
  conflictEvents:conflicts.liveEvents.length,
  conflictReportedTotal:conflicts.totalLiveEvents,
  conflictDataState:conflicts.dataState,
  gdeltEvents:gdelt.events.length,
  gdeltDataState:gdelt.data_state,
  gdeltSourcePublishedAt:gdelt.source_published_at,
  scannedRows:gdelt.scanned,
};
console.log('PUBLIC_SCOPE_PROOF '+JSON.stringify(report));
