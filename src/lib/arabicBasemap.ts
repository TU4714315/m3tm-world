/** Locale-only style for the existing CARTO vector place labels.
 * Does not alter geographic borders, sovereignty, map geometry or provenance.
 * ISO 3166 display names are produced natively by Intl; no upstream UI copied.
 */
type LabelLayer = { id:string; type:string; source?:string; 'source-layer'?:string };
type LabelMap = {
  getStyle():{layers?:LabelLayer[]}|undefined;
  setLayoutProperty(layer:string,prop:string,value:unknown):void;
  setPaintProperty(layer:string,prop:string,value:unknown):void;
};
const SHORT_MENA:Readonly<Record<string,string>>={
  SA:'السعودية',YE:'اليمن',IR:'إيران',IQ:'العراق',AE:'الإمارات',
  QA:'قطر',BH:'البحرين',KW:'الكويت',OM:'عُمان',JO:'الأردن',
  SY:'سوريا',LB:'لبنان',PS:'فلسطين',IL:'إسرائيل',
  EG:'مصر',SD:'السودان',LY:'ليبيا',DZ:'الجزائر',
  TN:'تونس',MA:'المغرب',TR:'تركيا',SO:'الصومال',
  DJ:'جيبوتي',ER:'إريتريا',ET:'إثيوبيا',
};
export function arabicCountryLabelExpression():unknown[]{
  const names=new Intl.DisplayNames(['ar'],{type:'region',fallback:'none'});
  const englishNames=new Intl.DisplayNames(['en'],{type:'region',fallback:'none'});
  const entries:Array<string>=[];
  const englishEntries=new Map<string,string>();
  for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){
    const code=String.fromCharCode(a,b);
    const localized=SHORT_MENA[code]||names.of(code);
    if(localized&&localized!==code){
      entries.push(code,localized);
      const english=englishNames.of(code);
      if(english&&english!==code&&!englishEntries.has(english)) englishEntries.set(english,localized);
    }
  }
  return ['coalesce',
    ['match',['upcase',['coalesce',['get','iso_a2'],'']],...entries,null],
    ['get','name:ar'],
    // CARTO place_country tiles do not consistently expose iso_a2/name:ar.
    // Their style itself renders `name_en`, so retain a deterministic Arabic
    // fallback keyed by that published English country label before falling
    // back to the raw source name. This changes text only, never geometry.
    ['match',['coalesce',['get','name_en'],['get','name'],''],
      ...Array.from(englishEntries.entries()).flat(),null],
    ['get','name'],['get','name_en']];
}
const ARABIC_LOCAL_NAME=['coalesce',['get','name:ar'],['get','name']];
export function applyArabicBasemapLabels(map:LabelMap):string[]{
  const changed:string[]=[];
  for(const layer of map.getStyle()?.layers||[]){
    if(layer.type!=='symbol'||layer['source-layer']!=='place')continue;
    const id=layer.id;
    if(!/^place_(country|state|continent|city|capital)/.test(id))continue;
    const isCountry=id.startsWith('place_country');
    map.setLayoutProperty(id,'text-field',
      isCountry?arabicCountryLabelExpression():ARABIC_LOCAL_NAME);
    // Arabic font support is provided by the existing CARTO Noto Sans glyph
    // stack; keep styling and geographic source attribution intact.
    map.setLayoutProperty(id,'text-transform','none');
    map.setLayoutProperty(id,'text-font',['Noto Sans Regular']);
    map.setPaintProperty(id,'text-color',isCountry?'#F5F1E7':'#E8EEF2');
    map.setPaintProperty(id,'text-halo-color','#071018');
    map.setPaintProperty(id,'text-halo-width',isCountry?1.7:1.35);
    map.setPaintProperty(id,'text-halo-blur',0.35);
    map.setPaintProperty(id,'text-opacity',isCountry?0.96:0.9);
    changed.push(id);
  }
  return changed;
}
