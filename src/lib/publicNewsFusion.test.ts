import {describe,expect,it} from 'vitest';
import {mergePublicNews,publicUrl,sourceTitleKey,selectPublicHeadlineAlerts,type PublicNewsRow} from './publicNewsFusion';
const published=new Date(Date.now()-10*60_000).toISOString();
const item=(o:Partial<PublicNewsRow>={}):PublicNewsRow=>({
 id:'1',title:'Reported incident in the Red Sea',description:'Observed in published reporting',
 link:'https://example.org/news?utm_source=chat',published,source:'Publisher A',
 risk_score:3,coords:null,coords_default:true,language:'en',
 feed_origin:'independent-fallback',location_basis:'keyword-context',
 verification_status:'source-reported',machine_assessment:null,...o,
});
describe('source-preserving public news fusion',()=>{
 it('normalizes duplicate URL tracking params and keeps publisher evidence',()=>{
   const result=mergePublicNews([item(),item({source:'Publisher B',link:'https://example.net/story'})]);
   expect(result).toHaveLength(1);
   expect(result[0].publication_count).toBe(2);
   expect(result[0].evidence_label).toContain('ليس تحققًا');
   expect(result[0].evidence_links?.map(x=>x.publisher)).toEqual(['Publisher A','Publisher B']);
 });
 it('does not fabricate a map incident position from a keyword mention',()=>{
   expect(mergePublicNews([item({coords:[32,53]})])[0].coords).toBeNull();
 });
 it('retains explicit primary feed published geolocation and prioritizes Arabic',()=>{
   const result=mergePublicNews([item(),item({
     feed_origin:'m3tm-app',source:'M3TM.APP',language:'ar',
     coords:[24.5,46.5],location_basis:'published-feed-coordinate',
   })]);
   expect(result[0].coords).toEqual([24.5,46.5]);
   expect(result[0].feed_origin).toBe('m3tm-app');
 });
 it('does not replace missing or future timestamps with current time',()=>{
   expect(mergePublicNews([item({published:''}),item({published:'2099-10-05'})])).toEqual([]);
 });
 it('refuses local or script URLs and removes tracking params',()=>{
   expect(publicUrl('javascript:alert(1)')).toBe('');
   expect(publicUrl('http://localhost/news')).toBe('');
   expect(publicUrl('https://foo.example/p?utm_medium=a&id=1')).toBe('https://foo.example/p?id=1');
 });
 it('normalizes Arabic title variants and ignores uninformative titles',()=>{
   expect(sourceTitleKey('اشتباكٌ  مُبلّغ في اليمن'))
     .toBe(sourceTitleKey('اشتباك مبلغ في اليمن'));
   expect(mergePublicNews([item({title:'NEWS'})])).toEqual([]);
 });
 it('keeps distinct titles and publication windows as separate reports',()=>{
   const a=item();
   const b=item({title:'Official diplomatic statement about ceasefire', link:'https://example.net/independent-article'});
   expect(mergePublicNews([a,b])).toHaveLength(2);
   const sevenHoursAgo=new Date(Date.now()-7*60*60_000).toISOString();
   expect(mergePublicNews([a,item({published:sevenHoursAgo})])).toHaveLength(2);
 });

  it('never emits social/keyword stories or stale items as breaking alerts',()=>{
    const fresh=item({risk_score:9,feed_origin:'m3tm-app'});
    const keyword=item({risk_score:9,feed_origin:'m3tm-app',risk_basis:'keyword-only'});
    const telegram=item({risk_score:10,feed_origin:'independent-fallback'});
    const old=item({risk_score:9,feed_origin:'m3tm-app',
      published:new Date(Date.now()-4*60*60_000).toISOString()});
    expect(selectPublicHeadlineAlerts([fresh,keyword,telegram,old])).toEqual([fresh]);
  });
});
