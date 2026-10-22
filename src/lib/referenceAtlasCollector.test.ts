import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const script = new URL('../../tools/refresh-reference-atlas.mjs', import.meta.url).href;

function run(overrides: Record<string, string> = {}, status = 200, sourceState = 'ok') {
  const fixture = `
    globalThis.fetch = async (url, options) => {
      console.log(JSON.stringify({ request: { url, ...options, signal: undefined } }));
      return new Response(JSON.stringify({ provider:'iswn', version:1,
        contentKind:'reference_annotations', status:${JSON.stringify(sourceState)}, featureCount:29 }), { status:${status} });
    };
    await import(${JSON.stringify(script)});
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', fixture], {
    encoding: 'utf8', timeout: 5000,
    env: { ...process.env, REFERENCE_ATLAS_ORIGIN: 'https://m3tm-world-recovery.onrender.com',
      WORLD_MAP_REFRESH_TOKEN: 'r'.repeat(40), REFERENCE_ATLAS_TRIGGER: 'schedule', REFERENCE_ATLAS_MAJOR_EVENT_ID: '', ...overrides },
  });
  return { ...result, request: result.stdout.split('\n').filter(Boolean)
    .map(line => JSON.parse(line)).find(value => value.request)?.request };
}

describe('scheduled published atlas collector', () => {
  it('requires a collector credential for scheduled source acquisition, never anonymous polling', () => {
    const result = run();
    expect(result.status).toBe(0);
    expect(result.request.url).toBe('https://m3tm-world-recovery.onrender.com/api/reference-atlas');
    expect(result.request.headers).toEqual({ Accept: 'application/json', Authorization: `Bearer ${'r'.repeat(40)}`, 'X-M3TM-Atlas-Collect': '1' });
    expect(result.request.redirect).toBe('error');
  });
  it('fails closed when the 12-hour job lacks its collector token', () => {
    const result = run({ WORLD_MAP_REFRESH_TOKEN: '' });
    expect(result.status).not.toBe(0);
    expect(result.request).toBeUndefined();
  });
  it('retains configured collector authentication for a major event', () => {
    const token = 'r'.repeat(40);
    const result = run({ WORLD_MAP_REFRESH_TOKEN: token, REFERENCE_ATLAS_TRIGGER: 'repository_dispatch',
      REFERENCE_ATLAS_MAJOR_EVENT_ID: 'published-event:one' });
    expect(result.status).toBe(0);
    expect(result.request.headers).toMatchObject({ Authorization: `Bearer ${token}`, 'X-M3TM-Atlas-Collect': '1', 'X-M3TM-Atlas-Force': '1', 'X-M3TM-Atlas-Event-Id': 'published-event:one' });
  });
  it('never dispatches a major event without authentication or a stable event id', () => {
    for (const overrides of [{ WORLD_MAP_REFRESH_TOKEN: '', REFERENCE_ATLAS_MAJOR_EVENT_ID: 'published-event:one', REFERENCE_ATLAS_TRIGGER: 'schedule' },
      { REFERENCE_ATLAS_TRIGGER: 'repository_dispatch', REFERENCE_ATLAS_MAJOR_EVENT_ID: '' }]) {
      const result = run(overrides);
      expect(result.status).not.toBe(0);
      expect(result.request).toBeUndefined();
    }
  });
  it('fails a malformed configured credential instead of silently downgrading it', () => {
    const result = run({ WORLD_MAP_REFRESH_TOKEN: 'short' });
    expect(result.status).not.toBe(0);
    expect(result.request).toBeUndefined();
  });
  it('rejects unallowlisted origins before sending a collector credential', () => {
    const result = run({ REFERENCE_ATLAS_ORIGIN: 'https://example.org', WORLD_MAP_REFRESH_TOKEN: 'r'.repeat(40) });
    expect(result.status).not.toBe(0);
    expect(result.request).toBeUndefined();
  });
  it('honors server authorization failures rather than bypassing a restored invitation gate', () => {
    expect(run({}, 403).status).not.toBe(0);
  });
  it('reports retained stale data as a failed source check', () => {
    expect(run({}, 200, 'stale').status).not.toBe(0);
  });
});
