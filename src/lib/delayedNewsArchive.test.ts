import { beforeEach, describe, expect, it, vi } from 'vitest';
const cache=vi.hoisted(()=>({items:[] as unknown[]}));
vi.mock('./durableCache',()=>({durableGetJson:async()=>({value:cache.items}),durableSetJson:async(_key:string,items:unknown[])=>{cache.items=structuredClone(items);}}));
import { archiveMapNews } from './delayedNewsArchive';
import { delayedPublicNews } from './mapAccessPolicy';
beforeEach(()=>{cache.items=[];});
describe('delayed public news archive',()=>{
  it('retains a real event until it becomes public after twelve hours',async()=>{
    const now=Date.parse('2026-10-15T12:00:00Z');
    const event={id:'yemen-event',title:'Published report',published:new Date(now).toISOString()};
    expect(delayedPublicNews(await archiveMapNews([event],now),now)).toEqual([]);
    expect(delayedPublicNews(await archiveMapNews([],now+12*3600000),now+12*3600000)).toEqual([event]);
  });
  it('discards undated/future records and prunes expired history without inventing timestamps',async()=>{
    const now=Date.parse('2026-10-15T12:00:00Z');
    const values=await archiveMapNews([{id:'unknown',fetchedAt:new Date(now).toISOString()},
      {id:'future',published:new Date(now+1).toISOString()},
      {id:'expired',published:new Date(now-8*86400000).toISOString()}],now);
    expect(values).toEqual([]);
  });
});
