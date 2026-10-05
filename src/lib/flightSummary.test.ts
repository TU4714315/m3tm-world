import {describe,expect,it} from 'vitest';
import {buildFlightSummary,markCachedFlightDataStale} from './flightSummary';

describe('flight process-cache fallback',()=>{
  const now=Date.parse('2026-10-05T04:00:00Z');
  it('marks every coarse military observation stale, preserving the last good snapshot',()=>{
    const good={
      source:'opensky-anon',timestamp:'2026-10-05T03:50:00Z',
      commercial_flights:[],military_flights:[],
      military_activity:[
        {lat:24,lng:46,trend:'up',data_state:'live',observed_at:'2026-10-05T03:49:00Z',age_seconds:60},
        {lat:26,lng:42,trend:'new',data_state:'live'},
      ],
      military_activity_meta:{
        mode:'coarse-regional-aggregate',stale_fallback:false,
        provider_healthy:true,exact_tracks_exposed:false,identifiers_exposed:false,
      },
      flight_source_status:{status:'active',timestamp:'2026-10-05T03:50:00Z'},
    };
    const fallback=markCachedFlightDataStale(good,now);
    expect(good.military_activity[0].data_state).toBe('live');
    expect(good.military_activity[0].trend).toBe('up');
    expect(fallback.source).toBe('opensky-anon+stale');
    expect(fallback.timestamp).toBe('2026-10-05T03:50:00Z');
    expect(fallback.flight_source_status.status).toBe('degraded');
    expect(fallback.military_activity_meta.stale_fallback).toBe(true);
    expect(fallback.military_activity_meta.exact_tracks_exposed).toBe(false);
    expect(fallback.military_activity[0].data_state).toBe('cached-stale');
    expect(fallback.military_activity[0].trend).toBeUndefined();
    expect(fallback.military_activity[0].age_seconds).toBe(660);
    expect(fallback.military_activity[1].data_state).toBe('cached-stale');
    expect(fallback.military_activity[1].age_seconds).toBeNull();
    expect(buildFlightSummary(fallback).status).toBe('degraded');
    expect(markCachedFlightDataStale(fallback,now).source).toBe('opensky-anon+stale');
    const text=JSON.stringify(fallback);
    expect(text).not.toContain('icao24');
    expect(text).not.toContain('trajectory');
  });
  it('keeps a safe degraded fallback when no aggregate is available',()=>{
    const out=markCachedFlightDataStale({source:'regional',military_activity:[],military_activity_meta:{stale_fallback:false}});
    expect(out.military_activity).toHaveLength(0);
    expect(out.military_activity_meta.stale_fallback).toBe(true);
  });
});
