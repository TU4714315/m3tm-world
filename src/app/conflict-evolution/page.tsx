'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {buildConflictEvolutionFrames,conflictGridGeoJson,CONFLICT_FOCUS,
  type ConflictFocus,type ConflictKind} from '@/lib/conflictEvolution';
import type {GdeltHistoryView} from '@/lib/gdeltPublicHistory';
import {MAP_ATTRIBUTION_OPTIONS} from '@/lib/terrain-source-attribution';

const PERIODS=[{hours:1,label:'ساعة'},{hours:6,label:'٦ ساعات'},
  {hours:24,label:'٢٤ ساعة'},{hours:168,label:'٧ أيام'}] as const;
const KINDS:Array<{id:ConflictKind;label:string}>=[
  {id:'all',label:'كل التقارير'}, {id:'violence',label:'عنف واشتباكات'},
  {id:'unrest',label:'اضطرابات'}, {id:'diplomatic',label:'تصريحات'},
];
const LABELS:Record<string,string>={
  aerial_attack:'نشاط جوي مُرمّز', heavy_weapons:'أسلحة ثقيلة',
  bombing:'تفجير مُبلّغ', armed_clash:'اشتباك مُبلّغ',
  mass_violence:'عنف جماعي', assault:'اعتداء',
  material_conflict:'نزاع مادي', civil_unrest:'اضطرابات', verbal_report:'تصريح',
};
const BAND_LABEL:Record<string,string>={
  violence:'بلاغات عنف/نزاع',unrest:'بلاغات اضطرابات',diplomatic:'تصريحات',
};
function formatTime(s:string){
  return new Date(s).toLocaleString('ar-SA',{
    timeZone:'UTC',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',
  })+' UTC';
}

/** Public, historical news attribution only: no territorial or military live map. */
export default function ConflictEvolutionPage(){
  const container=useRef<HTMLDivElement>(null);
  const mapRef=useRef<maplibregl.Map|null>(null);
  const [ready,setReady]=useState(false),[mapError,setMapError]=useState(false);
  const [focus,setFocus]=useState<ConflictFocus>('mena');
  const [kind,setKind]=useState<ConflictKind>('all');
  const [period,setPeriod]=useState<1|6|24|168>(24);
  const [archive,setArchive]=useState<GdeltHistoryView|null>(null);
  const [coverage,setCoverage]=useState<{durable?:boolean;observedWindows?:number|null;expectedWindows?:number|null}|null>(null);
  const [loading,setLoading]=useState<'loading'|'ready'|'unavailable'>('loading');
  const [cursor,setCursor]=useState(-1),[playing,setPlaying]=useState(false);

  const frames=useMemo(()=>archive?buildConflictEvolutionFrames(archive,focus,kind):[],[archive,focus,kind]);
  const index=cursor<0?frames.length-1:Math.min(cursor,frames.length-1);
  const selected=frames[index]||null;
  const mapData=useMemo(()=>conflictGridGeoJson(selected?.cells||[]),[selected]);
  const peak=Math.max(1,...frames.map(x=>x.recordedReports));
  const sampled=Boolean(archive &&
    (archive.totalReportRows>archive.events.length || archive.events.length>=archive.reportLimit));

  useEffect(()=>{
    let active=true;
    const load=async()=>{
      try{
        const response=await fetch('/api/gdelt-history?hours='+period+'&limit=200');
        if(!response.ok)throw new Error('Unavailable source archive');
        const value=await response.json() as GdeltHistoryView;
        if(value.data_state!=='historical-sample'||value.lookbackHours!==period||
          !Array.isArray(value.timeline)||!Array.isArray(value.events))throw new Error('Source mismatch');
        if(active){setArchive(value);setLoading('ready');}
      }catch{if(active){setArchive(null);setLoading('unavailable');setPlaying(false);}}
    };
    setLoading('loading');setArchive(null);setCursor(-1);setPlaying(false);
    void load();
    const refresh=window.setInterval(()=>{if(!document.hidden)void load();},120_000);
    return()=>{active=false;window.clearInterval(refresh);};
  },[period]);

  useEffect(()=>{
    let active=true;
    void fetch('/api/source-coverage').then(r=>r.ok?r.json():null)
      .then(r=>{if(active)setCoverage(r);})
      .catch(()=>{if(active)setCoverage(null);});
    return()=>{active=false;};
  },[]);

  useEffect(()=>{
    if(!playing || frames.length===0)return;
    const timer=window.setInterval(()=>{
      if(!document.hidden)setCursor(i=>i<0||i>=frames.length-1?0:i+1);
    },1400);
    return()=>window.clearInterval(timer);
  },[playing,frames.length]);

  useEffect(()=>{
    if(!container.current||mapRef.current)return;
    let map:maplibregl.Map|undefined;
    try {
      maplibregl.setWorkerUrl('/vendor/maplibre/'+maplibregl.getVersion()+'/maplibre-gl-worker.mjs');
      map=new maplibregl.Map({
        container:container.current,
        style:'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center:[43,26],zoom:4,minZoom:2,maxZoom:10,
        attributionControl:MAP_ATTRIBUTION_OPTIONS,
        canvasContextAttributes:{powerPreference:'low-power',failIfMajorPerformanceCaveat:false},
        transformRequest:(url:string)=>url.includes('cartocdn.com')
          ?{url:'/api/proxy-tiles?url='+encodeURIComponent(url)}:{url},
      });
      mapRef.current=map;
      map.addControl(new maplibregl.NavigationControl({showCompass:false}),'bottom-left');
      map.on('load',()=>{
        if(!map)return;
        map.addSource('evolution-evidence',{type:'geojson',data:conflictGridGeoJson([])});
        map.addLayer({id:'evolution-glow',type:'circle',source:'evolution-evidence',paint:{
          'circle-radius':['interpolate',['linear'],['zoom'],2,29,5,48,8,65],
          'circle-color':['match',['get','band'],'violence','#f97373',
            'unrest','#ffcf70','#5fe3e5'],
          'circle-blur':0.8,'circle-opacity':0.22,
        }});
        map.addLayer({id:'evolution-cells',type:'circle',source:'evolution-evidence',paint:{
          'circle-radius':['interpolate',['linear'],['get','count'],1,9,4,15,12,23],
          'circle-color':['match',['get','band'],'violence','#fa6666',
            'unrest','#ffcb68','#71e7e8'],
          'circle-opacity':0.78,'circle-stroke-color':'#021018','circle-stroke-width':1.5,
        }});
        map.addLayer({id:'evolution-labels',type:'symbol',source:'evolution-evidence',
          layout:{'text-field':['to-string',['get','count']],
            'text-font':['Open Sans Bold'],'text-size':12,'text-allow-overlap':true},
          paint:{'text-color':'#07141e'},
        });
        map.on('click','evolution-cells',e=>{
          const f=e.features?.[0];if(!f||f.geometry.type!=='Point')return;
          const p=f.properties as {count:number;band:string}|null;
          const element=document.createElement('div');
          element.style.cssText='direction:rtl;font:12px system-ui;max-width:210px;line-height:1.65;color:#101820';
          element.textContent=String(p?.count||0)+' من عيّنة التقارير · '+
            (BAND_LABEL[p?.band||'']||'تصنيف آلي')+
            '. خلية تقريبية ٣ درجات، ليست جبهة أو سيطرة عسكرية.';
          new maplibregl.Popup({offset:12})
            .setLngLat(f.geometry.coordinates as [number,number])
            .setDOMContent(element).addTo(map!);
        });
        setReady(true);
      });
      map.on('error',event=>{if(event.error)setMapError(true);});
    }catch{setMapError(true);}
    return()=>{map?.remove();mapRef.current=null;setReady(false);};
  },[]);

  useEffect(()=>{
    const map=mapRef.current;
    if(ready&&map){
      const source=map.getSource('evolution-evidence') as maplibregl.GeoJSONSource|undefined;
      source?.setData(mapData);
    }
  },[ready,mapData]);
  useEffect(()=>{
    const map=mapRef.current;
    if(!ready||!map)return;
    const [w,s,e,n]=CONFLICT_FOCUS[focus].bounds;
    map.fitBounds([[w,s],[e,n]],{padding:45,maxZoom:6,duration:350});
  },[ready,focus]);

  return <main dir="rtl" className="min-h-dvh bg-[#07131c] text-[#ecf4f7]">
    <header className="border-b border-cyan-400/20 bg-[#091b27] px-4 py-3 sm:px-7">
      <div className="mx-auto flex max-w-[1540px] items-center justify-between gap-4">
        <div><div className="text-[11px] font-semibold tracking-[0.18em] text-cyan-300">M3TM / FUSION INTELLIGENCE</div>
          <h1 className="text-xl font-extrabold sm:text-2xl">تطوّر بلاغات النزاعات</h1>
          <p className="text-xs text-white/55">أطلس زمني تفاعلي · الشرق الأوسط والبحر الأحمر</p></div>
        <a href="/" className="rounded-lg border border-cyan-300/30 px-3 py-2 text-xs text-cyan-100 hover:bg-cyan-300/10">العودة للخريطة</a>
      </div>
    </header>
    <div className="mx-auto grid max-w-[1540px] gap-4 p-3 sm:p-5 lg:grid-cols-[minmax(320px,370px)_minmax(0,1fr)]">
      <aside className="min-w-0 space-y-3 rounded-xl border border-white/10 bg-[#0b1e29] p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-sm font-bold text-cyan-100">استكشاف زمني ومكاني</h2>
          <span className="text-[10px] text-amber-200">أدلة إعلامية لا جبهات</span>
        </div>
        <fieldset><legend className="mb-1.5 text-xs text-white/65">النطاق الجغرافي للعرض</legend>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.keys(CONFLICT_FOCUS) as ConflictFocus[]).map(id=><button
              type="button" key={id} aria-pressed={focus===id}
              onClick={()=>{setFocus(id);setCursor(-1);setPlaying(false);}}
              className={'min-h-9 rounded-md border px-2 py-1.5 text-[11px] '+
                (focus===id?'border-cyan-300/65 bg-cyan-300/15 text-cyan-100':'border-white/15 bg-white/5 text-white/65')}>
              {CONFLICT_FOCUS[id].label}</button>)}
          </div>
        </fieldset>
        <fieldset><legend className="mb-1.5 text-xs text-white/65">نافذة نشر المصدر</legend>
          <div className="grid grid-cols-4 gap-1">
            {PERIODS.map(p=><button type="button" key={p.hours}
              aria-pressed={period===p.hours} onClick={()=>setPeriod(p.hours)}
              className={'rounded-md border px-1 py-2 text-[11px] '+
                (period===p.hours?'border-cyan-300 bg-cyan-300/15':'border-white/15 bg-white/5')}>
              {p.label}</button>)}
          </div>
        </fieldset>
        <fieldset><legend className="mb-1.5 text-xs text-white/65">نوع التقرير المنشور</legend>
          <div className="grid grid-cols-2 gap-1.5">
            {KINDS.map(k=><button type="button" key={k.id}
              aria-pressed={kind===k.id} onClick={()=>{setKind(k.id);setCursor(-1);setPlaying(false);}}
              className={'rounded-md border px-2 py-2 text-xs '+
                (kind===k.id?'border-cyan-300 bg-cyan-300/15':'border-white/15 bg-white/5')}>
              {k.label}</button>)}
          </div>
        </fieldset>
        <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
          <div className="rounded-lg bg-cyan-200/10 p-2"><strong className="block text-lg text-cyan-200">{archive?.totalReportRows??'—'}</strong>إجمالي الفترة*</div>
          <div className="rounded-lg bg-white/5 p-2"><strong className="block text-lg">{selected?.recordedReports??'—'}</strong>تقارير الدفعة*</div>
          <div className="rounded-lg bg-white/5 p-2"><strong className="block text-lg">{selected?.sampledReports??'—'}</strong>العيّنة المعروضة</div>
        </div>
        <div className="rounded-lg border border-amber-300/25 bg-amber-300/5 p-2.5 text-[11px] leading-5 text-amber-100/90">
          <strong className="block">حدود الدلالة والتحقق</strong>
          البقع تمثل بلاغات مرمّزة تلقائيًا حسب زمن نشر الملف في خلايا تقريبية ٣ درجات.
          ليست خريطة سيطرة أو تقدم جبهات أو تحركات قوات أو إثبات مسؤولية.
          {sampled?' تُعرض عينة محدودة بأحدث ٢٠٠ سجل، ولا تمثل جميع أحداث النافذة.':''}
        </div>
        <div className="rounded-lg border border-white/10 p-2.5 text-[11px] leading-5 text-white/65">
          <p>الأرشيف: {loading==='ready'?'تقارير منشورة':loading==='loading'?'جارٍ الاسترجاع':'غير متاح؛ لا توجد بيانات مختلقة'}</p>
          <p>تغطية النوافذ: {coverage?.durable
            ?String(coverage.observedWindows??'—')+' / '+String(coverage.expectedWindows??'—')
            :'غير مثبتة؛ لا تعني غياب النزاع'}</p>
          <p>* الإجمالي وعدد تقارير الدفعة لكامل الشرق الأوسط ولكل الأنواع قبل التصفية.</p>
          <p>المصدر: <a href="https://www.gdeltproject.org/" rel="noopener noreferrer" target="_blank" className="text-cyan-200 underline">GDELT Events</a></p>
        </div>
        <section aria-label="الأدلة المصدرية للّقطة">
          <h3 className="text-sm font-bold">الأدلة المرتبطة باللقطة</h3>
          <p className="mt-1 text-[11px] text-white/60">روابط مصدرية لا تعني التحقق المستقل؛ الناشرون المتعددون قد ينقلون خبرًا واحدًا.</p>
          {selected?.sampleRows.length
            ?<div className="mt-2 max-h-[225px] space-y-2 overflow-auto">
              {selected.sampleRows.slice(0,12).map(row=><div key={row.id} className="rounded-md bg-white/5 p-2 text-[11px]">
                <div>{LABELS[row.category]||'ترميز خبري'} · {row.place||row.country||'موقع تقريبي'}</div>
                <div className="mt-1 flex justify-between gap-2 text-[10px] text-white/60">
                  <span>{row.publisherCoverage==='multi-source-report'?'عدة ناشرين':'ناشر واحد'}</span>
                  {row.url?<a href={row.url} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">فتح الأصل ↗</a>:<span>بلا رابط</span>}
                </div></div>)}
            </div>
            :<p className="mt-2 text-xs text-white/50">لا توجد تقارير في العيّنة لهذه اللقطة؛ لا يُستنتج انعدام أحداث.</p>}
        </section>
      </aside>
      <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0b1e29]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3 text-xs">
          <strong className="text-cyan-100">{CONFLICT_FOCUS[focus].label}</strong>
          <div className="flex gap-3"><span className="text-[#ff8b8b]">● عنف</span>
            <span className="text-[#ffcb68]">● اضطرابات</span><span className="text-[#71e7e8]">● تصريحات</span></div>
        </div>
        <div className="relative min-h-[350px] flex-1 bg-[#07131c] sm:min-h-[62vh]">
          <div ref={container} dir="ltr" aria-label="خريطة تجمّعات البلاغات التاريخية" className="absolute inset-0"/>
          {mapError?<div className="pointer-events-none absolute inset-x-4 top-4 rounded bg-black/80 p-2 text-xs text-amber-100">تعذّر تحميل جزء من خريطة الأساس أو WebGL؛ تبقى البيانات النصية متاحة.</div>:null}
          {loading!=='ready'?<div className="absolute bottom-5 right-5 rounded border border-white/15 bg-black/80 p-3 text-xs">
            {loading==='loading'?'جارٍ جلب الأرشيف…':'الأرشيف غير متاح حاليًا'}</div>:null}
        </div>
        <div className="border-t border-cyan-300/15 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2 text-xs">
            <strong>التسلسل الزمني للنشر</strong>
            <span className="font-mono text-cyan-200">{selected?formatTime(selected.time):'—'}</span>
          </div>
          <div aria-hidden="true" className="mt-2 flex h-12 items-end gap-0.5">
            {frames.map((frame,i)=><div key={frame.time}
              className={'min-w-[2px] flex-1 rounded-t-sm '+(i===index?'bg-cyan-200':'bg-cyan-400/35')}
              title={formatTime(frame.time)+' · '+frame.recordedReports+' تقريرًا مؤرشفًا'}
              style={{height:Math.max(5,Math.round(frame.recordedReports/peak*100))+'%'}}/>)}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button type="button" disabled={!frames.length}
              aria-label={playing?'إيقاف العرض الزمني':'تشغيل التسلسل الزمني'}
              onClick={()=>{if(!playing&&(cursor<0||cursor>=frames.length-1))setCursor(0);setPlaying(!playing);}}
              className="min-w-20 rounded-md border border-cyan-300/50 bg-cyan-300/10 px-3 py-2 text-xs disabled:opacity-40">
              {playing?'إيقاف':'▶ تشغيل'}</button>
            <input className="w-full accent-cyan-300" type="range" min={0}
              max={Math.max(0,frames.length-1)} step={1} disabled={!frames.length}
              value={Math.max(0,index)} aria-label="تحديد فترة نشر التقارير"
              onChange={e=>{setPlaying(false);setCursor(Number(e.target.value));}}/>
          </div>
          <p className="mt-2 text-[10px] leading-4 text-white/50">
            ارتفاع الأعمدة يعني عدد التقارير المؤرشفة في المنطقة بأكملها، لا توسّع السيطرة أو خسائر بشرية.
            الحركة تنقل الزمن المسجل، ولا تتنبأ بالمستقبل.</p>
        </div>
      </section>
    </div>
  </main>;
}
