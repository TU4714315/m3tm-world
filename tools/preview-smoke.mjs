// Isolated production-browser smoke test. No runtime dependency or user profile.
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.env.PREVIEW_URL || 'http://127.0.0.1:3001';
const scenario = process.env.SMOKE_SCENARIO || 'startup';
// A single read-only deployed APP check is permitted on an isolated CI runner.
const liveAppProbe = process.env.CI === 'true' && scenario === 'app-frame' && new URL(url).href === 'https://m3tm.app/';
const liveWorldProbe = process.env.CI === 'true' && scenario === 'world-live' &&
  new URL(url).origin === 'https://m3tm-world-recovery.onrender.com';
const smokeMobile = process.env.SMOKE_MOBILE === '1';
if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname) && !liveAppProbe && !liveWorldProbe) {
  throw new Error('This smoke test only accepts localhost previews.');
}
const profile = await mkdtemp(join(tmpdir(), 'osiris-smoke-'));
const output = process.env.SMOKE_OUTPUT_DIR || profile;
await mkdir(output, { recursive: true });
const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--no-first-run', '--no-default-browser-check',
  ...(process.env.CI === 'true' ? ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : []),
  '--remote-debugging-pipe', `--user-data-dir=${profile}`, '--window-size=1440,1000', 'about:blank',
], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
const pending = new Map();
const errors = [];
const requests = [];
const requestUrls = new Map();
const network = new Map();
const warnings = [];
const checks = [];
const measurements = {};
let sequence = 0;
let buffer = '';
let session;
chrome.stdio[4].on('data', chunk => {
  buffer += chunk.toString();
  let end;
  while ((end = buffer.indexOf('\0')) !== -1) {
    const message = JSON.parse(buffer.slice(0, end));
    buffer = buffer.slice(end + 1);
    if (message.id) {
      const task = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) task?.reject(new Error(JSON.stringify(message.error)));
      else task?.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') {
      errors.push(message.params.exceptionDetails);
    } else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      errors.push(message.params.args.map(value => value.description || value.value));
    } else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'warning') {
      warnings.push(message.params.args.map(value => value.description || value.value));
    } else if (message.method === 'Network.requestWillBeSent') {
      requestUrls.set(message.params.requestId, message.params.request.url);
      network.set(message.params.requestId, { url: message.params.request.url, state: 'pending' });
    } else if (message.method === 'Network.responseReceived') {
      const record = network.get(message.params.requestId);
      if (record) record.status = message.params.response.status;
    } else if (message.method === 'Network.loadingFinished') {
      const record = network.get(message.params.requestId);
      if (record) record.state = 'complete';
    } else if (message.method === 'Network.loadingFailed') {
      const record = network.get(message.params.requestId);
      if (record) record.state = 'failed';
      requests.push({ ...message.params, url: requestUrls.get(message.params.requestId) });
    } else if (message.method === 'Fetch.requestPaused') {
      // Deterministic visual-test locations, confined to the localhost geo API.
      const location = scenario === 'buildings' ? { lat: 40.7128, lon: -74.006 } : { lat: 46.02, lon: 7.75 };
      const satelliteFixture = {
        satellites: Array.from({ length: 200 }, (_, i) => ({ name: `RENDER TEST ${i}`, noradId: String(90000 + i),
          lat: -60 + (i % 20) * 6, lng: -170 + Math.floor(i / 20) * 34, alt: 550, color: '#38bdf8', category: 'comms', mission: 'Render test' })),
        timestamp: new Date().toISOString(), total: 200, category_counts: { comms: 200 },
      };
      const payload = new URL(message.params.request.url).pathname === '/api/satellites'
        ? satelliteFixture : { status: 'success', city: 'Visual test location', ...location };
      void command('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
        body: Buffer.from(JSON.stringify(payload)).toString('base64'),
      }).catch(error => errors.push(String(error)));
    }
  }
});
function command(method, params = {}, sessionId = session) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    chrome.stdio[3].write(`${JSON.stringify({ id, method, params, sessionId: sessionId ?? undefined })}\0`);
  });
}
async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function check(name, expression) {
  checks.push({ name, passed: Boolean(await evaluate(expression)) });
}
async function click(label) {
  await evaluate(`(() => { const button = [...document.querySelectorAll('button')].find(b => [b.getAttribute('aria-label'), b.getAttribute('title'), b.textContent.trim()].some(text => text?.toLowerCase() === ${JSON.stringify(label.toLowerCase())})); if (!button) throw new Error('Missing button: ' + ${JSON.stringify(label)}); button.scrollIntoView({block: 'nearest'}); button.click(); })()`);
}
async function openDisplay() {
  if (scenario === 'mobile') { await click('LAYERS'); await pause(400); }
  else if (!await evaluate(`document.querySelector('button[title="DISPLAY"]')?.getAttribute('aria-expanded') === 'true'`)) { await click('DISPLAY'); await pause(250); }
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const deadline = setTimeout(() => {
  console.error('Browser test timed out');
  chrome.kill();
  process.exitCode = 1;
}, liveAppProbe || liveWorldProbe ? 280_000 : 100_000);
try {
  const { targetId } = await command('Target.createTarget', { url: 'about:blank' });
  ({ sessionId: session } = await command('Target.attachToTarget', { targetId, flatten: true }));
  await command('Page.bringToFront');
  await command('Emulation.setFocusEmulationEnabled', { enabled: true });
  await command('Runtime.enable');
  await command('Page.enable');
  await command('Network.enable');
  const system = await command('SystemInfo.getInfo', {}, null);
  measurements.graphics = { devices: system.gpu.devices, renderer: system.gpu.auxAttributes?.glRenderer, features: system.gpu.featureStatus };
  if (['imagery', 'buildings', 'terrain-camera'].includes(scenario)) await command('Fetch.enable', { patterns: [{ urlPattern: `${new URL(url).origin}/api/geo*` }] });
  if (scenario === 'satellites') await command('Fetch.enable', { patterns: [{ urlPattern: `${new URL(url).origin}/api/satellites` }] });
  await command('Page.addScriptToEvaluateOnNewDocument', { source: `window.__previewLongTasks = []; new PerformanceObserver(list => { for (const e of list.getEntries()) window.__previewLongTasks.push({start: Math.round(e.startTime), ms: Math.round(e.duration)}); }).observe({type: 'longtask', buffered: true});` });
  if (liveAppProbe) await command('Page.addScriptToEvaluateOnNewDocument', { source: `window.__publishedWorldReady=[]; window.addEventListener('message',event=>{
    if(event.origin==='https://m3tm-world-recovery.onrender.com' && event.source===document.querySelector('iframe[data-testid="m3tm-world-frame"]')?.contentWindow
      && event.data?.source==='m3tm-world' && event.data?.type==='m3tm:ready' && event.data?.version===1) window.__publishedWorldReady.push({origin:event.origin,at:Date.now()});
  });` });
  if (scenario === 'recovery') await command('Network.setBlockedURLs', { urls: [`${new URL(url).origin}/dark-matter-style.json*`] });
  await command('Emulation.setDeviceMetricsOverride', scenario === 'mobile' || smokeMobile
    ? { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }
    : { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await command('Page.navigate', { url });
  if (process.env.PROBE_MAP_NETWORK) {
    const probe = await command('Runtime.evaluate', {
      expression: `Promise.all(['https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json','https://tiles.basemaps.cartocdn.com/vector/carto.streets/v1/tiles.json','https://tiles-a.basemaps.cartocdn.com/vectortiles/carto.streets/v1/2/2/1.mvt','https://s3.amazonaws.com/elevation-tiles-prod/terrarium/10/531/363.png'].map(async url => { try { const r = await fetch(url, {signal: AbortSignal.timeout(12000)}); return {url, status:r.status, bytes:(await r.arrayBuffer()).byteLength}; } catch(e) { return {url, error:String(e)}; } }))`,
      awaitPromise: true, returnByValue: true,
    });
    console.log('Network probe:', JSON.stringify(probe.result));
  }
  // Wait for asynchronous module workers, style loading and initial data layers.
  await new Promise(resolve => setTimeout(resolve, 25_000));
  if (process.env.PROFILE_TERRAIN) { await command('Profiler.enable'); await command('Profiler.start'); }
  if (liveAppProbe) {
    for (let i=0;i<85 && !await evaluate(`window.__publishedWorldReady?.length>0`);i++) await pause(1000);
    measurements.publishedApp = await evaluate(`({frame:document.querySelector('iframe[data-testid="m3tm-world-frame"]')?.src,
      readyMessages:window.__publishedWorldReady, unavailable:!!document.querySelector('[data-testid="m3tm-world-unavailable"]'),
      newsCards:document.querySelectorAll('.gate1-news-panel article').length, visibility:document.visibilityState})`);
    // The top-level APP can be healthy while its isolated WORLD iframe hangs.
    // CDP frame tree is non-invasive and discloses the frame navigation URL
    // without bypassing cross-origin restrictions or reading private content.
    measurements.frameTree = await command('Page.getFrameTree').then(x=>x.frameTree).catch(e=>({error:String(e)}));
    measurements.chromeTargets = await command('Target.getTargets', {}, null)
      .then(x=>(x.targetInfos||[]).filter(t=>t.type==='iframe'||t.type==='page')
        .map(t=>({type:t.type,url:t.url,attached:t.attached,openerId:t.openerId})))
      .catch(e=>({error:String(e)}));
    // Inspect the public WORLD out-of-process iframe from isolated Chromium.
    // No credentials or private API content; only the public map's render state.
    const iframeTarget = await command('Target.getTargets', {}, null)
      .then(x=>(x.targetInfos||[]).find(t=>t.type==='iframe' && t.url.startsWith('https://m3tm-world-recovery.onrender.com/')))
      .catch(()=>null);
    if (iframeTarget) {
      try {
        const attached = await command('Target.attachToTarget',{targetId:iframeTarget.targetId,flatten:true},null);
        await command('Runtime.enable',{},attached.sessionId);
        const status = await command('Runtime.evaluate',{
          expression:"({url:location.href,state:document.readyState,body:document.body?.innerText?.slice(0,480),scripts:document.scripts.length,canvases:[...document.querySelectorAll('.maplibregl-canvas')].map(c=>({w:c.width,h:c.height})),iframeContext:window.parent!==window})",
          returnByValue:true
        },attached.sessionId);
        measurements.iframeRuntime = status.result?.value ?? {error:status.exceptionDetails?.text};
        await command('Target.detachFromTarget',{sessionId:attached.sessionId},null).catch(()=>{});
      } catch(e) { measurements.iframeRuntime={error:String(e)}; }
    }

    measurements.frameLoadingState = await evaluate("({frameReady:document.querySelector('iframe[data-testid=\\\"m3tm-world-frame\\\"]')?.contentDocument?.readyState||'cross-origin',frameLoadedPerformance:performance.getEntriesByType('resource').filter(x=>x.name.includes('m3tm-world-recovery.onrender.com')).map(x=>({name:x.name,start:x.startTime,duration:x.duration,responseEnd:x.responseEnd})).slice(0,4)})");
    measurements.browserResponses = [...network.values()]
      .filter(x=>/m3tm-world|_next|api\/news/.test(x.url))
      .slice(0,35);
    measurements.documentProgress = await evaluate("({state:document.readyState,timing:performance.now(),frameCount:window.frames.length,mode3D:document.body.textContent.includes('3D'),framePresent:!!document.querySelector('iframe[data-testid=\\\"m3tm-world-frame\\\"]')})");

    await check('Deployed APP receives map-ready from its exact WORLD frame', `window.__publishedWorldReady?.length>0 && !document.querySelector('[data-testid="m3tm-world-unavailable"]')`);
    await check('Published frame remains on its fixed trusted origin', `document.querySelector('iframe[data-testid="m3tm-world-frame"]')?.src==='https://m3tm-world-recovery.onrender.com/?embed=1&surface=public'`);
    await check('Published news has one publisher link per card', `(()=>{const cards=[...document.querySelectorAll('.gate1-news-panel article')];return cards.length>0 && cards.every(card=>card.querySelectorAll('a').length===1)})()`);
  } else if (liveWorldProbe) {
    // A real Chromium loads the public deployed WORLD runtime. No API fixtures
    // and no internal credentials. Keep external-source failures observable.
    for (let i = 0; i < 25 && !await evaluate("!!document.querySelector('.world-news-ticker')"); i++) await pause(1000);
    // Differentiate a delayed Next.js RSC/client bootstrap from a map failure.
    for (let i = 0; i < 105 && !await evaluate("!!document.querySelector('.maplibregl-canvas') && !/جارٍ تجهيز الخريطة العامة|تعذر تحميل النمط الأساسي/.test(document.body.innerText)"); i++) await pause(1000);
    measurements.bootstrap = await evaluate("({state:document.readyState,scriptCount:document.scripts.length,externalScripts:[...document.scripts].map(s=>s.src).filter(Boolean).slice(0,18),hasNextData:!!document.getElementById('__NEXT_DATA__'),nextScripts:[...document.querySelectorAll('link[rel=modulepreload],link[rel=preload]')].length,reactRoot:!!document.getElementById('__next'),title:document.title,elapsedMs:Math.round(performance.now())})");
    measurements.responseLedger = [...network.values()].filter(x => /_next|api\/news|maplibre/.test(x.url)).slice(0,28);
    const state = await evaluate("({headlineLinks:[...document.querySelectorAll('.world-news-ticker a[href*=\"story=\"]')].map(a=>({url:a.href,title:a.textContent.trim()})),tickerText:document.querySelector('.world-news-ticker')?.innerText?.slice(0,1200),canvas:[...document.querySelectorAll('.maplibregl-canvas')].map(c=>({w:c.width,h:c.height})),embed:document.querySelector('.world-news-ticker')?.getAttribute('data-embed'),title:document.title})");
    measurements.publishedWorld = state;
    await check('Published WORLD renders the branded expanded ticker', "document.querySelector('.world-news-ticker')?.innerText.includes('M3TM')");
    await check('Ticker links only to M3TM.APP internal story URLs', "(()=>{const links=[...document.querySelectorAll('.world-news-ticker a')];return links.length>0 && links.every(a=>a.href.startsWith('https://m3tm.app/news'))})()");
    await check('WORLD uses a real MapLibre canvas, not a placeholder', "!![...document.querySelectorAll('.maplibregl-canvas')].find(c=>c.width>0&&c.height>0)");
    await check('Published basemap leaves the loading overlay and is ready for use', "!!document.querySelector('.maplibregl-canvas') && !/جارٍ تجهيز الخريطة العامة|تعذر تحميل النمط الأساسي|تعذر رسم الخريطة/.test(document.body.innerText)");
    await check('Public WORLD stays separate from private OSINT', "!document.body.innerText.includes('Scan Target') && !document.body.innerText.includes('Port Scanner')");
    await check('Arabic right-to-left document direction', "document.documentElement.dir==='rtl' || document.querySelector('main')?.getAttribute('dir')==='rtl' || getComputedStyle(document.body).direction==='rtl'");
    if (!smokeMobile && !url.includes('embed=1')) {
      const hasDesktopStyle = await evaluate("!!document.querySelector('button[title=\"الوضع الليلي\"]') && !!document.querySelector('button[title=\"عرض الأقمار الصناعية\"]')");
      checks.push({name:'Both geographic and satellite controls are present',passed:hasDesktopStyle});
      if (hasDesktopStyle) {
        await click('الوضع الليلي'); await pause(3800);
        await check('Night basemap switch changes active control without dropping canvas', "document.querySelector('button[title=\"الوضع الليلي\"]')?.getAttribute('aria-pressed')==='true' && document.querySelectorAll('.maplibregl-canvas').length===1");
        await click('عرض الأقمار الصناعية'); await pause(3800);
        await check('Satellite switch restores active map without dropping canvas', "document.querySelector('button[title=\"عرض الأقمار الصناعية\"]')?.getAttribute('aria-pressed')==='true' && document.querySelectorAll('.maplibregl-canvas').length===1");
      }
      // Desktop layer groups are intentionally collapsed. Open the published
      // conflict group through the visible control before testing a child.
      await evaluate("(()=>{const b=[...document.querySelectorAll('button')].find(el=>el.title==='الحروب والأحداث العامة');b?.click();return !!b})()");
      await pause(400);
      const toggle = await evaluate("document.querySelector('button[aria-label=\"تنبيهات ميدانية منشورة\"]')?.getAttribute('aria-pressed')");
      measurements.alertToggleBefore = toggle ?? null;
      if (toggle != null) {
        await click('تنبيهات ميدانية منشورة'); await pause(350);
        await check('Field-alert layer switch changes state', "[...document.querySelectorAll(\"button\")].find(b=>b.getAttribute(\"aria-label\")===\"تنبيهات ميدانية منشورة\")?.getAttribute(\"aria-pressed\")!=="+JSON.stringify(toggle));
        await click('تنبيهات ميدانية منشورة');
      } else checks.push({name:'Public field-alert switch is reachable',passed:false});
    }
    measurements.liveAssets = await evaluate("({mapTiles:performance.getEntriesByType('resource').filter(e=>/World_Imagery|cartocdn|tiles/.test(e.name)).length,viewport:window.innerWidth,overflow:document.documentElement.scrollWidth>window.innerWidth})");
    await check('No horizontal overflow in deployed WORLD viewport', "document.documentElement.scrollWidth <= window.innerWidth+2");
    if (!smokeMobile && !url.includes('embed=1')) {
      const firstLink = measurements.publishedWorld.headlineLinks?.[0]?.url;
      if (firstLink) {
        const beforeStory = await command('Page.captureScreenshot', { format: 'png' });
        await writeFile(join(output, 'world-before-story.png'), Buffer.from(beforeStory.data, 'base64'));
        const requestedId = new URL(firstLink).searchParams.get('story');
        await command('Page.navigate', { url: firstLink });
        for (let i=0; i<20 && !await evaluate("!!document.querySelector('[data-news-id]')"); i++) await pause(1000);
        measurements.storyNavigation = await evaluate("({url:location.href,cards:document.querySelectorAll('[data-news-id]').length,selected:[...document.querySelectorAll('[data-news-id].is-linked')].map(e=>e.getAttribute('data-news-id'))})");
        await check('Approved WORLD headline opens its exact public APP card', "(()=>{const id=new URLSearchParams(location.search).get('story');return id==="+JSON.stringify(requestedId)+"&&!![...document.querySelectorAll('[data-news-id].is-linked')].find(e=>e.getAttribute('data-news-id')===id)})()" );
      } else {
        checks.push({ name: 'A published APP headline is available for real deep-link verification', passed: false });
      }
    }
  } else if (scenario === 'recovery') {
    await check('Failed style shows recovery state', `document.querySelector('[data-map-status]')?.dataset.mapStatus === 'error' && document.body.innerText.includes('Retry map')`);
    await command('Network.setBlockedURLs', { urls: [] });
    measurements.retryVisibility = await evaluate(`({hidden: document.hidden, state: document.visibilityState})`);
    await command('Page.bringToFront');
    await click('Retry map');
    const retryStarted = Date.now();
    while (Date.now() - retryStarted < 25_000 && !await evaluate(`document.querySelector('[data-map-status]')?.dataset.mapStatus === 'ready'`)) await pause(250);
    measurements.recoveryMs = Date.now() - retryStarted;
    await check('Retry restores one working map', `document.querySelector('[data-map-status]')?.dataset.mapStatus === 'ready' && document.querySelectorAll('.maplibregl-canvas').length === 1`);
  } else {
    if (scenario === 'yemen') {
      await check('Fresh map finishes loading', `(() => {
        const root=document.querySelector('[data-map-projection][data-map-camera]');
        const camera=JSON.parse(root?.dataset.mapCamera || '{}');
        const canvas=root?.querySelector('.maplibregl-canvas');
        return Number.isFinite(camera.lat) && Number.isFinite(camera.lng) && canvas?.width>0 && canvas?.height>0;
      })()`);
      await check('Globe projection is actually initialized', `document.querySelector('[data-map-projection]')?.dataset.mapProjection === 'globe'`);
    } else {
      await check('Fresh map finishes loading', `document.querySelector('[data-map-status]')?.dataset.mapStatus === 'ready'`);
      await check('Globe projection is actually initialized', `document.querySelector('[data-map-status]')?.dataset.mapProjection === 'globe'`);
    }
    await check('Terrain is not fetched during startup', `!performance.getEntriesByType('resource').some(r => r.name.includes('elevation-tiles-prod'))`);
    if (scenario === 'yemen') {
      const response = await fetch(new URL('/api/reference-atlas', url), { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`Published areas HTTP${response.status}`);
      const snapshot = await response.json();
      const areas = snapshot.features?.features?.filter(f => ['Polygon','MultiPolygon'].includes(f.geometry?.type)) || [];
      measurements.yemenAreas = {
        houthi: areas.filter(f => /ansar\s*allah|houthi/i.test(f.properties?.name)).length,
        government: areas.filter(f => /\bhadi\b|yemeni? government/i.test(f.properties?.name)).length,
        sourcePublishedAt: snapshot.sourcePublishedAt,
        fetchedAt: snapshot.fetchedAt,
      };
      checks.push({ name: 'Published Yemen regions available across publisher folders', passed: measurements.yemenAreas.houthi > 0 && measurements.yemenAreas.government > 0 });
      await click('رصد اليمن');
      await pause(10000);
      await check('Yemen focus reaches the intended camera on a working flat map', `(() => {
        const element=document.querySelector('[data-map-projection][data-map-camera]');
        const camera=JSON.parse(element?.dataset.mapCamera || '{}');
        return element?.dataset.mapProjection === 'mercator' && element.querySelector('.maplibregl-canvas')?.width>0
          && Math.abs(camera.lat-15.6)<0.2 && Math.abs(camera.lng-47.5)<0.2 && camera.zoom>=5.4;
      })()`);
      await check('Yemen view retains news and no invitation prompt', `!document.body.innerText.includes('كود الدعوة') && document.querySelectorAll('.maplibregl-canvas').length===1`);
      await evaluate(`(() => {
        const summary=[...document.querySelectorAll('summary')].find(node=>node.textContent.includes('دليل الرموز'));
        if (!summary) throw new Error('Missing symbol legend');
        if (!summary.parentElement.open) summary.click();
      })()`);
      await check('Public legend retains both affiliations without folder dates or system explanations', `(() => {
        const legend=[...document.querySelectorAll('details')].find(node=>node.querySelector('summary')?.textContent.includes('دليل الرموز'));
        return legend?.open && legend.innerText.includes('مناطق الحوثيين') && legend.innerText.includes('مناطق الحكومة')
          && !/نفوذ منشور بتاريخ|2024-06-02|ليست حصرًا|أطلس المصدر/.test(legend.innerText);
      })()`);

    }
    if (scenario === 'zoom') {
      await openDisplay();
      const zoom = () => evaluate(`Number(document.body.innerText.match(/ZOOM\\s+([\\d.]+)/)?.[1])`);
      measurements.beforeZoom = await zoom();
      for (let i = 0; i < 3; i++) { await click('Zoom in'); await pause(60); }
      await pause(1000);
      measurements.afterRapidZoom = await zoom();
      checks.push({ name: 'Three rapid zoom taps preserve all three steps', passed: Math.abs(measurements.afterRapidZoom - measurements.beforeZoom - 3) < 0.15 });
      await click('3D Terrain');
      await pause(2000);
      for (let i = 0; i < 12; i++) { await click(i % 2 ? '2D Map' : '3D Terrain'); await pause(80); }
      await pause(2000);
      await check('Rapid projection switching keeps one usable map', `document.querySelector('[data-map-status]')?.dataset.mapStatus === 'ready' && document.querySelectorAll('.maplibregl-canvas').length === 1`);
      await check('Final flat projection is applied', `document.querySelector('[data-map-status]')?.dataset.mapProjection === 'mercator'`);
      measurements.longTasks = await evaluate('window.__previewLongTasks');
      measurements.heap = await command('Runtime.getHeapUsage');
    }
    if (scenario === 'terrain-camera') {
      await openDisplay();
      const camera = () => evaluate(`JSON.parse(document.querySelector('[data-map-status]').dataset.mapCamera)`);
      const unchanged = (name, before, after) => checks.push({ name, passed: ['zoom', 'pitch', 'bearing', 'lat', 'lng'].every(key => Math.abs(before[key] - after[key]) < 0.00001) });
      measurements.overviewBefore = await camera();
      await click('3D Terrain'); await pause(1500);
      measurements.overviewAfter = await camera();
      unchanged('Enabling terrain at overview zoom leaves the camera alone', measurements.overviewBefore, measurements.overviewAfter);
      await click('3D Terrain'); await pause(500);
      for (let i = 0; i < 5; i++) { await click('Zoom in'); await pause(60); }
      await pause(2000);
      measurements.closeupBefore = await camera();
      await click('3D Terrain'); await pause(8000);
      measurements.closeupAfter = await camera();
      await check('Terrain is rendered for the close-up camera check', `document.body.innerText.includes('Terrain on')`);
      unchanged('Loading mountain elevation does not auto-zoom or tilt', measurements.closeupBefore, measurements.closeupAfter);
      await click('3D Terrain'); await pause(1500);
      measurements.disabled = await camera();
      unchanged('Disabling terrain preserves the chosen camera', measurements.closeupBefore, measurements.disabled);
      await click('2D Map'); await pause(750);
      measurements.flatBefore = await camera();
      await click('3D Terrain'); await pause(4000);
      measurements.flatAfter = await camera();
      unchanged('Enabling terrain from flat mode does not zoom or tilt', measurements.flatBefore, measurements.flatAfter);
    }
    if (scenario === 'mobile') {
      await openDisplay();
      await click('3D Terrain');
      await pause(1_500);
      await check('Mobile terrain selection remains zoom gated', `document.body.innerText.includes('Terrain at zoom 10+') && !performance.getEntriesByType('resource').some(r => r.name.includes('elevation-tiles-prod'))`);
      await check('Mobile viewport has no horizontal overflow', `document.documentElement.scrollWidth === window.innerWidth`);
      await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Zoom to terrain')?.scrollIntoView({block: 'nearest'})`);
      await pause(250);
    }
    if (scenario === 'terrain') {
      await openDisplay();
      await check('Terrain sits beside Buildings, not in the view strip', `!!document.querySelector('button[aria-label="3D Buildings"]') && !!document.querySelector('button[aria-label="3D Terrain"]') && !document.querySelector('button[title="3D Terrain Globe"]')`);
      await click('3D Terrain');
      await pause(1_500);
      await check('Globe terrain selection is zoom gated', `document.body.innerText.includes('Terrain at zoom 10+') && !performance.getEntriesByType('resource').some(r => r.name.includes('elevation-tiles-prod'))`);
      await click('Zoom to terrain');
      await pause(8_000);
      await check('Zoomed terrain finishes loading', `document.body.innerText.includes('Terrain on')`);
      const terrainScreenshot = await command('Page.captureScreenshot', { format: 'png' });
      await writeFile(join(output, 'terrain.png'), Buffer.from(terrainScreenshot.data, 'base64'));
      await click('3D Terrain');
      await pause(1_500);
      await check('Terrain toggles off without replacing the canvas', `document.querySelector('[data-map-status]')?.dataset.mapStatus === 'ready' && document.querySelectorAll('.maplibregl-canvas').length === 1 && !document.body.innerText.includes('Terrain on')`);
      const before = await evaluate(`performance.getEntriesByType('resource').filter(r => r.name.includes('elevation-tiles-prod')).length`);
      const reenableStarted = Date.now();
      await click('3D Terrain');
      while (Date.now() - reenableStarted < 12000 && !await evaluate(`document.body.innerText.includes('Terrain on')`)) await pause(200);
      measurements.terrainReenableMs = Date.now() - reenableStarted;
      const after = await evaluate(`performance.getEntriesByType('resource').filter(r => r.name.includes('elevation-tiles-prod')).length`);
      measurements.terrainRequestsBeforeReenable = before; measurements.terrainRequestsAfterReenable = after;
      checks.push({ name: 'Same-area re-enable reuses elevation cache', passed: after === before });
      await check('Cached re-enable finishes loading', `document.body.innerText.includes('Terrain on')`);
      await click('Ghost Protocol'); await pause(8000);
      await openDisplay();
      await check('Theme remount does not replay an earlier terrain zoom request', `document.querySelector('[data-map-status]')?.dataset.mapStatus === 'ready' && JSON.parse(document.querySelector('[data-map-status]').dataset.mapCamera).zoom < 10 && document.querySelector('button[aria-label="3D Terrain"]')?.getAttribute('aria-pressed') === 'true'`);
      await click('2D Map'); await pause(1000);
      await check('2D mode disables terrain and buildings', `document.querySelector('button[aria-label="3D Terrain"]')?.getAttribute('aria-pressed') === 'false' && document.querySelector('button[aria-label="3D Buildings"]')?.getAttribute('aria-pressed') === 'false'`);
    }
    if (scenario === 'imagery') {
      await openDisplay();
      await click('Day / Night Cycle');
      await click('3D Terrain'); await pause(500);
      await click('Zoom to terrain'); await pause(8000);
      for (let i = 0; i < 2; i++) { await click('Zoom in'); await pause(60); }
      await click('Satellite View'); await pause(8000);
      await check('Mountain terrain works with satellite imagery', `document.body.innerText.includes('Terrain on') && performance.getEntriesByType('resource').some(r => r.name.includes('World_Imagery'))`);
      measurements.longTasks = await evaluate('window.__previewLongTasks');
    }
    if (scenario === 'buildings') {
      await openDisplay();
      await click('Day / Night Cycle'); await click('3D Buildings');
      for (let i = 0; i < 8; i++) { await click('Zoom in'); await pause(60); }
      await pause(8000);
      await check('Building close-up keeps the map usable', `document.querySelector('[data-map-status]')?.dataset.mapStatus === 'ready' && document.querySelector('button[aria-label="3D Buildings"]')?.getAttribute('aria-pressed') === 'true'`);
      await check('Buildings reuse the existing vector tiles without elevation', `!performance.getEntriesByType('resource').some(r => /openfreemap|elevation-tiles-prod/.test(r.name))`);
      if (process.env.COMBINED_TERRAIN) {
        await click('3D Terrain'); await pause(7000);
        await check('Buildings and terrain work together on one canvas', `document.body.innerText.includes('Terrain on') && document.querySelector('button[aria-label="3D Buildings"]')?.getAttribute('aria-pressed') === 'true' && document.querySelectorAll('.maplibregl-canvas').length === 1`);
      }
    }
    if (scenario === 'satellites') {
      await click('SPACE TRACKING'); await pause(250); await click('All Satellites'); await pause(2000);
      await check('Satellite renderer receives the 200-object fixture', `document.querySelector('button[aria-label="All Satellites"]')?.textContent.includes('200')`);
      for (let i = 0; i < 8; i++) { await click('Zoom out'); await pause(60); }
      await pause(2000);
      for (let i = 0; i < 4; i++) { await click('2D Map'); await pause(750); await click('3D Globe'); await pause(750); }
      await check('Active satellite layer survives projection changes', `document.querySelector('[data-map-status]')?.dataset.mapStatus === 'ready' && document.querySelectorAll('.maplibregl-canvas').length === 1`);
    }
  }
  const result = await command('Runtime.evaluate', {
    expression: `JSON.stringify({title: document.title, text: document.body.innerText.slice(0, 6000), canvases: [...document.querySelectorAll('canvas')].map(c => ({width: c.width, height: c.height})), resources: performance.getEntriesByType('resource').filter(r => /maplibre|\\.js|\\.mjs|proxy-tiles/.test(r.name)).map(r => ({url: r.name, bytes: r.transferSize, duration: Math.round(r.duration)}))})`,
    returnByValue: true,
  });
  if (process.env.PROFILE_TERRAIN) {
    const { profile: cpu } = await command('Profiler.stop');
    await writeFile(join(output, 'terrain.cpuprofile'), JSON.stringify(cpu));
    const totals = new Map();
    cpu.samples?.forEach((id, i) => totals.set(id, (totals.get(id) ?? 0) + cpu.timeDeltas[i]));
    measurements.cpuTop = [...totals].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([id, us]) => ({ ms: Math.round(us / 1000), frame: cpu.nodes.find(n => n.id === id)?.callFrame }));
  }
  const visual = await command('Page.captureScreenshot', { format: 'jpeg', quality: 75 });
  await writeFile(join(output, 'visual.jpg'), Buffer.from(visual.data, 'base64'));
  const screenshot = await command('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(output, 'preview.png'), Buffer.from(screenshot.data, 'base64'));
  checks.push({ name: 'No camera or renderer failures', passed: !warnings.some(w => /Projection switch failed|TypeError|Satellite picking unavailable|Map initialization failed/.test(JSON.stringify(w))) });
  measurements.mapNetwork = [...network.values()].filter(r => /cartocdn|maplibre|dark-matter-style/.test(r.url));
  measurements.visibility = await evaluate(`({hidden: document.hidden, state: document.visibilityState})`);
  const report = { scenario, checks, measurements, page: JSON.parse(result.result.value), errors, warnings, failedRequests: requests, screenshot: join(output, 'preview.png') };
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ scenario, checks, measurements, errors, warnings, failedRequests: requests, report: join(output, 'report.json'), screenshot: report.screenshot }, null, 2));
  process.exitCode = errors.length || checks.some(c => !c.passed) ? 1 : 0;
} finally {
  clearTimeout(deadline);
  await command('Browser.close', {}, undefined).catch(() => {});
  chrome.kill();
}
