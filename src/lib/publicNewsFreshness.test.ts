import {describe, expect, it} from 'vitest';
import {appNewsFreshness, appPublishedItemUrgency} from './publicNewsFreshness';

const NOW=Date.parse('2026-10-28T06:00:00.000Z');
const urgent={publishedAt:'2026-10-28T05:50:00Z',isBreaking:true,breaking:true,urgency:'breaking'};

describe('APP public news: source freshness must not be fabricated',()=>{
  it('marks a timely published snapshot current',()=>{
    const f=appNewsFreshness('2026-10-28T05:45:00Z',NOW);
    expect(f).toMatchObject({state:'current',age_minutes:15});
    expect(appPublishedItemUrgency(urgent,f,NOW)).toEqual({isBreaking:true,breaking:true,urgency:'breaking'});
  });
  it('keeps old headlines but removes misleading breaking flags',()=>{
    const f=appNewsFreshness('2026-10-23T20:22:57.872Z',NOW);
    expect(f.state).toBe('stale');
    expect(f.age_minutes).toBeGreaterThan(4*24*60);
    expect(appPublishedItemUrgency(urgent,f,NOW)).toEqual({isBreaking:false,breaking:false});
  });
  it('never invents freshness for absent, invalid or far-future metadata',()=>{
    for(const value of [undefined,null,'invalid','2026-10-29T06:00:00Z']){
      const f=appNewsFreshness(value,NOW);
      expect(f).toMatchObject({state:'unknown',fetched_at:null,age_minutes:null});
      expect(appPublishedItemUrgency(urgent,f,NOW)).toEqual({isBreaking:false,breaking:false});
    }
  });
  it('a recent digest cannot revive an old headline as breaking',()=>{
    const f=appNewsFreshness('2026-10-28T05:45:00Z',NOW);
    expect(appPublishedItemUrgency({...urgent,publishedAt:'2026-10-24T05:50:00Z'},f,NOW))
      .toEqual({isBreaking:false,breaking:false});
  });
  it('future-dated and invalid headlines cannot become breaking',()=>{
    const f=appNewsFreshness('2026-10-28T05:45:00Z',NOW);
    expect(appPublishedItemUrgency({...urgent,publishedAt:'2026-10-29T05:50:00Z'},f,NOW).isBreaking).toBe(false);
    expect(appPublishedItemUrgency({...urgent,publishedAt:'bad'},f,NOW).breaking).toBe(false);
  });
});
