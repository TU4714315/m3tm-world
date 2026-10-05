import {describe,it,expect} from 'vitest';
import {normalizeGdeltHistory} from './gdeltPublicHistory';
const base = {
  source:'GDELT 2.0 Events',sampling:'stored-source-reports',
  region:'middle-east-red-sea',precision:'generalized-0.25deg',
  analytics:{lookbackHours:24,totalReportRows:25,distinctEventIds:24,
    singlePublisher:24,multiplePublishers:1,
    categories:[{category:'armed_clash',reports:25}],
    countries:[{country:'YM',reports:10}],
    timeline:[{publishedAt:'2026-10-05T12:15:00Z',reports:25}]},
};
describe('GDELT MENA public historical evidence sanitization',()=>{
  it('separates codes from independent verification, scrubs unrelated fields',()=>{
    const result=normalizeGdeltHistory({...base,events:[{
      event_id:123,latitude:24.756,longitude:46.777,
      event_category:'armed_clash',country:'SA',place:'Riyadh',
      source_count:2,article_count:10,source_url:'https://news.example/article',
      window_name:'20261005121500.export.CSV.zip',
      icao24:'SECRET',callsign:'military',trajectory:[1,2]
    }]},24,50);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({lat:24.75,lng:46.75,
      publisherCoverage:'multi-source-report'});
    expect(JSON.stringify(result)).not.toMatch(/SECRET|callsign|trajectory|icao24/);
    expect(result.guidance).toContain('does not prove');
    expect(result.totalReportRows).toBe(25);
  });
  it('drops invalid location, URL schemes, dates and duplicate IDs',()=>{
    const event={
      event_id:123,latitude:25,longitude:45,event_category:'aerial_attack',
      window_name:'20261005120000.export.CSV.zip',
      source_url:'javascript:evil()',place:'<private>Headquarters',
      source_count:1,
    };
    const result=normalizeGdeltHistory({...base,events:[event,event,
      {...event,event_id:124,latitude:0},
      {...event,event_id:125,window_name:'19700101000000.export.CSV.zip'}]},24,100);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].url).toBe('');
    expect(result.events[0].place).not.toContain('<');
    expect(result.events[0].publisherCoverage).toBe('single-source-report');
  });
  it('fails closed on mislabeled or incompatible source periods',()=>{
    expect(()=>normalizeGdeltHistory({...base,precision:'exact'},24,50)).toThrow();
    expect(()=>normalizeGdeltHistory(base,168,50)).toThrow();
  });
});
