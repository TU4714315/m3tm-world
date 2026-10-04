import {describe,expect,it} from 'vitest';
import {gdeltWindowTime,isMiddleEastBelt,regionalPublicSignals} from './menaSignals';
describe('M3TM regional public evidence',()=>{
  it('includes the Middle East and Red Sea but does not misclassify New York',()=>{
    expect(isMiddleEastBelt(24.7,46.7)).toBe(true);
    expect(isMiddleEastBelt(15.6,33)).toBe(true);
    expect(isMiddleEastBelt(40.7,-74)).toBe(false);
  });
  it('de-duplicates GDELT reports and does not expose military identifiers',()=>{
    const data=regionalPublicSignals({
      gdelt_events:[{id:'1',lat:24.75,lng:46.75}],
      conflict_live_events:[{id:'gdelt-1',lat:24.75,lng:46.75}],
      military_activity:[{lat:24,lng:46,icao24:'secret'} as {lat:number;lng:number}],
      naval_activity:[{lat:15,lng:42,mmsi:'secret'} as {lat:number;lng:number}],
    });
    expect(data.reports).toBe(1);expect(data.airRegions).toBe(1);
    expect(data.seaRegions).toBe(1);
    expect(JSON.stringify(data)).not.toContain('secret');
  });
  it('surfaces names of published CAMEO parties but not live unit telemetry',()=>{
    const d=regionalPublicSignals({
      gdelt_events:[{id:'99',lat:24.7,lng:46.7,
        reported_actor1:'Government',reported_actor2:'Opposition'}],
      military_activity:[{lat:24,lng:46,callsign:'hidden-unit'} as {lat:number;lng:number}],
    });
    expect(d.events[0].actors).toEqual(['Government','Opposition']);
    expect(JSON.stringify(d)).not.toContain('hidden-unit');
  });
  it('uses the GDELT archive timestamp, not HTTP response time',()=>{
    expect(gdeltWindowTime('20261004150000.export.CSV.zip')).toBe('2026-10-04T15:00:00.000Z');
    expect(gdeltWindowTime('20261304150000.export.CSV.zip')).toBeNull();
  });
});
