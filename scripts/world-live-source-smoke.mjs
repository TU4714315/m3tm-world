#!/usr/bin/env node
// Public, read-only production probe: no secrets, device searches or camera feeds.
// This script can verify API reachability and advertised source configuration;
// it cannot prove that MapLibre painted in a real browser.
import { writeFile } from 'node:fs/promises';

const BASE = 'https://m3tm-world-recovery.onrender.com';
const checks = [
  { name: 'world-home', path: '/', mode: 'head' },
  { name: 'network-provider-capability', path: '/api/cloudflare-radar?probe=1', mode: 'json' },
  { name: 'camera-region-index', path: '/api/cctv?catalog=regions', mode: 'json' },
];
const results = [];
for (const check of checks) {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 24_000);
  try {
    const response = await fetch(BASE + check.path, {
      method: check.mode === 'head' ? 'HEAD' : 'GET',
      signal: controller.signal,
      redirect: 'error',
      headers: { Accept: check.mode === 'json' ? 'application/json' : '*/*' },
    });
    const result = {
      check: check.name,
      status: response.status,
      elapsed_ms: Math.round(performance.now() - started),
      ok: response.ok,
    };
    if (response.ok && check.mode === 'json') {
      const value = await response.json();
      if (check.name === 'network-provider-capability') {
        result.configured = value.configured === true;
        result.fallback_available = value.fallback_available === true;
        result.valid = typeof value.configured === 'boolean' && typeof value.fallback_available === 'boolean';
      } else if (check.name === 'camera-region-index') {
        result.regions = Array.isArray(value.regions) ? value.regions.length : 0;
        result.westasia_available = Array.isArray(value.regions) && value.regions.includes('westasia');
        result.valid = result.westasia_available;
      }
    }
    if (check.mode === 'json' && result.ok && result.valid !== true) result.ok = false;
    results.push(result);
  } catch (error) {
    // Do not log raw response bodies or upstream URLs containing credentials.
    results.push({ check: check.name, ok: false, status: null,
      elapsed_ms: Math.round(performance.now() - started),
      error: error?.name === 'AbortError' ? 'timeout' : 'request_failed' });
  } finally {
    clearTimeout(timer);
  }
}
const report = {
  checked_at: new Date().toISOString(),
  target: BASE,
  scope: 'public-api-reachability-only',
  checks: results,
  limitation: 'No proof of CCTV stream play, regional outage events or map canvas rendering.',
};
await writeFile('world-live-source-smoke.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) {
  const markdown = [
    '### M3TM WORLD — public source reachability',
    '| Check | HTTP | Valid | Duration ms |',
    '|---|---:|---|---:|',
    ...results.map(r => `| ${r.check} | ${r.status ?? '—'} | ${r.ok ? 'yes' : 'no'} | ${r.elapsed_ms} |`),
    '',
    'Probe tests public endpoint availability, not camera footage, device positions or a painted MapLibre map.',
    '',
  ].join('\n');
  await writeFile(process.env.GITHUB_STEP_SUMMARY, markdown, { flag: 'a' });
}
if (results.some(r => !r.ok)) process.exitCode = 1;
