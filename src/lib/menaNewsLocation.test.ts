import { describe, it, expect } from 'vitest';
import {locatePublishedMenaNews,locatePublishedMenaReport} from './menaNewsLocation';

describe('MENA bulletin map link provenance',()=>{
  it('focuses a geotagged APP article in its already-published half-degree region',()=>{
    const item={url:'https://example.org/article',lat:24.5,lng:46.5,
      provenance:'M3TM.APP public feed',status:'source-reported',precision:'regional-0.5deg'};
    expect(locatePublishedMenaNews({app_news:[item]},item.url)).toEqual({lat:24.5,lng:46.5});
  });
  it('rejects RSS keyword contexts, undated coordinates and malformed points',()=>{
    const good={url:'https://example.org/article',lat:24.5,lng:46.5,
      provenance:'M3TM.APP public feed',status:'source-reported',precision:'regional-0.5deg'};
    expect(locatePublishedMenaNews({app_news:[{...good,provenance:'independent-rss'}]},good.url)).toBeNull();
    expect(locatePublishedMenaNews({app_news:[{...good,lat:null}]},good.url)).toBeNull();
    expect(locatePublishedMenaNews({app_news:[{...good,lat:40.7,lng:-74}]},good.url)).toBeNull();
  });
  it('links source-backed GDELT/ACLED region records, never a keyword-inferred URL',()=>{
    expect(locatePublishedMenaReport({gdelt_events:[{id:'gdelt-xy',lat:25,lng:47}]},'gdelt:xy')).toEqual({lat:25,lng:47});
    expect(locatePublishedMenaReport({conflict_live_events:[{id:'one',provider:'ACLED',lat:14,lng:43}]},'acled:one')).toEqual({lat:14,lng:43});
    expect(locatePublishedMenaReport({gdelt_events:[{id:'one',lat:40.7,lng:-74}]},'gdelt:one')).toBeNull();
    expect(locatePublishedMenaReport({gdelt_events:[{id:'one',lat:15,lng:45}]},'gdelt:other')).toBeNull();
  });
});
