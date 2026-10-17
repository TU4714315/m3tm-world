import { describe, expect, it } from 'vitest';
import { needsApprovedAppNewsRetry } from './appNewsRetry';

const approved = {feed_origin:'m3tm-app',id:'abc',title:'خبر معتمد',published:'2026-10-17T20:00:00Z'};
describe('public ticker bounded recovery', () => {
  it('does not retry after a valid approved APP headline exists',()=>{
    expect(needsApprovedAppNewsRetry([approved],0)).toBe(false);
    expect(needsApprovedAppNewsRetry([approved,{feed_origin:'independent-rss'}],1)).toBe(false);
  });
  it('retries when upstream temporarily returns only unapproved source rows',()=>{
    expect(needsApprovedAppNewsRetry([{feed_origin:'independent-rss',title:'External'}],0)).toBe(true);
    expect(needsApprovedAppNewsRetry([],1)).toBe(true);
    expect(needsApprovedAppNewsRetry(null,0)).toBe(true);
    expect(needsApprovedAppNewsRetry([],2)).toBe(false);
  });
  it('never treats a missing or invented publication timestamp as an approved headline',()=>{
    expect(needsApprovedAppNewsRetry([{...approved,published:'invalid'}],0)).toBe(true);
    expect(needsApprovedAppNewsRetry([{...approved,published:new Date(Date.now()+20*60_000).toISOString()}],0)).toBe(true);
    expect(needsApprovedAppNewsRetry([{...approved,title:' '}],0)).toBe(true);
  });
});
