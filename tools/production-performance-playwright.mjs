// Read-only published Chromium/Playwright benchmark. No stored credentials,
// synthetic data, internal OSINT routes or private endpoints.
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const scenario = process.env.BENCH_SCENARIO || 'world-desktop';
const iterations = Math.min(5, Math.max(2, Number(process.env.BENCH_RUNS || 3)));
const output = process.env.BENCH_OUTPUT || 'production-benchmark';
const world = 'https://m3tm-world-recovery.onrender.com/';
const app = 'https://m3tm.app/';
if (!['world-desktop','world-mobile','app-iframe'].includes(scenario)) throw Error('Unapproved scenario');
await mkdir(output, {recursive:true});
const browser = await chromium.launch({
  executablePath:process.env.CHROME_PATH || '/usr/bin/google-chrome',
  headless:true,
  args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'],
});
const entries=[];
const numeric=(a,k)=>a.map(x=>x[k]).filter(Number.isFinite).sort((x,y)=>x-y);
const summary=(rows,key)=>{const n=numeric(rows,key);return n.length ? {
  n:n.length,min:n[0],mean:n.reduce((a,b)=>a+b,0)/n.length,
  median:n[Math.floor((n.length-1)/2)],
  p95:n[Math.max(0,Math.ceil(n.length*.95)-1)],
  max:n[n.length-1],
}:null};
for(let iteration=1;iteration<=iterations;iteration++){
  const mobile=scenario==='world-mobile';
  const context=await browser.newContext({
    viewport:mobile?{width:390,height:844}:{width:1365,height:850},
    deviceScaleFactor:mobile?2:1,
    isMobile:mobile,
    locale:'ar-SA',
    reducedMotion:'reduce',
  });
  const page=await context.newPage();
  const requests=[];
  const failures=[];
  const jsErrors=[];
  const started=Date.now();
  let lastStatus=null;
  page.on('requestfinished',r=>{const timing=r.timing();requests.push({
    url:r.url(),duration:timing.responseEnd??null,size:null,
  });});
  page.on('requestfailed',r=>failures.push({url:r.url(),error:r.failure()?.errorText}));
  page.on('pageerror',e=>jsErrors.push(e.message.slice(0,200)));
  const target=scenario==='app-iframe'?app:world+(scenario==='world-mobile'?'':'');
  await page.addInitScript(()=>{
    window.__m3tmPaintObserved={canvas:null,usable:null};
    const measure=()=>{
      if(!document.body)return;
      const canvas=document.querySelector('.maplibregl-canvas');
      if(!canvas || !canvas.width || !canvas.height)return;
      window.__m3tmPaintObserved.canvas ??= performance.now();
      if(!/جارٍ تجهيز الخريطة العامة|تعذر تحميل النمط الأساسي|تعذر رسم الخريطة/.test(document.body.innerText)){
        window.__m3tmPaintObserved.usable ??= performance.now();
      }
    };
    document.addEventListener('DOMContentLoaded',()=>{
      measure();
      const o=new MutationObserver(measure);
      o.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']});
      setInterval(measure,1000);
    });
  });
  let navigationError=null;
  try{const response=await page.goto(target,{waitUntil:'domcontentloaded',timeout:65000});lastStatus=response?.status()??null;}catch(e){navigationError=String(e).slice(0,250);}
  const isApp=scenario==='app-iframe';
  let frame=null;
  let readySignal=null;
  if(isApp){
    // Cross-origin frame is accessed only with supported public browser APIs.
    try{
      await page.locator('iframe[data-testid="m3tm-world-frame"]').waitFor({state:'attached',timeout:80000});
      const frameElement=await page.locator('iframe[data-testid="m3tm-world-frame"]').elementHandle();
      frame=await frameElement?.contentFrame();
    }catch(e){navigationError??=String(e).slice(0,220);}
  }
  let ready=false;
  const t0=Date.now();
  while(Date.now()-t0<110000){
    if(isApp){
      readySignal=await page.evaluate(()=>({
        unavailable:!!document.querySelector('[data-testid="m3tm-world-unavailable"]'),
        ready:!!document.querySelector('iframe[data-testid="m3tm-world-frame"]')&&!document.body.innerText.includes('الخريطة ثلاثية الأبعاد غير متاحة مؤقتًا'),
      })).catch(()=>null);
      if(!frame){
        frame=page.frames().find(f=>f.url().startsWith(world))??null;
      }
    }
    const f=isApp?frame:page.mainFrame();
    if(f) {
      ready=await f.evaluate(()=>{
        const c=document.querySelector('.maplibregl-canvas');
        return !!(c && c.width>0 && c.height>0) &&
          !/جارٍ تجهيز الخريطة العامة|تعذر تحميل النمط الأساسي|تعذر رسم الخريطة/.test(document.body.innerText);
      }).catch(()=>false);
      if(ready)break;
    }
    await page.waitForTimeout(1000);
  }
  const map=isApp?frame:page.mainFrame();
  let details={};
  if(map)details=await map.evaluate(async()=>{
    const perf=performance;
    const nav=perf.getEntriesByType('navigation')[0];
    const resource=perf.getEntriesByType('resource');
    const marker=window.__m3tmPaintObserved||{};
    const candidates=[...document.querySelectorAll('.maplibregl-canvas')];
    // rAF measures scheduler responsiveness, NOT GPU/WebGL present FPS.
    const deltas=[];let prev=0;let ticks=0;
    await new Promise(resolve=>{
      const start=performance.now();
      function sample(now){if(prev)deltas.push(now-prev);prev=now;ticks++;if(now-start<1600)requestAnimationFrame(sample);else resolve();}
      requestAnimationFrame(sample);
    });
    return{
      firstCanvasMs:marker.canvas??null,
      firstUsableMs:marker.usable??null,
      serverResponseStartMs:nav?.responseStart??null,
      domContentMs:nav?.domContentLoadedEventEnd??null,
      jsHeapBytes:performance.memory?.usedJSHeapSize??null,
      resources:resource.length,
      tileRequests:resource.filter(r=>/cartocdn|arcgis|maptiler|openmaptiles/.test(r.name)).length,
      resourceByHost:Object.entries(resource.reduce((m,r)=>{try{const h=new URL(r.name).hostname;m[h]=(m[h]||0)+1}catch{}return m},{})).sort((a,b)=>b[1]-a[1]).slice(0,12),
      // Key stages already marked by WORLD's runtime. These timestamps
      // distinguish JS/map constructor, style network load, map layer
      // registration and first usable frame without modifying production.
      worldRuntimeMarks:perf.getEntriesByType('mark')
        .filter(x=>x.name.startsWith('m3tm:'))
        .map(x=>({name:x.name,atMs:Math.round(x.startTime)})),
      worldRuntimeMeasures:perf.getEntriesByType('measure')
        .filter(x=>x.name.startsWith('m3tm:'))
        .map(x=>({name:x.name,durationMs:Math.round(x.duration)})),
      slowestResources:resource.filter(x=>x.responseEnd>0)
        .sort((a,b)=>(b.responseEnd-b.startTime)-(a.responseEnd-a.startTime))
        .slice(0,12).map(r=>({
          resource:r.name.includes('/_next/')?'_next/'+r.name.split('/_next/').pop()?.slice(0,80):
            r.name.replace(/([?&])(token|key|apikey|api_key)=[^&]+/gi,'$1$2=REDACTED').slice(0,130),
          ms:Math.round(r.responseEnd-r.startTime),
          transfer:r.transferSize??0,
          startedMs:Math.round(r.startTime),
        })),
      longTaskCount:perf.getEntriesByType('longtask').length,
      rafSchedulerHz:deltas.length*1000/(deltas.reduce((a,b)=>a+b,0)||1),
      canvasCount:candidates.length,
      direction:getComputedStyle(document.body).direction,
    };
  }).catch(e=>({probeError:String(e).slice(0,180)}));
  const capturedAt=Date.now();
  const row={scenario,iteration,pageStatus:lastStatus,elapsedWallMs:capturedAt-started,ready,
    ...details,networkRequests:requests.length,failedRequests:failures.length,
    javaScriptErrors:jsErrors.length,
    errors:jsErrors.slice(0,4),failedUrls:failures.slice(0,5),
    iframeReadySignal:readySignal,navigationError};
  entries.push(row);
  await page.screenshot({path:path.join(output,scenario+'-'+iteration+'.png'),fullPage:false,timeout:18000}).catch(()=>{});
  await context.close();
}
await browser.close();
const summaryFields=['firstCanvasMs','firstUsableMs','serverResponseStartMs','elapsedWallMs',
  'networkRequests','failedRequests','tileRequests','jsHeapBytes','rafSchedulerHz'];
const report={scenario,iterations,successes:entries.filter(x=>x.ready).length,
  statistics:Object.fromEntries(summaryFields.map(k=>[k,summary(entries,k)])),entries,
  note:'rAF scheduler Hz is not actual MapLibre/WebGL rendered FPS; each iteration uses an isolated cold profile and identical CI SwiftShader settings.'};
await writeFile(path.join(output,scenario+'-report.json'),JSON.stringify(report,null,2));
console.log('PERFORMANCE_REPORT '+JSON.stringify(report));
if(report.successes!==iterations)process.exitCode=1;
