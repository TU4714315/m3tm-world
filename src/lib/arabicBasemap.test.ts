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
   expect(str).toContain('"Saudi Arabia","السعودية"');
   expect(str).toContain('"Iran","إيران"');
   expect(str).toContain('"Yemen","اليمن"');
   expect(str).toContain('"Germany",');
   expect(str).toContain('name_en');
   expect(str).toContain('name:ar');
 });
 it('uses only formatted/string fallbacks accepted by MapLibre text-field',()=>{
   const expression=arabicCountryLabelExpression();
   expect(JSON.stringify(expression)).not.toContain('null');
   expect(expression[0]).toBe('match');
   const englishMatch=expression.at(-1) as unknown[];
   expect(englishMatch[0]).toBe('match');
   expect(JSON.stringify(englishMatch)).toContain('"Saudi Arabia","السعودية"');
   const sourceFallback=englishMatch.at(-1) as unknown[];
   expect(sourceFallback).toEqual(['coalesce',['get','name:ar'],['get','name_en'],['get','name'],'']);
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
