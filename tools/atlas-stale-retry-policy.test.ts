import { describe, expect, it } from 'vitest';
import { atlasScheduledRecoveryDelay, ATLAS_MAX_RECOVERY_WAIT_MS } from './atlas-stale-retry-policy.mjs';
const now = Date.parse('2026-10-17T23:25:00Z');
const stale = {status:'stale', fetchedAt:'2026-10-17T23:20:00Z',nextRefreshAt:'2026-10-17T23:27:00Z'};
describe('atlas scheduled stale source recovery',()=>{
  it('waits until the actual server backoff expires',()=>{
    expect(atlasScheduledRecoveryDelay(stale, now)).toBe(120_750);
  });
  it('never waits for a current, undated, missing or unavailable snapshot',()=>{
    expect(atlasScheduledRecoveryDelay({...stale,status:'ok'},now)).toBeNull();
    expect(atlasScheduledRecoveryDelay({...stale,fetchedAt:null},now)).toBeNull();
    expect(atlasScheduledRecoveryDelay({...stale,nextRefreshAt:null},now)).toBeNull();
    expect(atlasScheduledRecoveryDelay({...stale,nextRefreshAt:'not-a-date'},now)).toBeNull();
  });
  it('rejects excessive waits while preserving stale status',()=>{
    expect(atlasScheduledRecoveryDelay({...stale,nextRefreshAt:new Date(now+ATLAS_MAX_RECOVERY_WAIT_MS).toISOString()},now)).toBeNull();
    expect(atlasScheduledRecoveryDelay({...stale,nextRefreshAt:new Date(now-2_000).toISOString()},now)).toBe(750);
  });
});
