import {describe,it,expect,vi} from 'vitest';
import {applyArabicBasemapLabels,arabicCountryLabelExpression} from './arabicBasemap';
describe('Arabic worldwide map labels without geometry changes',()=>{
 it('includes audited Middle Eastern names and globally derived ISO names',()=>{
   const e=arabicCountryLabelExpression();
   const str=JSON.stringify(e);
   expect(str).toContain('"SA","السعودية"');
   expect(str).toContain('"IR","إيران"');
   expect(str).toContain('"YE","اليمن"');
   expect(str).toContain('"DE",');
   expect(str).toContain('name:ar');
 });
 it('falls back to source Arabic/name when ISO code is missing or unmatched',()=>{
   const expression=arabicCountryLabelExpression();
   const match=expression[1] as unknown[];
   expect(match.at(-1)).toBeNull();
   expect(expression).toEqual(expect.arrayContaining([['get','name:ar'],['get','name']]));
 });
 it('changes only vector text labels and does not mutate boundaries',()=>{
   const map={
     getStyle:()=>({layers:[
       {id:'place_country_2',type:'symbol',source:'carto','source-layer':'place'},
       {id:'place_city_r2',type:'symbol',source:'carto','source-layer':'place'},
       {id:'public-boundaries',type:'line',source:'public'},
       {id:'flight-labels',type:'symbol',source:'flights'},
     ]}),
     setLayoutProperty:vi.fn(),setPaintProperty:vi.fn(),
   };
   expect(applyArabicBasemapLabels(map)).toEqual(['place_country_2','place_city_r2']);
   expect(map.setLayoutProperty).not.toHaveBeenCalledWith('public-boundaries',expect.anything(),expect.anything());
   expect(map.setPaintProperty).toHaveBeenCalledWith('place_country_2','text-halo-width',1.7);
   expect(map.setPaintProperty).toHaveBeenCalledWith('place_country_2','text-color','#F5F1E7');
   expect(map.setPaintProperty).toHaveBeenCalledWith('place_city_r2','text-color','#E8EEF2');
 });
});
