import {afterEach,describe,expect,it,vi} from 'vitest';
import {GET} from './route';

afterEach(()=>vi.unstubAllGlobals());
const now=()=>new Date(Date.now()-60_000).toISOString();
describe('public news multi-source ingestion contract',()=>{
 it('preserves Arabic APP plus parsed RSS, and exposes unavailable channels honestly',async()=>{
   const published=now();
   const mock=vi.fn(async(input:RequestInfo|URL)=>{
     const url=String(input);
     if(url.includes('m3tm.app/data/news.json')){
       return new Response(JSON.stringify({fetchedAt:published,items:[{
         id:'app-1',title:'تقرير موثق النشر عن تطورات إقليمية في المنطقة',
         summary:'عنوان منشور تجريبي عبر التغذية العامة',source:'Original Publisher',
         sourceUrl:'https://example.org/arabic/1',publishedAt:published,
         latitude:25,longitude:45,severity:'high',
       }]}),{status:200});
     }
     if(url.includes('feeds.bbci.co.uk/news/world/rss.xml')){
       const rss='<rss><channel><item><title>Regional diplomatic update from public media</title>'+
         '<link>https://example.net/report</link><pubDate>'+new Date(published).toUTCString()+
         '</pubDate><description>Published public RSS report</description></item></channel></rss>';
       return new Response(rss,{status:200});
     }
     return new Response('blocked',{status:503});
   });
   vi.stubGlobal('fetch',mock);
   const response=await GET(),data=await response.json();
   expect(response.status).toBe(200);
   expect(mock).toHaveBeenCalledTimes(9); // APP + four Telegram + four curated RSS
   expect(data.news.some((r:{feed_origin:string})=>r.feed_origin==='m3tm-app')).toBe(true);
   expect(data.news.some((r:{source:string})=>r.source==='BBC')).toBe(true);
   expect(data.news).toHaveLength(2);
   expect(data.source_health.app).toBe('data');
   const broken=data.source_health.providers.find((p:{source:string})=>p.source==='t.me/Faytuks');
   expect(broken.state).toBe('unavailable');
   expect(data.source_health.providers.some((p:{source:string;state:string})=>
     p.source==='BBC'&&p.state==='ready')).toBe(true);
 });
 it('never pins social location mentions as incident coordinates',async()=>{
   const published=now();
   vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{
     const url=String(input);
     if(url.includes('m3tm.app/'))return new Response('',{status:503});
     if(url.includes('feeds.bbci.co.uk/news/world/rss.xml'))
       return new Response('<rss><item><title>Iran mentioned in report about another country</title>'+
         '<link>https://example.org/story</link><pubDate>'+
         new Date(published).toUTCString()+'</pubDate></item></rss>',{status:200});
     return new Response('',{status:503});
   }));
   const data=await(await GET()).json();
   expect(data.news).toHaveLength(1);
   expect(data.news[0].coords).toBeNull();
   expect(data.news[0].risk_basis).toBe('keyword-only');
   expect(data.source_health.app).toBe('unavailable');
 });
});
