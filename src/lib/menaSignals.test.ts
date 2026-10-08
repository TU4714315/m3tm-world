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
  it('reports publisher coverage without upgrading syndicated articles',()=>{
    const d=regionalPublicSignals({gdelt_events:[
      {id:'11',lat:24.7,lng:46.7,sources:1,corroboration:'single-source-report',event_category:'aerial_attack'},
      {id:'12',lat:25.3,lng:44,sources:2,corroboration:'multi-source-report',event_category:'armed_clash'}
    ]});
    expect(d.events.find(e=>e.id==='gdelt:11')?.multiplePublishers).toBe(false);
    expect(d.events.find(e=>e.id==='gdelt:12')?.multiplePublishers).toBe(true);
  });
  it('uses the GDELT archive timestamp, not HTTP response time',()=>{
    expect(gdeltWindowTime('20261004150000.export.CSV.zip')).toBe('2026-10-04T15:00:00.000Z');
    expect(gdeltWindowTime('20261304150000.export.CSV.zip')).toBeNull();
  });
});

describe('M3TM Fusion Radar — source timing and coverage',()=>{
  const now=Date.parse('2026-10-05T04:00:00Z');
  it('separates 1h/6h/24h/7d, previous 6h and undated evidence',async()=>{
    const {buildMenaFusionRadar}=await import('./menaSignals');
    const timestamps=[
      '2026-10-05T03:45:00Z', '2026-10-04T23:00:00Z',
      '2026-10-04T20:00:00Z', '2026-10-02T12:00:00Z',
      '2026-10-05T05:00:00Z',
    ];
    const r=buildMenaFusionRadar({gdelt_events:timestamps.map((date,i)=>({
      id:String(i+1),lat:24.7,lng:46.7,date,
      url:i===0?'https://publisher.example/story':'',
      event_category:'material_conflict',
      corroboration:i===0?'multi-source-report':'single-source-report',
      sources:i===0?2:1,
    }))},'2026-10-05T03:45:00Z',now);
    expect(r.windows).toEqual({h1:1,h6:2,h24:3,d7:4});
    expect(r.previous6h).toBe(1);
    expect(r.coverage.invalidDates).toBe(1);
    expect(r.coverage.missingLinks).toBe(4);
    expect(r.coverage.multiplePublishers).toBe(1);
    expect(r.source.publicationState).toBe('fresh');
    expect(r.source.publishedAgeMinutes).toBe(15);
  });
  it('does not treat fetch time or future timestamps as source freshness',async()=>{
    const {buildMenaFusionRadar}=await import('./menaSignals');
    const r=buildMenaFusionRadar({gdelt_events:[
      {id:'a',lat:25,lng:45,date:'2026-10-05T04:10:00Z'},
      {id:'b',lat:25,lng:45},
    ]},'2026-10-04T21:00:00Z',now);
    expect(r.windows.h24).toBe(0);
    expect(r.coverage.invalidDates).toBe(2);
    expect(r.source.publicationState).toBe('stale');
    expect(buildMenaFusionRadar({},null,now).source.publicationState).toBe('unknown');
  });

  it('ages out a disconnected public aviation feed and suppresses old rising trends',async()=>{
    const {buildMenaFusionRadar}=await import('./menaSignals');
    const input={
      military_activity:[{lat:24,lng:46,trend:'up',data_state:'live'}],
      military_activity_meta:{
        mode:'coarse-regional-aggregate',provider_healthy:true,stale_fallback:false,
      },
      flight_source_status:{status:'active',timestamp:'2026-10-05T03:53:00Z'},
    };
    const old=buildMenaFusionRadar(input,null,now);
    expect(old.airObservation).toEqual({
      regionalCells:1,upwardOrNew:0,staleCells:1,
      providerHealthy:null,staleFallback:true,mode:'aggregate-only',
    });
    const fresh=buildMenaFusionRadar({
      ...input,flight_source_status:{status:'active',timestamp:'2026-10-05T03:57:00Z'},
    },null,now);
    expect(fresh.airObservation).toEqual({
      regionalCells:1,upwardOrNew:1,staleCells:0,
      providerHealthy:true,staleFallback:false,mode:'aggregate-only',
    });
  });
  it('shares the exact stale clock and strips military identifying fields from map markers',async()=>{
    const {coarseFlightSourceStale, coarseFlightMapFeatures}=await import('./menaSignals');
    const data={
      flight_source_status:{status:'active',timestamp:'2026-10-05T03:55:00Z'},
      military_activity_meta:{mode:'coarse-regional-aggregate',stale_fallback:false},
    };
    expect(coarseFlightSourceStale(data, Date.parse('2026-10-05T04:00:00Z'))).toBe(false);
    expect(coarseFlightSourceStale(data, Date.parse('2026-10-05T04:00:00.001Z'))).toBe(true);
    expect(coarseFlightSourceStale({...data,military_activity_meta:{...data.military_activity_meta,stale_fallback:true}},Date.parse('2026-10-05T03:55:01Z'))).toBe(true);
    expect(coarseFlightSourceStale({
      flight_source_status:{status:'degraded',timestamp:'2026-10-05T03:59:59Z'},
    },Date.parse('2026-10-05T04:00:00Z'))).toBe(true);
    const rows=[
      {lat:24,lng:45,trend:'up',data_state:'live',level:2,activity:'متوسط',callsign:'PRIVATE',icao24:'HIDDEN',heading:89},
    ] as never;
    const features=coarseFlightMapFeatures(rows,coarseFlightSourceStale({...data,military_activity_meta:{stale_fallback:true}}));
    expect(features).toHaveLength(1);
    expect(features[0].properties).toMatchObject({trend:undefined,data_state:'cached-stale'});
    expect(JSON.stringify(features)).not.toMatch(/PRIVATE|HIDDEN|icao24|heading|callsign/);
    expect(coarseFlightMapFeatures(rows,false)[0].properties.trend).toBe('up');
    expect(coarseFlightMapFeatures([{lat:NaN,lng:45}])).toHaveLength(0);
  });
  it('uses only coarse MENA aggregate counts, never military identities or positions',async()=>{
    const {buildMenaFusionRadar}=await import('./menaSignals');
    const r=buildMenaFusionRadar({
      military_activity:[
        {lat:24,lng:45,trend:'up',data_state:'cached-stale',callsign:'SECRET-CALLSIGN',icao24:'secret'} as never,
        {lat:25,lng:47,trend:'steady',data_state:'live',trajectory:[1,2]} as never,
        {lat:40,lng:-75,trend:'new'} as never
      ],
      military_activity_meta:{mode:'coarse-regional-aggregate',provider_healthy:false,stale_fallback:true},
      conflict_source_status:{acled:{status:'restricted_recency'},gdelt:{status:'ok'}},
    },null,now);
    expect(r.airObservation).toEqual({
      regionalCells:2,upwardOrNew:0,staleCells:2,
      providerHealthy:null,staleFallback:true,mode:'aggregate-only',
    });
    expect(r.source.acledStatus).toBe('restricted_recency');
    expect(r.airObservation.upwardOrNew).toBe(0); // stale trend must not become a fresh alert
    expect(buildMenaFusionRadar({
      military_activity_meta:{provider_healthy:false,stale_fallback:false},
    },null,now).airObservation.providerHealthy).toBeNull();
    const output=JSON.stringify(r);
    expect(output).not.toContain('SECRET-CALLSIGN');
    expect(output).not.toContain('trajectory');
    expect(output).not.toContain('icao24');
    expect(output).not.toContain('secret');
  });
});

describe('M3TM independent APP published news witness',()=>{
  const now=Date.parse('2026-10-05T04:00:00Z');
  const pin={
    id:'app-1',title:'منشور إخباري موثق الإسناد',
    source:'M3TM.APP',url:'https://example.org/article',
    published:'2026-10-05T03:30:00Z',
    lat:24.5,lng:45.5,
    precision:'regional-0.5deg' as const,
    provenance:'M3TM.APP public feed' as const,
    status:'source-reported' as const,
    language:'ar',
  };
  it('keeps published APP news separate from classified GDELT conflicts',async()=>{
    const {buildMenaFusionRadar}=await import('./menaSignals');
    const r=buildMenaFusionRadar({
      app_news:[pin,{...pin,id:'second'},{
        ...pin,id:'bad-source',provenance:'independent-fallback' as never
      },{
        ...pin,id:'old',published:'2025-10-04T03:30:00Z',url:'https://example.org/old'
      },{
        ...pin,id:'keyword',precision:'keyword-centroid' as never,url:'https://example.org/untrusted'
      }],
    },null,now);
    expect(r.appNewsSignals).toHaveLength(1);
    expect(r.appNewsLast24h).toBe(1);
    expect(r.appNewsSignals[0]).toMatchObject({
      title:pin.title,source:pin.source,url:pin.url,ageMs:30*60_000,language:'ar',
    });
    expect(r.events).toHaveLength(0);
    expect(r.windows.h1).toBe(0);
    expect(JSON.stringify(r.appNewsSignals)).not.toContain('lat');
    expect(JSON.stringify(r.appNewsSignals)).not.toContain('lng');
    expect(JSON.stringify(r.appNewsSignals)).not.toContain('keyword-centroid');
  });
});
