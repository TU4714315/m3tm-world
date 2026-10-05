import {describe,expect,it} from 'vitest';
import type {GdeltHistoryView} from './gdeltPublicHistory';
import {buildConflictEvolutionFrames,conflictGridGeoJson,evidenceBand,CONFLICT_FOCUS} from './conflictEvolution';

const t0=Date.parse('2026-10-05T12:00:00.000Z');
const stamp=(i:number)=>new Date(t0+i*15*60_000).toISOString();
const example: GdeltHistoryView={
  data_state:'historical-sample',source:'GDELT 2.0 Events',region:'middle-east-red-sea',
  lookbackHours:1,reportLimit:200,totalReportRows:7,distinctEventIds:7,
  singlePublisher:7,multiplePublishers:0,categories:[],countries:[],
  timeline:[0,1,2,3].map(i=>({publishedAt:stamp(i),reports:i===1?4:i===3?3:0})),
  events:[
    {id:1,publishedAt:stamp(1),reportTime:null,eventDate:null,lat:15,lng:44,category:'armed_clash',country:'YM',place:'',url:'https://example.org/1',articles:1,publishers:1,publisherCoverage:'single-source-report'},
    {id:2,publishedAt:stamp(1),reportTime:null,eventDate:null,lat:15.2,lng:44.1,category:'bombing',country:'YM',place:'',url:'https://example.org/2',articles:1,publishers:1,publisherCoverage:'single-source-report'},
    {id:3,publishedAt:stamp(3),reportTime:null,eventDate:null,lat:33,lng:45,category:'civil_unrest',country:'IZ',place:'',url:'https://example.org/3',articles:1,publishers:1,publisherCoverage:'single-source-report'},
    {id:4,publishedAt:stamp(3),reportTime:null,eventDate:null,lat:25,lng:48,category:'verbal_report',country:'SA',place:'',url:'https://example.org/4',articles:1,publishers:1,publisherCoverage:'single-source-report'},
  ],guidance:'coded public reports',
};
describe('source-coded conflict report evolution',()=>{
  it('retains empty source time bins rather than inventing activity',()=>{
    const f=buildConflictEvolutionFrames(example);
    expect(f.map(x=>x.recordedReports)).toEqual([0,4,0,3]);
    expect(f.map(x=>x.sampledReports)).toEqual([0,2,0,2]);
    expect(f[0].cells).toEqual([]);
  });
  it('shows Yemen news in regional 3-degree cells, not exact published positions',()=>{
    const f=buildConflictEvolutionFrames(example,'yemen');
    expect(f[1].cells).toEqual([{lat:15.5,lng:45.5,count:2,band:'violence'}]);
    expect(f[3].cells).toEqual([]);
  });
  it('uses reported source publication time rather than incident date',()=>{
    const f=buildConflictEvolutionFrames({...example,events:[{...example.events[0],eventDate:'2020-01-01'}]});
    expect(f[1].sampledReports).toBe(1);
  });
  it('does not mix statements, civil unrest and reported violence',()=>{
    expect(evidenceBand('verbal_report')).toBe('diplomatic');
    expect(evidenceBand('civil_unrest')).toBe('unrest');
    expect(evidenceBand('undefined_type')).toBeNull();
    expect(buildConflictEvolutionFrames(example,'mena','violence')[3].sampledReports).toBe(0);
    expect(buildConflictEvolutionFrames(example,'mena','diplomatic')[3].sampledReports).toBe(1);
  });
  it('never converts aggregate counts to fabricated geo events',()=>{
    const f=buildConflictEvolutionFrames({...example,events:[]});
    expect(f[1].recordedReports).toBe(4);
    expect(f[1].cells).toEqual([]);
    expect(f[1].notRepresentative).toBe(true);
  });
  it('deduplicates identifiers and excludes future/invalid locations',()=>{
    const f=buildConflictEvolutionFrames({...example,events:[
      example.events[0],example.events[0],
      {...example.events[0],id:9,publishedAt:stamp(8)},
      {...example.events[0],id:10,lat:Infinity},
    ]});
    expect(f[1].sampledReports).toBe(1);
  });
  it('public map contract excludes source urls, actors and unit identities',()=>{
    const view=conflictGridGeoJson(buildConflictEvolutionFrames(example,'yemen')[1].cells);
    expect(JSON.stringify(view)).not.toContain('example.org');
    expect(view.features[0].properties.precision).toBe('3-degree-observed-report-sample');
    expect(Object.keys(CONFLICT_FOCUS)).toContain('iraq-iran');
  });
});
